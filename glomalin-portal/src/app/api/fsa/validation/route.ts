import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCluRecords } from '@/lib/fsa/calc'
import type { CluRecord, PricingEntry, InsurancePolicy } from '@/lib/fsa/calc'

export async function GET() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all 3 datasets in parallel for the 2026 crop year
  const [cluResult, pricingResult, policiesResult] = await Promise.all([
    supabase.from('clu_records').select('*').eq('crop_year', 2026),
    supabase.from('insurance_pricing').select('*').eq('year', 2026),
    supabase.from('insurance_policies').select('*').eq('policy_year', 2026),
  ])

  if (cluResult.error) {
    return NextResponse.json(
      { error: 'Failed to fetch CLU records', details: cluResult.error.message },
      { status: 500 }
    )
  }
  if (pricingResult.error) {
    return NextResponse.json(
      { error: 'Failed to fetch insurance pricing', details: pricingResult.error.message },
      { status: 500 }
    )
  }
  if (policiesResult.error) {
    return NextResponse.json(
      { error: 'Failed to fetch insurance policies', details: policiesResult.error.message },
      { status: 500 }
    )
  }

  const cluRecords: CluRecord[] = cluResult.data ?? []
  const pricing: PricingEntry[] = pricingResult.data ?? []
  const policies: InsurancePolicy[] = policiesResult.data ?? []

  const warnings = validateCluRecords(cluRecords, pricing, policies)

  return NextResponse.json({
    warnings,
    recordCount: cluRecords.length,
  })
}
