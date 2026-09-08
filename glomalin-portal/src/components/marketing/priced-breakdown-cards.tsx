// Granular priced-position cards for the command center headline strip.
//
// The old strip put every futures bushel in one basket: "62% priced" told you
// nothing about WHICH crop is exposed. These two cards keep the farm-wide
// number as the headline and break it down per commodity, each with its crop
// glyph and a bar:
//
//   % PRICED     — each bar normalized to its own crop (fill = that crop's %)
//   PRICED BU    — all bars on ONE shared bushel scale (track length ∝ the
//                  crop's projected bu), so pool sizes are comparable
//
// Futures tier only, same wall the rest of the page enforces: organics and
// specialty are tracked but never blended into a futures total.

import { formatBu, formatPct } from '@/lib/fmt'
import { CropIcon, cropColorFor } from '@/components/marketing/crop-icon'
import type {
  CommodityRollupRow,
  OfficeCommodityRollupRow,
} from '@/lib/marketing/enterprise-rollup'

const EM = '—'

export interface CropSlice {
  key: string
  commodityName: string
  symbol: string | null
  projectedBu: number
  pricedBu: number
  soldBu: number
  color: string
  /** priced / projected; null when there is no projection to measure against */
  pctPriced: number | null
  overhedged: boolean
}

/** Futures-tier rows → per-crop slices, largest pool first. */
export function buildCropSlices(
  rows: Array<CommodityRollupRow | OfficeCommodityRollupRow>
): CropSlice[] {
  return rows
    .filter((r) => r.tier === 'futures')
    .map((r) => {
      const projectedBu = r.projectedBu ?? 0
      const pricedBu = r.pricedBu
      return {
        key: `${r.commodityName}-${r.cropYear}`,
        commodityName: r.commodityName,
        symbol: r.cbotSymbol,
        projectedBu,
        pricedBu,
        soldBu: r.soldBu,
        color: cropColorFor(r.commodityName, r.cbotSymbol),
        pctPriced: projectedBu > 0 ? pricedBu / projectedBu : null,
        overhedged: projectedBu > 0 && pricedBu > projectedBu,
      }
    })
    .filter((s) => s.projectedBu > 0 || s.pricedBu > 0)
    .sort((a, b) => Math.max(b.projectedBu, b.pricedBu) - Math.max(a.projectedBu, a.pricedBu))
}

// ── Card chrome ─────────────────────────────────────────────────────────────

function Card({
  label,
  value,
  sublabel,
  danger,
  children,
}: {
  label: string
  value?: string
  sublabel?: string
  danger?: boolean
  children: React.ReactNode
}) {
  // With no value/sublabel the card is just a labelled table — no headline
  // crown over three rows (owner: make it useful or make it simple).
  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4">
      <p className="text-xs text-glomalin-muted font-sans font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      {value != null && (
        <p
          className={`text-2xl font-mono font-bold leading-none ${
            danger ? 'text-glomalin-warning' : 'text-glomalin-bright'
          }`}
        >
          {value}
        </p>
      )}
      {sublabel != null && <p className="mt-1.5 text-xs font-sans text-glomalin-muted">{sublabel}</p>}
      <div className={`${value != null || sublabel != null ? 'mt-3 pt-3 border-t border-glomalin-border/60' : 'mt-2'} space-y-2.5`}>{children}</div>
    </div>
  )
}

function CropLabel({ slice }: { slice: CropSlice }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 w-[104px] shrink-0">
      <CropIcon
        commodity={slice.commodityName}
        symbol={slice.symbol}
        size={15}
        color={slice.color}
        className="shrink-0"
      />
      <span className="truncate text-[11px] font-sans text-glomalin-text">
        {slice.commodityName}
      </span>
    </span>
  )
}

function EmptyBreakdown({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <Card label={label} value={EM} sublabel={sublabel}>
      <p className="text-[11px] font-sans text-glomalin-muted">
        No futures crop plan for this year.
      </p>
    </Card>
  )
}

// ── % priced ────────────────────────────────────────────────────────────────

