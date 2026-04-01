'use client'

import { Fragment, useState } from 'react'
import type { RevenueMode } from '@/components/macro/macro-rollup-view'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContractEntry {
  id: string
  buyer: string | null
  contractType: string
  bushels: number
  pricePerBushel: number | null
  deliveryStart: string | null
  deliveryEnd: string | null
  total: number | null
}

export interface CostBreakdown {
  rent: number
  fert: number
  seed: number
  machinery: number
  labor: number
  fuel: number
  drying: number
  interest: number
  insurance: number
}

export interface FieldRow {
  fieldId: string
  fieldName: string
  crop: string
  acres: number
  totalCost: number
  costPerAcre: number
  costBreakdown: CostBreakdown
  revenue: number | null
  revenuePerAcre: number | null
  margin: number | null
  marginPerAcre: number | null
  budgetMarginPerAcre: number
  budgetRevenuePerAcre: number
  contracts: ContractEntry[]
  missingData: string[]
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDollars(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDollarsExact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtAcres(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function fmtBushels(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ── Status dot ─────────────────────────────────────────────────────────────────

function StatusDot({ margin, isEstimate }: { margin: number | null; isEstimate: boolean }) {
  if (margin === null) {
    return (
      <span title="Incomplete data">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-glomalin-muted/50" />
      </span>
    )
  }
  if (margin > 0) {
    return (
      <span title={isEstimate ? 'Budget estimate: profitable' : 'Profitable'}>
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-glomalin-green opacity-80" />
      </span>
    )
  }
  return (
    <span title={isEstimate ? 'Budget estimate: losing money' : 'Losing money'}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 opacity-80" />
    </span>
  )
}

// ── Expand chevron ─────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

// ── Detail panel (Layer 3) ─────────────────────────────────────────────────────

function FieldDetail({ row, mode }: { row: FieldRow; mode: RevenueMode }) {
  const costCategories: { label: string; key: keyof CostBreakdown }[] = [
    { label: 'Land Rent', key: 'rent' },
    { label: 'Fertilizer', key: 'fert' },
    { label: 'Seed', key: 'seed' },
    { label: 'Machinery', key: 'machinery' },
    { label: 'Labor & Overhead', key: 'labor' },
    { label: 'Fuel', key: 'fuel' },
    { label: 'Drying', key: 'drying' },
    { label: 'Interest', key: 'interest' },
    { label: 'Crop Insurance', key: 'insurance' },
  ]

  return (
    <tr className="bg-glomalin-highlight">
      <td colSpan={8} className="px-6 py-5">
        <div className="grid grid-cols-2 gap-8">

          {/* Revenue breakdown */}
          <div>
            <h4 className="mb-3 font-mono text-xs uppercase tracking-wider text-glomalin-accent">
              Revenue
            </h4>
            {mode === 'projected' ? (
              <p className="font-mono text-sm text-glomalin-muted italic">
                Budget estimate at farm price —{' '}
                <span className="not-italic text-glomalin-text">
                  {fmtDollars(row.budgetRevenuePerAcre * row.acres)}
                </span>
                <span className="ml-1 text-xs">
                  ({fmtDollarsExact(row.budgetRevenuePerAcre)}/ac)
                </span>
              </p>
            ) : row.contracts.length > 0 ? (
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-left text-xs text-glomalin-muted">
                    <th className="pb-2 font-normal">Buyer</th>
                    <th className="pb-2 text-right font-normal">Bu</th>
                    <th className="pb-2 text-right font-normal">Price</th>
                    <th className="pb-2 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glomalin-border">
                  {row.contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5 text-glomalin-text">
                        {c.buyer ?? '—'}
                        <span className="ml-1.5 text-xs text-glomalin-muted">({c.contractType})</span>
                      </td>
                      <td className="py-1.5 text-right text-glomalin-text">{fmtBushels(c.bushels)}</td>
                      <td className="py-1.5 text-right text-glomalin-text">
                        {c.pricePerBushel != null ? fmtDollarsExact(c.pricePerBushel) : '—'}
                      </td>
                      <td className="py-1.5 text-right text-glomalin-text">
                        {c.total != null ? fmtDollars(c.total) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="font-mono text-sm text-glomalin-muted italic">
                No contracts for {row.crop}
              </p>
            )}
          </div>

          {/* Cost breakdown */}
          <div>
            <h4 className="mb-3 font-mono text-xs uppercase tracking-wider text-glomalin-accent">
              Costs / Acre
            </h4>
            <table className="w-full text-sm font-mono">
              <tbody className="divide-y divide-glomalin-border">
                {costCategories
                  .filter((c) => row.costBreakdown[c.key] > 0)
                  .map((c) => (
                    <tr key={c.key}>
                      <td className="py-1.5 text-glomalin-muted">{c.label}</td>
                      <td className="py-1.5 text-right text-glomalin-text">
                        {fmtDollarsExact(row.costBreakdown[c.key])}
                      </td>
                    </tr>
                  ))}
                <tr className="border-t-2 border-glomalin-border">
                  <td className="py-1.5 font-semibold text-glomalin-text">Total</td>
                  <td className="py-1.5 text-right font-semibold text-glomalin-text">
                    {fmtDollarsExact(row.costPerAcre)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* Missing data callout */}
        {row.missingData.length > 0 && (
          <div className="mt-4 rounded border border-glomalin-border bg-glomalin-surface px-4 py-3">
            <p className="font-mono text-xs text-glomalin-muted">
              <span className="text-glomalin-text">Missing: </span>
              {row.missingData.join(' · ')}
            </p>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FieldTable({
  rows,
  mode,
  hasContracts,
}: {
  rows: FieldRow[]
  mode: RevenueMode
  hasContracts: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const revenueLabel = mode === 'projected' ? 'Proj. Revenue' : 'Locked Revenue'

  return (
    <div className="rounded border border-glomalin-border overflow-hidden">
      <table className="w-full text-sm font-mono">
        <thead className="border-b border-glomalin-border bg-glomalin-surface">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              Field
            </th>
            <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              Acres
            </th>
            <th className="px-4 py-3 text-left text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              Crop
            </th>
            <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              {revenueLabel}
            </th>
            <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              Costs
            </th>
            <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              Margin
            </th>
            <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              $/Acre
            </th>
            <th className="px-4 py-3 text-center text-xs font-normal uppercase tracking-wider text-glomalin-muted">
              {/* status */}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-glomalin-border">
          {rows.map((row) => {
            const isOpen = expandedId === row.fieldId
            const isProjected = mode === 'projected'
            const displayRevenue = isProjected
              ? row.budgetRevenuePerAcre * row.acres
              : (row.revenue ?? 0)
            const displayMargin = isProjected
              ? row.budgetMarginPerAcre * row.acres
              : (row.margin ?? 0)
            const displayMarginPerAcre = isProjected
              ? row.budgetMarginPerAcre
              : (row.marginPerAcre ?? row.budgetMarginPerAcre)
            const statusMargin = displayMarginPerAcre

            return (
              <Fragment key={row.fieldId}>
                <tr
                  className="cursor-pointer bg-glomalin-bg hover:bg-glomalin-surface transition-colors"
                  onClick={() => toggle(row.fieldId)}
                  aria-expanded={isOpen}
                >
                  {/* Field name + expand chevron */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-glomalin-text">{row.fieldName}</span>
                      <span className="text-glomalin-muted">
                        <Chevron open={isOpen} />
                      </span>
                    </div>
                  </td>

                  {/* Acres */}
                  <td className="px-4 py-3 text-right text-glomalin-muted">
                    {fmtAcres(row.acres)}
                  </td>

                  {/* Crop */}
                  <td className="px-4 py-3 text-glomalin-muted">{row.crop}</td>

                  {/* Revenue */}
                  <td className="px-4 py-3 text-right text-glomalin-text">
                    {fmtDollars(displayRevenue)}
                  </td>

                  {/* Costs */}
                  <td className="px-4 py-3 text-right text-glomalin-text">
                    {fmtDollars(row.totalCost)}
                  </td>

                  {/* Margin */}
                  <td className="px-4 py-3 text-right">
                    <span className={displayMargin >= 0 ? 'text-glomalin-green' : 'text-red-400'}>
                      {fmtDollars(displayMargin)}
                    </span>
                  </td>

                  {/* $/Acre */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={displayMarginPerAcre >= 0 ? 'text-glomalin-green' : 'text-red-400'}
                    >
                      {fmtDollarsExact(displayMarginPerAcre)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusDot margin={statusMargin} isEstimate={isProjected} />
                  </td>
                </tr>

                {/* Expand: Layer 3 detail */}
                {isOpen && <FieldDetail row={row} mode={mode} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      <div className="border-t border-glomalin-border bg-glomalin-surface px-4 py-2">
        <p className="font-mono text-xs text-glomalin-muted">
          {mode === 'projected'
            ? 'Projected — farm-budget price × yield estimate. Switch to Locked In to see contracted position.'
            : 'Locked In — contracted bushels only. Uncontracted production not included in margin.'}
        </p>
      </div>
    </div>
  )
}
