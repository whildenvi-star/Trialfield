import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// GET /api/fsa/clu-summary?policy_id=UUID&year=YYYY
//
// Returns FSA planted acres and reporting status for the insurance policy's
// farm + crop combination. Used by ClaimDrawer Financials tab to cross-reference
// insured acres against FSA-reported acres — no manual re-entry.
//
// Lookup chain: policy_id → insurance_policies (farm_number, crop) → clu_records
export async function GET(request: Request) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const policyId = searchParams.get('policy_id')
  const yearParam = searchParams.get('year')
  const cropYear  = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (!policyId) {
    return NextResponse.json({ error: 'policy_id is required' }, { status: 400 })
  }

  // 1. Pull the policy to get farm_number and crop
  const { data: policy, error: policyErr } = await supabase
    .from('insurance_policies')
    .select('farm_number, crop, farm_name')
    .eq('id', policyId)
    .single()

  if (policyErr || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  // 2. Aggregate clu_records for this farm + year
  //    Match on farm_number; filter by crop if present (case-insensitive ILIKE)
  let query = supabase
    .from('clu_records')
    .select('fsa_acres, reported, crop')
    .eq('crop_year', cropYear)

  if (policy.farm_number) {
    query = query.eq('farm_number', policy.farm_number)
  }

  // If we have a crop name, try a case-insensitive partial match.
  // This handles "Corn" matching "Org Corn" or "Yellow Corn".
  if (policy.crop) {
    query = query.ilike('crop', `%${policy.crop}%`)
  }

  const { data: cluRows, error: cluErr } = await query

  if (cluErr) {
    return NextResponse.json({ error: cluErr.message }, { status: 500 })
  }

  const rows = cluRows ?? []
  const total_clu_count   = rows.length
  const confirmed_count   = rows.filter((r) => r.reported).length
  const unconfirmed_count = total_clu_count - confirmed_count
  const total_fsa_ac      = rows.reduce((sum, r) => sum + (Number(r.fsa_acres) || 0), 0)
  const confirmed_fsa_ac  = rows
    .filter((r) => r.reported)
    .reduce((sum, r) => sum + (Number(r.fsa_acres) || 0), 0)

  return NextResponse.json({
    policy_id:        policyId,
    farm_number:      policy.farm_number,
    farm_name:        policy.farm_name,
    crop:             policy.crop,
    crop_year:        cropYear,
    total_clu_count,
    confirmed_count,
    unconfirmed_count,
    total_fsa_ac:     Math.round(total_fsa_ac * 100) / 100,
    confirmed_fsa_ac: Math.round(confirmed_fsa_ac * 100) / 100,
  })
}
