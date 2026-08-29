// Crop pool cards — the macro-rollup "Hedging Dashboard" card layout rebuilt
// on command-center data (enterprise rollup rows + grain contracts). One card
// per commodity: priced progress bar, WAP vs CBOT, contract-mix strip, open
// pricing legs, and a variant table. Office role receives rows with financial
// keys omitted server-side; this component only renders what it was given.

import { formatBu, formatUsd, formatPricePerBu, formatPct } from '@/lib/fmt'
import { Empty } from '@/components/ui/empty'
import type {
  CommodityRollupRow,
  OfficeCommodityRollupRow,
  VariantRollupRow,
} from '@/lib/marketing/enterprise-rollup'

const EM = '—'
const CBOT_TICKER: Record<string, string> = { C: 'ZC', S: 'ZS', W: 'ZW' }

export type Instrument =
  | 'PRICED' | 'SPOT' | 'FOB' | 'PRICED_LATER'
  | 'BASIS_FIXED' | 'FUTURES_FIXED' | 'MIN_PRICE' | 'ACCUMULATOR'

/** Minimal contract shape the cards need for mix strips + open-leg badges. */
export interface PoolCardContract {
  instrument: Instrument
  contractedBushels: number
  basis?: number | null
  futuresPrice?: number | null
  variant: { name: string }
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'
}

const MIX_COLORS: Record<Instrument, string> = {
  PRICED: '#14b8a6',
  SPOT: '#0ea5e9',
  FOB: '#64748b',
  PRICED_LATER: '#f59e0b',
  BASIS_FIXED: '#3b82f6',
  FUTURES_FIXED: '#6366f1',
  MIN_PRICE: '#8b5cf6',
  ACCUMULATOR: '#eab308',
}
const MIX_LABELS: Record<Instrument, string> = {
  PRICED: 'Priced',
  SPOT: 'Spot',
  FOB: 'FOB',
  PRICED_LATER: 'Priced Later',
  BASIS_FIXED: 'Basis Fixed',
  FUTURES_FIXED: 'HTA',
  MIN_PRICE: 'Min Price',
  ACCUMULATOR: 'Accumulator',
}

// Owner rows carry financials; office rows omit them. Render through one view
// type where every financial field is optional (same trick as the table).
type RowView = OfficeCommodityRollupRow &
  Partial<Pick<CommodityRollupRow, 'cbotPriceDollars' | 'poolWapCents' | 'wapCents'>>
type VariantView = Partial<VariantRollupRow> & OfficeCommodityRollupRow['variants'][number]

interface CropPoolCardsProps {
  rows: Array<CommodityRollupRow | OfficeCommodityRollupRow>
  isOwner: boolean
  contracts: PoolCardContract[]
}

export function CropPoolCards({ rows: rawRows, isOwner, contracts }: CropPoolCardsProps) {
  const rows = rawRows as RowView[]

  if (rows.length === 0) {
    return (
      <Empty
        title="No position data"
        description="No contracts or crop plan found for this crop year."
      />
    )
  }

  // Hard wall between the two jobs: futures crops (marketed on CBOT) never
  // share a section — or a total — with organics & specialty (tracked only).
  const futures = rows.filter((r) => r.tier !== 'tracking')
  const tracking = rows.filter((r) => r.tier === 'tracking')

  const grid = (sectionRows: RowView[]) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {sectionRows.map((row) => (
        <PoolCard
          key={`${row.tier}-${row.commodityName}-${row.cropYear}`}
          row={row}
          isOwner={isOwner}
          contracts={contractsForRow(row, contracts)}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {futures.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-mono font-bold uppercase tracking-widest text-glomalin-muted">
            Futures Position — Job 1
          </div>
          {grid(futures)}
        </div>
      )}
      {tracking.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-mono font-bold uppercase tracking-widest text-glomalin-muted">
            Organics &amp; Specialty — tracking only, never in futures totals
          </div>
          {grid(tracking)}
        </div>
      )}
    </div>
  )
}

function contractsForRow(row: RowView, contracts: PoolCardContract[]): PoolCardContract[] {
  const variantNames = new Set(row.variants.map((v) => v.variantName.toLowerCase()))
  return contracts.filter(
    (c) => c.status !== 'CANCELLED' && variantNames.has(c.variant.name.toLowerCase())
  )
}