export function FuturesPercentPricedCard({
  slices,
}: {
  slices: CropSlice[]
}) {
  // No headline, no blend (owner, 2026-09-09: bushels never sum across
  // commodities, and no "most open" crown either — make the table useful or
  // make it simple). One row per crop carries everything actionable: the
  // bar, its own %, and the open bushels still to price.
  if (slices.length === 0) {
    return (
      <EmptyBreakdown
        label="FUTURES % PRICED"
        sublabel="per crop · futures only"
      />
    )
  }

  return (
    <Card label="FUTURES % PRICED">
      {slices.map((s) => {
        const fill = s.pctPriced != null ? Math.min(1, s.pctPriced) : 0
        const openBu = Math.max(0, Math.round(s.projectedBu - s.pricedBu))
        return (
          <div key={s.key} className="flex items-center gap-2">
            <CropLabel slice={s} />
            <span
              className="relative h-2 flex-1 rounded-full bg-glomalin-elevated overflow-hidden"
              title={`${formatBu(Math.round(s.pricedBu))} of ${formatBu(Math.round(s.projectedBu))} bu priced`}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${fill * 100}%`,
                  backgroundColor: s.overhedged ? 'rgb(var(--c-danger))' : s.color,
                }}
              />
            </span>
            <span
              className={`w-11 shrink-0 text-right text-[11px] font-mono tabular-nums ${
                s.overhedged ? 'text-glomalin-danger' : 'text-glomalin-bright'
              }`}
            >
              {s.pctPriced != null ? formatPct(s.pctPriced) : EM}
            </span>
            <span className="w-24 shrink-0 text-right text-[11px] font-mono tabular-nums text-glomalin-muted">
              {s.pctPriced != null ? `${formatBu(openBu)} open` : 'no plan'}
            </span>
          </div>
        )
      })}
    </Card>
  )
}

// ── priced bushels ──────────────────────────────────────────────────────────

export function PricedBushelsCard({
  slices,
}: {
  slices: CropSlice[]
}) {
  if (slices.length === 0) {
    return <EmptyBreakdown label="PRICED BUSHELS" sublabel="per crop · futures only" />
  }

  // One shared scale across crops — bar length means bushels here, not percent,
  // so a small pool can't look like a big one. No summed headline: bushels of
  // different commodities never add.
  const scale = Math.max(...slices.map((s) => Math.max(s.projectedBu, s.pricedBu)), 1)

  return (
    <Card label="PRICED BUSHELS">
      {slices.map((s) => {
        const pool = Math.max(s.projectedBu, s.pricedBu)
        const trackPct = (pool / scale) * 100
        const fillPct = pool > 0 ? (s.pricedBu / pool) * 100 : 0
        return (
          <div key={s.key} className="flex items-center gap-2">
            <CropLabel slice={s} />
            <span className="relative h-2 flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-glomalin-elevated overflow-hidden"
                style={{ width: `${trackPct}%` }}
                title={`${formatBu(Math.round(s.pricedBu))} priced of ${formatBu(Math.round(pool))} bu pool`}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: s.overhedged ? 'rgb(var(--c-danger))' : s.color,
                  }}
                />
              </span>
            </span>
            <span className="w-[74px] shrink-0 text-right text-[11px] font-mono tabular-nums text-glomalin-bright">
              {formatBu(Math.round(s.pricedBu))}
            </span>
          </div>
        )
      })}
      <p className="text-[10px] font-sans text-glomalin-muted pt-0.5">
        Filled = priced · full bar = projected pool
      </p>
    </Card>
  )
}

// ── pair ────────────────────────────────────────────────────────────────────

/** Both breakdown cards side by side, sharing one set of crop slices. */
export function PricedBreakdownCards({
  rows,
}: {
  rows: Array<CommodityRollupRow | OfficeCommodityRollupRow>
}) {
  const slices = buildCropSlices(rows)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <FuturesPercentPricedCard slices={slices} />
      <PricedBushelsCard slices={slices} />
    </div>
  )
}
