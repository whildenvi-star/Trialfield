'use client'

import { useState } from 'react'
import { FieldTable } from '@/components/macro/field-table'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'
import { Tabs } from '@/components/ui/tabs'
import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { Empty } from '@/components/ui/empty'
import { formatUsd, formatPct } from '@/lib/fmt'
import type { FieldRow } from '@/components/macro/field-table'
import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  CommodityPricing,
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
  initialPricingConfigs: CommodityPricing[]
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

// Local alias for readability — kept in sync with src/lib/fmt
const fmtDollars = formatUsd

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
// Large net-margin hero with KPI strip showing field profitability breakdown.

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
        ? 'text-glomalin-accent-light'
        : 'text-glomalin-danger'

  const pctProfitable = fieldCount > 0 ? formatPct(profitableCount / fieldCount) : '—'

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
      <p className="mt-2 font-mono text-xs text-glomalin-muted/70">{sublabel}</p>

      {fieldCount > 0 && (
        <KpiStrip cols={3} className="mt-4">
          <StatCard label="Fields" value={fieldCount.toString()} sublabel={`${cropYear} crop year`} />
          <StatCard
            label="Profitable"
            value={`${profitableCount} / ${fieldCount}`}
            sublabel={pctProfitable}
            variant={profitableCount === fieldCount ? 'success' : profitableCount > 0 ? 'default' : 'danger'}
          />
          <StatCard
            label="Net Margin"
            value={value != null ? fmtDollars(value) : '—'}
            variant={value == null ? 'default' : value >= 0 ? 'success' : 'danger'}
          />
        </KpiStrip>
      )}
    </div>
  )
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const PLANNER_TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'marketing' as const, label: 'Sales & Marketing' },
]

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
        <Tabs tabs={PLANNER_TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />
        <Empty title="Farm Budget offline" description="Start the service on port 3001 to see field data." />
      </>
    )
  }

  return (
    <>
      <Tabs tabs={PLANNER_TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

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
            <Empty title="No fields found" description="Add fields and crop assignments in Farm Budget to get started." />
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
          initialPricingConfigs={marketingData.initialPricingConfigs}
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
