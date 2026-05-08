'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { AcreageTab } from '@/components/compliance/acreage-tab'
import { InsuranceTab } from '@/components/compliance/insurance-tab'
import { ClaimsTab } from '@/components/compliance/claims-tab'
import { OverviewTab } from '@/components/compliance/overview-tab'
import { CalendarTab } from '@/components/compliance/calendar-tab'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { CluRecord, InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import type { Claim } from '@/components/claims/claim-card'

type TabId = 'overview' | 'acreage' | 'insurance' | 'claims' | 'calendar'

const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'overview',  label: 'Overview',   sub: 'Dashboard' },
  { id: 'acreage',   label: 'Acreage',    sub: 'FSA 578'   },
  { id: 'insurance', label: 'Insurance',  sub: 'Policies'  },
  { id: 'claims',    label: 'Claims',     sub: 'Kanban'    },
  { id: 'calendar',  label: 'Calendar',   sub: 'Deadlines' },
]

interface ComplianceShellProps {
  unreportedCount: number
  activePoliciesCount: number
  openClaimsCount: number
  cluRecords: CluRecord[]
  cluLoadError: string | null
  policies: InsurancePolicy[]
  pricing: PricingEntry[]
  lastScraped: string | null
  claimsData: Claim[]
}

export function ComplianceShell({
  unreportedCount,
  activePoliciesCount,
  openClaimsCount,
  cluRecords,
  cluLoadError,
  policies,
  pricing,
  lastScraped,
  claimsData,
}: ComplianceShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const rawTab = searchParams.get('tab') as TabId | null
  const activeTab: TabId =
    rawTab && TABS.some((t) => t.id === rawTab) ? rawTab : 'overview'

  const farmParam = searchParams.get('farm') ?? ''
  const cropParam = searchParams.get('crop') ?? ''

  const [farmInput, setFarmInput] = useState(farmParam)
  const [cropInput, setCropInput] = useState(cropParam)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setFarmInput(farmParam) }, [farmParam])
  useEffect(() => { setCropInput(cropParam) }, [cropParam])

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })

  function navigateTab(tabId: string) {
    const params = new URLSearchParams()
    if (tabId !== 'overview') params.set('tab', tabId)
    if (farmInput) params.set('farm', farmInput)
    if (cropInput) params.set('crop', cropInput)
    const str = params.toString()
    router.replace(`/app/compliance${str ? `?${str}` : ''}`)
  }

  function setFilter(key: 'farm' | 'crop', value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (activeTab !== 'overview') params.set('tab', activeTab)
      const farm = key === 'farm' ? value : farmInput
      const crop = key === 'crop' ? value : cropInput
      if (farm) params.set('farm', farm)
      if (crop) params.set('crop', crop)
      const str = params.toString()
      router.replace(`/app/compliance${str ? `?${str}` : ''}`)
    }, 300)
  }

  function clearFilters() {
    setFarmInput('')
    setCropInput('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const params = new URLSearchParams()
    if (activeTab !== 'overview') params.set('tab', activeTab)
    router.replace(`/app/compliance${params.toString() ? `?${params.toString()}` : ''}`)
  }

  function renderTabContent() {
    if (activeTab === 'overview') {
      return (
        <OverviewTab
          unreportedCount={unreportedCount}
          activePoliciesCount={activePoliciesCount}
          openClaimsCount={openClaimsCount}
          claims={claimsData as Record<string, unknown>[]}
          cluRecords={cluRecords}
          navigateTab={navigateTab}
        />
      )
    }
    if (activeTab === 'acreage') {
      return (
        <AcreageTab
          records={cluRecords}
          loadError={cluLoadError}
          farmFilter={farmInput || undefined}
          cropFilter={cropInput || undefined}
          navigateTab={navigateTab}
        />
      )
    }
    if (activeTab === 'insurance') {
      return (
        <InsuranceTab
          policies={policies}
          pricing={pricing}
          lastScraped={lastScraped}
          farmFilter={farmInput || undefined}
          cropFilter={cropInput || undefined}
          navigateTab={navigateTab}
        />
      )
    }
    if (activeTab === 'claims') {
      return (
        <ClaimsTab
          claims={claimsData}
          farmFilter={farmInput || undefined}
          cropFilter={cropInput || undefined}
        />
      )
    }
    if (activeTab === 'calendar') {
      return <CalendarTab claims={claimsData} cluRecords={cluRecords} />
    }
    return null
  }

  return (
    <div>
      {/* ── Module header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-wide text-glomalin-bright uppercase leading-tight">
            Compliance Hub
          </h1>
          <p className="text-[11px] font-mono tracking-[0.2em] text-glomalin-muted mt-1 uppercase">
            FSA 578 &middot; Insurance &middot; Claims
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-mono px-2.5 py-1 rounded border border-glomalin-accent/30 bg-glomalin-accent/5 text-glomalin-accent tracking-[0.14em] uppercase">
            {CURRENT_CROP_YEAR} Crop Year
          </span>
          <span className="text-[10px] font-mono text-glomalin-muted">{today}</span>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────── */}
      <div className="relative border-b border-glomalin-border">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => navigateTab(tab.id)}
                className={[
                  'relative flex flex-col items-center px-5 pt-2.5 pb-3 transition-colors',
                  isActive
                    ? 'text-glomalin-accent'
                    : 'text-glomalin-muted hover:text-glomalin-text',
                ].join(' ')}
              >
                <span className="text-xs font-mono font-medium">{tab.label}</span>
                <span className={`text-[9px] font-mono mt-0.5 transition-colors ${
                  isActive ? 'text-glomalin-accent/60' : 'text-glomalin-muted/40'
                }`}>
                  {tab.sub}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-glomalin-accent rounded-t-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 py-2.5 border-b border-glomalin-border/50">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-glomalin-muted/50">
          Filter
        </span>
        <span className="h-3 w-px bg-glomalin-border" />

        <label className="flex items-center gap-1.5 bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 focus-within:border-glomalin-accent/40 transition-colors">
          <span className="text-[10px] text-glomalin-muted font-mono select-none">⌂</span>
          <input
            type="text"
            placeholder="Farm"
            value={farmInput}
            onChange={(e) => {
              setFarmInput(e.target.value)
              setFilter('farm', e.target.value)
            }}
            className="bg-transparent text-glomalin-text text-[11px] font-mono placeholder:text-glomalin-muted/40 outline-none w-24"
          />
        </label>

        <label className="flex items-center gap-1.5 bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 focus-within:border-glomalin-accent/40 transition-colors">
          <span className="text-[10px] text-glomalin-muted font-mono select-none">◈</span>
          <input
            type="text"
            placeholder="Crop"
            value={cropInput}
            onChange={(e) => {
              setCropInput(e.target.value)
              setFilter('crop', e.target.value)
            }}
            className="bg-transparent text-glomalin-text text-[11px] font-mono placeholder:text-glomalin-muted/40 outline-none w-20"
          />
        </label>

        {(farmInput || cropInput) && (
          <button
            onClick={clearFilters}
            className="text-[11px] font-mono text-glomalin-muted/60 hover:text-glomalin-danger transition-colors"
          >
            × clear
          </button>
        )}
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div className="mt-5">
        {renderTabContent()}
      </div>
    </div>
  )
}
