import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { InsuranceWorkspace } from '@/components/insurance/insurance-workspace'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import { CURRENT_CROP_YEAR } from '@/lib/config'

export default async function InsurancePage() {
  const supabase = await createClient()

  const [{ data: policiesData }, { data: pricingData }, { data: latestScrapeData }] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('policy_year', CURRENT_CROP_YEAR)
      .order('farm_name'),
    supabase
      .from('insurance_pricing')
      .select('*')
      .eq('year', CURRENT_CROP_YEAR),
    // Find the most recent last_scraped timestamp across all pricing rows
    supabase
      .from('insurance_pricing')
      .select('last_scraped')
      .not('last_scraped', 'is', null)
      .order('last_scraped', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const policies: InsurancePolicy[] = (policiesData as InsurancePolicy[]) ?? []
  const pricing: PricingEntry[] = (pricingData as PricingEntry[]) ?? []
  const lastScraped: string | null = latestScrapeData?.last_scraped ?? null

  return (
    // Suspense required: InsuranceWorkspace uses useSearchParams() for ?highlight= and ?action= params
    // Without Suspense, Next.js 14 will throw during SSR when useSearchParams is called.
    <Suspense fallback={null}>
      <InsuranceWorkspace
        initialPolicies={policies}
        initialPricing={pricing}
        lastScraped={lastScraped}
      />
    </Suspense>
  )
}
