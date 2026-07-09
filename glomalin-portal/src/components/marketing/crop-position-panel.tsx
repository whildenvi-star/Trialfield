'use client'

import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBu, formatUsd, formatPricePerBu, formatPct } from '@/lib/fmt'
import { applyScenario } from '@/lib/marketing/position-by-crop'
import type { CropMarketingData, HypotheticalSale } from '@/lib/marketing/position-by-crop'

// Maps short commodity symbol to CBOT root ticker for display
const CBOT_TICKER: Record<string, string> = { C: 'ZC', S: 'ZS', W: 'ZW' }

const EM = '—'

interface CropPositionPanelProps {
  crops: CropMarketingData[]
  role: string
}

export function CropPositionPanel({ crops, role }: CropPositionPanelProps) {
  if (crops.length === 0) return null
  const isOwner = role === 'owner'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {crops.map((crop) => (
        <CommodityCard key={crop.commodityName} crop={crop} isOwner={isOwner} />
      ))}
    </div>
  )
}

// ── Compact stat tile ──────────────────────────────────────────────────────
// Spec palette: cyan (accent) = positive; amber/red = warning/below break-even.
// No green in this panel.

type Tone = 'default' | 'accent' | 'warning' | 'danger' | 'bright'

const toneClass: Record<Tone, string> = {
  default: 'text-glomalin-text',
  accent: 'text-glomalin-accent-light',
  warning: 'text-glomalin-warning',
  danger: 'text-glomalin-danger',
  bright: 'text-glomalin-bright',
}

