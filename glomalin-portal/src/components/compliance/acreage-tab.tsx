'use client'

import { useMemo } from 'react'
import { CluWorkspace } from '@/components/fsa/clu-workspace'
import { ActionButton } from '@/components/compliance/ui'
import type { CluRecord } from '@/lib/fsa/calc'

interface AcreageTabProps {
  records: CluRecord[]
  loadError: string | null
  farmFilter?: string   // from ?farm= URL param
  cropFilter?: string   // from ?crop= URL param
  navigateTab: (tab: string, params?: Record<string, string>) => void
}

export function AcreageTab({ records, loadError, farmFilter, cropFilter, navigateTab }: AcreageTabProps) {
  const filtered = useMemo(() => {
    let out = records
    if (farmFilter) {
      const f = farmFilter.toLowerCase()
      out = out.filter(
        (r) =>
          String(r.farm_number ?? '').toLowerCase().includes(f) ||
          String(r.farm_name ?? '').toLowerCase().includes(f)
      )
    }
    if (cropFilter) {
      const c = cropFilter.toLowerCase()
      out = out.filter((r) => String(r.crop ?? '').toLowerCase().includes(c))
    }
    return out
  }, [records, farmFilter, cropFilter])

  return (
    <div className="max-w-7xl">
      {/* Wrapper-level cross-tab navigation buttons (COMP-05).
          CluCard has internal router.push calls that cannot be intercepted without
          modifying workspace code. These wrapper buttons give users the direct
          compliance-hub path for the same actions. */}
      <div className="flex gap-3 mb-4 pb-4 border-b border-glomalin-border">
        <ActionButton
          variant="secondary"
          size="sm"
          onClick={() => navigateTab('insurance')}
        >
          View Insurance &rarr;
        </ActionButton>
        <ActionButton
          variant="secondary"
          size="sm"
          onClick={() => navigateTab('claims')}
        >
          File PP Claim &rarr;
        </ActionButton>
      </div>

      {(farmFilter || cropFilter) && filtered.length !== records.length && (
        <p className="text-xs font-mono text-glomalin-muted mb-3">
          Showing {filtered.length} of {records.length} CLU records
          {farmFilter ? ` — farm: "${farmFilter}"` : ''}
          {cropFilter ? ` — crop: "${cropFilter}"` : ''}
        </p>
      )}
      <CluWorkspace initialRecords={filtered} loadError={loadError} />
    </div>
  )
}
