'use client'

// Enterprise position table — commodity rows (per crop year) expandable into
// variant sub-rows, under the owner's pooled-marketing model. Office role
// receives rows with financial keys OMITTED server-side; this component only
// ever renders what it was given.

import { Fragment, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBu, formatUsd, formatPricePerBu, formatPct } from '@/lib/fmt'
import { applyScenario } from '@/lib/marketing/position-by-crop'
import type { CropMarketingData, HypotheticalSale } from '@/lib/marketing/position-by-crop'
import type {
  CommodityRollupRow,
  OfficeCommodityRollupRow,
  VariantRollupRow,
} from '@/lib/marketing/enterprise-rollup'
import type { EnterpriseDataNotes } from '@/lib/marketing/load-enterprise-data'

const EM = '—'
const CBOT_TICKER: Record<string, string> = { C: 'ZC', S: 'ZS', W: 'ZW' }

// Owner rows carry financials; office rows omit them. Render through one view
// type where every financial field is optional.
type RowView = OfficeCommodityRollupRow &
  Partial<Pick<CommodityRollupRow,
    'cbotPriceDollars' | 'poolWapCents' | 'wapCents' | 'copPerBu' | 'copPerAcre' |
    'totalCost' | 'grossSalesDollars' | 'settledRevenue' | 'blendedIfSoldTodayCents'>> & {
    variants: Array<Omit<VariantRollupRow, never> | OfficeCommodityRollupRow['variants'][number]>
  }
type VariantView = Partial<VariantRollupRow> & OfficeCommodityRollupRow['variants'][number]

interface EnterprisePositionTableProps {
  rows: Array<CommodityRollupRow | OfficeCommodityRollupRow>
  isOwner: boolean
  cropYear: number
  notes: EnterpriseDataNotes
  /** collapsed = header + rows only, no card chrome opened by default */
  defaultOpen?: boolean
}

