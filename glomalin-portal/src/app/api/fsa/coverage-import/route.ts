import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import {
  FieldOpsAdapter,
  normalizeGeoJsonCollection,
  type NormalizedCoverageEvent,
  type GeoJSONFeatureCollection,
} from '@/lib/fsa/adapters/fieldview'

// POST /api/fsa/coverage-import
//
// Accepts two import modes:
//   { source: 'fieldops', crop_year: 2026 }
//     — pulls live data from CNH FieldOps API (requires FIELDOPS_* env vars)
//   { source: 'geojson', crop_year: 2026, operation_type?: string, data: GeoJSONFeatureCollection }
//     — accepts a GeoJSON FeatureCollection export from any precision ag platform
//
// For each normalized event:
//   1. If geojson is present, call find_zone_for_geometry RPC to resolve zone_id
//   2. Call import_coverage_event RPC to insert with PostGIS geometry
//
// Returns { imported: N, zone_matched: N, unmatched: N, skipped: N, errors: string[] }

export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const source    = body['source'] as string | undefined
  const yearParam = body['crop_year'] as number | string | undefined
  const cropYear  = yearParam ? Number(yearParam) : CURRENT_CROP_YEAR

  if (!source || !['fieldops', 'geojson'].includes(source)) {
    return NextResponse.json(
      { error: 'source must be "fieldops" or "geojson"' },
      { status: 400 }
    )
  }

  // ── Normalize events from source ──────────────────────────────────────────

  let events: NormalizedCoverageEvent[] = []
  const warnings: string[] = []

  if (source === 'fieldops') {
    if (!FieldOpsAdapter.isConfigured()) {
      return NextResponse.json(
        {
          error: 'CNH FieldOps not configured',
          detail: 'Set FIELDOPS_CLIENT_ID, FIELDOPS_CLIENT_SECRET, and FIELDOPS_SUBSCRIPTION_KEY in your environment.',
        },
        { status: 422 }
      )
    }
    try {
      events = await FieldOpsAdapter.fetchEvents(cropYear)
      if (events.length === 0) {
        warnings.push(
          'FieldOps returned 0 events. This may indicate a dealership-linked account limitation — ' +
          'equipment enrolled under a dealership account is silently excluded from API results.'
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `FieldOps fetch failed: ${msg}` }, { status: 502 })
    }
  } else {
    // geojson upload
    const data = body['data'] as GeoJSONFeatureCollection | undefined
    if (!data || data.type !== 'FeatureCollection') {
      return NextResponse.json(
        { error: 'data must be a GeoJSON FeatureCollection' },
        { status: 400 }
      )
    }
    const opType = (body['operation_type'] as string | undefined) ?? 'application'
    try {
      events = normalizeGeoJsonCollection(data, cropYear, opType)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `GeoJSON parse failed: ${msg}` }, { status: 400 })
    }
  }

  // ── Insert events ─────────────────────────────────────────────────────────

  let imported      = 0
  let zoneMatched   = 0
  let unmatched     = 0
  let skipped       = 0
  const errors: string[] = []

  for (const event of events) {
    if (!event.crop_year || !event.source_adapter || !event.operation_type) {
      skipped++
      continue
    }

    // Resolve zone_id via spatial lookup if geometry is present
    let zoneId: string | null = event.zone_id ?? null

    if (!zoneId && event.geojson) {
      try {
        const { data: zoneData, error: zoneErr } = await supabase.rpc(
          'find_zone_for_geometry',
          { p_geojson: event.geojson }
        )
        if (!zoneErr && zoneData) {
          zoneId = zoneData as string
          zoneMatched++
        } else {
          unmatched++
        }
      } catch {
        unmatched++
      }
    } else if (!zoneId) {
      unmatched++
    }

    // Insert via RPC (geometry column requires ST_GeomFromGeoJSON, not plain insert)
    const { error: insertErr } = await supabase.rpc('import_coverage_event', {
      p_zone_id:        zoneId,
      p_crop_year:      event.crop_year,
      p_source_adapter: event.source_adapter,
      p_operation_type: event.operation_type,
      p_op_date:        event.op_date ?? '',
      p_geojson:        event.geojson ?? '',
      p_applied_acres:  event.applied_acres ?? null,
      p_product:        event.product ?? null,
      p_rate:           event.rate ?? null,
      p_rate_unit:      event.rate_unit ?? null,
      p_raw_payload:    event.raw_payload ?? {},
    })

    if (insertErr) {
      errors.push(`Insert failed: ${insertErr.message}`)
    } else {
      imported++
    }
  }

  return NextResponse.json({
    source,
    crop_year:    cropYear,
    total_events: events.length,
    imported,
    zone_matched: zoneMatched,
    unmatched,
    skipped,
    warnings,
    errors:       errors.slice(0, 20),   // cap error list to avoid huge responses
  })
}

// GET /api/fsa/coverage-import?year=2026
// Returns import summary from coverage_events_summary view.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const cropYear  = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  const { data, error } = await supabase
    .from('coverage_events_summary')
    .select('*')
    .eq('crop_year', cropYear)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    crop_year: cropYear,
    summary:   data ?? [],
    fieldops_configured: FieldOpsAdapter.isConfigured(),
  })
}
