'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MacroRollupView } from '@/components/macro/macro-rollup-view'
import { AddContractModal } from '@/components/macro/add-contract-modal'
import type { FieldRow, InputEntry } from '@/components/macro/field-table'
import type { MarketingData } from '@/components/macro/macro-rollup-view'

// ── Props ──────────────────────────────────────────────────────────────────────

interface MobileMacroViewProps {
  rows: FieldRow[]
  hasContracts: boolean
  budgetOffline: boolean
  heroValueProjected: number | null
  heroValueLocked: number | null
  cropYear: number
  role: string
  productNames: string[]
  cropNames: string[]
  marketingData: MarketingData
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtAcres(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

function fmtDollars(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtPop(n: number): string {
  return n >= 1000
    ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
    : String(n)
}

// ── Crop summary card (office view) ───────────────────────────────────────────

interface CropGroup {
  crop: string
  totalAcres: number
  weightedRevPerAcre: number
  contracts: FieldRow['contracts']
}

function buildCropGroups(rows: FieldRow[]): CropGroup[] {
  const map = new Map<string, CropGroup>()
  for (const r of rows) {
    const key = r.crop.toLowerCase()
    if (!map.has(key)) {
      map.set(key, { crop: r.crop, totalAcres: 0, weightedRevPerAcre: 0, contracts: r.contracts })
    }
    const g = map.get(key)!
    g.totalAcres += r.acres
    g.weightedRevPerAcre += r.budgetRevenuePerAcre * r.acres
  }
  const groups = Array.from(map.values())
  for (const g of groups) {
    g.weightedRevPerAcre = g.totalAcres > 0 ? g.weightedRevPerAcre / g.totalAcres : 0
  }
  return groups.sort((a, b) => b.totalAcres - a.totalAcres)
}

function CropCard({ group }: { group: CropGroup }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded border border-glomalin-border bg-glomalin-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <span className="font-mono font-semibold text-glomalin-text">{group.crop}</span>
          <span className="ml-3 font-mono text-sm text-glomalin-muted">{fmtAcres(group.totalAcres)} ac</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-glomalin-accent">{fmtDollars(group.weightedRevPerAcre)}/ac proj.</span>
          <svg
            className={`w-4 h-4 text-glomalin-muted transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && group.contracts.length > 0 && (
        <div className="border-t border-glomalin-border px-4 py-3 space-y-2">
          <p className="font-mono text-xs text-glomalin-muted uppercase tracking-wide mb-2">Contracts</p>
          {group.contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between font-mono text-sm">
              <span className="text-glomalin-text">{c.buyer ?? '—'}</span>
              <span className="text-glomalin-muted">
                {fmtAcres(c.bushels)} bu
                {c.pricePerBushel != null ? ` @ ${fmtDollars(c.pricePerBushel)}/bu` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && group.contracts.length === 0 && (
        <div className="border-t border-glomalin-border px-4 py-3">
          <p className="font-mono text-sm text-glomalin-muted">No contracts entered yet.</p>
        </div>
      )}
    </div>
  )
}

// ── Office view ────────────────────────────────────────────────────────────────

function OfficeView({ rows, cropYear }: { rows: FieldRow[]; cropYear: number }) {
  const [showModal, setShowModal] = useState(false)
  const groups = buildCropGroups(rows)
  const totalAcres = rows.reduce((s, r) => s + r.acres, 0)

  return (
    <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono text-lg font-semibold text-glomalin-text">Crop Summary</h1>
            <p className="font-mono text-sm text-glomalin-muted">{cropYear} · {fmtAcres(totalAcres)} total acres</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded border border-glomalin-accent bg-glomalin-accent/10 px-3 py-2 font-mono text-sm text-glomalin-accent hover:bg-glomalin-accent/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Contract
          </button>
        </div>

        <div className="space-y-2">
          {groups.map((g) => (
            <CropCard key={g.crop} group={g} />
          ))}
          {groups.length === 0 && (
            <p className="font-mono text-sm text-glomalin-muted text-center py-8">No field data available.</p>
          )}
        </div>
      </div>

      {showModal && (
        <AddContractModal
          crops={groups.map((g) => g.crop)}
          cropYear={cropYear}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ── Operator view ──────────────────────────────────────────────────────────────

// Input row within the inline editor
function InputRow({
  input,
  onChange,
  onRemove,
  productNames,
}: {
  input: InputEntry
  onChange: (updated: InputEntry) => void
  onRemove: () => void
  productNames: string[]
}) {
  const seasons = ['Spring', 'Fall', 'Pre-plant', 'Post-emerge', 'Summer', 'Winter']
  return (
    <div className="flex items-center gap-2">
      <input
        list={`products-${input.id}`}
        value={input.productName}
        onChange={(e) => onChange({ ...input, productName: e.target.value })}
        placeholder="Product name"
        className="min-w-0 flex-1 rounded border border-glomalin-border bg-glomalin-bg px-2 py-1 font-mono text-xs text-glomalin-text placeholder:text-glomalin-muted focus:border-glomalin-accent focus:outline-none"
      />
      <datalist id={`products-${input.id}`}>
        {productNames.slice(0, 40).map((p) => <option key={p} value={p} />)}
      </datalist>
      <input
        type="number"
        value={input.quantity || ''}
        onChange={(e) => onChange({ ...input, quantity: Number(e.target.value) })}
        placeholder="Qty"
        className="w-16 rounded border border-glomalin-border bg-glomalin-bg px-2 py-1 font-mono text-xs text-glomalin-text placeholder:text-glomalin-muted focus:border-glomalin-accent focus:outline-none"
      />
      <select
        value={input.season}
        onChange={(e) => onChange({ ...input, season: e.target.value })}
        className="rounded border border-glomalin-border bg-glomalin-bg px-1 py-1 font-mono text-xs text-glomalin-text focus:border-glomalin-accent focus:outline-none"
      >
        {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={onRemove}
        className="shrink-0 text-glomalin-muted hover:text-red-400 transition-colors"
        aria-label="Remove input"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Expandable field card with inline crop plan editor
function OperatorFieldCard({
  row,
  productNames,
  cropNames,
}: {
  row: FieldRow
  productNames: string[]
  cropNames: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local edit state — initialized from row on each open
  const [editCrop, setEditCrop] = useState(row.crop)
  const [editVariety, setEditVariety] = useState(row.variety ?? '')
  const [editPop, setEditPop] = useState(row.population ?? 0)
  const [editInputs, setEditInputs] = useState<InputEntry[]>(row.inputs)

  function handleOpen() {
    // Reset to current row values every time we open
    setEditCrop(row.crop)
    setEditVariety(row.variety ?? '')
    setEditPop(row.population ?? 0)
    setEditInputs(row.inputs)
    setError(null)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
    setError(null)
  }

  function addInput() {
    setEditInputs((prev) => [
      ...prev,
      { id: `new_${Date.now()}`, productName: '', quantity: 0, season: 'Spring', unit: 'per acre' },
    ])
  }

  function updateInput(idx: number, updated: InputEntry) {
    setEditInputs((prev) => prev.map((inp, i) => i === idx ? updated : inp))
  }

  function removeInput(idx: number) {
    setEditInputs((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/macro/crop-plans/${row.fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: editCrop,
          seed: { variety: editVariety, population: editPop },
          inputs: editInputs.filter((i) => i.productName.trim()),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Save failed')
        return
      }
      setOpen(false)
      startTransition(() => router.refresh())
    } catch {
      setError('Network error — check connection')
    } finally {
      setSaving(false)
    }
  }

  const isLoading = saving || isPending

  return (
    <div className="rounded border border-glomalin-border bg-glomalin-surface overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={open ? handleCancel : handleOpen}
        className="w-full flex items-start justify-between px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono font-semibold text-glomalin-text truncate">{row.fieldName}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="inline-block rounded bg-glomalin-accent/15 px-1.5 py-0.5 font-mono text-xs text-glomalin-accent">
              {row.crop}
            </span>
            {row.variety && (
              <span className="font-mono text-xs text-glomalin-muted">{row.variety}</span>
            )}
            <span className="font-mono text-xs text-glomalin-muted">{fmtAcres(row.acres)} ac</span>
            {row.population != null && row.population > 0 && (
              <span className="inline-block rounded bg-glomalin-border px-1.5 py-0.5 font-mono text-xs text-glomalin-muted">
                {fmtPop(row.population)} seeds/ac
              </span>
            )}
            {row.inputs.length > 0 && (
              <span className="inline-block rounded bg-glomalin-border px-1.5 py-0.5 font-mono text-xs text-glomalin-muted">
                {row.inputs.length} input{row.inputs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="ml-3 shrink-0 mt-0.5">
          {open ? (
            <span className="font-mono text-xs text-glomalin-muted">Cancel</span>
          ) : (
            <svg className="w-4 h-4 text-glomalin-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded inline editor */}
      {open && (
        <div className="border-t border-glomalin-border px-4 py-4 space-y-4">
          {/* Crop */}
          <div>
            <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wide mb-1">Crop</label>
            <input
              list="crop-names-list"
              value={editCrop}
              onChange={(e) => setEditCrop(e.target.value)}
              className="w-full rounded border border-glomalin-border bg-glomalin-bg px-3 py-2 font-mono text-sm text-glomalin-text focus:border-glomalin-accent focus:outline-none"
            />
            <datalist id="crop-names-list">
              {cropNames.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Variety + Population */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wide mb-1">Variety</label>
              <input
                type="text"
                value={editVariety}
                onChange={(e) => setEditVariety(e.target.value)}
                placeholder="e.g. P0720"
                className="w-full rounded border border-glomalin-border bg-glomalin-bg px-3 py-2 font-mono text-sm text-glomalin-text placeholder:text-glomalin-muted focus:border-glomalin-accent focus:outline-none"
              />
            </div>
            <div className="w-32 shrink-0">
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wide mb-1">Pop. (seeds/ac)</label>
              <input
                type="number"
                value={editPop || ''}
                onChange={(e) => setEditPop(Number(e.target.value))}
                placeholder="34000"
                className="w-full rounded border border-glomalin-border bg-glomalin-bg px-3 py-2 font-mono text-sm text-glomalin-text placeholder:text-glomalin-muted focus:border-glomalin-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Inputs list */}
          <div>
            <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wide mb-2">Planned Inputs</label>
            <div className="space-y-2">
              {editInputs.map((inp, idx) => (
                <InputRow
                  key={inp.id}
                  input={inp}
                  onChange={(updated) => updateInput(idx, updated)}
                  onRemove={() => removeInput(idx)}
                  productNames={productNames}
                />
              ))}
            </div>
            <button
              onClick={addInput}
              className="mt-2 flex items-center gap-1 font-mono text-xs text-glomalin-accent hover:text-glomalin-text transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add input
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="font-mono text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 rounded border border-glomalin-border px-3 py-2 font-mono text-sm text-glomalin-muted hover:text-glomalin-text transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 rounded border border-glomalin-accent bg-glomalin-accent/10 px-3 py-2 font-mono text-sm text-glomalin-accent hover:bg-glomalin-accent/20 transition-colors disabled:opacity-40"
            >
              {isLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OperatorView({
  rows,
  cropYear,
  productNames,
  cropNames,
}: {
  rows: FieldRow[]
  cropYear: number
  productNames: string[]
  cropNames: string[]
}) {
  const sorted = [...rows].sort((a, b) => a.fieldName.localeCompare(b.fieldName))
  return (
    <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6">
          <h1 className="font-mono text-lg font-semibold text-glomalin-text">Crop Plans</h1>
          <p className="font-mono text-sm text-glomalin-muted">{cropYear} · {sorted.length} fields</p>
        </div>
        <div className="space-y-2">
          {sorted.map((r) => (
            <OperatorFieldCard
              key={r.fieldId}
              row={r}
              productNames={productNames}
              cropNames={cropNames}
            />
          ))}
          {sorted.length === 0 && (
            <p className="font-mono text-sm text-glomalin-muted text-center py-8">No field data available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MobileMacroView({
  rows,
  hasContracts,
  budgetOffline,
  heroValueProjected,
  heroValueLocked,
  cropYear,
  role,
  productNames,
  cropNames,
  marketingData,
}: MobileMacroViewProps) {
  return (
    <>
      {budgetOffline && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/40 px-4 py-2 font-mono text-xs text-yellow-400 text-center">
          Farm budget service offline — showing last known data
        </div>
      )}

      {role === 'admin' || role === 'agronomist' ? (
        <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <MacroRollupView
              rows={rows}
              hasContracts={hasContracts}
              budgetOffline={budgetOffline}
              heroValueProjected={heroValueProjected}
              heroValueLocked={heroValueLocked}
              cropYear={cropYear}
              marketingData={marketingData}
            />
          </div>
        </div>
      ) : role === 'operator' ? (
        <OperatorView rows={rows} cropYear={cropYear} productNames={productNames} cropNames={cropNames} />
      ) : (
        <OfficeView rows={rows} cropYear={cropYear} />
      )}
    </>
  )
}