export function EnterprisePositionTable({
  rows: rawRows,
  isOwner,
  cropYear,
  notes,
  defaultOpen = true,
}: EnterprisePositionTableProps) {
  const rows = rawRows as RowView[]
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (rows.length === 0) return null

  const toggleRow = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2 pb-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 text-left"
        >
          <CardTitle className="text-lg">
            <span className="text-glomalin-muted font-mono text-sm mr-1.5">{open ? '▾' : '▸'}</span>
            Enterprise Position
          </CardTitle>
          <span className="text-[10px] font-mono text-glomalin-muted uppercase tracking-wider">
            {cropYear} crop
          </span>
        </button>
        {!notes.budgetAvailable && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-glomalin-warning">
            no {cropYear} crop plan — volumes only
          </span>
        )}
      </CardHeader>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <div className="overflow-x-auto rounded border border-glomalin-border/60">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-glomalin-border/60 bg-glomalin-elevated/50 text-glomalin-muted">
                  <Th left>Enterprise</Th>
                  <Th>Acres</Th>
                  <Th>Proj Yld</Th>
                  <Th>Proj Bu</Th>
                  <Th>Actual Bu</Th>
                  <Th>Sold Bu</Th>
                  <Th left>% Sold</Th>
                  {isOwner && (
                    <>
                      <Th>Avg Sale</Th>
                      <Th>COP/bu</Th>
                      <Th>Gross Sales</Th>
                      <Th>@ Today</Th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={`${row.commodityName}-${row.cropYear}`}>
                    <CommodityTr
                      row={row}
                      isOwner={isOwner}
                      expanded={expanded.has(row.commodityName)}
                      onToggle={() => toggleRow(row.commodityName)}
                    />
                    {expanded.has(row.commodityName) && (
                      <>
                        {(row.variants as VariantView[]).map((v) => (
                          <VariantTr key={v.variantName} v={v} isOwner={isOwner} />
                        ))}
                        {isOwner && row.poolWapCents != null && (
                          <tr className="border-b border-glomalin-border/40 bg-glomalin-accent/[0.03]">
                            <td colSpan={11} className="px-2.5 py-1.5 text-[10px] text-glomalin-muted">
                              <span className="uppercase tracking-wider text-glomalin-accent-light">Pool</span>
                              {' '}· all {row.commodityName.toLowerCase()} sales share a futures-equivalent avg of{' '}
                              <span className="text-glomalin-bright tabular-nums">{formatPricePerBu(row.poolWapCents / 100)}</span>
                              {' '}on {formatBu(row.pricedBu)} priced bu — each variant adds its own premium at delivery
                            </td>
                          </tr>
                        )}
                        {isOwner && (
                          <tr className="border-b border-glomalin-border/40">
                            <td colSpan={11} className="px-2.5 py-2">
                              <RowWhatIf row={row} />
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-glomalin-muted/70">
            {isOwner && notes.cbotAvailable && (
              <span>@ Today = priced revenue + unsold projection at live CBOT (delayed)</span>
            )}
            <ExcludedTicketsWarning notes={notes} />
            {!notes.ticketsAvailable && <span>grain-tickets offline — actuals unavailable</span>}
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Excluded-tickets warning ───────────────────────────────────────────────

const EXCLUDED_REASON: Record<string, string> = {
  noCropId: 'crop not linked to a registry crop — edit the ticket and pick the crop from the registry list',
  noFieldId: 'farm has no registry ID — needs re-linking in Grain Tickets Admin',
}

function ExcludedTicketsWarning({ notes }: { notes: EnterpriseDataNotes }) {
  const [showDetails, setShowDetails] = useState(false)
  const count =
    (notes.excludedTickets?.noFieldId ?? 0) + (notes.excludedTickets?.noCropId ?? 0)
  if (count === 0) return null

  const details = notes.excludedTicketDetails
  const label = `${count} scale ticket${count === 1 ? '' : 's'} missing registry IDs excluded from actuals`

  // Older grain-tickets responses carry only the count — link straight through
  if (!details || details.length === 0) {
    return (
      <a href="/app/grain-tickets" className="text-glomalin-warning underline hover:opacity-80">
        {label}
      </a>
    )
  }

  return (
    <div className="basis-full">
      <button
        onClick={() => setShowDetails((s) => !s)}
        className="text-glomalin-warning hover:opacity-80 text-left"
      >
        <span className="mr-1">{showDetails ? '▾' : '▸'}</span>
        {label}
      </button>
      {showDetails && (
        <ul className="mt-1 ml-4 space-y-1">
          {details.map((t) => (
            <li key={t.id} className="text-glomalin-warning/90">
              <span className="text-glomalin-bright">#{t.id}</span>
              {' '}· {String(t.date).slice(0, 10)} · {t.farm} · {t.crop}
              {' '}— {EXCLUDED_REASON[t.reason] ?? t.reason}{' '}
              <a href="/app/grain-tickets" className="underline hover:opacity-80">
                open Grain Tickets
              </a>
            </li>
          ))}
          {details.length < count && (
            <li className="text-glomalin-muted">…and {count - details.length} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Rows ───────────────────────────────────────────────────────────────────

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th className={`px-2.5 py-1.5 font-medium uppercase tracking-wider whitespace-nowrap ${left ? 'text-left' : 'text-right'}`}>
      {children}
    </th>
  )
}

function Num({ children, tone = 'text-glomalin-text' }: { children: React.ReactNode; tone?: string }) {
  return <td className={`px-2.5 py-2 text-right tabular-nums whitespace-nowrap ${tone}`}>{children}</td>
}

function CommodityTr({
  row,
  isOwner,
  expanded,
  onToggle,
}: {
  row: RowView
  isOwner: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const ticker = row.cbotSymbol ? CBOT_TICKER[row.cbotSymbol] : null
  const belowBreakEven =
    row.wapCents != null && row.wapCents > 0 && row.copPerBu != null && row.wapCents / 100 < row.copPerBu

  return (
    <tr
      onClick={onToggle}
      className="border-b border-glomalin-border/40 cursor-pointer hover:bg-glomalin-elevated/30 transition-colors"
    >
      <td className="px-2.5 py-2 whitespace-nowrap">
        <span className="text-glomalin-muted mr-1.5">{expanded ? '▾' : '▸'}</span>
        <span className="text-glomalin-bright font-semibold">{row.commodityName}</span>
        {row.overhedged && (
          <span className="ml-2 rounded-full border border-glomalin-danger/50 bg-glomalin-danger/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-glomalin-danger">
            Overhedged
          </span>
        )}
        {isOwner && ticker && row.cbotPriceDollars != null && (
          <span className="ml-2 text-[10px] text-glomalin-muted">
            {ticker} <span className="text-glomalin-accent-light tabular-nums">{formatPricePerBu(row.cbotPriceDollars)}</span>
          </span>
        )}
      </td>
      <Num>{row.acres != null ? formatBu(Math.round(row.acres)) : EM}</Num>
      <Num tone="text-glomalin-muted">
        {row.projYieldPerAcre != null ? Math.round(row.projYieldPerAcre) : EM}
      </Num>
      <Num>{row.projectedBu != null ? formatBu(Math.round(row.projectedBu)) : EM}</Num>
      <Num tone={row.actualBu != null ? 'text-glomalin-text' : 'text-glomalin-muted'}>
        {row.actualBu != null ? formatBu(Math.round(row.actualBu)) : EM}
      </Num>
      <Num tone="text-glomalin-accent-light">{formatBu(row.soldBu)}</Num>
      <td className="px-2.5 py-2 min-w-[110px]">
        {row.pctSold != null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 min-w-[48px] rounded-full bg-glomalin-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${row.overhedged ? 'bg-glomalin-danger' : 'bg-glomalin-accent'}`}
                style={{ width: `${Math.min(100, row.pctSold * 100)}%` }}
              />
            </div>
            <span className={`tabular-nums text-[10px] ${row.overhedged ? 'text-glomalin-danger' : 'text-glomalin-accent-light'}`}>
              {formatPct(row.pctSold)}
            </span>
          </div>
        ) : (
          <span className="text-glomalin-muted">{EM}</span>
        )}
      </td>
      {isOwner && (
        <>
          <Num tone={belowBreakEven ? 'text-glomalin-danger' : 'text-glomalin-text'}>
            {row.wapCents != null && row.wapCents > 0 ? formatPricePerBu(row.wapCents / 100) : EM}
          </Num>
          <Num tone="text-glomalin-muted">
            {row.copPerBu != null ? formatPricePerBu(row.copPerBu) : EM}
          </Num>
          <Num>
            {row.grossSalesDollars != null && row.grossSalesDollars > 0
              ? formatUsd(row.grossSalesDollars)
              : EM}
          </Num>
          <Num tone="text-glomalin-bright font-semibold">
            {row.blendedIfSoldTodayCents != null
              ? formatPricePerBu(row.blendedIfSoldTodayCents / 100)
              : EM}
          </Num>
        </>
      )}
    </tr>
  )
}

function VariantTr({ v, isOwner }: { v: VariantView; isOwner: boolean }) {
  return (
    <tr className="border-b border-glomalin-border/40 bg-glomalin-elevated/20">
      <td className="px-2.5 py-1.5 whitespace-nowrap">
        <span className="ml-5 text-glomalin-text">{v.variantName}</span>
        {v.budgetCropNames.length > 0 && (
          <span className="ml-2 text-[9px] text-glomalin-muted/70">({v.budgetCropNames.join(', ')})</span>
        )}
      </td>
      <Num tone="text-glomalin-muted">{v.acres != null ? formatBu(Math.round(v.acres)) : EM}</Num>
      <Num tone="text-glomalin-muted">
        {v.projYieldPerAcre != null ? Math.round(v.projYieldPerAcre) : EM}
      </Num>
      <Num tone="text-glomalin-muted">{v.projectedBu != null ? formatBu(Math.round(v.projectedBu)) : EM}</Num>
      <Num tone="text-glomalin-muted">{v.actualBu != null ? formatBu(Math.round(v.actualBu)) : EM}</Num>
      <Num tone="text-glomalin-text">{formatBu(v.soldBu)}</Num>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-[10px] text-glomalin-muted">
        {v.pctSold != null ? formatPct(v.pctSold) : EM}
      </td>
      {isOwner && (
        <>
          <Num tone="text-glomalin-text">
            {v.wapCents != null && v.wapCents > 0 ? formatPricePerBu(v.wapCents / 100) : EM}
          </Num>
          <Num tone="text-glomalin-muted">{v.copPerBu != null ? formatPricePerBu(v.copPerBu) : EM}</Num>
          <td className="px-2.5 py-1.5 text-right tabular-nums text-[10px] text-glomalin-muted whitespace-nowrap">
            {v.premiumPerBu != null && v.premiumPerBu !== 0
              ? `${v.premiumPerBu > 0 ? '+' : ''}${formatPricePerBu(v.premiumPerBu)} prem`
              : EM}
          </td>
          <Num tone="text-glomalin-accent-light">
            {v.pooledPriceCents != null ? formatPricePerBu(v.pooledPriceCents / 100) : EM}
          </Num>
        </>
      )}
    </tr>
  )
}

// ── What-if adapter — feeds the pooled figures through applyScenario ───────

function RowWhatIf({ row }: { row: RowView }) {
  const crop: CropMarketingData = useMemo(
    () => ({
      commodityName: row.commodityName,
      cbotSymbol: row.cbotSymbol,
      cbotPriceDollars: row.cbotPriceDollars ?? null,
      position: {
        contractedBu: row.soldBu,
        pricedBu: row.pricedBu,
        openBu: row.soldBu - row.pricedBu,
        avgPriceCents: row.wapCents ?? 0,
        contractCount: 0,
      },
      variantBreakdown: [],
      sales: [],
      budget:
        row.projectedBu != null && row.acres != null && row.copPerBu != null && row.acres > 0
          ? {
              acres: row.acres,
              expPerAcre: (row.totalCost ?? 0) / row.acres,
              yieldPerAcre: row.projectedBu / row.acres,
              copPerBu: row.copPerBu,
              totalEstimatedBu: row.projectedBu,
              totalCost: row.totalCost ?? 0,
            }
          : null,
      pctSold: row.pctSold,
      overhedged: row.overhedged,
      marginLockedPerBu: null,
      marginLockedTotal: null,
    }),
    [row]
  )

  const defaultPrice = row.cbotPriceDollars ?? (row.wapCents != null && row.wapCents > 0 ? row.wapCents / 100 : 0)
  const [pendingBu, setPendingBu] = useState('')
  const [pendingPrice, setPendingPrice] = useState(defaultPrice > 0 ? defaultPrice.toFixed(2) : '')
  const [scenario, setScenario] = useState<HypotheticalSale[]>([])
  const result = useMemo(() => applyScenario(crop, scenario), [crop, scenario])

  function addSale() {
    const bushels = Number(pendingBu)
    const priceDollars = Number(pendingPrice)
    if (bushels > 0 && priceDollars > 0) {
      setScenario((s) => [...s, { bushels, priceDollars }])
      setPendingBu('')
    }
  }

  return (
    <div className="rounded border border-glomalin-accent/25 bg-glomalin-accent/[0.04] px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-glomalin-accent-light uppercase tracking-widest">
          ▸ What-if
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          placeholder="bu"
          value={pendingBu}
          onChange={(e) => setPendingBu(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSale()}
          className="w-24 rounded border border-glomalin-border bg-glomalin-surface px-2 py-1 text-[11px] font-mono text-glomalin-bright focus:border-glomalin-accent focus:outline-none tabular-nums"
        />
        <span className="text-glomalin-muted text-[10px] font-mono">@</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="$/bu"
          value={pendingPrice}
          onChange={(e) => setPendingPrice(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSale()}
          className="w-20 rounded border border-glomalin-border bg-glomalin-surface px-2 py-1 text-[11px] font-mono text-glomalin-bright focus:border-glomalin-accent focus:outline-none tabular-nums"
        />
        <button
          onClick={addSale}
          disabled={!(Number(pendingBu) > 0 && Number(pendingPrice) > 0)}
          className="rounded border border-glomalin-accent/50 bg-glomalin-accent/15 px-2.5 py-1 text-[11px] font-mono text-glomalin-accent-light hover:bg-glomalin-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
        {scenario.length > 0 && (
          <>
            <span className="text-[10px] font-mono text-glomalin-muted tabular-nums">
              {scenario.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setScenario((s) => s.filter((_, j) => j !== i))}
                  title="Remove"
                  className="mr-1.5 rounded border border-dashed border-glomalin-accent/30 px-1.5 py-0.5 hover:border-glomalin-danger hover:text-glomalin-danger transition-colors"
                >
                  {formatBu(h.bushels)} @ {formatPricePerBu(h.priceDollars)} ×
                </button>
              ))}
            </span>
            <span className="text-[10px] font-mono tabular-nums">
              <span className="text-glomalin-muted uppercase tracking-wider mr-1">→ % sold</span>
              <span className={result.overhedged ? 'text-glomalin-danger' : 'text-glomalin-accent-light'}>
                {result.newPctSold != null ? formatPct(result.newPctSold) : EM}
              </span>
              <span className="text-glomalin-muted uppercase tracking-wider mx-1.5">blended</span>
              <span className="text-glomalin-bright">
                {result.newWAPDollars != null ? formatPricePerBu(result.newWAPDollars) : EM}
              </span>
              <span className="text-glomalin-muted uppercase tracking-wider mx-1.5">margin</span>
              <span className={result.marginPerBu != null && result.marginPerBu < 0 ? 'text-glomalin-danger' : 'text-glomalin-accent-light'}>
                {result.marginPerBu != null
                  ? (result.marginPerBu >= 0 ? '+' : '') + formatPricePerBu(result.marginPerBu)
                  : EM}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  )
}
