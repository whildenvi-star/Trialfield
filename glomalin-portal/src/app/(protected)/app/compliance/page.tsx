import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { ComplianceShell } from '@/components/compliance/compliance-shell'
import type { CluRecord } from '@/lib/fsa/calc'

export default async function CompliancePage() {
  const supabase = await createClient()

  const [
    { count: unreportedCount },
    { count: activePoliciesCount },
    { count: openClaimsCount },
    { data: cluData, error: cluError },
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
  ])

  const cluRecords: CluRecord[] = (cluData as CluRecord[]) ?? []

  return (
    <Suspense fallback={null}>
      <ComplianceShell
        unreportedCount={unreportedCount ?? 0}
        activePoliciesCount={activePoliciesCount ?? 0}
        openClaimsCount={openClaimsCount ?? 0}
        cluRecords={cluRecords}
        cluLoadError={cluError?.message ?? null}
      />
    </Suspense>
  )
}
