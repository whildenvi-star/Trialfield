import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { computeAphFromRecords, computeGuarantee } from '@/lib/insurance/calc'
import type { AphRecord } from '@/lib/insurance/calc'

// GET /api/insurance/aph?policyId=xxx
// Returns all APH records for a policy plus computed APH and insurance guarantee.
// APH-02: Computed APH from yield history excluding disaster years.
// APH-03: Guarantee auto-calculated from computed APH and coverage level.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const policyId = searchParams.get('policyId')

  if (!policyId) {
    return NextResponse.json({ error: 'policyId query parameter is required' }, { status: 400 })
  }

  // Fetch APH records for this policy, newest year first
  const { data: records, error: recordsError } = await supabase
    .from('aph_records')
    .select('*')
    .eq('policy_id', policyId)
    .order('crop_year', { ascending: false })

  if (recordsError) {
    return NextResponse.json(
      { error: 'Failed to fetch APH records', details: recordsError.message },
      { status: 500 }
    )
  }

  // Fetch parent insurance policy to get coverage_level for guarantee computation
  const { data: policy, error: policyError } = await supabase
    .from('insurance_policies')
    .select('id, coverage_level')
    .eq('id', policyId)
    .single()

  if (policyError) {
    return NextResponse.json(
      { error: 'Failed to fetch insurance policy', details: policyError.message },
      { status: 500 }
    )
  }

  const coverageLevel = policy?.coverage_level ?? 75

  // Compute APH and guarantee from records
  const { aph, includedCount, excludedCount, totalCount } = computeAphFromRecords(
    (records ?? []) as AphRecord[]
  )
  const guarantee = computeGuarantee(aph, coverageLevel)

  return NextResponse.json({
    records: records ?? [],
    computedAph: aph,
    includedCount,
    excludedCount,
    totalCount,
    guarantee,
    coverageLevel,
  })
}

// POST /api/insurance/aph
// Creates a new APH record with source tracking.
// APH-01: Structured multi-year yield storage.
export async function POST(request: Request) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  const policyId = typeof body.policy_id === 'string' ? body.policy_id : null
  if (!policyId) {
    return NextResponse.json({ error: 'policy_id is required' }, { status: 400 })
  }

  const cropYear = typeof body.crop_year === 'number' ? Math.floor(body.crop_year) : null
  if (cropYear === null || isNaN(cropYear)) {
    return NextResponse.json({ error: 'crop_year is required and must be an integer' }, { status: 400 })
  }

  const actualYield = typeof body.actual_yield === 'number' ? body.actual_yield : null
  if (actualYield === null || actualYield < 0) {
    return NextResponse.json(
      { error: 'actual_yield is required and must be a number >= 0' },
      { status: 400 }
    )
  }

  const insertData = {
    policy_id: policyId,
    crop_year: cropYear,
    actual_yield: actualYield,
    source: typeof body.source === 'string' ? body.source : 'manual',
    is_disaster_year:
      typeof body.is_disaster_year === 'boolean' ? body.is_disaster_year : false,
    notes: typeof body.notes === 'string' ? body.notes : null,
  }

  const { data: record, error } = await supabase
    .from('aph_records')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // Unique constraint violation — duplicate crop_year for this policy
    if (error.code === '23505' || error.message.toLowerCase().includes('unique')) {
      return NextResponse.json(
        {
          error: `An APH record already exists for policy ${policyId} in year ${cropYear}. Use PATCH to update it.`,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create APH record', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ record }, { status: 201 })
}
