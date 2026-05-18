'use client'

import { useState, useCallback } from 'react'
import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  CommodityPricing,
  YieldSummary,
} from '@/lib/marketing/types'
import type { BudgetField } from '@/lib/marketing/types'
import { computeCommodityPositions } from '@/lib/marketing/queries'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { HedgingDashboard } from './hedging-dashboard'
import { CommodityTable } from './commodity-table'
import { InstrumentForm } from './instrument-form'
import { VariantSetupPanel } from './variant-setup-panel'
import { CropTypesPanel } from './crop-types-panel'
import { WhatIfPanel } from './what-if-panel'
import { Tabs } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

interface MarketingWorkspaceProps {
  commodities: Commodity[]
  initialVariants: CropVariant[]
  initialInstruments: SaleInstrument[]
  initialCommodityPositions: CommodityPosition[]
  initialPricingConfigs: CommodityPricing[]
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
  initialPricingConfigs,
  cbotPrices: initialCbotPrices,
  priceSource: initialPriceSource,
  priceTimestamp: initialPriceTimestamp,
  yieldAvailable,
  budgetFields,
  cropYear,
}: MarketingWorkspaceProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'contracts' | 'crop-types' | 'what-if'>('dashboard')
  const [activeCropYear, setActiveCropYear] = useState(cropYear)
  const [variants, setVariants] = useState<CropVariant[]>(initialVariants)
  const [instruments, setInstruments] = useState<SaleInstrument[]>(initialInstruments)
  const [pricingConfigs, setPricingConfigs] = useState<CommodityPricing[]>(initialPricingConfigs)
  const [positions, setPositions] = useState<CommodityPosition[]>(initialCommodityPositions)
  const [cbotPrices, setCbotPrices] = useState<CbotPrice[]>(initialCbotPrices)
  const [priceSource, setPriceSource] = useState(initialPriceSource)
  const [priceTimestamp, setPriceTimestamp] = useState<string | null>(initialPriceTimestamp)
  const [priceRefreshing, setPriceRefreshing] = useState(false)

  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false)
  const [editingInstrument, setEditingInstrument] = useState<SaleInstrument | null>(null)
  const [variantSetupOpen, setVariantSetupOpen] = useState(false)

  const recompute = useCallback(
    (
      updatedVariants: CropVariant[],
      updatedInstruments: SaleInstrument[],
      updatedPrices: CbotPrice[],
      updatedPricingConfigs: CommodityPricing[]
    ) => {
      setPositions(
        computeCommodityPositions(commodities, updatedVariants, updatedInstruments, updatedPrices, updatedPricingConfigs)
      )
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
      recompute(variants, instruments, prices, pricingConfigs)
    } catch (err) {
      console.error('Failed to refresh CBOT prices:', err)
    } finally {
      setPriceRefreshing(false)
    }
  }

  async function refreshPricing(year: number = activeCropYear) {
    try {
      const res = await fetch(`/api/marketing/commodity-pricing?cropYear=${year}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const updated: CommodityPricing[] = data.pricing ?? []
      setPricingConfigs(updated)
      return updated
    } catch (err) {
      console.error('Failed to refresh pricing configs:', err)
    }
  }

  async function refreshInstruments(year: number = activeCropYear) {
    try {
      const res = await fetch(`/api/marketing/instruments?cropYear=${year}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const updated: SaleInstrument[] = data.instruments ?? []
      setInstruments(updated)
      recompute(variants, updated, cbotPrices, pricingConfigs)
    } catch (err) {
      console.error('Failed to refresh instruments:', err)
    }
  }

  async function refreshVariants(year: number = activeCropYear) {
    try {
      const res = await fetch(`/api/marketing/variants?cropYear=${year}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const updated: CropVariant[] = data.variants ?? []
      setVariants(updated)
      recompute(updated, instruments, cbotPrices, pricingConfigs)
    } catch (err) {
      console.error('Failed to refresh variants:', err)
    }
  }

  async function handleYearChange(newYear: number) {
    setActiveCropYear(newYear)
    try {
      const [varRes, instRes, pricingRes] = await Promise.allSettled([
        fetch(`/api/marketing/variants?cropYear=${newYear}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/marketing/instruments?cropYear=${newYear}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/marketing/commodity-pricing?cropYear=${newYear}`, { cache: 'no-store' }).then((r) => r.json()),
      ])
      const updatedVariants: CropVariant[] = varRes.status === 'fulfilled' ? (varRes.value.variants ?? []) : variants
      const updatedInstruments: SaleInstrument[] = instRes.status === 'fulfilled' ? (instRes.value.instruments ?? []) : instruments
      const updatedPricing: CommodityPricing[] = pricingRes.status === 'fulfilled' ? (pricingRes.value.pricing ?? []) : []
      setVariants(updatedVariants)
      setInstruments(updatedInstruments)
      setPricingConfigs(updatedPricing)
      recompute(updatedVariants, updatedInstruments, cbotPrices, updatedPricing)
    } catch (err) {
      console.error('Failed to load year data:', err)
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
      recompute(variants, updated, cbotPrices, pricingConfigs)
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
    { id: 'contracts' as const, label: 'Contracts' },
    { id: 'crop-types' as const, label: 'Crop Types' },
    { id: 'what-if' as const, label: 'What-If' },
  ]

  return (
    <div>
      {/* Header: price badge + year selector + actions */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-5">
        <div className="flex items-center gap-3">
          {activeSubTab !== 'crop-types' && (
            <>
              <Badge variant={isLivePrices ? 'accent' : isFallbackPrices ? 'warning' : 'default'} size="md">
                {priceSourceLabel(priceSource)}
                {priceTimestamp && (
                  <span className="opacity-75 ml-1">— {formatPriceTimestamp(priceTimestamp)}</span>
                )}
              </Badge>
              <button
                onClick={handleRefreshPrices}
                disabled={priceRefreshing}
                className="text-xs font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors disabled:opacity-50"
              >
                {priceRefreshing ? 'Refreshing...' : '↺ Refresh Prices'}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Crop year selector */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => handleYearChange(activeCropYear - 1)}
              className="text-glomalin-muted hover:text-glomalin-text px-1 transition-colors"
              title="Previous year"
            >
              ←
            </button>
            <span className={`px-2 py-0.5 rounded border font-semibold ${
              activeCropYear === CURRENT_CROP_YEAR
                ? 'border-glomalin-accent/50 text-glomalin-accent bg-glomalin-accent/10'
                : 'border-glomalin-warning/50 text-glomalin-warning bg-glomalin-warning/10'
            }`}>
              {activeCropYear}
            </span>
            <button
              onClick={() => handleYearChange(activeCropYear + 1)}
              className="text-glomalin-muted hover:text-glomalin-text px-1 transition-colors"
              title="Next year"
            >
              →
            </button>
          </div>

          {/* Actions — visible on dashboard and contracts tabs */}
          {(activeSubTab === 'dashboard' || activeSubTab === 'contracts') && (
            <>
              {activeSubTab === 'contracts' && (
                <button
                  onClick={() => setVariantSetupOpen(true)}
                  className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors border border-glomalin-border rounded px-3 py-1.5"
                  title="Manage crop variants"
                >
                  ⚙ Variants
                </button>
              )}
              <button
                onClick={openNewInstrument}
                className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-1.5 hover:opacity-90 transition-opacity"
              >
                + Add Instrument
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grain-tickets offline warning */}
      {!yieldAvailable && (
        <div className="mb-5 rounded-md border border-glomalin-warning/30 bg-glomalin-warning/10 px-4 py-3 text-sm font-mono">
          <p className="text-glomalin-warning font-semibold">
            Grain-tickets offline — estimated production unavailable
          </p>
          <p className="text-glomalin-warning/70 text-xs mt-0.5">
            Start grain-tickets on port 3007 to populate estimated production from harvest data.
          </p>
        </div>
      )}

      {/* Sub-tab strip */}
      <Tabs
        tabs={subTabs}
        active={activeSubTab}
        onChange={setActiveSubTab}
        size="sm"
        className="mb-6"
      />

      {/* Tab content */}
      {activeSubTab === 'dashboard' && (
        <HedgingDashboard
          positions={positions}
          cropYear={activeCropYear}
          onSwitchToContracts={() => setActiveSubTab('contracts')}
        />
      )}

      {activeSubTab === 'crop-types' && (
        <CropTypesPanel
          commodities={commodities}
          pricingConfigs={pricingConfigs}
          cropYear={activeCropYear}
          onCommoditiesChanged={() => {}}
          onPricingChanged={() => refreshPricing()}
        />
      )}

      {activeSubTab === 'contracts' && (
        <CommodityTable
          positions={positions}
          onEditInstrument={openEditInstrument}
          onDeleteInstrument={handleDeleteInstrument}
        />
      )}

      {activeSubTab === 'what-if' && (
        <WhatIfPanel positions={positions} />
      )}

      {/* Instrument form drawer */}
      <InstrumentForm
        open={instrumentFormOpen}
        instrument={editingInstrument}
        commodities={commodities}
        variants={variants}
        cropYear={activeCropYear}
        onClose={() => setInstrumentFormOpen(false)}
        onSave={handleInstrumentSave}
        onVariantCreated={() => refreshVariants()}
      />

      {/* Variant setup panel */}
      {variantSetupOpen && (
        <VariantSetupPanel
          commodities={commodities}
          variants={variants}
          budgetFields={budgetFields}
          cropYear={activeCropYear}
          onClose={() => setVariantSetupOpen(false)}
          onSaved={() => refreshVariants()}
        />
      )}
    </div>
  )
}
