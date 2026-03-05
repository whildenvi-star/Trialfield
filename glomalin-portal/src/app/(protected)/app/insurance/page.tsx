import { createClient } from '@/lib/supabase/server'
import { InsuranceWorkspace } from '@/components/insurance/insurance-workspace'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'

export default async function InsurancePage() {
  const supabase = await createClient()

  const [{ data: policiesData }, { data: pricingData }] = await Promise.all([
    supabase
      .from('insurance_policies')
      .select('*')
      .eq('policy_year', 2026)
      .order('farm_name'),
    supabase
      .from('insurance_pricing')
      .select('*')
      .eq('year', 2026),
  ])

  const policies: InsurancePolicy[] = (policiesData as InsurancePolicy[]) ?? []
  const pricing: PricingEntry[] = (pricingData as PricingEntry[]) ?? []

  return (
    <InsuranceWorkspace
      initialPolicies={policies}
      initialPricing={pricing}
    />
  )
}
