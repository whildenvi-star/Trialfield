'use client'

import { useEffect, useRef, useState } from 'react'

// ─── DeliveryRow ───────────────────────────────────────────────────────────

export interface DeliveryRow {
  id: string
  farmId: string
  customerId: string
  variantId: string
  deliveryDate: string        // ISO string from API
  netWeightLbs: number
  netBushels: number
  moisturePercent: number | null
  testWeightLbs: number | null
  foreignMatterPct: number | null
  scaleTicketNum: string | null
  loadoutEventId: string | null
  settlementLineId: number | null   // Int in DB — comes back as number from API
  notes: string | null
  appliedBushels: number            // computed
  unappliedBushels: number          // computed
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
}

// ─── Form state ────────────────────────────────────────────────────────────

interface DeliveryFormState {
  variantId: string
  customerId: string
  deliveryDate: string        // 'YYYY-MM-DD'
  netWeightLbs: string
  netBushels: string
  moisturePercent: string
  testWeightLbs: string
  foreignMatterPct: string
  scaleTicketNum: string
  loadoutEventId: string      // optional backward-compat FK (DELIVERY-05)
  settlementLineId: string    // optional soft ref (stored as Int — DELIVERY-05)
  notes: string
}

const EMPTY_DELIVERY_FORM: DeliveryFormState = {
  variantId: '',
  customerId: '',
  deliveryDate: new Date().toISOString().split('T')[0],
  netWeightLbs: '',
  netBushels: '',
  moisturePercent: '',
  testWeightLbs: '',
  foreignMatterPct: '',
  scaleTicketNum: '',
  loadoutEventId: '',
  settlementLineId: '',
  notes: '',
}

function deliveryToForm(d: DeliveryRow): DeliveryFormState {
  return {
    variantId: d.variantId,
    customerId: d.customerId,
    deliveryDate: d.deliveryDate.split('T')[0],
    netWeightLbs: String(d.netWeightLbs),
    netBushels: String(d.netBushels),
    moisturePercent: d.moisturePercent !== null ? String(d.moisturePercent) : '',
    testWeightLbs: d.testWeightLbs !== null ? String(d.testWeightLbs) : '',
    foreignMatterPct: d.foreignMatterPct !== null ? String(d.foreignMatterPct) : '',
    scaleTicketNum: d.scaleTicketNum ?? '',
    loadoutEventId: d.loadoutEventId ?? '',
    settlementLineId: d.settlementLineId !== null ? String(d.settlementLineId) : '',
    notes: d.notes ?? '',
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface DeliveryFormProps {
  delivery: DeliveryRow | null
  customers: { id: string; name: string; shortCode: string }[]
  variants: { id: string; name: string }[]
  onSuccess: () => void
  open: boolean
  onDirtyChange?: (isDirty: boolean) => void
}

// ─── Styling constants ─────────────────────────────────────────────────────

const inputClass =
  'w-full bg-glomalin-elevated border border-glomalin-border text-glomalin-text font-mono text-sm rounded-md px-2.5 py-2 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted/50 transition-colors'
const labelClass =
  'block text-[10px] text-glomalin-text/60 font-mono mb-1.5 uppercase tracking-widest'
const fieldClass = 'mb-3'

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-glomalin-accent shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-glomalin-border" />
    </div>
  )
}

// ─── numOrNull helper ──────────────────────────────────────────────────────
// Converts a string to a number, returning null for empty/non-finite input.

