import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { groupRpcRows, type ReconciliationRpcRow } from '@/lib/fsa/reconciliation'

// GET /api/fsa/reconciliation?farm=14903&year=2026
//
// Calls the get_farm_reconciliation() Postgres RPC and returns grouped rows:
// one ReconciliationRow per CLU, with zones nested as an array.
//
// Also returns a distinct list of farm numbers that have clu_boundaries data
// for the given year — used to populate the farm picker in the UI.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const farm = searchParams.get('farm')
  const yearParam = searchParams.get('year')
  const cropYear = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(cropYear)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  // Fetch available farm numbers for picker (always, regardless of farm filter)
  const { data: farmRows } = await supabase
    .from('clu_boundaries')
    .select('farm_number')
    .eq('crop_year', cropYear)
    .order('farm_number')

  const farms = Array.from(new Set((farmRows ?? []).map((r) => r.farm_number as string)))

  // If no farm selected, return just the farm list
  if (!farm) {
    return NextResponse.json({ farms, rows: [], crop_year: cropYear })
  }

  const { data, error } = await supabase.rpc('get_farm_reconciliation', {
    p_farm_number: farm,
    p_crop_year:   cropYear,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = groupRpcRows((data ?? []) as ReconciliationRpcRow[])

  // Summary stats
  const total    = rows.length
  const ok       = rows.filter((r) => r.status === 'ok').length
  const flagged  = rows.filter((r) => r.status === 'flagged').length
  const unresoled = rows.filter((r) => r.status === 'unresolved').length

  return NextResponse.json({
    farms,
    rows,
    crop_year: cropYear,
    farm,
    summary: { total, ok, flagged, unresolved: unresoled },
  })
}
