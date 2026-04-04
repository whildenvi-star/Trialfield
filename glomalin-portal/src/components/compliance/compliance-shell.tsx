'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'

type TabId = 'overview' | 'acreage' | 'insurance' | 'claims' | 'calendar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'acreage', label: 'Acreage' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'claims', label: 'Claims' },
  { id: 'calendar', label: 'Calendar' },
]

const TAB_PLACEHOLDERS: Record<TabId, string> = {
  overview: 'Overview tab — coming in Plan 04',
  acreage: 'Acreage tab — coming in Plan 02',
  insurance: 'Insurance tab — coming in Plan 03',
  claims: 'Claims tab — coming in Plan 03',
  calendar: 'Calendar tab — coming in Plan 05',
}

interface ComplianceShellProps {
  unreportedCount: number
  activePoliciesCount: number
  openClaimsCount: number
}

export function ComplianceShell({
  unreportedCount,
  activePoliciesCount,
  openClaimsCount,
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

  function buildParams(overrides: Record<string, string>): string {
    const params = new URLSearchParams()
    const base: Record<string, string> = {
      tab: activeTab,
      farm: farmInput,
      crop: cropInput,
    }
    const merged = { ...base, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    const str = params.toString()
    return str ? `?${str}` : ''
  }

  function navigateTab(tabId: TabId) {
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

  // Suppress unused variable warnings — counts available for future Overview use
  void unreportedCount
  void activePoliciesCount
  void openClaimsCount

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
        <p className="text-glomalin-muted font-mono text-sm">
          {TAB_PLACEHOLDERS[activeTab]}
        </p>
      </div>
    </div>
  )
}