function numOrNull(s: string): number | null {
  if (s === '' || s === null || s === undefined) return null
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

// ─── DeliveryForm component ────────────────────────────────────────────────

export function DeliveryForm({
  delivery,
  customers,
  variants,
  onSuccess,
  open,
  onDirtyChange,
}: DeliveryFormProps) {
  const isEdit = delivery !== null

  const [form, setForm] = useState<DeliveryFormState>(
    delivery ? deliveryToForm(delivery) : EMPTY_DELIVERY_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initialFormRef = useRef<DeliveryFormState>(
    delivery ? deliveryToForm(delivery) : EMPTY_DELIVERY_FORM
  )

  // Reset form when drawer opens or delivery changes
  useEffect(() => {
    if (open) {
      const initial = delivery ? deliveryToForm(delivery) : EMPTY_DELIVERY_FORM
      setForm(initial)
      initialFormRef.current = initial
      setError(null)
      onDirtyChange?.(false)
    }
  }, [open, delivery]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      const dirty = JSON.stringify(next) !== JSON.stringify(initialFormRef.current)
      onDirtyChange?.(dirty)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ── Validation ────────────────────────────────────────────────────────
    const errors: string[] = []
    if (!form.variantId) errors.push('Grain variant is required')
    if (!form.customerId) errors.push('Buyer is required')
    if (!form.deliveryDate) errors.push('Delivery date is required')
    const weightNum = parseFloat(form.netWeightLbs)
    if (!form.netWeightLbs || !isFinite(weightNum)) {
      errors.push('Net weight (lbs) must be a valid number')
    }
    const bushelsNum = parseFloat(form.netBushels)
    if (!form.netBushels || !isFinite(bushelsNum)) {
      errors.push('Net bushels must be a valid number')
    }

    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const body = {
        variantId: form.variantId,
        customerId: form.customerId,
        deliveryDate: form.deliveryDate,
        netWeightLbs: Number(form.netWeightLbs),
        netBushels: Number(form.netBushels),
        moisturePercent: numOrNull(form.moisturePercent),
        testWeightLbs: numOrNull(form.testWeightLbs),
        foreignMatterPct: numOrNull(form.foreignMatterPct),
        scaleTicketNum: form.scaleTicketNum || null,
        loadoutEventId: form.loadoutEventId || null,
        settlementLineId:
          form.settlementLineId !== '' ? parseInt(form.settlementLineId, 10) : null,
        notes: form.notes || null,
      }

      const url = isEdit
        ? `/api/cert-proxy/marketing/deliveries/${delivery!.id}`
        : '/api/cert-proxy/marketing/deliveries'

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json?.error ?? 'Save failed.')
      } else {
        onSuccess()
      }
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="bg-red-900/20 border border-glomalin-danger text-glomalin-danger text-sm font-mono px-3 py-2 rounded mb-3"
          >
            {error}
          </div>
        )}

        {/* ── Section 1: Delivery Details ───────────────────────────────── */}
        <SectionDivider label="Delivery Details" />

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="variantId">
            Grain Variant
          </label>
          <select
            id="variantId"
            name="variantId"
            value={form.variantId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— Select variant —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="customerId">
            Buyer
          </label>
          <select
            id="customerId"
            name="customerId"
            value={form.customerId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— Select buyer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="deliveryDate">
            Delivery Date
          </label>
          <input
            id="deliveryDate"
            name="deliveryDate"
            type="date"
            value={form.deliveryDate}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* ── Section 2: Weight & Bushels ───────────────────────────────── */}
        <SectionDivider label="Weight & Bushels" />

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="netWeightLbs">
            Net Weight (lbs)
          </label>
          <input
            id="netWeightLbs"
            name="netWeightLbs"
            type="number"
            step="0.01"
            value={form.netWeightLbs}
            onChange={handleChange}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="netBushels">
            Net Bushels
          </label>
          <input
            id="netBushels"
            name="netBushels"
            type="number"
            step="0.01"
            value={form.netBushels}
            onChange={handleChange}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="scaleTicketNum">
            Scale Ticket #
          </label>
          <input
            id="scaleTicketNum"
            name="scaleTicketNum"
            type="text"
            value={form.scaleTicketNum}
            onChange={handleChange}
            placeholder="e.g. T-00123"
            className={inputClass}
          />
        </div>

        {/* ── Section 3: Grade Factors (optional) ──────────────────────── */}
        <SectionDivider label="Grade Factors (Optional)" />

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="moisturePercent">
            Moisture %
          </label>
          <input
            id="moisturePercent"
            name="moisturePercent"
            type="number"
            step="0.01"
            value={form.moisturePercent}
            onChange={handleChange}
            placeholder="14.2"
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="testWeightLbs">
            Test Weight (lbs/bu)
          </label>
          <input
            id="testWeightLbs"
            name="testWeightLbs"
            type="number"
            step="0.1"
            value={form.testWeightLbs}
            onChange={handleChange}
            placeholder="56.0"
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="foreignMatterPct">
            Foreign Matter %
          </label>
          <input
            id="foreignMatterPct"
            name="foreignMatterPct"
            type="number"
            step="0.01"
            value={form.foreignMatterPct}
            onChange={handleChange}
            placeholder="0.5"
            className={inputClass}
          />
        </div>

        {/* ── Section 4: Backward Compat FKs ───────────────────────────── */}
        <SectionDivider label="Backward Compat" />

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="loadoutEventId">
            Loadout Event ID
          </label>
          <input
            id="loadoutEventId"
            name="loadoutEventId"
            type="text"
            value={form.loadoutEventId}
            onChange={handleChange}
            placeholder="Optional event ID"
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="settlementLineId">
            Settlement Line ID
          </label>
          <input
            id="settlementLineId"
            name="settlementLineId"
            type="number"
            value={form.settlementLineId}
            onChange={handleChange}
            placeholder="Optional integer"
            className={inputClass}
          />
        </div>

        {/* ── Section 5: Notes ──────────────────────────────────────────── */}
        <SectionDivider label="Notes" />

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

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-glomalin-accent text-black font-mono font-semibold text-sm rounded-md px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Delivery'}
        </button>
      </form>
    </div>
  )
}
