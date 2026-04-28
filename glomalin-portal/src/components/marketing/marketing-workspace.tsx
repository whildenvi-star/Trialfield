'use client'

import { useState, useCallback } from 'react'
import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  YieldSummary,
} from '@/lib/marketing/types'
import type { BudgetField } from '@/app/(protected)/app/macro-rollup/page'
import { computeCommodityPositions } from '@/lib/marketing/queries'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { HedgingDashboard } from './hedging-dashboard'
import { CommodityTable } from './commodity-table'
import { InstrumentForm } from './instrument-form'
import { VariantSetupPanel } from './variant-setup-panel'

interface MarketingWorkspaceProps {
  commodities: Commodity[]
  initialVariants: CropVariant[]
  initialInstruments: SaleInstrument[]
  initialCommodityPositions: CommodityPosition[]
  cbotPrices: CbotPrice[]
  priceSource: string
  priceTimestamp: string | null
  yieldAvailable: boolean
  yieldSummaries: YieldSummary[]
  budgetFields: BudgetField[]
  cropYear: number
}

function formatPriceTimestamp(ts: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function priceSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'barchart-delayed': 'Barchart Delayed',
    'manual-fallback': 'Manual Fallback',
    unavailable: 'Unavailable',
  }
  return labels[source] ?? source
}

