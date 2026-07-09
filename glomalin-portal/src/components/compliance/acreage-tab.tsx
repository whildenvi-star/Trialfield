'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CluWorkspace } from '@/components/fsa/clu-workspace'
import { ZoneSetupPanel } from '@/components/fsa/zone-setup-panel'
import { CoverageImportPanel } from '@/components/fsa/coverage-import-panel'
import { ActionButton } from '@/components/compliance/ui'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { CluRecord } from '@/lib/fsa/calc'

// CRITICAL: ssr: false required — map components use maplibre-gl which requires `window`
const ReportingMap = dynamic(
  () => import('@/components/fsa/reporting-map').then((m) => m.ReportingMap),
  { ssr: false }
)

const OverlayMap = dynamic(
  () => import('@/components/fsa/overlay-map').then((m) => m.OverlayMap),
  { ssr: false }
)

interface AcreageTabProps {
  records: CluRecord[]
  loadError: string | null
  farmFilter?: string   // from ?farm= URL param
  cropFilter?: string   // from ?crop= URL param
  navigateTab: (tab: string, params?: Record<string, string>) => void
}

export function AcreageTab({ records, loadError, farmFilter, cropFilter, navigateTab }: AcreageTabProps) {
  const [view, setView] = useState<'clu' | 'map' | 'zones' | 'overlay' | 'coverage'>('map')

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

  // Overlay and Map views need full height — remove max-w constraint
  const wrapClass = (view === 'overlay' || view === 'map') ? 'h-[calc(100vh-220px)]' : 'max-w-7xl mx-auto px-0'

  return (
    <div className={wrapClass}>
      {/* Header bar: cross-tab nav + view toggle */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-glomalin-border">
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
        <div className="ml-auto flex rounded border border-glomalin-border overflow-hidden text-xs font-mono">
          {(['map', 'clu', 'zones', 'overlay', 'coverage'] as const).map((v, i) => {
            const labels = { map: 'Map View', clu: 'CLU Records', zones: 'Zone Setup', overlay: 'Overlay', coverage: 'As-Applied' }
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-glomalin-border' : ''} ${view === v ? 'bg-glomalin-accent text-black' : 'text-glomalin-muted hover:text-glomalin-text'}`}
              >
                {labels[v]}
              </button>
            )
          })}
        </div>
      </div>

      {view === 'map' && (
        <ReportingMap farmFilter={farmFilter} />
      )}

      {view === 'clu' && (
        <>
          {(farmFilter || cropFilter) && filtered.length !== records.length && (
            <p className="text-xs font-mono text-glomalin-muted mb-3">
              Showing {filtered.length} of {records.length} CLU records
              {farmFilter ? ` — farm: "${farmFilter}"` : ''}
              {cropFilter ? ` — crop: "${cropFilter}"` : ''}
            </p>
          )}
          <CluWorkspace initialRecords={filtered} loadError={loadError} />
        </>
      )}

      {view === 'zones' && (
        <ZoneSetupPanel cropYear={CURRENT_CROP_YEAR} />
      )}

      {view === 'overlay' && (
        <OverlayMap cropYear={CURRENT_CROP_YEAR} />
      )}

      {view === 'coverage' && (
        <CoverageImportPanel cropYear={CURRENT_CROP_YEAR} />
      )}
    </div>
  )
}
