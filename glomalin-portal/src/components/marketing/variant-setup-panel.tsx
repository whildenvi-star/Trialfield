'use client'

import { useState } from 'react'
import type { Commodity, CropVariant } from '@/lib/marketing/types'
import type { BudgetField } from '@/lib/marketing/types'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface VariantSetupPanelProps {
  commodities: Commodity[]
  variants: CropVariant[]
  budgetFields: BudgetField[]
  cropYear?: number
  onClose: () => void
  onSaved: () => void
}

interface VariantEdit {
  id: string
  name: string
  estimated_bu: string
  is_contracted: boolean
  dirty: boolean
}

function buildEdits(variants: CropVariant[]): Record<string, VariantEdit> {
  const out: Record<string, VariantEdit> = {}
  for (const v of variants) {
    out[v.id] = {
      id: v.id,
      name: v.name,
      estimated_bu: v.estimated_bu != null ? String(v.estimated_bu) : '',
      is_contracted: v.is_contracted,
      dirty: false,
    }
  }
  return out
}

export function VariantSetupPanel({
  commodities,
  variants,
  budgetFields,
  cropYear = CURRENT_CROP_YEAR,
  onClose,
  onSaved,
}: VariantSetupPanelProps) {
  const [edits, setEdits] = useState<Record<string, VariantEdit>>(() => buildEdits(variants))
  const [newRows, setNewRows] = useState<Array<{ commodity_id: string; name: string; estimated_bu: string; is_contracted: boolean }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  function updateEdit(id: string, patch: Partial<VariantEdit>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true } }))
  }

  function addNewRow(commodityId: string) {
    setNewRows((prev) => [...prev, { commodity_id: commodityId, name: '', estimated_bu: '', is_contracted: false }])
  }

  function updateNew(idx: number, patch: Partial<typeof newRows[0]>) {
    setNewRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeNew(idx: number) {
    setNewRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // Sync from farm-budget: group budgetFields by crop, estimate bu from acres × ~180 bu/ac
  // User can adjust — this is just a starting point
  function handleSyncFromBudget() {
    setSyncing(true)
    // Group budget fields by crop name
    const buByCrop = new Map<string, number>()
    for (const f of budgetFields) {
      const key = f.crop.toLowerCase().trim()
      // Estimate bushels from budget income data: cropIncomePerAcre is budget revenue/ac
      // Without a yield endpoint we can't get real bu — show acres as a starting hint
      buByCrop.set(key, (buByCrop.get(key) ?? 0) + f.acres)
    }

    // Fuzzy-match existing variants against budget crop names
    const updated = { ...edits }
    let matched = 0
    for (const [id, edit] of Object.entries(updated)) {
      const variantName = edit.name.toLowerCase()
      for (const [cropKey, acres] of Array.from(buByCrop.entries())) {
        if (variantName.includes(cropKey) || cropKey.includes(variantName.split(' ')[0])) {
          // Only prefill if empty
          if (!edit.estimated_bu) {
            updated[id] = { ...edit, estimated_bu: String(Math.round(acres)), dirty: true }
            matched++
          }
          break
        }
      }
    }

    setEdits(updated)
    setSyncing(false)
    if (matched === 0) {
      setError('No variant names matched budget crop names. Enter estimates manually.')
    } else {
      setError(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const patches = Object.values(edits)
        .filter((e) => e.dirty)
        .map((e) =>
          fetch(`/api/marketing/variants/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: e.name.trim() || undefined,
              estimated_bu: e.estimated_bu ? Number(e.estimated_bu) : null,
              is_contracted: e.is_contracted,
            }),
          })
        )

      const creates = newRows
        .filter((r) => r.name.trim() && r.commodity_id)
        .map((r) =>
          fetch('/api/marketing/variants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commodity_id: r.commodity_id,
              name: r.name.trim(),
              crop_year: cropYear,
              estimated_bu: r.estimated_bu ? Number(r.estimated_bu) : null,
              is_contracted: r.is_contracted,
            }),
          })
        )

      const results = await Promise.allSettled([...patches, ...creates])
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
      if (failed.length > 0) {
        setError(`${failed.length} save(s) failed. Check console for details.`)
        return
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete variant "${name}"? Any instruments linked to it will be unassigned.`)) return
    try {
      const res = await fetch(`/api/marketing/variants/${id}`, { method: 'DELETE' })
      if (!res.ok) { setError('Delete failed'); return }
      await onSaved()
      // Remove from local edits
      setEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch {
      setError('Delete failed')
    }
  }

  const ic = 'bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 w-[580px] bg-glomalin-surface border-l border-glomalin-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-glomalin-border">
          <div>
            <h2 className="font-mono font-semibold text-glomalin-text">Variant Setup</h2>
            <p className="font-mono text-xs text-glomalin-muted mt-0.5">{cropYear} crop year</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncFromBudget}
              disabled={syncing || budgetFields.length === 0}
              className="font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors border border-glomalin-border rounded px-3 py-1.5 disabled:opacity-40"
              title="Pre-fill estimated_bu from farm-budget field data"
            >
              {syncing ? 'Syncing…' : '↻ Sync from Farm Budget'}
            </button>
            <button
              onClick={onClose}
              className="text-glomalin-muted hover:text-glomalin-text transition-colors font-mono text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded border border-glomalin-warning/30 bg-glomalin-warning/10 px-3 py-2 text-xs font-mono text-glomalin-warning">
              {error}
            </div>
          )}

          {commodities.map((commodity) => {
            const commodityVariants = variants.filter((v) => v.commodity_id === commodity.id)
            const newForThis = newRows.filter((r) => r.commodity_id === commodity.id)

            return (
              <div key={commodity.id} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs font-semibold text-glomalin-accent uppercase tracking-wide">
                    {commodity.name}
                    {commodity.cbot_symbol && (
                      <span className="ml-1 text-glomalin-muted normal-case">({commodity.cbot_symbol})</span>
                    )}
                  </h3>
                  <button
                    onClick={() => addNewRow(commodity.id)}
                    className="font-mono text-xs text-glomalin-accent hover:opacity-80"
                  >
                    + Add Variant
                  </button>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="font-mono text-[10px] text-glomalin-muted uppercase pb-1.5 pr-3">Variant</th>
                      <th className="font-mono text-[10px] text-glomalin-muted uppercase pb-1.5 pr-3 text-right w-28">Est. Bu</th>
                      <th className="font-mono text-[10px] text-glomalin-muted uppercase pb-1.5 pr-3 text-center w-20">Pre-sold</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {commodityVariants.map((v) => {
                      const e = edits[v.id]
                      if (!e) return null
                      return (
                        <tr key={v.id} className="border-t border-glomalin-border/30">
                          <td className="py-1.5 pr-3">
                            <input
                              type="text"
                              value={e.name}
                              onChange={(ev) => updateEdit(v.id, { name: ev.target.value })}
                              className={`${ic} w-full`}
                            />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              step="100"
                              min="0"
                              value={e.estimated_bu}
                              onChange={(ev) => updateEdit(v.id, { estimated_bu: ev.target.value })}
                              className={`${ic} w-full text-right`}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-1.5 pr-3 text-center">
                            <input
                              type="checkbox"
                              checked={e.is_contracted}
                              onChange={(ev) => updateEdit(v.id, { is_contracted: ev.target.checked })}
                              className="accent-glomalin-accent"
                            />
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              onClick={() => handleDelete(v.id, v.name)}
                              className="font-mono text-[10px] text-glomalin-muted hover:text-glomalin-danger transition-colors"
                              title="Delete variant"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}

                    {/* New rows for this commodity */}
                    {newForThis.map((r, localIdx) => {
                      const globalIdx = newRows.findIndex(
                        (nr, i) => nr.commodity_id === commodity.id &&
                          newRows.filter((x, j) => j < i && x.commodity_id === commodity.id).length === localIdx
                      )
                      return (
                        <tr key={`new-${commodity.id}-${localIdx}`} className="border-t border-glomalin-border/30">
                          <td className="py-1.5 pr-3">
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => updateNew(globalIdx, { name: e.target.value })}
                              placeholder="Variant name"
                              className={`${ic} w-full`}
                              autoFocus={localIdx === 0}
                            />
                          </td>
                          <td className="py-1.5 pr-3">
                            <input
                              type="number"
                              step="100"
                              min="0"
                              value={r.estimated_bu}
                              onChange={(e) => updateNew(globalIdx, { estimated_bu: e.target.value })}
                              className={`${ic} w-full text-right`}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-1.5 pr-3 text-center">
                            <input
                              type="checkbox"
                              checked={r.is_contracted}
                              onChange={(e) => updateNew(globalIdx, { is_contracted: e.target.checked })}
                              className="accent-glomalin-accent"
                            />
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              onClick={() => removeNew(globalIdx)}
                              className="font-mono text-[10px] text-glomalin-muted hover:text-glomalin-danger transition-colors"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}

                    {commodityVariants.length === 0 && newForThis.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2">
                          <p className="font-mono text-xs text-glomalin-muted">
                            No variants — click + Add Variant above.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-glomalin-border flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded border border-glomalin-border px-3 py-2 font-mono text-sm text-glomalin-muted hover:text-glomalin-text transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded bg-glomalin-accent text-glomalin-bg font-mono font-bold text-sm px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
    </>
  )
}
