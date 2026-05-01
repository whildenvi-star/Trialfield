import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// GET /api/fsa/zones?registry_field_id=fld_NNN&crop_year=2026
// Returns zones for a registry field with their year attributes joined.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const registryFieldId = searchParams.get('registry_field_id')
  const yearParam = searchParams.get('crop_year')
  const cropYear = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(cropYear)) {
    return NextResponse.json({ error: 'Invalid crop_year' }, { status: 400 })
  }

  // management_zones_geo view returns geojson as JSONB (ST_AsGeoJSON already applied)
  let query = supabase
    .from('management_zones_geo')
    .select('id, registry_field_id, name, geojson, organic_default, irrigated_default, notes, created_at, updated_at')
    .order('name')

  if (registryFieldId) {
    query = query.eq('registry_field_id', registryFieldId)
  }

  const { data: zones, error: zonesError } = await query

  if (zonesError) {
    return NextResponse.json({ error: zonesError.message }, { status: 500 })
  }

  if (!zones || zones.length === 0) {
    return NextResponse.json({ zones: [], count: 0, crop_year: cropYear })
  }

  // Fetch zone_year_attributes for the requested year in a single query
  const zoneIds = zones.map((z) => z.id)
  const { data: yearAttrs, error: yaError } = await supabase
    .from('zone_year_attributes')
    .select('*')
    .in('zone_id', zoneIds)
    .eq('crop_year', cropYear)

  if (yaError) {
    return NextResponse.json({ error: yaError.message }, { status: 500 })
  }

  const yearAttrByZoneId = new Map<string, Record<string, unknown>>()
  for (const ya of yearAttrs ?? []) {
    yearAttrByZoneId.set(ya.zone_id, ya)
  }

  const result = zones.map((zone) => ({
    ...zone,
    year_attrs: yearAttrByZoneId.get(zone.id) ?? null,
  }))

  return NextResponse.json({ zones: result, count: result.length, crop_year: cropYear })
}

// POST /api/fsa/zones
// Creates a new management zone and optionally its zone_year_attributes.
//
// Body:
//   registry_field_id  string   required
//   name               string   required
//   organic_default    boolean  default false
//   irrigated_default  boolean  default false
//   notes              string?
//   geojson            object?  GeoJSON Polygon geometry (WGS84)
//   crop_year          number?  if present, creates zone_year_attributes
//   crop               string?
//   organic            boolean?
//   irrigated          boolean?
//   cover_crop         boolean?
//   intended_use       string?
export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Role restriction enforced by RLS: mz_write_admin policy allows admin/agronomist only.

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { registry_field_id, name, organic_default, irrigated_default, notes, geojson, crop_year, crop, organic, irrigated, cover_crop, intended_use } = body as Record<string, unknown>

  if (!registry_field_id || typeof registry_field_id !== 'string') {
    return NextResponse.json({ error: 'registry_field_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Build zone insert — geometry is set via raw SQL if geojson is provided
  let zoneData: Record<string, unknown>

  if (geojson) {
    // Use ST_GeomFromGeoJSON to convert GeoJSON → PostGIS geometry.
    // Supabase client doesn't support raw SQL expressions in .insert(), so we
    // use an RPC that does the insert and returns the new row id.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'insert_management_zone_with_geometry',
      {
        p_registry_field_id: registry_field_id,
        p_name:              name,
        p_geojson:           JSON.stringify(geojson),
        p_organic_default:   organic_default ?? false,
        p_irrigated_default: irrigated_default ?? false,
        p_notes:             notes ?? null,
      }
    )
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }
    zoneData = { id: rpcData as string }
  } else {
    const { data, error } = await supabase
      .from('management_zones')
      .insert({
        registry_field_id,
        name,
        organic_default:  organic_default  ?? false,
        irrigated_default: irrigated_default ?? false,
        notes: notes ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    zoneData = { id: data.id }
  }

  const newZoneId = zoneData.id as string

  // Optionally create zone_year_attributes
  if (crop_year && typeof crop_year === 'number') {
    const { error: yaError } = await supabase
      .from('zone_year_attributes')
      .insert({
        zone_id:      newZoneId,
        crop_year,
        crop:         crop ?? null,
        organic:      organic ?? null,
        irrigated:    irrigated ?? null,
        cover_crop:   cover_crop ?? null,
        intended_use: intended_use ?? null,
      })

    if (yaError) {
      return NextResponse.json({ error: yaError.message }, { status: 500 })
    }
  }

  // Return the full zone record from the geo view
  const { data: zone, error: fetchError } = await supabase
    .from('management_zones_geo')
    .select('*')
    .eq('id', newZoneId)
    .single()

  if (fetchError) {
    return NextResponse.json({ zone: { id: newZoneId } }, { status: 201 })
  }

  return NextResponse.json({ zone }, { status: 201 })
}
