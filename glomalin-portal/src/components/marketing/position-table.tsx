'use client'

import { useState } from 'react'
import type { MarketingPosition, GrainContract } from '@/lib/marketing/types'

interface PositionTableProps {
  positions: MarketingPosition[]
  onEditContract: (contract: GrainContract) => void
  onDeleteContract: (id: string) => void
}

function formatBu(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatDollars(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatPrice(value: number | null): string {
  if (value === null) return '—'
  return `$${value.toFixed(2)}`
}

function contractTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    accumulator: 'Accum',
    hta: 'HTA',
    options: 'Options',
    'min-price': 'Min-Price',
    basis: 'Basis',
  }
  return labels[type] ?? type
}

function formatDeliveryWindow(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `By ${fmt(end!)}`
}

export function PositionTable({
  positions,
  onEditContract,
  onDeleteContract,
}: PositionTableProps) {
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null)

  // Compute totals row
  const totalContracted = positions.reduce((sum, p) => sum + p.contracted_bu, 0)
  const totalUnpriced = positions.reduce((sum, p) => sum + p.unpriced_bu, 0)
  const totalExposure = positions.reduce(
    (sum, p) => sum + (p.unpriced_exposure_dollars ?? 0),
    0
  )
  const hasAnyExposure = positions.some((p) => p.unpriced_exposure_dollars !== null)

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-6 py-12 text-center">
        <p className="text-glomalin-muted text-sm font-mono">
          No positions for 2026. Add contracts using the button above, or wait for grain-tickets
          yield data to populate estimated production.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-glomalin-border overflow-hidden">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="bg-glomalin-surface border-b border-glomalin-border">
            <th className="px-4 py-3 text-left text-glomalin-accent font-semibold">Crop</th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">
              Est. Production (bu)
            </th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">
              Contracted (bu)
            </th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">
              Unpriced (bu)
            </th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">
              CBOT Price
            </th>
            <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">
              Unpriced Exposure
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const isExpanded = expandedCrop === pos.crop
            const isAlternate = idx % 2 === 1
            const rowKey = pos.registry_crop_id ?? pos.crop

            return (
              <>
                {/* Position summary row */}
                <tr
                  key={rowKey}
                  onClick={() => setExpandedCrop(isExpanded ? null : pos.crop)}
                  className={`border-b border-glomalin-border cursor-pointer transition-colors ${
                    isExpanded
                      ? 'border-l-2 border-l-glomalin-accent bg-glomalin-surface'
                      : isAlternate
                      ? 'bg-glomalin-bg hover:bg-glomalin-surface'
                      : 'bg-glomalin-surface hover:bg-glomalin-bg'
                  }`}
                >
                  {/* Crop name with expand indicator */}
                  <td className="px-4 py-3 text-glomalin-text">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`text-glomalin-muted text-xs transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      >
                        ▶
                      </span>
                      {pos.crop}
                      {pos.contracts.length > 0 && (
                        <span className="ml-1 text-xs text-glomalin-muted">
                          ({pos.contracts.length})
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Est. Production */}
                  <td className="px-4 py-3 text-right">
                    {pos.estimated_production_bu > 0 ? (
                      <span className="text-glomalin-text">{formatBu(pos.estimated_production_bu)}</span>
                    ) : (
                      <span className="text-glomalin-muted">—</span>
                    )}
                  </td>

                  {/* Contracted */}
                  <td className="px-4 py-3 text-right">
                    {pos.contracted_bu > 0 ? (
                      <span className="text-glomalin-green">{formatBu(pos.contracted_bu)}</span>
                    ) : (
                      <span className="text-glomalin-muted">0</span>
                    )}
                  </td>

                  {/* Unpriced */}
                  <td className="px-4 py-3 text-right">
                    {pos.unpriced_bu > 0 ? (
                      <span className="text-yellow-400">{formatBu(pos.unpriced_bu)}</span>
                    ) : (
                      <span className="text-glomalin-muted">0</span>
                    )}
                  </td>

                  {/* CBOT Price */}
                  <td className="px-4 py-3 text-right text-glomalin-text">
                    {formatPrice(pos.cbot_price)}
                  </td>

                  {/* Unpriced Exposure */}
                  <td className="px-4 py-3 text-right">
                    {pos.unpriced_exposure_dollars !== null ? (
                      <span
                        className={
                          pos.unpriced_exposure_dollars > 100000
                            ? 'text-yellow-400 font-semibold'
                            : 'text-glomalin-text'
                        }
                      >
                        {formatDollars(pos.unpriced_exposure_dollars)}
                      </span>
                    ) : (
                      <span className="text-glomalin-muted">—</span>
                    )}
                  </td>
                </tr>

                {/* Inline expanded contracts mini-table */}
                {isExpanded && (
                  <tr key={`${rowKey}-expanded`} className="border-b border-glomalin-border">
                    <td colSpan={6} className="px-0 py-0">
                      <div className="bg-glomalin-bg border-l-2 border-l-glomalin-accent px-4 py-3">
                        {pos.contracts.length === 0 ? (
                          <p className="text-glomalin-muted text-xs py-1">
                            No contracts entered for this crop.
                          </p>
                        ) : (
                          <table className="w-full text-xs font-mono">
                            <thead>
                              <tr className="text-glomalin-muted">
                                <th className="text-left pb-1.5 pr-4">Type</th>
                                <th className="text-left pb-1.5 pr-4">Buyer</th>
                                <th className="text-right pb-1.5 pr-4">Bushels</th>
                                <th className="text-right pb-1.5 pr-4">Price</th>
                                <th className="text-right pb-1.5 pr-4">Basis</th>
                                <th className="text-right pb-1.5 pr-4">Delivery</th>
                                <th className="text-right pb-1.5">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pos.contracts.map((c) => (
                                <tr
                                  key={c.id}
                                  className="border-t border-glomalin-border/50"
                                >
                                  <td className="py-1.5 pr-4">
                                    <span className="text-glomalin-accent font-semibold">
                                      {contractTypeLabel(c.contract_type)}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-4 text-glomalin-text">
                                    {c.buyer ?? <span className="text-glomalin-muted">—</span>}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-glomalin-text">
                                    {formatBu(c.bushels)}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-glomalin-text">
                                    {c.price_per_bushel !== null
                                      ? `$${c.price_per_bushel.toFixed(2)}`
                                      : <span className="text-glomalin-muted">—</span>}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-glomalin-text">
                                    {c.basis !== null
                                      ? `${c.basis >= 0 ? '+' : ''}${c.basis.toFixed(2)}`
                                      : <span className="text-glomalin-muted">—</span>}
                                  </td>
                                  <td className="py-1.5 pr-4 text-right text-glomalin-muted">
                                    {formatDeliveryWindow(c.delivery_start, c.delivery_end)}
                                  </td>
                                  <td className="py-1.5 text-right">
                                    <span className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onEditContract(c)
                                        }}
                                        className="text-glomalin-muted hover:text-glomalin-accent transition-colors"
                                      >
                                        Edit
                                      </button>
                                      <span className="text-glomalin-border">|</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onDeleteContract(c.id)
                                        }}
                                        className="text-glomalin-muted hover:text-red-400 transition-colors"
                                      >
                                        Delete
                                      </button>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}

          {/* Totals row */}
          <tr className="bg-glomalin-surface border-t-2 border-glomalin-border">
            <td className="px-4 py-3 text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
              Total
            </td>
            <td className="px-4 py-3 text-right text-glomalin-muted text-xs">—</td>
            <td className="px-4 py-3 text-right text-glomalin-green font-semibold">
              {formatBu(totalContracted)}
            </td>
            <td className="px-4 py-3 text-right font-semibold">
              <span className={totalUnpriced > 0 ? 'text-yellow-400' : 'text-glomalin-muted'}>
                {formatBu(totalUnpriced)}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-glomalin-muted text-xs">—</td>
            <td className="px-4 py-3 text-right font-semibold">
              {hasAnyExposure ? (
                <span className={totalExposure > 500000 ? 'text-yellow-400' : 'text-glomalin-text'}>
                  {formatDollars(totalExposure)}
                </span>
              ) : (
                <span className="text-glomalin-muted">—</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
