'use client'

import { useState, useEffect } from 'react'
import type { Commodity, CommodityPricing, PricingMode, PriceUnit } from '@/lib/marketing/types'

interface CropTypesPanelProps {
  commodities: Commodity[]
  pricingConfigs: CommodityPricing[]
  cropYear: number
  onCommoditiesChanged: () => void
  onPricingChanged: () => void
}

// ── Row state ──────────────────────────────────────────────────────────────────

interface RowDraft {
  commodityId: string
  name: string
  cbotSymbol: string
  isHedgeable: boolean
  pricingMode: PricingMode
  priceValue: string
  priceUnit: PriceUnit
  notes: string
  dirty: boolean
  saving: boolean
  error: string | null
}

function buildDraft(commodity: Commodity, pricing: CommodityPricing | undefined): RowDraft {
  return {
    commodityId: commodity.id,
    name: commodity.name,
    cbotSymbol: commodity.cbot_symbol ?? '',
    isHedgeable: commodity.is_hedgeable,
    pricingMode: pricing?.pricing_mode ?? 'cbot_basis',
    priceValue: pricing?.price_value != null ? String(pricing.price_value) : '',
    priceUnit: pricing?.price_unit ?? 'per_bu',
    notes: pricing?.notes ?? '',
    dirty: false,
    saving: false,
    error: null,
  }
}

// ── Label helpers ──────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<PriceUnit, string> = {
  per_bu:  '/bu',
  per_ton: '/ton',
  per_cwt: '/cwt',
}

function priceLabel(mode: PricingMode): string {
  return mode === 'flat_contract' ? 'Price' : 'Basis'
}

// ── Input class ────────────────────────────────────────────────────────────────

const ic = 'bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'

// ── New row form ───────────────────────────────────────────────────────────────

interface NewRowState {
  name: string
  cbotSymbol: string
  isHedgeable: boolean
  pricingMode: PricingMode
  priceValue: string
  priceUnit: PriceUnit
  notes: string
  saving: boolean
  error: string | null
}