function PoolCard({
  row,
  isOwner,
  contracts,
}: {
  row: RowView
  isOwner: boolean
  contracts: PoolCardContract[]
}) {
  const ticker = row.cbotSymbol ? CBOT_TICKER[row.cbotSymbol] : null
  const cbot = row.cbotPriceDollars ?? null

  const pct = row.pctSold != null ? Math.min(1, row.pctSold) : null
  const barClass =
    row.overhedged
      ? 'bg-glomalin-danger'
      : pct == null
        ? 'bg-glomalin-border'
        : pct >= 0.8
          ? 'bg-glomalin-success'
          : pct >= 0.5
            ? 'bg-glomalin-warning'
            : 'bg-glomalin-danger'

  const wap = row.wapCents != null && row.wapCents > 0 ? row.wapCents / 100 : null
  const wapDelta = wap != null && cbot != null ? wap - cbot : null

  // Unpriced exposure — projected bushels not yet priced, valued at today's CBOT
  const unpricedBu =
    row.projectedBu != null ? Math.max(0, row.projectedBu - row.pricedBu) : null
  const exposure = isOwner && unpricedBu != null && cbot != null ? unpricedBu * cbot : null

  // Contract-mix strip, weighted by contracted bushels
  const mix = new Map<Instrument, number>()
  for (const c of contracts) {
    mix.set(c.instrument, (mix.get(c.instrument) ?? 0) + c.contractedBushels)
  }
  const mixTotal = Array.from(mix.values()).reduce((s, n) => s + n, 0)

  // Open pricing legs (mirrors BasisExposurePanel's definition)
  const basisOpenBu = contracts
    .filter((c) => c.instrument === 'FUTURES_FIXED' && c.basis == null)
    .reduce((s, c) => s + c.contractedBushels, 0)
  const futuresOpenBu = contracts
    .filter((c) => c.instrument === 'BASIS_FIXED' && c.futuresPrice == null)
    .reduce((s, c) => s + c.contractedBushels, 0)

  const visVariants = (row.variants as VariantView[]).filter(
    (v) => v.soldBu > 0 || (v.projectedBu ?? 0) > 0
  )

  return (
    <div className="rounded-lg border border-glomalin-border bg-glomalin-surface p-4 space-y-2.5">
      {/* Header: name · ticker · CBOT */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-glomalin-bright">
          {row.commodityName}
          {row.overhedged && (
            <span className="ml-2 rounded-full border border-glomalin-danger/50 bg-glomalin-danger/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-glomalin-danger">
              Overhedged
            </span>
          )}
        </span>
        <span className="text-[11px] font-mono text-glomalin-muted">
          {ticker && <span className="mr-1.5">{row.cbotContract ?? ticker}</span>}
          {isOwner && cbot != null && (
            <span className="text-glomalin-accent-light tabular-nums">
              CBOT {formatPricePerBu(cbot)}
            </span>
          )}
        </span>
      </div>

      {/* Progress: sold vs projected */}
      <div>
        <div className="h-1.5 rounded-full bg-glomalin-border/60 overflow-hidden">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${pct != null ? Math.round(pct * 100) : 0}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] font-mono text-glomalin-muted tabular-nums">
          {row.projectedBu != null ? (
            <>
              {formatBu(row.soldBu)} / {formatBu(Math.round(row.projectedBu))} bu
              {' '}·{' '}
              <span className={row.overhedged ? 'text-glomalin-danger' : ''}>
                {row.pctSold != null ? formatPct(row.pctSold) : EM} sold
              </span>
            </>
          ) : (
            <>
              {formatBu(row.soldBu)} bu sold · <span className="text-glomalin-warning">no crop plan</span>
            </>
          )}
          {row.actualBu != null && (
            <span className="ml-2 text-glomalin-muted/70">
              actual {formatBu(Math.round(row.actualBu))} bu
            </span>
          )}
        </div>
      </div>

      {/* WAP vs CBOT — owner only */}
      {isOwner && wap != null && (
        <div className="text-[11px] font-mono tabular-nums text-glomalin-muted">
          WAP <span className="text-glomalin-bright font-semibold">{formatPricePerBu(wap)}</span>
          {wapDelta != null && (
            <span className={wapDelta >= 0 ? 'text-glomalin-success' : 'text-glomalin-warning'}>
              {' '}({wapDelta >= 0 ? '+' : ''}{formatPricePerBu(wapDelta)} vs CBOT)
            </span>
          )}
          {row.poolWapCents != null && (
            <span className="ml-2 text-glomalin-muted/70">
              pool {formatPricePerBu(row.poolWapCents / 100)}
            </span>
          )}
        </div>
      )}

      {/* Contract-mix strip */}
      {mixTotal > 0 && (
        <div className="flex h-1 rounded-full overflow-hidden">
          {Array.from(mix.entries()).map(([inst, bu]) => (
            <div
              key={inst}
              className="h-full"
              style={{ width: `${(bu / mixTotal) * 100}%`, background: MIX_COLORS[inst] }}
              title={`${MIX_LABELS[inst]}: ${formatBu(bu)} bu`}
            />
          ))}
        </div>
      )}

      {/* Unpriced exposure — owner only */}
      {isOwner && unpricedBu != null && unpricedBu > 0 && (
        <div className="text-[11px] font-mono tabular-nums text-glomalin-muted">
          {formatBu(Math.round(unpricedBu))} bu unpriced
          {exposure != null && (
            <> · <span className="text-glomalin-warning">{formatUsd(exposure)} exposure</span></>
          )}
        </div>
      )}

      {/* Open pricing legs */}
      {basisOpenBu > 0 && (
        <div className="text-[11px] font-mono tabular-nums">
          <span className="rounded border border-glomalin-warning/40 bg-glomalin-warning/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-glomalin-warning mr-1.5">
            ○ Basis Open
          </span>
          <span className="text-glomalin-muted">
            {formatBu(basisOpenBu)} bu HTA — basis not yet set
          </span>
        </div>
      )}
      {futuresOpenBu > 0 && (
        <div className="text-[11px] font-mono tabular-nums">
          <span className="rounded border border-glomalin-warning/40 bg-glomalin-warning/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-glomalin-warning mr-1.5">
            ○ Futures Open
          </span>
          <span className="text-glomalin-muted">
            {formatBu(futuresOpenBu)} bu basis-fixed — futures not yet set
          </span>
        </div>
      )}

      {/* Variant table */}
      {visVariants.length > 0 && (
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-glomalin-muted border-b border-glomalin-border/60">
              <th className="text-left py-1 font-medium uppercase tracking-wider">Variety</th>
              <th className="text-right py-1 font-medium uppercase tracking-wider">Proj Bu</th>
              <th className="text-right py-1 font-medium uppercase tracking-wider">Sold</th>
              {isOwner && (
                <>
                  <th className="text-right py-1 font-medium uppercase tracking-wider">Prem</th>
                  <th className="text-right py-1 font-medium uppercase tracking-wider">Pooled</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visVariants.map((v) => (
              <tr key={v.variantName} className="border-b border-glomalin-border/30 last:border-0">
                <td className="py-1 text-glomalin-text">{v.variantName}</td>
                <td className="py-1 text-right tabular-nums text-glomalin-muted">
                  {v.projectedBu != null ? formatBu(Math.round(v.projectedBu)) : EM}
                </td>
                <td className="py-1 text-right tabular-nums text-glomalin-text">
                  {formatBu(v.soldBu)}
                </td>
                {isOwner && (
                  <>
                    <td className={`py-1 text-right tabular-nums ${(v.premiumPerBu ?? 0) >= 0 ? 'text-glomalin-success' : 'text-glomalin-warning'}`}>
                      {v.premiumPerBu != null && v.premiumPerBu !== 0
                        ? `${v.premiumPerBu > 0 ? '+' : ''}${formatPricePerBu(v.premiumPerBu)}`
                        : EM}
                    </td>
                    <td className="py-1 text-right tabular-nums text-glomalin-accent-light">
                      {v.pooledPriceCents != null ? formatPricePerBu(v.pooledPriceCents / 100) : EM}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
