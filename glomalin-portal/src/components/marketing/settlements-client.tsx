'use client'

import { useState } from 'react'
import { formatBu, formatUsd, formatUsdCents, formatPct } from '@/lib/fmt'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table'
import { Empty } from '@/components/ui/empty'

// ── Types ────────────────────────────────────────────────────────────────────

interface SettlementRow {
  id: string
  lotNumber: string
  grossLbs: number | null
  finishedLbs: number
  germPct: number | null
  purityPct: number | null
  seedsPerLb: number | null
  lbsPerUnit: number
  units: number
  settlementDate: string | null
  notes: string | null
}

interface SettlementsClientProps {
  contractId: string
  contract: {
    id: string
    cropYear: number
    paymentBasis: string
    customer: { id: string; name: string; shortCode: string }
    variant: { id: string; name: string }
    contractedUnits: number | null
    pricePerUnit?: number | null // KEY ABSENT for office
  }
  settlements: SettlementRow[]
  reconciliation: {
    physicalDeliveredLbs: number
    sumGrossLbs: number | null
    sumFinishedLbs: number
    shrinkPct: number | null
    sumUnits: number
    contractedUnits: number | null
    settledRevenue?: number | null // KEY ABSENT for office
  }
}

// ── Styling constants (copied verbatim from delivery-form.tsx) ─────────────

const inputClass =
  'w-full bg-glomalin-elevated border border-glomalin-border text-glomalin-text font-mono text-sm rounded-md px-2.5 py-2 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted/50 transition-colors'
const labelClass =
  'block text-[10px] text-glomalin-text/60 font-mono mb-1.5 uppercase tracking-widest'
const fieldClass = 'mb-3'

// ── numOrNull helper (matches delivery-form.tsx) ────────────────────────────

