'use client'

import { useMemo } from 'react'
import { ClaimsWorkspace } from '@/components/claims/claims-workspace'
import type { Claim } from '@/components/claims/claim-card'

interface ClaimsTabProps {
  claims: Claim[]
  farmFilter?: string
  cropFilter?: string
}

export function ClaimsTab({ claims, farmFilter, cropFilter }: ClaimsTabProps) {
  const filtered = useMemo(() => {
    let out = claims
    if (farmFilter) {
      const f = farmFilter.toLowerCase()
      out = out.filter(
        (c) =>
          String((c as any).farm_name ?? '').toLowerCase().includes(f) ||
          String((c as any).farm_number ?? '').toLowerCase().includes(f)
      )
    }
    if (cropFilter) {
      const cr = cropFilter.toLowerCase()
      out = out.filter((c) =>
        String((c as any).crop ?? (c as any).commodity ?? '').toLowerCase().includes(cr)
      )
    }
    return out
  }, [claims, farmFilter, cropFilter])

  return (
    <div>
      {(farmFilter || cropFilter) && filtered.length !== claims.length && (
        <p className="text-xs font-mono text-glomalin-muted mb-3">
          Showing {filtered.length} of {claims.length} claims
          {farmFilter ? ` — farm: "${farmFilter}"` : ''}
          {cropFilter ? ` — crop: "${cropFilter}"` : ''}
        </p>
      )}
      <ClaimsWorkspace initialClaims={filtered} />
    </div>
  )
}
