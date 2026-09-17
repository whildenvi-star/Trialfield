import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import shp from 'shpjs'
import { fetchRegistryService } from '@/app/api/mobile/_lib/proxy'

// ── DISABLED 2026-09-17 ─────────────────────────────────────────────
// This route replaces the WHOLE table on every upload:
//
//     .from('field_boundaries').delete().neq('id', '00000000-…')
//
// then inserts only the features it matched. That is fine for the one-off
// whole-farm load it was written for (all 51 boundaries arrived in a single
// burst on 2026-06-15), and wrong for the farm-by-farm imports we actually
// want: uploading one farm's zip would delete every other farm's boundary,
// with no version to restore from. field_boundary_history only records rows
// replaced through the per-field editor, not rows removed here.
//
// It stays disabled until the versioned flow replaces it — farm-scoped,
// .prj required, diff and validation before any write, effective from a
// chosen crop year, and a field missing from the file left alone rather than
// deleted. Scoped in recon/04-shape-import-scope.md.
//
// Nothing else is affected. Per-field edits (PUT /api/maps/boundaries/[id])
// soft-delete via is_deleted and write field_boundary_history, and
// GET /api/fsa/export-shapefile is untouched.
//
// The implementation below is left intact on purpose: the parsing, the
// registry name/alias matching and the centroid maths are all reusable by
// the replacement. Only the delete-then-insert tail has to go.
const IMPORT_DISABLED = true

const IMPORT_DISABLED_MESSAGE =
  'Shapefile import is disabled. This endpoint replaced every field boundary on ' +
  'the farm each time it ran, so importing one farm’s shapes would have deleted ' +
  'the others — with no saved version to restore from. Editing a single field’s ' +
  'boundary and exporting shapefiles both still work. A farm-by-farm import that ' +
  'keeps each version by crop year, and never removes a field that is simply ' +
  'absent from the file, is what will replace it.'

interface RegistryField {
  id: string
  name: string
  aliases?: string[]
}

interface BoundaryRow {
  registry_field_id: string
  name: string
  geojson: GeoJSON.Geometry
  centroid_lat: number
  centroid_lng: number
}

/**
 * Compute polygon centroid as the average of all outer ring coordinate pairs.
 * Handles both Polygon and MultiPolygon geometry types.
 */
function computeCentroid(
  geometry: GeoJSON.Geometry
): { lat: number; lng: number } | null {
  let allCoords: number[][] = []

  if (geometry.type === 'Polygon') {
    allCoords = geometry.coordinates[0]
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      allCoords = allCoords.concat(polygon[0])
    }
  } else {
    // Not a polygon geometry — cannot compute centroid
    return null
  }

  if (allCoords.length === 0) return null

  const count = allCoords.length
  const sumLng = allCoords.reduce((acc, c) => acc + c[0], 0)
  const sumLat = allCoords.reduce((acc, c) => acc + c[1], 0)

  return {
    lat: sumLat / count,
    lng: sumLng / count,
  }
}

/**
 * POST /api/maps/import
 *
 * Admin-only. Accepts a multipart/form-data request with a single file field
 * named "file" containing a .zip shapefile bundle (.shp + .dbf + .prj).
 *
 * Processing:
 * 1. Parse shapefile server-side using shpjs
 * 2. Fetch registry fields from farm-registry
 * 3. Match features to registry fields by name (case-insensitive)
 * 4. Delete ALL existing field_boundaries rows (full replace semantics)
 * 5. Insert matched rows with computed centroids
 * 6. Update farm_map_config with computed farm center
 *
 * Returns summary: { matched, updated, replaced, previousBoundariesCleared, unmatched, noGeometry, farmCenter }
 */
