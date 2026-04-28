'use client'

import { useState } from 'react'
import { FieldTable } from '@/components/macro/field-table'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'
import type { FieldRow } from '@/components/macro/field-table'
import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  YieldSummary,
} from '@/lib/marketing/types'
import type { BudgetField } from '@/app/(protected)/app/macro-rollup/page'

// ── Types ──────────────────────────────────────────────────────────────────────

export type RevenueMode = 'projected' | 'locked'

export interface MarketingData {
  commodities: Commodity[]
  cropVariants: CropVariant[]
  saleInstruments: SaleInstrument[]
  initialCommodityPositions: CommodityPosition[]
  cbotPrices: CbotPrice[]
  priceSource: string
  priceTimestamp: string | null
  yieldAvailable: boolean
  yieldSummaries: YieldSummary[]
  budgetFields: BudgetField[]
}

interface MacroRollupViewProps {
  rows: FieldRow[]
  hasContracts: boolean
  budgetOffline: boolean
  heroValueProjected: number | null
  heroValueLocked: number | null
  cropYear: number
  role?: string
  marketingData: MarketingData
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDollars(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Mode toggle ────────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  hasContracts,
  onChange,
}: {
  mode: RevenueMode
  hasContracts: boolean
  onChange: (m: RevenueMode) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded border border-glomalin-border bg-glomalin-surface p-0.5">
      <button
        onClick={() => onChange('projected')}
        className={[
          'rounded px-3 py-1 font-mono text-xs transition-colors',
          mode === 'projected'
            ? 'bg-glomalin-bg text-glomalin-text'
            : 'text-glomalin-muted hover:text-glomalin-text',
        ].join(' ')}
      >
        Projected
      </button>
      <button
        onClick={() => hasContracts && onChange('locked')}
        disabled={!hasContracts}
        title={!hasContracts ? 'No grain contracts entered yet' : undefined}
        className={[
          'rounded px-3 py-1 font-mono text-xs transition-colors',
          mode === 'locked'
            ? 'bg-glomalin-bg text-glomalin-text'
            : 'text-glomalin-muted hover:text-glomalin-text',
          !hasContracts ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        ].join(' ')}
      >
        Locked In
      </button>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function Hero({
  mode,
  value,
  fieldCount,
  profitableCount,
  cropYear,
}: {
  mode: RevenueMode
  value: number | null
  fieldCount: number
  profitableCount: number
  cropYear: number
}) {
  const label = mode === 'projected' ? 'BUDGET POSITION' : 'CONTRACTED POSITION'
  const sublabel =
    mode === 'projected'
      ? 'Farm-budget price × projected yield'
      : 'Locked contracts only — uncontracted bushels excluded'

  const valueColor =
    value === null
      ? 'text-glomalin-muted'
      : value >= 0
        ? 'text-[#2dd4bf]'
        : 'text-red-400'

  return (
    <div className="mb-2">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-glomalin-muted">
        {label}
      </p>
      {value !== null ? (
        <p className={`font-mono text-5xl font-semibold tracking-tight ${valueColor}`}>
          {fmtDollars(value)}
        </p>
      ) : (
        <p className="font-mono text-4xl font-semibold text-glomalin-muted">—</p>
      )}
      <p className="mt-2 font-mono text-sm text-glomalin-muted">
        {fieldCount > 0
          ? `${profitableCount} of ${fieldCount} fields — ${cropYear} crop year`
          : `${cropYear} crop year`}
      </p>
      <p className="mt-0.5 font-mono text-xs text-glomalin-muted/70">{sublabel}</p>
    </div>
  )
}

// ── Tab strip ──────────────────────────────────────────────────────────────────

function TabStrip({
  active,
  onChange,
}: {
  active: 'overview' | 'marketing'
  onChange: (tab: 'overview' | 'marketing') => void
}) {
  const tabs: Array<{ id: 'overview' | 'marketing'; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'marketing', label: 'Sales & Marketing' },
  ]
  return (
    <div className="flex gap-0 border-b border-glomalin-border mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-5 py-2.5 font-mono text-sm transition-colors border-b-2 -mb-px',
            active === t.id
              ? 'border-glomalin-accent text-glomalin-accent'
              : 'border-transparent text-glomalin-muted hover:text-glomalin-text',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MacroRollupView({
  rows,
  hasContracts,
  budgetOffline,
  heroValueProjected,
  heroValueLocked,
  cropYear,
  role = 'admin',
  marketingData,
}: MacroRollupViewProps) {
  const [mode, setMode] = useState<RevenueMode>('projected')
  const [activeTab, setActiveTab] = useState<'overview' | 'marketing'>('overview')
  const showFinancials = role === 'admin' || role === 'agronomist'

  const heroValue = mode === 'projected' ? heroValueProjected : heroValueLocked

  const profitableCount = rows.filter((r) => {
    const m = mode === 'projected' ? r.budgetMarginPerAcre : (r.marginPerAcre ?? r.budgetMarginPerAcre)
    return m > 0
  }).length

  if (budgetOffline && activeTab === 'overview') {
    return (
      <>
        <TabStrip active={activeTab} onChange={setActiveTab} />
        <div className="mt-6 rounded border border-glomalin-border bg-glomalin-surface px-6 py-10 text-center">
          <p className="font-mono text-sm text-glomalin-muted">
            Farm Budget is offline — start the service on port 3001 to see field data
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <TabStrip active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <>
          {showFinancials && rows.length > 0 && (
            <>
              <div className="mb-2 flex items-start justify-between">
                <Hero
                  mode={mode}
                  value={heroValue}
                  fieldCount={rows.length}
                  profitableCount={profitableCount}
                  cropYear={cropYear}
                />
                <div className="pt-1">
                  <ModeToggle mode={mode} hasContracts={hasContracts} onChange={setMode} />
                </div>
              </div>
              <div className="my-8 border-t border-glomalin-border" />
            </>
          )}

          {!showFinancials && (
            <p className="mb-6 font-mono text-xs text-glomalin-muted uppercase tracking-widest">
              {cropYear} Field Summary
            </p>
          )}

          {rows.length === 0 ? (
            <div className="mt-4 rounded border border-glomalin-border bg-glomalin-surface px-6 py-10 text-center">
              <p className="font-mono text-sm text-glomalin-muted">
                No fields found in Farm Budget — add fields and crop assignments to get started
              </p>
            </div>
          ) : (
            <FieldTable rows={rows} mode={mode} hasContracts={hasContracts} role={role} />
          )}
        </>
      )}

      {activeTab === 'marketing' && (
        <MarketingWorkspace
          commodities={marketingData.commodities}
          initialVariants={marketingData.cropVariants}
          initialInstruments={marketingData.saleInstruments}
          initialCommodityPositions={marketingData.initialCommodityPositions}
          cbotPrices={marketingData.cbotPrices}
          priceSource={marketingData.priceSource}
          priceTimestamp={marketingData.priceTimestamp}
          yieldAvailable={marketingData.yieldAvailable}
          yieldSummaries={marketingData.yieldSummaries}
          budgetFields={marketingData.budgetFields}
          cropYear={cropYear}
        />
      )}
    </>
  )
}
