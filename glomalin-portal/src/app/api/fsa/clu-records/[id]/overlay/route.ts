import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// GET /api/fsa/clu-records/[id]/overlay
//
// Returns a GeoJSON FeatureCollection of the three-layer Venn overlay for a
// single CLU record:
//   layer_type='clu'                 — the FSA CLU boundary polygon
//   layer_type='zone'                — management zones clipped to the CLU
//   layer_type='coverage'            — planting-pass coverage events clipped to CLU
//   layer_type='intersection_triple' — CLU ∩ zone ∩ coverage (highest certainty)
//
// Also returns a `summary` block derived from the features for the sidebar
// breakdown panel — avoids the client re-parsing the GeoJSON array.
//
// Called by OverlayMap when the user clicks a CLU in the left sidebar.

interface OverlayFeatureProps {
  layer_type: 'clu' | 'zone' | 'coverage' | 'intersection_triple'
  // zone props
  zone_id?: string
  zone_name?: string
  zone_crop?: string
  zone_irrigated?: boolean
  zone_organic?: boolean
  // coverage props
  event_id?: string
  op_date?: string
  product?: string
  source_adapter?: string
  applied_acres?: number
  // shared
  intersection_ac?: number
  // clu props
  clu_label?: string
  farm_number?: string
  tract_number?: string
  fsa_acres?: number
  crop?: string
  irrigated?: boolean
  organic?: boolean
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { data, error } = await supabase.rpc('get_clu_overlay_intersections', {
    p_clu_record_id: id,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Overlay RPC failed', details: error.message },
      { status: 500 }
    )
  }

  const features = (data ?? []) as Array<{ type: string; geometry: unknown; properties: OverlayFeatureProps }>

  // Build summary from features so the client sidebar doesn't need to parse GeoJSON
  const cluFeature = features.find((f) => f.properties.layer_type === 'clu')

  const zones = features
    .filter((f) => f.properties.layer_type === 'zone')
    .map((f) => ({
      zone_id:         f.properties.zone_id,
      zone_name:       f.properties.zone_name,
      zone_crop:       f.properties.zone_crop,
      zone_irrigated:  f.properties.zone_irrigated,
      zone_organic:    f.properties.zone_organic,
      intersection_ac: f.properties.intersection_ac,
      geojson:         JSON.stringify(f.geometry),
    }))

  const coverage = features
    .filter((f) => f.properties.layer_type === 'coverage')
    .map((f) => ({
      event_id:        f.properties.event_id,
      op_date:         f.properties.op_date,
      product:         f.properties.product,
      source_adapter:  f.properties.source_adapter,
      applied_acres:   f.properties.applied_acres,
      intersection_ac: f.properties.intersection_ac,
      geojson:         JSON.stringify(f.geometry),
    }))

  const triples = features
    .filter((f) => f.properties.layer_type === 'intersection_triple')
    .map((f) => ({
      zone_id:         f.properties.zone_id,
      zone_name:       f.properties.zone_name,
      zone_crop:       f.properties.zone_crop,
      zone_irrigated:  f.properties.zone_irrigated,
      zone_organic:    f.properties.zone_organic,
      event_id:        f.properties.event_id,
      op_date:         f.properties.op_date,
      product:         f.properties.product,
      intersection_ac: f.properties.intersection_ac,
      geojson:         JSON.stringify(f.geometry),
    }))

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    summary: {
      clu_fsa_acres:    cluFeature?.properties.fsa_acres ?? null,
      clu_crop:         cluFeature?.properties.crop ?? null,
      clu_irrigated:    cluFeature?.properties.irrigated ?? null,
      clu_organic:      cluFeature?.properties.organic ?? null,
      total_zone_ac:    zones.reduce((s, z) => s + (z.intersection_ac ?? 0), 0),
      total_coverage_ac:coverage.reduce((s, c) => s + (c.intersection_ac ?? 0), 0),
      zones,
      coverage,
      triples,
    },
  })
}