export function MarketingWorkspace({
  commodities,
  initialVariants,
  initialInstruments,
  initialCommodityPositions,
  cbotPrices: initialCbotPrices,
  priceSource: initialPriceSource,
  priceTimestamp: initialPriceTimestamp,
  yieldAvailable,
  budgetFields,
  cropYear,
}: MarketingWorkspaceProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'contracts'>('dashboard')
  const [variants, setVariants] = useState<CropVariant[]>(initialVariants)
  const [instruments, setInstruments] = useState<SaleInstrument[]>(initialInstruments)
  const [positions, setPositions] = useState<CommodityPosition[]>(initialCommodityPositions)
  const [cbotPrices, setCbotPrices] = useState<CbotPrice[]>(initialCbotPrices)
  const [priceSource, setPriceSource] = useState(initialPriceSource)
  const [priceTimestamp, setPriceTimestamp] = useState<string | null>(initialPriceTimestamp)
  const [priceRefreshing, setPriceRefreshing] = useState(false)

  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false)
  const [editingInstrument, setEditingInstrument] = useState<SaleInstrument | null>(null)
  const [variantSetupOpen, setVariantSetupOpen] = useState(false)

  const recompute = useCallback(
    (updatedVariants: CropVariant[], updatedInstruments: SaleInstrument[], updatedPrices: CbotPrice[]) => {
      setPositions(computeCommodityPositions(commodities, updatedVariants, updatedInstruments, updatedPrices))
    },
    [commodities]
  )

  async function handleRefreshPrices() {
    setPriceRefreshing(true)
    try {
      const res = await fetch('/api/marketing/cbot-prices', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const prices: CbotPrice[] = data.prices ?? []
      setCbotPrices(prices)
      if (prices.length > 0) {
        setPriceSource(prices[0].source)
        setPriceTimestamp(prices[0].timestamp)
      }
      recompute(variants, instruments, prices)
    } catch (err) {
      console.error('Failed to refresh CBOT prices:', err)
    } finally {
      setPriceRefreshing(false)
    }
  }

  async function refreshInstruments() {
    try {
      const res = await fetch(`/api/marketing/instruments?cropYear=${cropYear}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const updated: SaleInstrument[] = data.instruments ?? []
      setInstruments(updated)
      recompute(variants, updated, cbotPrices)
    } catch (err) {
      console.error('Failed to refresh instruments:', err)
    }
  }

  async function refreshVariants() {
    try {
      const res = await fetch(`/api/marketing/variants?cropYear=${cropYear}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const updated: CropVariant[] = data.variants ?? []
      setVariants(updated)
      recompute(updated, instruments, cbotPrices)
    } catch (err) {
      console.error('Failed to refresh variants:', err)
    }
  }

  function openNewInstrument() {
    setEditingInstrument(null)
    setInstrumentFormOpen(true)
  }

  function openEditInstrument(inst: SaleInstrument) {
    setEditingInstrument(inst)
    setInstrumentFormOpen(true)
  }

  async function handleDeleteInstrument(id: string) {
    const inst = instruments.find((i) => i.id === id)
    const label = `${inst?.instrument_type ?? 'instrument'} — ${(inst?.bushels ?? inst?.daily_bu ?? 0).toLocaleString()} bu`
    if (!confirm(`Delete ${label}?`)) return
    try {
      const res = await fetch(`/api/marketing/instruments/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      const updated = instruments.filter((i) => i.id !== id)
      setInstruments(updated)
      recompute(variants, updated, cbotPrices)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleInstrumentSave() {
    setInstrumentFormOpen(false)
    await refreshInstruments()
  }

  const isLivePrices = priceSource === 'barchart-delayed'
  const isFallbackPrices = priceSource === 'manual-fallback'

  const subTabs = [
    { id: 'dashboard' as const, label: 'Hedging Dashboard' },
    { id: 'contracts' as const, label: 'Contract Management' },
  ]

  return (
    <div>
      {/* Price source badge + refresh */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold border ${
              isLivePrices
                ? 'bg-[#14b8a6]/10 border-[#14b8a6]/40 text-[#2dd4bf]'
                : isFallbackPrices
                ? 'bg-amber-900/20 border-amber-700/40 text-amber-400'
                : 'bg-glomalin-surface border-glomalin-border text-glomalin-muted'
            }`}
          >
            <span>{priceSourceLabel(priceSource)}</span>
            {priceTimestamp && (
              <span className="opacity-75">— {formatPriceTimestamp(priceTimestamp)}</span>
            )}
          </div>
          <button
            onClick={handleRefreshPrices}
            disabled={priceRefreshing}
            className="text-xs font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors disabled:opacity-50"
          >
            {priceRefreshing ? 'Refreshing...' : '↺ Refresh Prices'}
          </button>
        </div>

        {/* Actions for contract management tab */}
        {activeSubTab === 'contracts' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVariantSetupOpen(true)}
              className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors border border-glomalin-border rounded px-3 py-1.5"
              title="Manage crop variants"
            >
              ⚙ Variants
            </button>
            <button
              onClick={openNewInstrument}
              className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-1.5 hover:opacity-90 transition-opacity"
            >
              + Add Instrument
            </button>
          </div>
        )}
      </div>

      {/* Grain-tickets offline warning */}
      {!yieldAvailable && (
        <div className="mb-5 rounded-md border border-amber-800/50 bg-amber-950/20 px-4 py-3 text-sm font-mono">
          <p className="text-amber-400 font-semibold">
            Grain-tickets offline — estimated production unavailable
          </p>
          <p className="text-amber-300/70 text-xs mt-0.5">
            Start grain-tickets on port 3007 to populate estimated production from harvest data.
          </p>
        </div>
      )}

      {/* Sub-tab strip */}
      <div className="flex gap-0 border-b border-glomalin-border mb-6">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={[
              'px-4 py-2 font-mono text-xs transition-colors border-b-2 -mb-px',
              activeSubTab === t.id
                ? 'border-glomalin-accent text-glomalin-accent'
                : 'border-transparent text-glomalin-muted hover:text-glomalin-text',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeSubTab === 'dashboard' && (
        <HedgingDashboard
          positions={positions}
          cropYear={cropYear}
          onSwitchToContracts={() => setActiveSubTab('contracts')}
        />
      )}

      {activeSubTab === 'contracts' && (
        <CommodityTable
          positions={positions}
          onEditInstrument={openEditInstrument}
          onDeleteInstrument={handleDeleteInstrument}
        />
      )}

      {/* Instrument form drawer */}
      <InstrumentForm
        open={instrumentFormOpen}
        instrument={editingInstrument}
        commodities={commodities}
        variants={variants}
        cropYear={cropYear}
        onClose={() => setInstrumentFormOpen(false)}
        onSave={handleInstrumentSave}
        onVariantCreated={refreshVariants}
      />

      {/* Variant setup panel */}
      {variantSetupOpen && (
        <VariantSetupPanel
          commodities={commodities}
          variants={variants}
          budgetFields={budgetFields}
          cropYear={cropYear}
          onClose={() => setVariantSetupOpen(false)}
          onSaved={refreshVariants}
        />
      )}
    </div>
  )
}
