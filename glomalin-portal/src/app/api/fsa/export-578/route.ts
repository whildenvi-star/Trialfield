import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// GET /api/fsa/export-578?year=2026&confirmed_only=true
//
// Returns a CSV file containing clu_records for the given crop year.
// By default only includes reported=true records (confirmed in reconcile view).
// Format matches what Rock County FSA can import into their system:
// column names use FSA conventional identifiers where possible.
//
// The response is a download (Content-Disposition: attachment).
export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const yearParam       = searchParams.get('year')
  const confirmedOnly   = searchParams.get('confirmed_only') !== 'false'
  const cropYear        = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(cropYear)) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  let query = supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', cropYear)
    .order('farm_number')
    .order('tract_number')
    .order('clu')

  if (confirmedOnly) {
    query = query.eq('reported', true)
  }

  const { data: records, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also pull CLU boundary FSA attributes for the matching rows to include
  // original FSA field codes (CLUNBR, CALCACRES, etc.) in the export.
  const { data: boundaries } = await supabase
    .from('clu_boundaries')
    .select('farm_number, tract_number, clu_label, fsa_acres, fsa_attributes')
    .eq('crop_year', cropYear)

  // Build lookup: "farm::tract::clu" → boundary row
  const boundaryMap = new Map<string, { fsa_acres: number; fsa_attributes: Record<string, unknown> }>()
  for (const b of boundaries ?? []) {
    const key = `${b.farm_number}::${b.tract_number}::${b.clu_label}`
    boundaryMap.set(key, { fsa_acres: b.fsa_acres, fsa_attributes: b.fsa_attributes ?? {} })
  }

  // ── CSV build ────────────────────────────────────────────────────────────────

  const COLS = [
    // FSA-578 standard columns
    'FARM_NUMBER',
    'TRACT_NUMBER',
    'CLU_NUMBER',
    'FIELD_NAME',
    'CROP_YEAR',
    'COMMODITY',
    'INTENDED_USE',
    'PLANTED_ACRES',          // from clu_records.fsa_acres (producer-confirmed)
    'FSA_CALC_ACRES',         // from clu_boundaries.fsa_acres (shapefile)
    'SHARE_PCT',
    'IRRIGATION_PRACTICE',    // I = Irrigated, N = Non-irrigated
    'ORGANIC_PRACTICE',       // O = Organic, C = Conventional
    'COVER_CROP',             // Y / N
    'PREVENTED_PLANTING',     // Y / N
    'PLANT_DATE',
    'REPORTED_STATUS',        // CONFIRMED / PENDING
    // FSA shapefile passthrough (CALCACRES, TRACTNBR, etc.)
    'FSA_CLUNBR',
    'FSA_TRACTNBR',
    'FSA_FARMNBR',
    'FSA_CALCACRES',
  ]

  const rows: string[] = [COLS.join(',')]

  for (const r of records ?? []) {
    const bKey = `${r.farm_number}::${r.tract_number}::${r.clu}`
    const b    = boundaryMap.get(bKey)
    const fsa  = (b?.fsa_attributes ?? {}) as Record<string, unknown>

    const cells = [
      r.farm_number  ?? '',
      r.tract_number ?? '',
      r.clu          ?? '',
      csvQuote(r.field_name),
      String(cropYear),
      csvQuote(r.crop),
      csvQuote(r.use),
      r.fsa_acres != null ? r.fsa_acres.toFixed(2) : '',
      b?.fsa_acres   != null ? Number(b.fsa_acres).toFixed(2) : '',
      '100',
      r.irrigated         ? 'I' : 'N',
      r.organic           ? 'O' : 'C',
      r.cover_crop        ? 'Y' : 'N',
      r.prevented_planting ? 'Y' : 'N',
      csvQuote(r.grain_plant_date),
      r.reported ? 'CONFIRMED' : 'PENDING',
      // FSA shapefile passthrough fields
      csvQuote(fsa['CLUNBR']),
      csvQuote(fsa['TRACTNBR']),
      csvQuote(fsa['FARMNBR']),
      fsa['CALCACRES'] != null ? Number(fsa['CALCACRES']).toFixed(2) : '',
    ]

    rows.push(cells.join(','))
  }

  const csv     = rows.join('\r\n')
  const filename = `fsa-578-crop-year-${cropYear}${confirmedOnly ? '-confirmed' : ''}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}

function csvQuote(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