const EMPTY_NEW: NewRowState = {
  name: '',
  cbotSymbol: '',
  isHedgeable: false,
  pricingMode: 'flat_contract',
  priceValue: '',
  priceUnit: 'per_bu',
  notes: '',
  saving: false,
  error: null,
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CropTypesPanel({
  commodities,
  pricingConfigs,
  cropYear,
  onCommoditiesChanged,
  onPricingChanged,
}: CropTypesPanelProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [addingNew, setAddingNew] = useState(false)
  const [newRow, setNewRow] = useState<NewRowState>(EMPTY_NEW)

  // Rebuild row drafts when upstream data changes
  useEffect(() => {
    const configById = new Map(pricingConfigs.map((p) => [p.commodity_id, p]))
    setRows(
      [...commodities]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => buildDraft(c, configById.get(c.id)))
    )
  }, [commodities, pricingConfigs])

  function patchRow(idx: number, patch: Partial<RowDraft>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r))
    )
  }

  async function saveRow(idx: number) {
    const row = rows[idx]
    if (!row.dirty) return
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, saving: true, error: null } : r)))

    try {
      // 1. Patch commodity fields
      const commodityRes = await fetch(`/api/marketing/commodities/${row.commodityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.name.trim(),
          cbot_symbol: row.cbotSymbol.trim() || null,
          is_hedgeable: row.isHedgeable,
        }),
      })
      if (!commodityRes.ok) {
        const err = await commodityRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to save crop type')
      }

      // 2. Upsert pricing config for this crop year
      const pricingRes = await fetch('/api/marketing/commodity-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commodity_id: row.commodityId,
          crop_year: cropYear,
          pricing_mode: row.pricingMode,
          price_value: row.priceValue ? parseFloat(row.priceValue) : null,
          price_unit: row.priceUnit,
          notes: row.notes.trim() || null,
        }),
      })
      if (!pricingRes.ok) {
        const err = await pricingRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to save pricing')
      }

      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, dirty: false, saving: false } : r)))
      onCommoditiesChanged()
      onPricingChanged()
    } catch (err) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, saving: false, error: err instanceof Error ? err.message : 'Save failed' }
            : r
        )
      )
    }
  }

  async function deleteRow(idx: number) {
    const row = rows[idx]
    if (!confirm(`Delete crop type "${row.name}"? This cannot be undone.`)) return

    const res = await fetch(`/api/marketing/commodities/${row.commodityId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, error: (err as { error?: string }).error ?? 'Delete failed' }
            : r
        )
      )
      return
    }
    onCommoditiesChanged()
    onPricingChanged()
  }

  async function saveNew() {
    if (!newRow.name.trim()) return
    setNewRow((prev) => ({ ...prev, saving: true, error: null }))

    try {
      const res = await fetch('/api/marketing/commodities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRow.name.trim(),
          cbot_symbol: newRow.cbotSymbol.trim() || null,
          is_hedgeable: newRow.isHedgeable,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to create crop type')
      }
      const { commodity } = await res.json()

      // Set pricing if provided
      if (newRow.priceValue || newRow.pricingMode) {
        await fetch('/api/marketing/commodity-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commodity_id: commodity.id,
            crop_year: cropYear,
            pricing_mode: newRow.pricingMode,
            price_value: newRow.priceValue ? parseFloat(newRow.priceValue) : null,
            price_unit: newRow.priceUnit,
          }),
        })
      }

      setNewRow(EMPTY_NEW)
      setAddingNew(false)
      onCommoditiesChanged()
      onPricingChanged()
    } catch (err) {
      setNewRow((prev) => ({
        ...prev,
        saving: false,
        error: err instanceof Error ? err.message : 'Save failed',
      }))
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-xs text-glomalin-muted uppercase tracking-wider">
            Pricing for {cropYear} crop year
          </p>
          <p className="font-mono text-xs text-glomalin-muted/60 mt-0.5">
            Changes apply to position calculations and exposure estimates.
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setNewRow(EMPTY_NEW) }}
          className="font-mono text-xs font-bold bg-glomalin-accent text-glomalin-bg rounded px-3 py-1.5 hover:opacity-90 transition-opacity"
        >
          + Add Crop Type
        </button>
      </div>

      {/* Table */}
      <div className="rounded border border-glomalin-border overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead className="bg-glomalin-surface border-b border-glomalin-border">
            <tr>
              <th className="text-left px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px]">Crop Name</th>
              <th className="text-left px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px] w-20">CBOT</th>
              <th className="text-center px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px] w-16">Hedge</th>
              <th className="text-center px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px] w-44">Pricing Mode</th>
              <th className="text-right px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px] w-28">Price / Basis</th>
              <th className="text-left px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px] w-24">Unit</th>
              <th className="text-left px-3 py-2.5 font-normal text-glomalin-muted uppercase tracking-wider text-[10px]">Notes</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-glomalin-border">
            {rows.map((row, idx) => (
              <tr key={row.commodityId} className="bg-glomalin-bg hover:bg-glomalin-surface/50 transition-colors">
                {/* Name */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => patchRow(idx, { name: e.target.value })}
                    className={`${ic} w-full`}
                  />
                </td>

                {/* CBOT symbol */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.cbotSymbol}
                    onChange={(e) => patchRow(idx, { cbotSymbol: e.target.value.toUpperCase() })}
                    placeholder="ZC"
                    className={`${ic} w-16 uppercase`}
                  />
                </td>

                {/* Is hedgeable */}
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.isHedgeable}
                    onChange={(e) => patchRow(idx, { isHedgeable: e.target.checked })}
                    className="accent-glomalin-accent"
                  />
                </td>

                {/* Pricing mode toggle */}
                <td className="px-3 py-2">
                  <div className="flex rounded border border-glomalin-border overflow-hidden">
                    {(['cbot_basis', 'flat_contract'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => patchRow(idx, { pricingMode: mode })}
                        className={[
                          'flex-1 py-1 font-mono text-[10px] transition-colors whitespace-nowrap px-1',
                          row.pricingMode === mode
                            ? 'bg-glomalin-accent text-glomalin-bg font-semibold'
                            : 'bg-glomalin-bg text-glomalin-muted hover:text-glomalin-text',
                        ].join(' ')}
                      >
                        {mode === 'cbot_basis' ? 'CBOT' : 'Flat'}
                      </button>
                    ))}
                  </div>
                </td>

                {/* Price / Basis value */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-glomalin-muted text-[10px]">
                      {priceLabel(row.pricingMode)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={row.priceValue}
                      onChange={(e) => patchRow(idx, { priceValue: e.target.value })}
                      placeholder={row.pricingMode === 'cbot_basis' ? '−0.15' : '15.00'}
                      className={`${ic} w-20 text-right`}
                    />
                  </div>
                </td>

                {/* Unit — shown for flat_contract only */}
                <td className="px-3 py-2">
                  {row.pricingMode === 'flat_contract' ? (
                    <select
                      value={row.priceUnit}
                      onChange={(e) => patchRow(idx, { priceUnit: e.target.value as PriceUnit })}
                      className={`${ic} w-20`}
                    >
                      {(Object.keys(UNIT_LABELS) as PriceUnit[]).map((u) => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-glomalin-muted text-[10px]">/bu</span>
                  )}
                </td>

                {/* Notes */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => patchRow(idx, { notes: e.target.value })}
                    placeholder="optional"
                    className={`${ic} w-full`}
                  />
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end">
                    {row.error && (
                      <span className="text-glomalin-danger text-[10px]" title={row.error}>!</span>
                    )}
                    {row.dirty && (
                      <button
                        onClick={() => saveRow(idx)}
                        disabled={row.saving}
                        className="font-mono text-[10px] text-glomalin-accent hover:opacity-80 disabled:opacity-40"
                        title="Save changes"
                      >
                        {row.saving ? '…' : '✓'}
                      </button>
                    )}
                    <button
                      onClick={() => deleteRow(idx)}
                      className="font-mono text-[10px] text-glomalin-muted hover:text-glomalin-danger transition-colors"
                      title="Delete crop type"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* New row form */}
            {addingNew && (
              <tr className="bg-glomalin-elevated border-t-2 border-glomalin-accent/30">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={newRow.name}
                    onChange={(e) => setNewRow((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Crop name"
                    autoFocus
                    className={`${ic} w-full`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={newRow.cbotSymbol}
                    onChange={(e) => setNewRow((p) => ({ ...p, cbotSymbol: e.target.value.toUpperCase() }))}
                    placeholder="ZC"
                    className={`${ic} w-16 uppercase`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={newRow.isHedgeable}
                    onChange={(e) => setNewRow((p) => ({ ...p, isHedgeable: e.target.checked }))}
                    className="accent-glomalin-accent"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex rounded border border-glomalin-border overflow-hidden">
                    {(['cbot_basis', 'flat_contract'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNewRow((p) => ({ ...p, pricingMode: mode }))}
                        className={[
                          'flex-1 py-1 font-mono text-[10px] transition-colors whitespace-nowrap px-1',
                          newRow.pricingMode === mode
                            ? 'bg-glomalin-accent text-glomalin-bg font-semibold'
                            : 'bg-glomalin-bg text-glomalin-muted hover:text-glomalin-text',
                        ].join(' ')}
                      >
                        {mode === 'cbot_basis' ? 'CBOT' : 'Flat'}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-glomalin-muted text-[10px]">
                      {priceLabel(newRow.pricingMode)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={newRow.priceValue}
                      onChange={(e) => setNewRow((p) => ({ ...p, priceValue: e.target.value }))}
                      placeholder={newRow.pricingMode === 'cbot_basis' ? '−0.15' : '15.00'}
                      className={`${ic} w-20 text-right`}
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  {newRow.pricingMode === 'flat_contract' ? (
                    <select
                      value={newRow.priceUnit}
                      onChange={(e) => setNewRow((p) => ({ ...p, priceUnit: e.target.value as PriceUnit }))}
                      className={`${ic} w-20`}
                    >
                      {(Object.keys(UNIT_LABELS) as PriceUnit[]).map((u) => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-glomalin-muted text-[10px]">/bu</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={newRow.notes}
                    onChange={(e) => setNewRow((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="optional"
                    className={`${ic} w-full`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end">
                    {newRow.error && (
                      <span className="text-glomalin-danger text-[10px]" title={newRow.error}>!</span>
                    )}
                    <button
                      onClick={saveNew}
                      disabled={newRow.saving || !newRow.name.trim()}
                      className="font-mono text-[10px] text-glomalin-accent hover:opacity-80 disabled:opacity-40"
                      title="Add crop type"
                    >
                      {newRow.saving ? '…' : '✓'}
                    </button>
                    <button
                      onClick={() => setAddingNew(false)}
                      className="font-mono text-[10px] text-glomalin-muted hover:text-glomalin-text"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {rows.length === 0 && !addingNew && (
          <div className="py-10 text-center font-mono text-xs text-glomalin-muted">
            No crop types defined — click <span className="text-glomalin-accent">+ Add Crop Type</span> to get started.
          </div>
        )}
      </div>

      <p className="mt-3 font-mono text-[10px] text-glomalin-muted">
        CBOT Basis: unpriced exposure = unpriced bu × (CBOT futures + basis offset) ·
        Flat Contract: unpriced exposure = unpriced bu × flat price · Changes save per row (✓).
      </p>
    </div>
  )
}
