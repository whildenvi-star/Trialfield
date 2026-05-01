'use client'

import { useState } from 'react'
import type { CommodityPosition, VariantPosition, SaleInstrument, InstrumentType } from '@/lib/marketing/types'
import { instrumentPricedBu } from '@/lib/marketing/queries'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'
import { colors } from '@/lib/tokens'

// ── Colors / labels ────────────────────────────────────────────────────────────

// Maps instrument type to Badge variant. Option + HTA have no semantic token — use inline class override.
const TYPE_BADGE_VARIANT: Record<InstrumentType, 'accent' | 'info' | 'warning' | 'default'> = {
  cash:             'accent',
  forward_contract: 'info',
  hta:              'default',   // overridden with indigo below
  option:           'default',   // overridden with violet below
  accumulator:      'warning',
}

const TYPE_LABELS: Record<InstrumentType, string> = {
  cash:             'Cash',
  forward_contract: 'Forward',
  hta:              'HTA',
  option:           'Option',
  accumulator:      'Accumulator',
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}

function fmtBasis(n: number | null): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

function fmtDelivery(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  if (start && end) return `${fmt(start)}–${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `By ${fmt(end!)}`
}

// ── Mini progress bar ──────────────────────────────────────────────────────────

function MiniBar({ pct, color = '#14b8a6' }: { pct: number; color?: string }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-glomalin-bg overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs text-glomalin-muted">{fmtPct(pct)}</span>
    </div>
  )
}

// ── Type badge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: InstrumentType }) {
  const customClass =
    type === 'option' ? 'bg-[#8b5cf6]/15 text-[#c4b5fd] border-[#8b5cf6]/30' :
    type === 'hta'    ? 'bg-[#6366f1]/15 text-[#a5b4fc] border-[#6366f1]/30' :
    undefined
  return (
    <Badge variant={TYPE_BADGE_VARIANT[type]} className={customClass}>
      {TYPE_LABELS[type]}
    </Badge>
  )
}

// ── Layer 3: Instrument row ────────────────────────────────────────────────────

function InstrumentRow({
  inst,
  onEdit,
  onDelete,
}: {
  inst: SaleInstrument
  onEdit: (inst: SaleInstrument) => void
  onDelete: (id: string) => void
}) {
  const pricedBu = instrumentPricedBu(inst)

  function renderDetail() {
    switch (inst.instrument_type) {
      case 'cash':
      case 'forward_contract':
        return (
          <>
            <td className="px-3 py-1.5 text-right text-glomalin-text">{formatBu(inst.bushels ?? 0)}</td>
            <td className="px-3 py-1.5 text-right text-glomalin-text">{fmtPrice(inst.price_per_bushel)}</td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {inst.basis != null ? (
                <span className={inst.basis > 0 ? 'text-glomalin-accent' : ''}>
                  {fmtBasis(inst.basis)}
                </span>
              ) : '—'}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {fmtDelivery(inst.delivery_start, inst.delivery_end)}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {inst.delivered_bu > 0 ? (
                <span className="text-glomalin-accent tabular-nums">
                  {formatBu(inst.delivered_bu)}
                  {' del.'}
                </span>
              ) : '—'}
            </td>
          </>
        )
      case 'hta':
        return (
          <>
            <td className="px-3 py-1.5 text-right text-glomalin-text">{formatBu(inst.bushels ?? 0)}</td>
            <td className="px-3 py-1.5 text-right">
              <span className="font-mono text-xs text-glomalin-text">
                Fut: {fmtPrice(inst.futures_reference)}
              </span>
            </td>
            <td className="px-3 py-1.5 text-right">
              {inst.basis != null ? (
                <span className={inst.basis > 0 ? 'text-glomalin-accent font-semibold' : 'text-glomalin-muted'}>
                  {fmtBasis(inst.basis)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded border border-glomalin-warning/40 bg-glomalin-warning/10 px-1.5 py-0.5 font-mono text-[10px] text-glomalin-warning">
                  Basis Open
                </span>
              )}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {fmtDelivery(inst.delivery_start, inst.delivery_end)}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {inst.delivered_bu > 0 ? (
                <span className="text-glomalin-accent tabular-nums">
                  {formatBu(inst.delivered_bu)}
                  {' del.'}
                </span>
              ) : '—'}
            </td>
          </>
        )
      case 'option':
        return (
          <>
            <td className="px-3 py-1.5 text-right text-glomalin-text">{formatBu(inst.bushels ?? 0)}</td>
            <td className="px-3 py-1.5 text-right">
              <span className="font-mono text-xs text-glomalin-muted">
                {inst.option_side === 'long' ? 'Long' : 'Short'}{' '}
                {inst.option_type === 'put' ? 'Put' : 'Call'}
              </span>
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-text">
              {inst.strike_price != null ? (
                <>
                  {fmtPrice(inst.strike_price)}
                  {inst.premium_paid != null && (
                    <span className="text-glomalin-muted text-[10px] ml-1">
                      (−{fmtPrice(inst.premium_paid)})
                    </span>
                  )}
                </>
              ) : '—'}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {inst.expiry_date
                ? new Date(inst.expiry_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                : '—'}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">—</td>
          </>
        )
      case 'accumulator':
        return (
          <>
            <td className="px-3 py-1.5 text-right text-glomalin-text">
              {inst.daily_bu != null ? (
                <span className="tabular-nums">
                  {formatBu(inst.daily_bu)}
                  <span className="text-glomalin-muted text-[10px]">/day</span>
                </span>
              ) : inst.weekly_bu != null ? (
                <span className="tabular-nums">
                  {formatBu(inst.weekly_bu)}
                  <span className="text-glomalin-muted text-[10px]">/wk</span>
                </span>
              ) : '—'}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {'KO '}
              {fmtPrice(inst.ko_level)}
              {inst.ki_level != null && ` / KI ${fmtPrice(inst.ki_level)}`}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">
              {fmtDelivery(inst.accumulation_start, inst.accumulation_end)}
            </td>
            <td className="px-3 py-1.5 text-right">
              {pricedBu > 0 ? (
                <span className="font-mono text-xs text-glomalin-accent tabular-nums">
                  {formatBu(pricedBu)}
                  {' accum.'}
                </span>
              ) : '—'}
            </td>
            <td className="px-3 py-1.5 text-right text-glomalin-muted">—</td>
          </>
        )
    }
  }

  return (
    <tr className="border-t border-glomalin-border/30 hover:bg-glomalin-surface/30 transition-colors">
      <td className="py-1.5 pl-8 pr-3">
        <TypeBadge type={inst.instrument_type} />
      </td>
      <td className="px-3 py-1.5 text-glomalin-muted font-mono text-xs">
        {inst.buyer ?? inst.counterparty ?? '—'}
      </td>
      {renderDetail()}
      <td className="px-3 py-1.5">
        <span className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(inst)}
            className="font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
          >
            Edit
          </button>
          <span className="text-glomalin-border">|</span>
          <button
            onClick={() => onDelete(inst.id)}
            className="font-mono text-xs text-glomalin-muted hover:text-glomalin-danger transition-colors"
          >
            Delete
          </button>
        </span>
      </td>
    </tr>
  )
}

// ── Layer 2: Variant row ───────────────────────────────────────────────────────

function VariantRow({
  vp,
  onEdit,
  onDelete,
}: {
  vp: VariantPosition
  onEdit: (inst: SaleInstrument) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { variant } = vp

  return (
    <>
      <tr
        onClick={() => setExpanded((v) => !v)}
        className="border-t border-glomalin-border/30 cursor-pointer hover:bg-glomalin-surface/40 transition-colors"
      >
        <td colSpan={9} className="px-0 py-0">
          <div className="flex items-center gap-3 pl-5 pr-4 py-2">
            <span
              className={`text-glomalin-muted text-xs transition-transform inline-block ${
                expanded ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
            <span className="font-mono text-sm text-glomalin-text">{variant.name}</span>
            {variant.is_contracted && (
              <Badge variant="info">Pre-sold</Badge>
            )}
            <div className="flex-1" />
            {variant.estimated_bu != null && variant.estimated_bu > 0 ? (
              <>
                <span className="font-mono text-xs text-glomalin-muted">
                  <span className="tabular-nums">{formatBu(vp.priced_bu)}</span>
                  {' / '}
                  <span className="tabular-nums">{formatBu(variant.estimated_bu)}</span>
                  {' bu'}
                </span>
                <MiniBar pct={vp.pct_priced} />
              </>
            ) : (
              <span className="font-mono text-xs text-glomalin-muted">
                {vp.priced_bu > 0 ? (
                  <><span className="tabular-nums">{formatBu(vp.priced_bu)}</span>{' bu priced'}</>
                ) : 'No estimate set'}
              </span>
            )}
            {vp.wap != null && (
              <span className="font-mono text-xs text-glomalin-muted">
                WAP {fmtPrice(vp.wap)}
              </span>
            )}
            <span className="font-mono text-xs text-glomalin-muted">
              ({vp.instruments.length})
            </span>
          </div>
        </td>
      </tr>

      {expanded && vp.instruments.length === 0 && (
        <tr className="border-t border-glomalin-border/20">
          <td colSpan={9} className="pl-16 pr-4 py-2">
            <p className="font-mono text-xs text-glomalin-muted">No instruments for this variant.</p>
          </td>
        </tr>
      )}

      {expanded && vp.instruments.map((inst) => (
        <InstrumentRow
          key={inst.id}
          inst={inst}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

// ── Layer 1: Commodity row ─────────────────────────────────────────────────────

function CommodityRow({
  pos,
  onEdit,
  onDelete,
}: {
  pos: CommodityPosition
  onEdit: (inst: SaleInstrument) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { commodity } = pos

  const barColor = pos.pct_priced >= 80 ? colors.accent : pos.pct_priced >= 50 ? colors.info : colors.warning

  return (
    <>
      <tr
        onClick={() => setExpanded((v) => !v)}
        className={`cursor-pointer transition-colors border-b border-glomalin-border ${
          expanded
            ? 'bg-glomalin-surface border-l-2 border-l-glomalin-accent'
            : 'bg-glomalin-surface hover:bg-glomalin-bg'
        }`}
      >
        {/* Expand + name */}
        <td className="px-4 py-3">
          <span className="flex items-center gap-2">
            <span
              className={`text-glomalin-muted text-xs transition-transform inline-block ${
                expanded ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
            <span className="font-mono font-semibold text-glomalin-text">{commodity.name}</span>
            {commodity.cbot_symbol && (
              <span className="font-mono text-xs text-glomalin-muted">({commodity.cbot_symbol})</span>
            )}
            {!commodity.is_hedgeable && (
              <Badge variant="info">Specialty</Badge>
            )}
          </span>
        </td>

        {/* Bu priced / est */}
        <td className="px-4 py-3 text-right font-mono text-sm text-glomalin-muted">
          {pos.total_estimated_bu > 0 ? (
            <>
              <span className="tabular-nums">{formatBu(pos.total_priced_bu)}</span>
              {' / '}
              <span className="tabular-nums">{formatBu(pos.total_estimated_bu)}</span>
              {' bu'}
            </>
          ) : (
            <>
              <span className="tabular-nums">{formatBu(pos.total_priced_bu)}</span>
              {' bu priced'}
            </>
          )}
        </td>

        {/* Progress bar */}
        <td className="px-4 py-3 w-40">
          {pos.total_estimated_bu > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-glomalin-bg overflow-hidden">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, pos.pct_priced)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <span className="font-mono text-xs text-glomalin-text w-10 text-right">
                {fmtPct(pos.pct_priced)}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-glomalin-muted">—</span>
          )}
        </td>

        {/* CBOT price */}
        <td className="px-4 py-3 text-right font-mono text-sm text-glomalin-text">
          {pos.cbot_price != null ? fmtPrice(pos.cbot_price) : '—'}
        </td>

        {/* WAP */}
        <td className="px-4 py-3 text-right font-mono text-sm">
          {pos.wap != null ? (
            <span className="text-glomalin-text">{fmtPrice(pos.wap)}</span>
          ) : (
            <span className="text-glomalin-muted">—</span>
          )}
        </td>

        {/* Unpriced exposure */}
        <td className="px-4 py-3 text-right font-mono text-sm" colSpan={4}>
          {pos.unpriced_exposure_dollars != null ? (
            pos.unpriced_exposure_dollars > 0 ? (
              <span className={pos.unpriced_exposure_dollars > 200_000 ? 'text-glomalin-warning font-semibold' : 'text-glomalin-muted'}>
                <span className="tabular-nums">{formatBu(pos.unpriced_bu)}</span>
                {' bu · $'}
                <span className="tabular-nums">{Math.round(pos.unpriced_exposure_dollars / 1000)}</span>
                {'k'}
              </span>
            ) : (
              <span className="text-glomalin-accent">✓ Fully priced</span>
            )
          ) : (
            <span className="text-glomalin-muted">—</span>
          )}
        </td>
      </tr>

      {expanded && pos.variants.length === 0 && (
        <tr className="border-b border-glomalin-border/50">
          <td colSpan={9} className="pl-10 pr-4 py-3">
            <p className="font-mono text-xs text-glomalin-muted">
              No variants configured for this commodity. Use ⚙ Variants to add them.
            </p>
          </td>
        </tr>
      )}

      {expanded && pos.variants.map((vp) => (
        <VariantRow
          key={vp.variant.id}
          vp={vp}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CommodityTableProps {
  positions: CommodityPosition[]
  onEditInstrument: (inst: SaleInstrument) => void
  onDeleteInstrument: (id: string) => void
}

export function CommodityTable({ positions, onEditInstrument, onDeleteInstrument }: CommodityTableProps) {
  if (positions.length === 0) {
    return <Empty title="No commodity positions" description="No positions for this crop year." />
  }

  return (
    <div className="rounded-lg border border-glomalin-border overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-glomalin-surface border-b border-glomalin-border">
            <th className="px-4 py-3 text-left text-glomalin-accent font-semibold">
              Commodity / Variant / Instrument
            </th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">Bu Priced</th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold w-40">%</th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">CBOT</th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">WAP</th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold" colSpan={4}>
              Unpriced / Detail
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <CommodityRow
              key={pos.commodity.id}
              pos={pos}
              onEdit={onEditInstrument}
              onDelete={onDeleteInstrument}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