function MiniStat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  tone?: Tone
}) {
  return (
    <div className="rounded-md border border-glomalin-border/60 bg-glomalin-elevated/40 px-2.5 py-2 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-wider text-glomalin-muted truncate">
        {label}
      </p>
      <p className={`text-sm font-semibold tabular-nums leading-snug ${toneClass[tone]}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-glomalin-muted/70 truncate">{sub}</p>}
    </div>
  )
}

// ── Per-commodity card ─────────────────────────────────────────────────────

function CommodityCard({ crop, isOwner }: { crop: CropMarketingData; isOwner: boolean }) {
  const { position, budget } = crop
  const [salesOpen, setSalesOpen] = useState(false)

  const wapPerBu = position.avgPriceCents > 0 ? position.avgPriceCents / 100 : null
  const cbotTicker = crop.cbotSymbol ? CBOT_TICKER[crop.cbotSymbol] : null
  const projected = budget?.totalEstimatedBu ?? null
  const remaining = projected != null ? projected - position.contractedBu : null
  const belowBreakEven = wapPerBu != null && budget != null && wapPerBu < budget.copPerBu

  // Coverage bar: % of projected production sold. Fallback to priced/contracted
  // when no budget data exists for this crop.
  const barPct = crop.pctSold ?? (position.contractedBu > 0 ? position.pricedBu / position.contractedBu : 0)
  const barIsCoverage = crop.pctSold != null

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2 pb-2">
        <div className="flex items-center gap-2.5">
          <CardTitle className="text-lg">{crop.commodityName}</CardTitle>
          {position.contractCount > 0 && (
            <span className="text-[10px] font-mono text-glomalin-muted uppercase tracking-wider">
              {position.contractCount} sale{position.contractCount === 1 ? '' : 's'}
            </span>
          )}
          {crop.overhedged && (
            <span className="rounded-full border border-glomalin-danger/50 bg-glomalin-danger/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-glomalin-danger">
              Overhedged
            </span>
          )}
        </div>
        {crop.cbotPriceDollars != null && cbotTicker && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-glomalin-accent/40 bg-glomalin-accent/10 px-3 py-1 text-xs font-mono">
            <span className="text-glomalin-muted">{cbotTicker}</span>
            <span className="text-glomalin-bright font-semibold tabular-nums">
              {formatPricePerBu(crop.cbotPriceDollars)}
            </span>
          </span>
        )}
      </CardHeader>

      <div className="px-4 pb-4 space-y-3">
        {/* Coverage bar — % of projected production sold */}
        <div>
          <div className="flex justify-between text-[10px] font-mono text-glomalin-muted mb-1">
            <span className={crop.overhedged ? 'text-glomalin-danger' : 'text-glomalin-accent-light'}>
              {formatPct(barPct)} {barIsCoverage ? 'of projected sold' : 'of contracted priced'}
            </span>
            {remaining != null ? (
              <span>{formatBu(Math.max(0, remaining))} bu unsold</span>
            ) : (
              <span>{formatBu(position.openBu)} bu unpriced</span>
            )}
          </div>
          <div className="h-2 rounded-full bg-glomalin-border/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${crop.overhedged ? 'bg-glomalin-danger' : 'bg-glomalin-accent'}`}
              style={{ width: `${Math.min(100, barPct * 100)}%` }}
            />
          </div>
          {crop.overhedged && projected != null && (
            <p className="mt-1 text-[10px] font-mono text-glomalin-danger">
              Sold {formatBu(position.contractedBu)} bu against {formatBu(Math.round(projected))} bu projected ({formatPct(barPct)})
            </p>
          )}
        </div>

        {/* Position stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MiniStat
            label="Projected"
            value={projected != null ? formatBu(Math.round(projected)) : EM}
            sub={projected != null ? 'bu' : 'set costs in Budget tab'}
            tone="bright"
          />
          <MiniStat
            label="Sold"
            value={formatBu(position.contractedBu)}
            sub={crop.pctSold != null ? formatPct(crop.pctSold) + ' of projected' : 'bu'}
            tone="accent"
          />
          <MiniStat
            label="Remaining"
            value={remaining != null ? formatBu(Math.max(0, Math.round(remaining))) : EM}
            sub="unsold bu"
            tone={remaining != null && remaining <= 0 ? 'danger' : 'default'}
          />
          <MiniStat
            label="Avg sale"
            value={wapPerBu != null ? formatPricePerBu(wapPerBu) : EM}
            sub={belowBreakEven ? 'below break-even' : 'weighted avg'}
            tone={belowBreakEven ? 'danger' : wapPerBu != null ? 'accent' : 'default'}
          />
          <MiniStat
            label="Break-even"
            value={budget != null ? formatPricePerBu(budget.copPerBu) : EM}
            sub={budget != null ? 'COP / bu' : 'set costs in Budget tab'}
            tone="bright"
          />
          <MiniStat
            label="Margin locked"
            value={
              crop.marginLockedPerBu != null
                ? (crop.marginLockedPerBu >= 0 ? '+' : '') + formatPricePerBu(crop.marginLockedPerBu)
                : EM
            }
            sub={
              crop.marginLockedTotal != null
                ? `${crop.marginLockedTotal < 0 ? '-' : ''}${formatUsd(Math.abs(crop.marginLockedTotal))} on ${formatBu(position.pricedBu)} bu`
                : 'needs sales + costs'
            }
            tone={
              crop.marginLockedPerBu == null
                ? 'default'
                : crop.marginLockedPerBu >= 0
                  ? 'accent'
                  : 'danger'
            }
          />
        </div>

        {belowBreakEven && (
          <p className="rounded border border-glomalin-danger/40 bg-glomalin-danger/10 px-3 py-2 text-[11px] font-mono text-glomalin-danger">
            Average sale price is below break-even
          </p>
        )}

        {/* Expandable sales list */}
        {crop.sales.length > 0 && (
          <div className="rounded border border-glomalin-border/60 overflow-hidden">
            <button
              onClick={() => setSalesOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-glomalin-muted hover:text-glomalin-accent-light hover:bg-glomalin-elevated/40 transition-colors"
            >
              <span className="uppercase tracking-wider">
                {salesOpen ? '▾' : '▸'} {crop.sales.length} sale{crop.sales.length === 1 ? '' : 's'}
              </span>
              <span>{salesOpen ? 'hide' : 'show'}</span>
            </button>
            {salesOpen && (
              <div className="overflow-x-auto border-t border-glomalin-border/60">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-glomalin-border/60 bg-glomalin-elevated/50 text-glomalin-muted">
                      <th className="px-2.5 py-1.5 text-left font-medium uppercase tracking-wider">Date</th>
                      <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">Bu</th>
                      <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">$/bu</th>
                      <th className="px-2.5 py-1.5 text-left font-medium uppercase tracking-wider">Type</th>
                      <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">Cum %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crop.sales.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-glomalin-border/40 last:border-0 hover:bg-glomalin-elevated/30 transition-colors"
                      >
                        <td className="px-2.5 py-1.5 text-glomalin-muted whitespace-nowrap">
                          {s.date ? s.date.slice(0, 10) : EM}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-glomalin-text">
                          {formatBu(s.bushels)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-glomalin-text">
                          {s.priceDollars != null ? formatPricePerBu(s.priceDollars) : EM}
                        </td>
                        <td className="px-2.5 py-1.5 text-glomalin-muted">{s.instrument}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-glomalin-accent-light">
                          {s.cumulativePctSold != null ? formatPct(s.cumulativePctSold) : EM}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Variant breakdown — only when there's more than one variant */}
        {crop.variantBreakdown.length > 1 && (
          <div className="overflow-x-auto rounded border border-glomalin-border/60">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-glomalin-border/60 bg-glomalin-elevated/50 text-glomalin-muted">
                  <th className="px-2.5 py-1.5 text-left font-medium uppercase tracking-wider">Variant</th>
                  <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">Contr.</th>
                  <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">Open</th>
                  <th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider">Avg $</th>
                </tr>
              </thead>
              <tbody>
                {crop.variantBreakdown.map((v) => (
                  <tr
                    key={v.variantId}
                    className="border-b border-glomalin-border/40 last:border-0 hover:bg-glomalin-elevated/30 transition-colors"
                  >
                    <td className="px-2.5 py-1.5 text-glomalin-text truncate max-w-[140px]">{v.variantName}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-glomalin-text">
                      {formatBu(v.contractedBu)}
                    </td>
                    <td className={`px-2.5 py-1.5 text-right tabular-nums ${v.openBu > 0 ? 'text-glomalin-warning' : 'text-glomalin-muted'}`}>
                      {formatBu(v.openBu)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-glomalin-text">
                      {v.avgPriceCents > 0 ? formatPricePerBu(v.avgPriceCents / 100) : EM}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* What-if simulator — owner only */}
        {isOwner && <WhatIfBox crop={crop} />}
      </div>
    </Card>
  )
}

// ── What-if simulator — stackable hypothetical sales, pure client state ────

function WhatIfBox({ crop }: { crop: CropMarketingData }) {
  const defaultPrice =
    crop.cbotPriceDollars ??
    (crop.position.avgPriceCents > 0 ? crop.position.avgPriceCents / 100 : null) ??
    crop.budget?.copPerBu ??
    0

  const [pendingBu, setPendingBu] = useState('')
  const [pendingPrice, setPendingPrice] = useState(defaultPrice > 0 ? defaultPrice.toFixed(2) : '')
  const [scenario, setScenario] = useState<HypotheticalSale[]>([])

  const result = useMemo(() => applyScenario(crop, scenario), [crop, scenario])

  const before = useMemo(() => applyScenario(crop, []), [crop])

  function addSale() {
    const bushels = Number(pendingBu)
    const priceDollars = Number(pendingPrice)
    if (bushels > 0 && priceDollars > 0) {
      setScenario((s) => [...s, { bushels, priceDollars }])
      setPendingBu('')
    }
  }

  function removeSale(idx: number) {
    setScenario((s) => s.filter((_, i) => i !== idx))
  }

  const hasScenario = scenario.length > 0

  return (
    <div className="rounded-lg border border-glomalin-accent/25 bg-glomalin-accent/[0.04] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono text-glomalin-accent-light uppercase tracking-widest">
          ▸ What-if — hypothetical
        </p>
        {hasScenario && (
          <button
            onClick={() => setScenario([])}
            className="text-[10px] text-glomalin-muted hover:text-glomalin-danger transition-colors font-mono uppercase tracking-wider"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Entry row — thumb-sized on mobile */}
      <div className="flex items-end gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] font-mono text-glomalin-muted mb-0.5">Sell (bu)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="20,000"
            value={pendingBu}
            onChange={(e) => setPendingBu(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSale()}
            className="w-full rounded border border-glomalin-border bg-glomalin-surface px-2.5 py-2 text-sm font-mono text-glomalin-bright focus:border-glomalin-accent focus:outline-none tabular-nums"
          />
        </div>
        <span className="pb-2.5 text-glomalin-muted text-xs font-mono">@</span>
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] font-mono text-glomalin-muted mb-0.5">$/bu</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={pendingPrice}
            onChange={(e) => setPendingPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSale()}
            className="w-full rounded border border-glomalin-border bg-glomalin-surface px-2.5 py-2 text-sm font-mono text-glomalin-bright focus:border-glomalin-accent focus:outline-none tabular-nums"
          />
        </div>
        <button
          onClick={addSale}
          disabled={!(Number(pendingBu) > 0 && Number(pendingPrice) > 0)}
          className="rounded border border-glomalin-accent/50 bg-glomalin-accent/15 px-4 py-2 text-sm font-mono text-glomalin-accent-light hover:bg-glomalin-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {/* Stacked hypothetical sales */}
      {hasScenario && (
        <div className="mb-3 space-y-1">
          {scenario.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded border border-dashed border-glomalin-accent/30 bg-glomalin-surface/60 px-2.5 py-1.5 text-[11px] font-mono"
            >
              <span className="text-glomalin-text tabular-nums">
                {formatBu(h.bushels)} bu @ {formatPricePerBu(h.priceDollars)}
                <span className="ml-2 text-glomalin-muted">= {formatUsd(h.bushels * h.priceDollars)}</span>
              </span>
              <button
                onClick={() => removeSale(i)}
                aria-label="Remove hypothetical sale"
                className="text-glomalin-muted hover:text-glomalin-danger transition-colors px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Before → after */}
      {hasScenario && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-1.5">
            <DeltaRow
              label="% sold"
              before={before.newPctSold != null ? formatPct(before.newPctSold) : EM}
              after={result.newPctSold != null ? formatPct(result.newPctSold) : EM}
              tone={result.overhedged ? 'danger' : 'accent'}
            />
            <DeltaRow
              label="Blended avg"
              before={before.newWAPDollars != null ? formatPricePerBu(before.newWAPDollars) : EM}
              after={result.newWAPDollars != null ? formatPricePerBu(result.newWAPDollars) : EM}
              tone={
                result.marginPerBu == null ? 'bright' : result.marginPerBu >= 0 ? 'accent' : 'danger'
              }
            />
            <DeltaRow
              label="Margin / bu"
              before={
                before.marginPerBu != null
                  ? (before.marginPerBu >= 0 ? '+' : '') + formatPricePerBu(before.marginPerBu)
                  : EM
              }
              after={
                result.marginPerBu != null
                  ? (result.marginPerBu >= 0 ? '+' : '') + formatPricePerBu(result.marginPerBu)
                  : EM
              }
              tone={
                result.marginPerBu == null ? 'default' : result.marginPerBu >= 0 ? 'accent' : 'danger'
              }
            />
          </div>

          {result.overhedged && (
            <p className="text-[10px] font-mono text-glomalin-danger">
              ⚠ Scenario sells {result.newPctSold != null ? formatPct(result.newPctSold) : '>100%'} of projected production — overhedged
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <MiniStat
              label="Locked revenue"
              value={formatUsd(result.lockedRevenue)}
              sub={`${formatBu(result.newPricedBu)} priced bu`}
              tone="accent"
            />
            <MiniStat
              label="vs total crop cost"
              value={
                result.profitVsTotalCOP != null
                  ? `${result.profitVsTotalCOP < 0 ? '-' : '+'}${formatUsd(Math.abs(result.profitVsTotalCOP))}`
                  : EM
              }
              sub={
                result.totalCOP != null
                  ? `total COP ${formatUsd(result.totalCOP)}`
                  : 'set costs in Budget tab'
              }
              tone={
                result.profitVsTotalCOP == null
                  ? 'default'
                  : result.profitVsTotalCOP >= 0
                    ? 'accent'
                    : 'warning'
              }
            />
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('glomalin:open-new-contract'))}
            className="w-full rounded border border-glomalin-border px-3 py-2 text-[11px] font-mono text-glomalin-muted hover:border-glomalin-accent hover:text-glomalin-accent-light transition-colors"
          >
            Enter as real contract →
          </button>
        </div>
      )}

      <p className="mt-3 text-[10px] text-glomalin-muted/60 italic font-mono">
        Hypothetical only — nothing here is saved.
      </p>
    </div>
  )
}

function DeltaRow({
  label,
  before,
  after,
  tone,
}: {
  label: string
  before: string
  after: string
  tone: Tone
}) {
  return (
    <div className="flex items-center justify-between rounded bg-glomalin-elevated/40 px-2.5 py-1.5 text-[11px] font-mono">
      <span className="text-glomalin-muted uppercase tracking-wider text-[10px]">{label}</span>
      <span className="tabular-nums">
        <span className="text-glomalin-muted">{before}</span>
        <span className="mx-1.5 text-glomalin-muted/50">→</span>
        <span className={`font-semibold ${toneClass[tone]}`}>{after}</span>
      </span>
    </div>
  )
}
