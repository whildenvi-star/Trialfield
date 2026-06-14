'use client'

import type { CommodityPosition, InstrumentType, YieldSummary } from '@/lib/marketing/types'
import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { Empty } from '@/components/ui/empty'
import { formatBu, formatUsd, formatPct } from '@/lib/fmt'
import { colors } from '@/lib/tokens'

// ── Yield summary helpers ──────────────────────────────────────────────────────

function findSettledBu(yieldSummaries: YieldSummary[], commodityName: string): number | null {
  const needle = commodityName.toLowerCase().trim()
  const match = yieldSummaries.find((s) => s.cropName.toLowerCase().trim() === needle)
  return match != null ? match.totalNetBU : null
}

// ── Instrument display maps ────────────────────────────────────────────────────

const INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  cash:             colors.accent,
  forward_contract: colors.info,
  hta:              '#6366f1',   // indigo — futures locked, basis open
  option:           '#8b5cf6',   // violet
  accumulator:      colors.warning,
}

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  cash:             'Cash',
  forward_contract: 'Forward',
  hta:              'HTA',
  option:           'Option',
  accumulator:      'Accum.',
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

// ── Summary banner → KpiStrip ─────────────────────────────────────────────────

function SummaryBanner({ positions, cropYear }: { positions: CommodityPosition[]; cropYear: number }) {
  const hedgeable = positions.filter((p) => p.commodity.is_hedgeable)
  const totalEstimated = hedgeable.reduce((s, p) => s + p.total_estimated_bu, 0)
  const totalPriced = hedgeable.reduce((s, p) => s + p.total_priced_bu, 0)
  const totalExposure = hedgeable.reduce((s, p) => s + (p.unpriced_exposure_dollars ?? 0), 0)
  const hasExposure = hedgeable.some((p) => p.unpriced_exposure_dollars != null)
  const pctPriced = totalEstimated > 0 ? Math.min(100, (totalPriced / totalEstimated) * 100) : 0

  const activeInstruments = positions.reduce(
    (s, p) => s + p.variants.reduce((vs, vp) => vs + vp.instruments.length, 0),
    0
  )

  return (
    <KpiStrip cols={hasExposure ? 4 : 3} className="mb-6">
      <StatCard
        label={`${cropYear} Crop Year`}
        value={activeInstruments.toString()}
        sublabel={activeInstruments === 1 ? 'active instrument' : 'active instruments'}
      />
      <StatCard
        label="Overall Priced"
        value={totalEstimated > 0 ? fmtPct(pctPriced) : '—'}
        sublabel={totalEstimated > 0 ? `${formatBu(totalPriced)} bu` : undefined}
        variant={pctPriced >= 80 ? 'success' : pctPriced >= 50 ? 'default' : 'warning'}
      />
      <StatCard
        label="Total Priced"
        value={`${formatBu(totalPriced)} bu`}
        sublabel={totalEstimated > 0 ? formatPct(pctPriced / 100) : undefined}
      />
      {hasExposure && (
        <StatCard
          label="Unpriced Exposure"
          value={formatUsd(totalExposure)}
          variant={totalExposure > 500_000 ? 'warning' : 'default'}
        />
      )}
    </KpiStrip>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const barColor = clamped >= 80 ? colors.accent : clamped >= 50 ? colors.info : colors.warning
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-glomalin-bg overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${clamped}%`, background: barColor }}
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
            {INSTRUMENT_LABELS[type]}{' '}
            <span className="tabular-nums">{formatBu(mix[type])}</span>
            {' '}bu
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Commodity card ─────────────────────────────────────────────────────────────

function CommodityCard({
  position,
  yieldSummaries,
  yieldAvailable,
  onViewContracts,
}: {
  position: CommodityPosition
  yieldSummaries: YieldSummary[]
  yieldAvailable: boolean
  onViewContracts: () => void
}) {
  const { commodity, pct_priced, wap, cbot_price, unpriced_bu, unpriced_exposure_dollars, instrument_mix } = position
  const settledBu = yieldAvailable ? findSettledBu(yieldSummaries, commodity.name) : null
  const settledPct =
    settledBu != null && position.total_estimated_bu > 0
      ? (settledBu / position.total_estimated_bu) * 100
      : null

  const allPreContracted =
    position.variants.length > 0 &&
    position.variants.every((vp) => vp.variant.is_contracted)
  const isSpecialty = !commodity.is_hedgeable || allPreContracted

  const wapDelta = wap != null && cbot_price != null ? wap - cbot_price : null

  // Count HTAs with open basis (basis == null)
  const openBasisCount = position.variants.reduce((total, vp) =>
    total + vp.instruments.filter((i) => i.instrument_type === 'hta' && i.basis == null).length, 0
  )

  return (
    <div className="rounded-lg border border-glomalin-border bg-glomalin-surface p-5 flex flex-col gap-4">
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
        <div>
          <span className="inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold bg-glomalin-info/15 text-glomalin-info border-glomalin-info/30">
            Pre-contracted
          </span>
          {position.total_priced_bu > 0 && (
            <p className="font-mono text-xs text-glomalin-muted mt-2">
              <span className="tabular-nums">{formatBu(position.total_priced_bu)}</span>
              {' '}bu committed
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
                <span className="tabular-nums">{formatBu(position.total_priced_bu)}</span>
                {' / '}
                <span className="tabular-nums">{formatBu(position.total_estimated_bu)}</span>
                {' bu'}
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
                    className={[
                      'ml-2 font-mono text-xs',
                      wapDelta >= 0 ? 'text-glomalin-accent' : 'text-glomalin-warning',
                    ].join(' ')}
                  >
                    {'('}
                    {wapDelta >= 0 ? '+' : ''}
                    {fmtPrice(wapDelta)}
                    {')'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Instrument mix */}
          <MixStrip mix={instrument_mix} />

          {/* Settled bushels (grain-tickets) */}
          {yieldAvailable && (
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-glomalin-muted">Settled</span>
              <div className="text-right">
                {settledBu != null ? (
                  <span className="font-mono text-sm" style={{ color: '#7A9E7E' }}>
                    <span className="tabular-nums">{settledBu.toLocaleString()}</span>
                    {' bu'}
                    {settledPct != null && (
                      <span className="text-xs ml-1.5 opacity-75">
                        ({settledPct.toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-glomalin-muted">—</span>
                )}
              </div>
            </div>
          )}

          {/* Open basis HTA indicator */}
          {openBasisCount > 0 && (
            <div className="flex items-center gap-2 rounded border border-glomalin-warning/30 bg-glomalin-warning/10 px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-glomalin-warning">
                {openBasisCount} HTA{openBasisCount > 1 ? 's' : ''} · basis open
              </span>
              <span className="font-mono text-[9px] text-glomalin-muted">— set at delivery</span>
            </div>
          )}

          {/* Unpriced exposure */}
          {unpriced_bu > 0 && (
            <div className="pt-1 border-t border-glomalin-border/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-glomalin-muted">
                  <span className="tabular-nums">{formatBu(unpriced_bu)}</span>
                  {' bu unpriced'}
                </span>
                {unpriced_exposure_dollars != null && (
                  <span
                    className={[
                      'font-mono text-xs font-semibold',
                      unpriced_exposure_dollars > 200_000
                        ? 'text-glomalin-warning'
                        : 'text-glomalin-muted',
                    ].join(' ')}
                  >
                    {formatUsd(unpriced_exposure_dollars)}
                    {' exposure'}
                  </span>
                )}
              </div>
            </div>
          )}

          {unpriced_bu === 0 && position.total_estimated_bu > 0 && (
            <div className="pt-1 border-t border-glomalin-border/50">
              <span className="font-mono text-xs text-glomalin-accent">
                ✓ Fully priced
              </span>
            </div>
          )}
        </>
      )}

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
  yieldAvailable: boolean
  yieldSummaries: YieldSummary[]
  onSwitchToContracts: () => void
}

export function HedgingDashboard({ positions, cropYear, yieldAvailable, yieldSummaries, onSwitchToContracts }: HedgingDashboardProps) {
  if (positions.length === 0) {
    return (
      <Empty
        title="No commodities configured"
        description="Run the migration and seed data to get started."
      />
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
            yieldSummaries={yieldSummaries}
            yieldAvailable={yieldAvailable}
            onViewContracts={onSwitchToContracts}
          />
        ))}
      </div>
    </div>
  )
}
