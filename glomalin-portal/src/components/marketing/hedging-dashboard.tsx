'use client'

import type { CommodityPosition, InstrumentType } from '@/lib/marketing/types'

// ── Colors by instrument type ──────────────────────────────────────────────────

const INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  cash:             '#14b8a6',
  forward_contract: '#3b82f6',
  option:           '#8b5cf6',
  accumulator:      '#f59e0b',
}

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  cash:             'Cash',
  forward_contract: 'Forward',
  option:           'Option',
  accumulator:      'Accum.',
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtBu(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtDollars(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

// ── Summary banner ─────────────────────────────────────────────────────────────

function SummaryBanner({ positions, cropYear }: { positions: CommodityPosition[]; cropYear: number }) {
  const hedgeable = positions.filter((p) => p.commodity.is_hedgeable)
  const totalEstimated = hedgeable.reduce((s, p) => s + p.total_estimated_bu, 0)
  const totalPriced = hedgeable.reduce((s, p) => s + p.total_priced_bu, 0)
  const totalExposure = hedgeable.reduce(
    (s, p) => s + (p.unpriced_exposure_dollars ?? 0),
    0
  )
  const hasExposure = hedgeable.some((p) => p.unpriced_exposure_dollars != null)
  const pctPriced = totalEstimated > 0 ? Math.min(100, (totalPriced / totalEstimated) * 100) : 0

  const activeInstruments = positions.reduce(
    (s, p) =>
      s + p.variants.reduce((vs, vp) => vs + vp.instruments.length, 0),
    0
  )

  return (
    <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-6 py-4 mb-6 flex flex-wrap items-center gap-6">
      <div>
        <p className="font-mono text-xs text-glomalin-muted uppercase tracking-widest mb-1">
          {cropYear} Crop Year
        </p>
        <p className="font-mono text-xs text-glomalin-muted">
          {activeInstruments} active instrument{activeInstruments !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="h-8 w-px bg-glomalin-border" />

      <div>
        <p className="font-mono text-xs text-glomalin-muted mb-0.5">Overall Priced</p>
        <p className="font-mono text-xl font-semibold text-[#14b8a6]">
          {totalEstimated > 0 ? fmtPct(pctPriced) : '—'}
        </p>
      </div>

      <div className="h-8 w-px bg-glomalin-border" />

      <div>
        <p className="font-mono text-xs text-glomalin-muted mb-0.5">Total Priced</p>
        <p className="font-mono text-xl font-semibold text-glomalin-text">
          {fmtBu(totalPriced)} bu
        </p>
      </div>

      {hasExposure && (
        <>
          <div className="h-8 w-px bg-glomalin-border" />
          <div>
            <p className="font-mono text-xs text-glomalin-muted mb-0.5">Unpriced Exposure</p>
            <p className={`font-mono text-xl font-semibold ${totalExposure > 500_000 ? 'text-amber-400' : 'text-glomalin-text'}`}>
              {fmtDollars(totalExposure)}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-glomalin-bg overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${clamped}%`,
            background: clamped >= 80
              ? '#14b8a6'
              : clamped >= 50
              ? '#3b82f6'
              : '#f59e0b',
          }}
        />
      </div>
      <span className="font-mono text-xs text-glomalin-text w-10 text-right">
        {fmtPct(clamped)}
      </span>
    </div>
  )
}

// ── Instrument mix strip ───────────────────────────────────────────────────────

function MixStrip({ mix }: { mix: Record<InstrumentType, number> }) {
  const total = Object.values(mix).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  const types = (Object.keys(mix) as InstrumentType[]).filter((k) => mix[k] > 0)

  return (
    <div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {types.map((type) => (
          <div
            key={type}
            style={{
              width: `${(mix[type] / total) * 100}%`,
              backgroundColor: INSTRUMENT_COLORS[type],
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {types.map((type) => (
          <span key={type} className="flex items-center gap-1 font-mono text-[10px] text-glomalin-muted">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: INSTRUMENT_COLORS[type] }}
            />
            {INSTRUMENT_LABELS[type]} {fmtBu(mix[type])} bu
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Commodity card ─────────────────────────────────────────────────────────────

function CommodityCard({
  position,
  onViewContracts,
}: {
  position: CommodityPosition
  onViewContracts: () => void
}) {
  const { commodity, pct_priced, wap, cbot_price, unpriced_bu, unpriced_exposure_dollars, instrument_mix } = position
  const allPreContracted =
    position.variants.length > 0 &&
    position.variants.every((vp) => vp.variant.is_contracted)
  const isSpecialty = !commodity.is_hedgeable || allPreContracted

  const wapDelta = wap != null && cbot_price != null ? wap - cbot_price : null

  return (
    <div className="rounded-lg border border-glomalin-border bg-[#0c1015] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {commodity.cbot_symbol && (
            <span className="font-mono text-[10px] text-glomalin-muted uppercase tracking-widest">
              {commodity.cbot_symbol}
            </span>
          )}
          <h3 className="font-semibold text-glomalin-text text-base leading-tight mt-0.5">
            {commodity.name}
          </h3>
        </div>
        {cbot_price != null && (
          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-glomalin-text">
              {fmtPrice(cbot_price)}
            </p>
            <p className="font-mono text-xs text-glomalin-muted">CBOT</p>
          </div>
        )}
      </div>

      {isSpecialty ? (
        /* Pre-contracted / specialty — no hedging progress */
        <div>
          <span className="inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-semibold bg-[#3b82f6]/15 text-[#93c5fd] border border-[#3b82f6]/30">
            Pre-contracted
          </span>
          {position.total_priced_bu > 0 && (
            <p className="font-mono text-xs text-glomalin-muted mt-2">
              {fmtBu(position.total_priced_bu)} bu committed
            </p>
          )}
          {position.variants.length > 0 && (
            <p className="font-mono text-xs text-glomalin-muted mt-0.5">
              {position.variants.map((vp) => vp.variant.name).join(', ')}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="font-mono text-xs text-glomalin-muted">Priced</span>
              <span className="font-mono text-xs text-glomalin-muted">
                {fmtBu(position.total_priced_bu)} / {fmtBu(position.total_estimated_bu)} bu
              </span>
            </div>
            <ProgressBar pct={pct_priced} />
          </div>

          {/* WAP vs CBOT */}
          {wap != null && (
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-glomalin-muted">WAP</span>
              <div className="text-right">
                <span className="font-mono text-sm text-glomalin-text">{fmtPrice(wap)}</span>
                {wapDelta != null && (
                  <span
                    className={`ml-2 font-mono text-xs ${wapDelta >= 0 ? 'text-[#14b8a6]' : 'text-amber-400'}`}
                  >
                    ({wapDelta >= 0 ? '+' : ''}{fmtPrice(wapDelta)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Instrument mix */}
          <MixStrip mix={instrument_mix} />

          {/* Unpriced exposure */}
          {unpriced_bu > 0 && (
            <div className="pt-1 border-t border-glomalin-border/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-glomalin-muted">
                  {fmtBu(unpriced_bu)} bu unpriced
                </span>
                {unpriced_exposure_dollars != null && (
                  <span
                    className={`font-mono text-xs font-semibold ${
                      unpriced_exposure_dollars > 200_000 ? 'text-amber-400' : 'text-glomalin-muted'
                    }`}
                  >
                    {fmtDollars(unpriced_exposure_dollars)} exposure
                  </span>
                )}
              </div>
            </div>
          )}

          {unpriced_bu === 0 && position.total_estimated_bu > 0 && (
            <div className="pt-1 border-t border-glomalin-border/50">
              <span className="font-mono text-xs text-[#14b8a6]">
                ✓ Fully priced
              </span>
            </div>
          )}
        </>
      )}

      {/* View contracts link */}
      <button
        onClick={onViewContracts}
        className="self-start font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors -mt-1"
      >
        View contracts →
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface HedgingDashboardProps {
  positions: CommodityPosition[]
  cropYear: number
  onSwitchToContracts: () => void
}

export function HedgingDashboard({ positions, cropYear, onSwitchToContracts }: HedgingDashboardProps) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-6 py-12 text-center">
        <p className="font-mono text-sm text-glomalin-muted">
          No commodities configured. Run the migration and seed data to get started.
        </p>
      </div>
    )
  }

  return (
    <div>
      <SummaryBanner positions={positions} cropYear={cropYear} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((pos) => (
          <CommodityCard
            key={pos.commodity.id}
            position={pos}
            onViewContracts={onSwitchToContracts}
          />
        ))}
      </div>
    </div>
  )
}
