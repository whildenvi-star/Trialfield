'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  CommodityPricing,
  YieldSummary,
  BudgetField,
} from '@/lib/marketing/types'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'

interface EnterprisePlannerShellProps {
  embedSrc: string
  commodities: Commodity[]
  cropVariants: CropVariant[]
  saleInstruments: SaleInstrument[]
  initialCommodityPositions: CommodityPosition[]
  pricingConfigs: CommodityPricing[]
  cbotPrices: CbotPrice[]
  priceSource: string
  priceTimestamp: string | null
  yieldAvailable: boolean
  yieldSummaries: YieldSummary[]
  budgetFields: BudgetField[]
  cropYear: number
}

// Height of the fixed tab bar — keep in sync with --embed-breadcrumb-h in globals.css
const BAR_H = 40

function getCurrentTheme(): string {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem('mru-theme') === 'light' ? 'light' : 'dark'
}

function getCurrentScale(): string {
  if (typeof window === 'undefined') return '1'
  return localStorage.getItem('mru-text-scale') ?? '1'
}

export function EnterprisePlannerShell({
  embedSrc,
  commodities,
  cropVariants,
  saleInstruments,
  initialCommodityPositions,
  pricingConfigs,
  cbotPrices,
  priceSource,
  priceTimestamp,
  yieldAvailable,
  yieldSummaries,
  budgetFields,
  cropYear,
}: EnterprisePlannerShellProps) {
  const [activeTab, setActiveTab] = useState<'field-planning' | 'sales-marketing'>('field-planning')
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeError, setIframeError] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function sendThemeToIframe(theme: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: 'glomalin-theme', theme }, '*')
  }

  function sendScaleToIframe(scale: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: 'glomalin-scale', scale }, '*')
  }

  function handleIframeLoad() {
    setIframeLoading(false)
    sendThemeToIframe(getCurrentTheme())
    sendScaleToIframe(getCurrentScale())
  }

  useEffect(() => {
    function onThemeChange() {
      sendThemeToIframe(getCurrentTheme())
    }
    function onScaleChange(e: Event) {
      const scale = (e as CustomEvent<{ scale: string }>).detail?.scale ?? getCurrentScale()
      sendScaleToIframe(scale)
    }
    window.addEventListener('theme-change', onThemeChange)
    window.addEventListener('text-scale-change', onScaleChange)
    return () => {
      window.removeEventListener('theme-change', onThemeChange)
      window.removeEventListener('text-scale-change', onScaleChange)
    }
  }, [])

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: BAR_H,
    right: 0,
    bottom: 0,
    left: 'var(--sidebar-w, 220px)',
  }

  return (
    <>
      {/* Fixed tab bar — replaces EmbedBreadcrumb for this module */}
      <div
        className="fixed right-0 z-40 flex items-center justify-between px-4 border-b border-glomalin-border bg-glomalin-surface"
        style={{ top: 0, left: 'var(--sidebar-w, 220px)', height: BAR_H }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 font-mono text-xs text-glomalin-muted" aria-label="Breadcrumb">
          <Link href="/dashboard" className="text-glomalin-accent hover:underline transition-colors">
            Dashboard
          </Link>
          <span className="select-none" aria-hidden="true">{'>'}</span>
          <span className="text-glomalin-text">Enterprise Planner</span>
        </nav>

        {/* Tab toggle */}
        <div className="flex items-center gap-0.5 rounded border border-glomalin-border bg-glomalin-bg p-0.5">
          <button
            onClick={() => setActiveTab('field-planning')}
            className={[
              'rounded px-3 py-0.5 font-mono text-xs transition-colors',
              activeTab === 'field-planning'
                ? 'bg-glomalin-surface text-glomalin-text'
                : 'text-glomalin-muted hover:text-glomalin-text',
            ].join(' ')}
          >
            Field Planning
          </button>
          <button
            onClick={() => setActiveTab('sales-marketing')}
            className={[
              'rounded px-3 py-0.5 font-mono text-xs transition-colors',
              activeTab === 'sales-marketing'
                ? 'bg-glomalin-surface text-glomalin-text'
                : 'text-glomalin-muted hover:text-glomalin-text',
            ].join(' ')}
          >
            Sales &amp; Marketing
          </button>
        </div>

        {/* Back link */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1 font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
          aria-label="Back to Dashboard"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Field Planning panel — iframe, always mounted to avoid reload on tab switch */}
      <div
        style={{
          ...panelStyle,
          visibility: activeTab === 'field-planning' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'field-planning' ? 'auto' : 'none',
        }}
      >
        {iframeLoading && !iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg">
            <p className="font-mono text-sm text-glomalin-muted animate-pulse">Loading Farm Budget…</p>
          </div>
        )}
        {iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-glomalin-bg gap-4">
            <p className="font-mono text-sm text-glomalin-muted">Could not connect to Farm Budget</p>
            <p className="font-mono text-xs text-glomalin-muted">Make sure the service is running</p>
            <button
              onClick={() => {
                setIframeError(false)
                setIframeLoading(true)
                setIframeKey((k) => k + 1)
              }}
              className="font-mono text-sm text-glomalin-accent underline"
            >
              Retry
            </button>
          </div>
        )}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={embedSrc}
          title="Farm Budget"
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={() => {
            setIframeLoading(false)
            setIframeError(true)
          }}
        />
      </div>

      {/* Sales & Marketing panel — always mounted, scrollable */}
      <div
        style={{
          ...panelStyle,
          overflowY: 'auto',
          visibility: activeTab === 'sales-marketing' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'sales-marketing' ? 'auto' : 'none',
        }}
      >
        <div className="p-6 max-w-7xl mx-auto">
          <MarketingWorkspace
            commodities={commodities}
            initialVariants={cropVariants}
            initialInstruments={saleInstruments}
            initialCommodityPositions={initialCommodityPositions}
            initialPricingConfigs={pricingConfigs}
            cbotPrices={cbotPrices}
            priceSource={priceSource}
            priceTimestamp={priceTimestamp}
            yieldAvailable={yieldAvailable}
            yieldSummaries={yieldSummaries}
            budgetFields={budgetFields}
            cropYear={cropYear}
          />
        </div>
      </div>
    </>
  )
}
