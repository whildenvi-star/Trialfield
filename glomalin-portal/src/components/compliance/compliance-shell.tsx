'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { AcreageTab } from '@/components/compliance/acreage-tab'
import { InsuranceTab } from '@/components/compliance/insurance-tab'
import { ClaimsTab } from '@/components/compliance/claims-tab'
import { OverviewTab } from '@/components/compliance/overview-tab'
import { CalendarTab } from '@/components/compliance/calendar-tab'
import type { CluRecord, InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import type { Claim } from '@/components/claims/claim-card'

type TabId = 'overview' | 'acreage' | 'insurance' | 'claims' | 'calendar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'acreage', label: 'Acreage' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'claims', label: 'Claims' },
  { id: 'calendar', label: 'Calendar' },
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

  // Local controlled state for inputs (debounced to URL)
  const [farmInput, setFarmInput] = useState(farmParam)
  const [cropInput, setCropInput] = useState(cropParam)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input state if URL params change externally
  useEffect(() => {
    setFarmInput(farmParam)
  }, [farmParam])

  useEffect(() => {
    setCropInput(cropParam)
  }, [cropParam])

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
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-mono font-bold text-glomalin-text">
          Compliance Hub
        </h1>
        <p className="text-sm text-glomalin-muted font-mono">FSA · Insurance · Claims</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-glomalin-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateTab(tab.id)}
            className={[
              'px-4 py-2 text-xs font-mono transition-colors',
              tab.id === activeTab
                ? 'text-glomalin-accent border-b-2 border-glomalin-accent'
                : 'text-glomalin-muted hover:text-glomalin-text',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="border-t border-glomalin-border pt-3 pb-3 flex gap-4 items-center">
        <span className="text-xs text-glomalin-muted font-mono">Filter:</span>
        <input
          type="text"
          placeholder="Farm..."
          value={farmInput}
          onChange={(e) => {
            setFarmInput(e.target.value)
            setFilter('farm', e.target.value)
          }}
          className="bg-glomalin-surface border border-glomalin-border text-glomalin-text text-xs font-mono px-2 py-1 rounded"
        />
        <input
          type="text"
          placeholder="Crop..."
          value={cropInput}
          onChange={(e) => {
            setCropInput(e.target.value)
            setFilter('crop', e.target.value)
          }}
          className="bg-glomalin-surface border border-glomalin-border text-glomalin-text text-xs font-mono px-2 py-1 rounded"
        />
        {(farmInput || cropInput) && (
          <button
            onClick={clearFilters}
            className="text-xs text-glomalin-muted hover:text-red-400 font-mono transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {renderTabContent()}
      </div>
    </div>
  )
}
