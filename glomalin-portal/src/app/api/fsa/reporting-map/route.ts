import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { CluRecord } from '@/lib/fsa/calc'

type ReportingStatus = 'orange' | 'yellow' | 'green'

function deriveStatus(r: CluRecord): ReportingStatus {
  if (r.reported) return 'green'
  if (r.crop) return 'yellow'
  return 'orange'
}

interface BoundaryRow {
  farm_number: string
  tract_number: string
  clu_label: string
  geojson: Record<string, unknown> | null
}

interface FarmSummary {
  farm_number: string
  farm_name: string | null
  total: number
  green: number
  yellow: number
  orange: number
  bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

function flatCoords(geojson: Record<string, unknown>): [number, number][] {
  const pts: [number, number][] = []
  function walk(v: unknown) {
    if (!Array.isArray(v)) return
    if (typeof v[0] === 'number') { pts.push([v[0] as number, v[1] as number]); return }
    for (const c of v) walk(c)
  }
  walk(geojson.coordinates)
  return pts
}

export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  // Fetch CLU records and boundaries in parallel
  const [recordsRes, boundariesRes] = await Promise.all([
    supabase
      .from('clu_records')
      .select('*')
      .eq('crop_year', year)
      .order('farm_number')
      .order('tract_number')
      .order('clu'),
    supabase
      .from('clu_boundaries_geo')
      .select('farm_number, tract_number, clu_label, geojson')
      .eq('crop_year', year),
  ])

  if (recordsRes.error) {
    return NextResponse.json({ error: 'Failed to fetch CLU records', details: recordsRes.error.message }, { status: 500 })
  }

  // Boundary fetch errors are non-fatal — map renders with no polygons
  const records: CluRecord[] = recordsRes.data ?? []
  const boundaries: BoundaryRow[] = (boundariesRes.data ?? []) as BoundaryRow[]

  // Build boundary lookup: "farmNumber|tractNumber|cluLabel" → GeoJSON geometry
  const boundaryMap = new Map<string, Record<string, unknown>>()
  for (const b of boundaries) {
    if (b.geojson) {
      boundaryMap.set(`${b.farm_number}|${b.tract_number}|${b.clu_label}`, b.geojson)
    }
  }

  // Build GeoJSON features + farm summaries
  const features: unknown[] = []
  const farmMap = new Map<string, FarmSummary>()

  for (const r of records) {
    const status = deriveStatus(r)
    const key = `${r.farm_number}|${r.tract_number}|${r.clu}`
    const geometry = boundaryMap.get(key) ?? null

    // Farm summary
    if (!farmMap.has(r.farm_number)) {
      farmMap.set(r.farm_number, {
        farm_number: r.farm_number,
        farm_name: r.farm_name,
        total: 0,
        green: 0,
        yellow: 0,
        orange: 0,
        bounds: [Infinity, Infinity, -Infinity, -Infinity],
      })
    }
    const farm = farmMap.get(r.farm_number)!
    farm.total++
    farm[status]++

    // Expand farm bounds from geometry
    if (geometry) {
      const pts = flatCoords(geometry)
      for (const [lng, lat] of pts) {
        if (lng < farm.bounds[0]) farm.bounds[0] = lng
        if (lat < farm.bounds[1]) farm.bounds[1] = lat
        if (lng > farm.bounds[2]) farm.bounds[2] = lng
        if (lat > farm.bounds[3]) farm.bounds[3] = lat
      }

      features.push({
        type: 'Feature',
        geometry,
        properties: {
          id: r.id,
          farm_number: r.farm_number,
          tract_number: r.tract_number,
          clu: r.clu,
          field_name: r.field_name,
          farm_name: r.farm_name,
          crop: r.crop,
          grain_plant_date: r.grain_plant_date,
          fsa_acres: r.fsa_acres,
          reported: r.reported,
          organic: r.organic,
          prevented_planting: r.prevented_planting,
          status,
        },
      })
    }
  }

  // Clamp farms with no geometry to null bounds
  const farms: FarmSummary[] = Array.from(farmMap.values()).map((f) => ({
    ...f,
    bounds: isFinite(f.bounds[0]) ? f.bounds : [0, 0, 0, 0],
  }))

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    farms,
    year,
  })
}
