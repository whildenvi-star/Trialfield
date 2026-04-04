import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { ComplianceShell } from '@/components/compliance/compliance-shell'
import type { CluRecord, InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import type { Claim } from '@/components/claims/claim-card'

export default async function CompliancePage() {
  const supabase = await createClient()

  const [
    { count: unreportedCount },
    { count: activePoliciesCount },
    { count: openClaimsCount },
    { data: cluData, error: cluError },
    { data: policiesData },
    { data: pricingData },
    { data: latestScrapeData },
    { data: claimsRaw },
  ] = await Promise.all([
    supabase
      .from('clu_records')
      .select('id', { count: 'exact', head: true })
      .eq('crop_year', CURRENT_CROP_YEAR)
      .is('reported_date', null),
    supabase
      .from('insurance_policies')
      .select('id', { count: 'exact', head: true })
      .eq('policy_year', CURRENT_CROP_YEAR),
    supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .not('stage', 'in', '(closed,denied)'),
    supabase
      .from('clu_records')
      .select('*')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .order('farm_number')
      .order('tract_number')
      .order('clu'),
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('policy_year', CURRENT_CROP_YEAR)
      .order('farm_name'),
    supabase
      .from('insurance_pricing')
      .select('*')
      .eq('year', CURRENT_CROP_YEAR),
    supabase
      .from('insurance_pricing')
      .select('last_scraped')
      .not('last_scraped', 'is', null)
      .order('last_scraped', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('claims')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const cluRecords: CluRecord[] = (cluData as CluRecord[]) ?? []
  const policies: InsurancePolicy[] = (policiesData as InsurancePolicy[]) ?? []
  const pricing: PricingEntry[] = (pricingData as PricingEntry[]) ?? []
  const lastScraped: string | null = latestScrapeData?.last_scraped ?? null
  const claimsData: Claim[] = (claimsRaw as Claim[]) ?? []

  return (
    <Suspense fallback={null}>
      <ComplianceShell
        unreportedCount={unreportedCount ?? 0}
        activePoliciesCount={activePoliciesCount ?? 0}
        openClaimsCount={openClaimsCount ?? 0}
        cluRecords={cluRecords}
        cluLoadError={cluError?.message ?? null}
        policies={policies}
        pricing={pricing}
        lastScraped={lastScraped}
        claimsData={claimsData}
      />
    </Suspense>
  )
}