function numOrNull(s: string): number | null {
  if (s === '' || s === null || s === undefined) return null
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

// ── D-02: units is entered, never computed — sanity check is a warning only ─

export function unitsSanityWarning(
  finishedLbs: number,
  lbsPerUnit: number,
  enteredUnits: number
): string | null {
  if (
    !isFinite(finishedLbs) ||
    !isFinite(lbsPerUnit) ||
    !isFinite(enteredUnits) ||
    lbsPerUnit <= 0
  ) {
    return null
  }
  const computed = finishedLbs / lbsPerUnit
  if (computed === 0) return null
  const pctDiff = Math.abs(computed - enteredUnits) / computed
  if (pctDiff <= 0.01) return null
  return `Entered units (${enteredUnits}) differ from computed (${computed.toFixed(
    1
  )}) by ${(pctDiff * 100).toFixed(1)}% — check for a typo. This will NOT block saving.`
}

// ── Form state ───────────────────────────────────────────────────────────────

interface SettlementFormState {
  lotNumber: string
  grossLbs: string
  finishedLbs: string
  germPct: string
  purityPct: string
  seedsPerLb: string
  lbsPerUnit: string
  units: string
  settlementDate: string
  notes: string
}

const EMPTY_SETTLEMENT_FORM: SettlementFormState = {
  lotNumber: '',
  grossLbs: '',
  finishedLbs: '',
  germPct: '',
  purityPct: '',
  seedsPerLb: '',
  lbsPerUnit: '',
  units: '',
  settlementDate: '',
  notes: '',
}

function settlementToForm(s: SettlementRow): SettlementFormState {
  return {
    lotNumber: s.lotNumber,
    grossLbs: s.grossLbs !== null ? String(s.grossLbs) : '',
    finishedLbs: String(s.finishedLbs),
    germPct: s.germPct !== null ? String(s.germPct) : '',
    purityPct: s.purityPct !== null ? String(s.purityPct) : '',
    seedsPerLb: s.seedsPerLb !== null ? String(s.seedsPerLb) : '',
    lbsPerUnit: String(s.lbsPerUnit),
    units: String(s.units),
    settlementDate: s.settlementDate ? s.settlementDate.split('T')[0] : '',
    notes: s.notes ?? '',
  }
}

// ── SettlementsClient ─────────────────────────────────────────────────────────

export function SettlementsClient({
  contractId,
  contract,
  settlements,
  reconciliation,
}: SettlementsClientProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SettlementFormState>(EMPTY_SETTLEMENT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openAddForm() {
    setEditingId(null)
    setForm(EMPTY_SETTLEMENT_FORM)
    setError(null)
    setFormOpen(true)
  }

  function openEditForm(row: SettlementRow) {
    setEditingId(row.id)
    setForm(settlementToForm(row))
    setError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_SETTLEMENT_FORM)
    setError(null)
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // D-02: recomputed on every keystroke of Finished Lbs / Lbs/Unit / Units —
  // advisory only, never gates the submit button.
  const warning = unitsSanityWarning(
    parseFloat(form.finishedLbs),
    parseFloat(form.lbsPerUnit),
    parseFloat(form.units)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ── Validation (matches server's D-05/POST required fields) ──────────
    const errors: string[] = []
    if (!form.lotNumber.trim()) errors.push('Lot number is required')
    const finishedLbsNum = parseFloat(form.finishedLbs)
    if (!form.finishedLbs || !isFinite(finishedLbsNum)) {
      errors.push('Finished lbs must be a valid number')
    }
    const lbsPerUnitNum = parseFloat(form.lbsPerUnit)
    if (!form.lbsPerUnit || !isFinite(lbsPerUnitNum)) {
      errors.push('Lbs/unit must be a valid number')
    }
    const unitsNum = parseFloat(form.units)
    if (!form.units || !isFinite(unitsNum)) {
      errors.push('Units must be a valid number')
    }

    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const body = {
        lotNumber: form.lotNumber.trim(),
        grossLbs: numOrNull(form.grossLbs),
        finishedLbs: Number(form.finishedLbs),
        germPct: numOrNull(form.germPct),
        purityPct: numOrNull(form.purityPct),
        seedsPerLb: numOrNull(form.seedsPerLb),
        lbsPerUnit: Number(form.lbsPerUnit),
        units: Number(form.units),
        settlementDate: form.settlementDate || null,
        notes: form.notes || null,
      }

      const url = editingId
        ? `/api/cert-proxy/marketing/contracts/${contractId}/settlements/${editingId}`
        : `/api/cert-proxy/marketing/contracts/${contractId}/settlements`

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? 'Save failed. Please try again.')
      } else {
        window.location.reload()
      }
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteLot(row: SettlementRow) {
    if (!window.confirm(`Delete lot ${row.lotNumber}? This cannot be undone.`)) return
    const res = await fetch(
      `/api/cert-proxy/marketing/contracts/${contractId}/settlements/${row.id}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      window.location.reload()
    } else {
      const json = await res.json().catch(() => ({}))
      window.alert(json?.error ?? 'Failed to delete lot.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      {/* Contract header panel */}
      <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4 mb-6">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent mb-3">
          Contract
        </h2>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          <div>
            <span className="text-glomalin-muted">Customer: </span>
            <span className="text-glomalin-text">{contract.customer.name}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Variant: </span>
            <span className="text-glomalin-text">{contract.variant.name}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Crop Year: </span>
            <span className="text-glomalin-text">{contract.cropYear}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Contracted Units: </span>
            <span className="text-glomalin-text">
              {contract.contractedUnits !== null ? (
                formatBu(contract.contractedUnits)
              ) : (
                <span className="text-glomalin-muted">—</span>
              )}
            </span>
          </div>
          {'pricePerUnit' in contract && contract.pricePerUnit != null && (
            <div>
              <span className="text-glomalin-muted">Price Per Unit: </span>
              <span className="text-glomalin-text">{formatUsdCents(contract.pricePerUnit)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lot Settlements section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent">
            Lot Settlements
          </h2>
          <button
            type="button"
            onClick={openAddForm}
            className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
          >
            + Add Lot
          </button>
        </div>

        {settlements.length === 0 ? (
          <Empty
            title="No lots settled yet."
            description="Add the first lot from the buyer's Production Summary sheet to begin reconciliation."
            action={{ label: '+ Add Lot', onClick: openAddForm }}
          />
        ) : (
          <div className="bg-glomalin-surface border border-glomalin-border rounded-lg">
            <Table>
              <TableHead>
                <TableRow hover={false}>
                  <TableHeader>Lot #</TableHeader>
                  <TableHeader className="text-right">Gross Lbs</TableHeader>
                  <TableHeader className="text-right">Finished Lbs</TableHeader>
                  <TableHeader className="text-right">Germ%</TableHeader>
                  <TableHeader className="text-right">Purity%</TableHeader>
                  <TableHeader className="text-right">Seeds/Lb</TableHeader>
                  <TableHeader className="text-right">Lbs/Unit</TableHeader>
                  <TableHeader className="text-right">Units</TableHeader>
                  <TableHeader className="text-right">Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm text-glomalin-text">
                      {s.lotNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.grossLbs !== null ? (
                        formatBu(s.grossLbs)
                      ) : (
                        <span className="text-glomalin-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatBu(s.finishedLbs)}</TableCell>
                    <TableCell className="text-right text-glomalin-muted">
                      {s.germPct !== null ? `${s.germPct.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-glomalin-muted">
                      {s.purityPct !== null ? `${s.purityPct.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-glomalin-muted">
                      {s.seedsPerLb !== null ? formatBu(s.seedsPerLb) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatBu(s.lbsPerUnit)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatBu(s.units)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => openEditForm(s)}
                        className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLot(s)}
                        className="ml-3 text-glomalin-danger font-mono text-xs hover:opacity-80 transition-opacity"
                      >
                        Delete
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Entry/edit form panel */}
      {formOpen && (
        <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4 mb-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent mb-3">
            {editingId ? `Edit Lot ${form.lotNumber}` : 'New Lot'}
          </h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="bg-red-900/20 border border-glomalin-danger text-glomalin-danger text-sm font-mono px-3 py-2 rounded mb-3"
              >
                {error}
              </div>
            )}

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="lotNumber">
                Lot Number
              </label>
              <input
                id="lotNumber"
                name="lotNumber"
                type="text"
                value={form.lotNumber}
                onChange={handleChange}
                placeholder="e.g. AV07A-B5Q-01B"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="grossLbs">
                Gross Lbs
              </label>
              <input
                id="grossLbs"
                name="grossLbs"
                type="number"
                step="0.01"
                value={form.grossLbs}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="finishedLbs">
                Finished Lbs
              </label>
              <input
                id="finishedLbs"
                name="finishedLbs"
                type="number"
                step="0.01"
                value={form.finishedLbs}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="germPct">
                Germ %
              </label>
              <input
                id="germPct"
                name="germPct"
                type="number"
                step="0.01"
                value={form.germPct}
                onChange={handleChange}
                placeholder="98.0"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="purityPct">
                Purity %
              </label>
              <input
                id="purityPct"
                name="purityPct"
                type="number"
                step="0.01"
                value={form.purityPct}
                onChange={handleChange}
                placeholder="99.99"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="seedsPerLb">
                Seeds/Lb
              </label>
              <input
                id="seedsPerLb"
                name="seedsPerLb"
                type="number"
                step="1"
                value={form.seedsPerLb}
                onChange={handleChange}
                placeholder="17532"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="lbsPerUnit">
                Lbs/Unit
              </label>
              <input
                id="lbsPerUnit"
                name="lbsPerUnit"
                type="number"
                step="0.01"
                value={form.lbsPerUnit}
                onChange={handleChange}
                placeholder="59"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="units">
                Units
              </label>
              <input
                id="units"
                name="units"
                type="number"
                step="0.01"
                value={form.units}
                onChange={handleChange}
                placeholder="12604"
                className={inputClass}
              />
            </div>

            {warning && (
              <div
                role="alert"
                className="bg-glomalin-warning/10 border border-glomalin-warning text-glomalin-warning text-sm font-mono px-3 py-2 rounded mb-3"
              >
                {warning}
              </div>
            )}

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="settlementDate">
                Settlement Date
              </label>
              <input
                id="settlementDate"
                name="settlementDate"
                type="date"
                value={form.settlementDate}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Optional notes"
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-glomalin-accent text-black font-mono font-semibold text-sm rounded-md px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : editingId ? 'Update Lot' : 'Save Lot'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="text-glomalin-muted font-mono text-xs hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reconciliation panel */}
      <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4 mb-6">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent mb-3">
          Reconciliation
        </h2>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          <div>
            <span className="text-glomalin-muted">Physical Delivered Lbs: </span>
            <span className="text-glomalin-text">
              {formatBu(reconciliation.physicalDeliveredLbs)}
            </span>
          </div>
          <div>
            <span className="text-glomalin-muted">Sum Gross Lbs: </span>
            <span className="text-glomalin-text">
              {reconciliation.sumGrossLbs !== null ? (
                formatBu(reconciliation.sumGrossLbs)
              ) : (
                <span className="text-glomalin-muted">—</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-glomalin-muted">Sum Finished Lbs: </span>
            <span className="text-glomalin-text">
              {formatBu(reconciliation.sumFinishedLbs)}
            </span>
          </div>
          <div>
            <span className="text-glomalin-muted">Shrink %: </span>
            <span className="text-glomalin-text">
              {reconciliation.shrinkPct !== null ? (
                formatPct(reconciliation.shrinkPct)
              ) : (
                <span className="text-glomalin-muted">—</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-glomalin-muted">Sum Units / Contracted Units: </span>
            <span className="text-glomalin-text">
              {formatBu(reconciliation.sumUnits)} /{' '}
              {reconciliation.contractedUnits !== null ? (
                formatBu(reconciliation.contractedUnits)
              ) : (
                <span className="text-glomalin-muted">—</span>
              )}
            </span>
          </div>
          {'settledRevenue' in reconciliation && reconciliation.settledRevenue != null && (
            <div>
              <span className="text-glomalin-muted">Settled Revenue: </span>
              <span className="text-glomalin-text">
                {formatUsd(reconciliation.settledRevenue)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Back link */}
      <a
        href="/app/marketing/contracts"
        className="block font-mono text-xs text-glomalin-accent hover:opacity-80 transition-opacity"
      >
        ← Back to Contracts
      </a>
    </div>
  )
}
