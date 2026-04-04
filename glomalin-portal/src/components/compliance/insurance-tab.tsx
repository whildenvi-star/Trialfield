'use client'

import { useMemo, Suspense } from 'react'
import { InsuranceWorkspace } from '@/components/insurance/insurance-workspace'
import { ActionButton } from '@/components/compliance/ui'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'

interface InsuranceTabProps {
  policies: InsurancePolicy[]
  pricing: PricingEntry[]
  lastScraped: string | null
  farmFilter?: string
  cropFilter?: string
  navigateTab: (tab: string, params?: Record<string, string>) => void
}

export function InsuranceTab({
  policies,
  pricing,
  lastScraped,
  farmFilter,
  cropFilter,
  navigateTab,
}: InsuranceTabProps) {
  const filtered = useMemo(() => {
    let out = policies
    if (farmFilter) {
      const f = farmFilter.toLowerCase()
      out = out.filter(
        (p) =>
          String(p.farm_name ?? '').toLowerCase().includes(f) ||
          String(p.farm_number ?? '').toLowerCase().includes(f)
      )
    }
    if (cropFilter) {
      const c = cropFilter.toLowerCase()
      out = out.filter((p) => String(p.crop ?? '').toLowerCase().includes(c))
    }
    return out
  }, [policies, farmFilter, cropFilter])

  return (
    <div>
      {/* File Claim button lives here in the wrapper — InsuranceWorkspace is not modified */}
      <div className="flex items-center justify-between mb-4">
        {(farmFilter || cropFilter) && filtered.length !== policies.length && (
          <p className="text-xs font-mono text-glomalin-muted">
            Showing {filtered.length} of {policies.length} policies
            {farmFilter ? ` — farm: "${farmFilter}"` : ''}
            {cropFilter ? ` — crop: "${cropFilter}"` : ''}
          </p>
        )}
        <div className="ml-auto">
          <ActionButton
            variant="primary"
            onClick={() => navigateTab('claims')}
          >
            File Claim
          </ActionButton>
        </div>
      </div>
      <Suspense fallback={null}>
        <InsuranceWorkspace
          initialPolicies={filtered}
          initialPricing={pricing}
          lastScraped={lastScraped}
        />
      </Suspense>
    </div>
  )
}
