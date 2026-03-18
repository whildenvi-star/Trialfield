import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import {
  findBestGrainMatch,
  computeClaimAlert,
  type GrainFarm,
} from '@/lib/insurance/calc'

// POST /api/insurance/yield-sync
// Body: { policyId: string }
// Fetches grain-ticket farm data and writes matched yieldPerAcre to insurance_policies.actual.
// INS-06: Grain-ticket yield bridge with score-based matching.
export async function POST(request: Request) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Parse request body
  let body: { policyId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { policyId } = body
  if (!policyId) {
    return NextResponse.json({ error: 'policyId is required' }, { status: 400 })
  }

  // Fetch the policy from Supabase
  const { data: policy, error: policyError } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('id', policyId)
    .single()

  if (policyError || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  // Cross-app fetch to grain-tickets (port 3000)
  // CRITICAL: no caching, timeout after 5 seconds
  let gtFarms: GrainFarm[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchOptions: any = {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 0 },
    }
    const res = await fetch('http://localhost:3000/api/farms', fetchOptions)
    if (!res.ok) throw new Error(`Grain-tickets returned ${res.status}`)
    gtFarms = (await res.json()) as GrainFarm[]
  } catch {
    // Grain-tickets offline is not a server error — return 200 with clear message
    return NextResponse.json({
      error: 'Grain ticket service unavailable — is port 3000 running?',
      matched: false,
      policy: null,
    })
  }

  // Score-based matching between policy and grain farm data
  const { match, score } = findBestGrainMatch(policy, gtFarms)

  // Only auto-apply matches with score >= 2 (crop match required)
  if (score < 2 || !match) {
    return NextResponse.json({
      matched: false,
      score,
      bestMatch: null,
      policy,
    })
  }

  // Build updated policy values for claim alert computation
  const updatedValues = {
    guarantee: policy.guarantee ?? 0,
    actual: match.yieldPerAcre,
    coverage_level: policy.coverage_level ?? 75,
  }

  const claimAlert = computeClaimAlert(updatedValues)

  // Write actual yield and recomputed claim_alert to insurance_policies
  const { data: updatedPolicy, error: updateError } = await supabase
    .from('insurance_policies')
    .update({
      actual: match.yieldPerAcre,
      actual_synced_from_grain: true,
      claim_alert: claimAlert,
    })
    .eq('id', policyId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update policy', details: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    matched: true,
    score,
    match: {
      farm: match.farm,
      crop: match.crop,
      yieldPerAcre: match.yieldPerAcre,
      ticketCount: match.ticketCount,
    },
    policy: updatedPolicy,
  })
}