export async function POST(request: Request) {
  // Refused before anything is read, parsed or written — see IMPORT_DISABLED above.
  if (IMPORT_DISABLED) {
    return NextResponse.json(
      {
        error: IMPORT_DISABLED_MESSAGE,
        disabledSince: '2026-09-17',
        stillAvailable: [
          'PUT /api/maps/boundaries/[id] — edit one field’s boundary',
          'GET /api/fsa/export-shapefile — export',
        ],
      },
      { status: 503 }
    )
  }

  // --- Auth check ---
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Admin check ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // --- Parse multipart form data ---
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not parse multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 })
  }

  // --- Validate file type ---
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return NextResponse.json(
      { error: 'Only .zip shapefile bundles are accepted' },
      { status: 400 }
    )
  }

  // --- Parse shapefile ---
  const arrayBuffer = await file.arrayBuffer()
  let geojson: ReturnType<typeof shp> extends Promise<infer T> ? T : never
  try {
    geojson = await shp(arrayBuffer)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Shapefile parse failed', detail }, { status: 422 })
  }

  // Normalize to flat array of features
  const rawFeatures: GeoJSON.Feature[] = Array.isArray(geojson)
    ? geojson.flatMap((fc) => fc.features)
    : geojson.features

  // --- Fetch registry fields ---
  let registryFields: RegistryField[]
  try {
    const res = await fetchRegistryService('/api/fields')
    if (!res.ok) {
      return NextResponse.json(
        { error: `farm-registry returned ${res.status}` },
        { status: 502 }
      )
    }
    registryFields = await res.json()
  } catch {
    return NextResponse.json(
      { error: 'farm-registry service unavailable' },
      { status: 502 }
    )
  }

  // --- Build name → field lookup (lowercase, trimmed) ---
  const nameToField = new Map<string, RegistryField>()
  for (const field of registryFields) {
    nameToField.set(field.name.trim().toLowerCase(), field)
    for (const alias of field.aliases ?? []) {
      nameToField.set(alias.trim().toLowerCase(), field)
    }
  }

  // --- Match features to registry fields ---
  const rows: BoundaryRow[] = []
  const unmatched: string[] = []
  const matchedFieldIds = new Set<string>()

  for (const feature of rawFeatures) {
    const props = feature.properties ?? {}
    // SMS exports vary — try common property keys
    const rawName: unknown =
      props['Name'] ?? props['name'] ?? props['FIELD_NAME'] ?? props['field_name']

    const featureName =
      typeof rawName === 'string' ? rawName.trim() : `[unnamed feature]`

    const registryField = nameToField.get(featureName.toLowerCase())

    if (!registryField) {
      unmatched.push(featureName)
      continue
    }

    if (!feature.geometry) {
      unmatched.push(featureName)
      continue
    }

    const centroid = computeCentroid(feature.geometry)
    if (!centroid) {
      // Non-polygon geometry — skip but record as unmatched
      unmatched.push(featureName)
      continue
    }

    matchedFieldIds.add(registryField.id)
    rows.push({
      registry_field_id: registryField.id,
      name: registryField.name,
      geojson: feature.geometry,
      centroid_lat: centroid.lat,
      centroid_lng: centroid.lng,
    })
  }

  // --- noGeometry: registry fields with no incoming boundary ---
  const noGeometry = registryFields
    .filter((f) => !matchedFieldIds.has(f.id))
    .map((f) => f.name)

  // --- Get Supabase client for data operations ---
  // Use service role client to bypass RLS for DELETE + INSERT
  const adminClient =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : supabase

  // --- Full replace: DELETE ALL existing boundaries ---
  const { error: deleteError } = await adminClient
    .from('field_boundaries')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to clear existing boundaries', detail: deleteError.message },
      { status: 500 }
    )
  }

  // --- Insert matched rows ---
  let updated = 0
  if (rows.length > 0) {
    const { error: insertError } = await adminClient.from('field_boundaries').insert(rows)

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to insert new boundaries', detail: insertError.message },
        { status: 500 }
      )
    }
    updated = rows.length
  }

  // --- Compute and store farm center ---
  let farmCenter: { lat: number; lng: number } | null = null

  if (rows.length > 0) {
    const sumLat = rows.reduce((acc, r) => acc + r.centroid_lat, 0)
    const sumLng = rows.reduce((acc, r) => acc + r.centroid_lng, 0)
    farmCenter = {
      lat: sumLat / rows.length,
      lng: sumLng / rows.length,
    }

    await adminClient.from('farm_map_config').upsert({
      key: 'farm_center',
      value: { lat: farmCenter.lat, lng: farmCenter.lng, zoom: 13 },
      updated_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    matched: rows.length,
    updated,
    replaced: true,
    previousBoundariesCleared: true,
    unmatched,
    noGeometry,
    farmCenter,
  })
}
