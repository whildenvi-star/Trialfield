'use client'

import { useEffect, useState } from 'react'
import type { Commodity, CropVariant, SaleInstrument, InstrumentType } from '@/lib/marketing/types'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface InstrumentFormProps {
  open: boolean
  instrument: SaleInstrument | null
  commodities: Commodity[]
  variants: CropVariant[]
  cropYear?: number
  onClose: () => void
  onSave: () => void
  onVariantCreated: () => void
}

interface FormState {
  commodity_id: string
  variant_id: string
  new_variant_name: string
  instrument_type: InstrumentType
  buyer: string
  counterparty: string
  notes: string
  // Cash + Forward
  bushels: string
  price_per_bushel: string
  basis: string
  futures_reference: string
  delivery_start: string
  delivery_end: string
  delivered_bu: string
  contract_number: string
  // Option
  option_type: 'call' | 'put'
  option_side: 'long' | 'short'
  strike_price: string
  premium_paid: string
  expiry_date: string
  // Accumulator
  ko_level: string
  ki_level: string
  accumulator_cadence: 'daily' | 'weekly'
  daily_bu: string
  weekly_bu: string
  accumulation_start: string
  accumulation_end: string
  leverage_ratio: string
}

const EMPTY: FormState = {
  commodity_id: '',
  variant_id: '',
  new_variant_name: '',
  instrument_type: 'cash',
  buyer: '',
  counterparty: '',
  notes: '',
  bushels: '',
  price_per_bushel: '',
  basis: '',
  futures_reference: '',
  delivery_start: '',
  delivery_end: '',
  delivered_bu: '0',
  contract_number: '',
  option_type: 'put',
  option_side: 'long',
  strike_price: '',
  premium_paid: '',
  expiry_date: '',
  ko_level: '',
  ki_level: '',
  accumulator_cadence: 'daily',
  daily_bu: '',
  weekly_bu: '',
  accumulation_start: '',
  accumulation_end: '',
  leverage_ratio: '1.0',
}

function instrumentToForm(inst: SaleInstrument): FormState {
  return {
    ...EMPTY,
    commodity_id: inst.commodity_id,
    variant_id: inst.variant_id ?? '',
    instrument_type: inst.instrument_type,
    buyer: inst.buyer ?? '',
    counterparty: inst.counterparty ?? '',
    notes: inst.notes ?? '',
    bushels: inst.bushels != null ? String(inst.bushels) : '',
    price_per_bushel: inst.price_per_bushel != null ? String(inst.price_per_bushel) : '',
    basis: inst.basis != null ? String(inst.basis) : '',
    futures_reference: inst.futures_reference != null ? String(inst.futures_reference) : '',
    delivery_start: inst.delivery_start ?? '',
    delivery_end: inst.delivery_end ?? '',
    delivered_bu: String(inst.delivered_bu ?? 0),
    contract_number: inst.contract_number ?? '',
    option_type: inst.option_type ?? 'put',
    option_side: inst.option_side ?? 'long',
    strike_price: inst.strike_price != null ? String(inst.strike_price) : '',
    premium_paid: inst.premium_paid != null ? String(inst.premium_paid) : '',
    expiry_date: inst.expiry_date ?? '',
    ko_level: inst.ko_level != null ? String(inst.ko_level) : '',
    ki_level: inst.ki_level != null ? String(inst.ki_level) : '',
    accumulator_cadence: inst.daily_bu != null ? 'daily' : 'weekly',
    daily_bu: inst.daily_bu != null ? String(inst.daily_bu) : '',
    weekly_bu: inst.weekly_bu != null ? String(inst.weekly_bu) : '',
    accumulation_start: inst.accumulation_start ?? '',
    accumulation_end: inst.accumulation_end ?? '',
    leverage_ratio: String(inst.leverage_ratio ?? 1.0),
  }
}

const INSTRUMENT_TYPES: Array<{ value: InstrumentType; label: string; desc: string }> = [
  { value: 'cash',             label: 'Cash Sale',          desc: 'Spot or deferred cash delivery' },
  { value: 'forward_contract', label: 'Forward Contract',   desc: 'Fixed-price forward with delivery window' },
  { value: 'option',           label: 'Option',             desc: 'Call or put, long or short' },
  { value: 'accumulator',      label: 'Accumulator',        desc: 'Daily/weekly accumulation with KO/KI levels' },
]

export function InstrumentForm({
  open,
  instrument,
  commodities,
  variants,
  cropYear = CURRENT_CROP_YEAR,
  onClose,
  onSave,
  onVariantCreated,
}: InstrumentFormProps) {
  const isEdit = instrument != null
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [creatingVariant, setCreatingVariant] = useState(false)
  const [showNewVariant, setShowNewVariant] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(isEdit ? instrumentToForm(instrument!) : EMPTY)
      setError(null)
      setShowNewVariant(false)
    }
  }, [open, instrument, isEdit])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const filteredVariants = variants.filter((v) => v.commodity_id === form.commodity_id)

  async function handleCreateVariant() {
    if (!form.new_variant_name.trim() || !form.commodity_id) return
    setCreatingVariant(true)
    try {
      const res = await fetch('/api/marketing/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commodity_id: form.commodity_id,
          name: form.new_variant_name.trim(),
          crop_year: cropYear,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? 'Failed to create variant')
        return
      }
      const data = await res.json()
      await onVariantCreated()
      setForm((prev) => ({
        ...prev,
        variant_id: data.variant?.id ?? prev.variant_id,
        new_variant_name: '',
      }))
      setShowNewVariant(false)
    } catch {
      setError('Network error creating variant')
    } finally {
      setCreatingVariant(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.commodity_id) {
      setError('Select a commodity.')
      return
    }

    const body: Record<string, unknown> = {
      commodity_id:    form.commodity_id,
      variant_id:      form.variant_id || null,
      instrument_type: form.instrument_type,
      crop_year:       cropYear,
      buyer:           form.buyer.trim() || null,
      counterparty:    form.counterparty.trim() || null,
      notes:           form.notes.trim() || null,
    }

    switch (form.instrument_type) {
      case 'cash':
      case 'forward_contract': {
        const bu = parseFloat(form.bushels)
        if (isNaN(bu) || bu <= 0) { setError('Bushels must be a positive number.'); return }
        body.bushels           = bu
        body.price_per_bushel  = form.price_per_bushel ? parseFloat(form.price_per_bushel) : null
        body.basis             = form.basis ? parseFloat(form.basis) : null
        body.futures_reference = form.futures_reference ? parseFloat(form.futures_reference) : null
        body.delivery_start    = form.delivery_start || null
        body.delivery_end      = form.delivery_end || null
        body.delivered_bu      = parseFloat(form.delivered_bu) || 0
        if (form.instrument_type === 'forward_contract') {
          body.contract_number = form.contract_number.trim() || null
        }
        break
      }
      case 'option': {
        const bu = parseFloat(form.bushels)
        if (isNaN(bu) || bu <= 0) { setError('Contract size (bushels) is required.'); return }
        if (!form.strike_price) { setError('Strike price is required for options.'); return }
        body.bushels     = bu
        body.option_type = form.option_type
        body.option_side = form.option_side
        body.strike_price = parseFloat(form.strike_price)
        body.premium_paid = form.premium_paid ? parseFloat(form.premium_paid) : null
        body.expiry_date  = form.expiry_date || null
        break
      }
      case 'accumulator': {
        if (form.accumulator_cadence === 'daily' && !form.daily_bu) {
          setError('Daily bushels required for daily accumulator.')
          return
        }
        if (form.accumulator_cadence === 'weekly' && !form.weekly_bu) {
          setError('Weekly bushels required for weekly accumulator.')
          return
        }
        if (!form.ko_level) { setError('KO level is required for accumulators.'); return }
        body.ko_level           = parseFloat(form.ko_level)
        body.ki_level           = form.ki_level ? parseFloat(form.ki_level) : null
        body.daily_bu           = form.accumulator_cadence === 'daily' ? parseFloat(form.daily_bu) : null
        body.weekly_bu          = form.accumulator_cadence === 'weekly' ? parseFloat(form.weekly_bu) : null
        body.accumulation_start = form.accumulation_start || null
        body.accumulation_end   = form.accumulation_end || null
        body.leverage_ratio     = parseFloat(form.leverage_ratio) || 1.0
        body.delivered_bu       = parseFloat(form.delivered_bu) || 0
        break
      }
    }

    setSubmitting(true)
    try {
      const url = isEdit
        ? `/api/marketing/instruments/${instrument!.id}`
        : '/api/marketing/instruments'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? `Request failed (HTTP ${res.status})`)
        return
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const ic = 'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
  const lc = 'block text-xs text-glomalin-muted font-mono mb-1'
  const fc = 'mb-3'
  const secLabel = 'text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3'

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-[520px] bg-glomalin-surface border-l border-glomalin-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-glomalin-border">
          <h2 className="font-mono font-semibold text-glomalin-text text-base">
            {isEdit ? 'Edit Instrument' : 'New Sale Instrument'}
          </h2>
          <button
            onClick={onClose}
            className="text-glomalin-muted hover:text-glomalin-text transition-colors font-mono text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Commodity + Variant ───────────────────────────────── */}
          <p className={secLabel}>Commodity & Variant</p>

          <div className={fc}>
            <label className={lc}>Commodity <span className="text-red-400">*</span></label>
            <select
              value={form.commodity_id}
              onChange={(e) => {
                set('commodity_id', e.target.value)
                set('variant_id', '')
              }}
              className={ic}
              required
            >
              <option value="">Select commodity…</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.cbot_symbol ? ` (${c.cbot_symbol})` : ''}
                </option>
              ))}
            </select>
          </div>

          {form.commodity_id && (
            <div className={fc}>
              <label className={lc}>Variant</label>
              {!showNewVariant ? (
                <div className="flex gap-2">
                  <select
                    value={form.variant_id}
                    onChange={(e) => set('variant_id', e.target.value)}
                    className={`${ic} flex-1`}
                  >
                    <option value="">None (unassigned)</option>
                    {filteredVariants.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewVariant(true)}
                    className="shrink-0 font-mono text-xs text-glomalin-accent hover:opacity-80 border border-glomalin-accent/40 rounded px-2 py-1.5"
                  >
                    + New
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.new_variant_name}
                    onChange={(e) => set('new_variant_name', e.target.value)}
                    placeholder="Variant name, e.g. RR Soybeans"
                    className={`${ic} flex-1`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateVariant}
                    disabled={creatingVariant || !form.new_variant_name.trim()}
                    className="shrink-0 font-mono text-xs bg-glomalin-accent text-glomalin-bg rounded px-2 py-1.5 disabled:opacity-50"
                  >
                    {creatingVariant ? '…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewVariant(false)}
                    className="shrink-0 font-mono text-xs text-glomalin-muted hover:text-glomalin-text"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Instrument type ───────────────────────────────────── */}
          <p className={`${secLabel} mt-4`}>Instrument Type</p>

          <div className={`${fc} grid grid-cols-2 gap-2`}>
            {INSTRUMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('instrument_type', t.value)}
                className={[
                  'text-left rounded border p-2.5 transition-colors',
                  form.instrument_type === t.value
                    ? 'border-glomalin-accent bg-glomalin-accent/10'
                    : 'border-glomalin-border hover:border-glomalin-border/80 bg-glomalin-bg',
                ].join(' ')}
              >
                <p className={`font-mono text-xs font-semibold ${form.instrument_type === t.value ? 'text-glomalin-accent' : 'text-glomalin-text'}`}>
                  {t.label}
                </p>
                <p className="font-mono text-[10px] text-glomalin-muted mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* ── Common: buyer / counterparty ─────────────────────── */}
          <p className={`${secLabel} mt-4`}>
            {form.instrument_type === 'option' ? 'Broker / Details' : 'Counterparty'}
          </p>

          <div className={fc}>
            <label className={lc}>
              {form.instrument_type === 'option' ? 'Broker' : 'Buyer'}
            </label>
            <input
              type="text"
              value={form.buyer}
              onChange={(e) => set('buyer', e.target.value)}
              placeholder={form.instrument_type === 'option' ? 'e.g. RJ O\'Brien' : 'e.g. Heartland Co-op'}
              className={ic}
            />
          </div>

          {form.instrument_type === 'forward_contract' && (
            <>
              <div className={fc}>
                <label className={lc}>Counterparty</label>
                <input
                  type="text"
                  value={form.counterparty}
                  onChange={(e) => set('counterparty', e.target.value)}
                  placeholder="e.g. Bunge"
                  className={ic}
                />
              </div>
              <div className={fc}>
                <label className={lc}>Contract Number</label>
                <input
                  type="text"
                  value={form.contract_number}
                  onChange={(e) => set('contract_number', e.target.value)}
                  placeholder="e.g. BG-2293"
                  className={ic}
                />
              </div>
            </>
          )}

          {/* ── Type-specific fields ───────────────────────────────── */}

          {(form.instrument_type === 'cash' || form.instrument_type === 'forward_contract') && (
            <>
              <p className={`${secLabel} mt-4`}>Price & Delivery</p>
              <div className={fc}>
                <label className={lc}>Bushels <span className="text-red-400">*</span></label>
                <input type="number" step="1" min="1" value={form.bushels}
                  onChange={(e) => set('bushels', e.target.value)} className={ic} placeholder="e.g. 15000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>Price / bu</label>
                  <input type="number" step="0.001" min="0" value={form.price_per_bushel}
                    onChange={(e) => set('price_per_bushel', e.target.value)} className={ic} placeholder="e.g. 11.45" />
                </div>
                <div className={fc}>
                  <label className={lc}>Basis</label>
                  <input type="number" step="0.001" value={form.basis}
                    onChange={(e) => set('basis', e.target.value)} className={ic} placeholder="e.g. -0.15" />
                </div>
              </div>
              <div className={fc}>
                <label className={lc}>Futures Reference</label>
                <input type="number" step="0.001" value={form.futures_reference}
                  onChange={(e) => set('futures_reference', e.target.value)} className={ic} placeholder="e.g. 11.60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>Delivery Start</label>
                  <input type="date" value={form.delivery_start}
                    onChange={(e) => set('delivery_start', e.target.value)} className={ic} />
                </div>
                <div className={fc}>
                  <label className={lc}>Delivery End</label>
                  <input type="date" value={form.delivery_end}
                    onChange={(e) => set('delivery_end', e.target.value)} className={ic} />
                </div>
              </div>
              {isEdit && (
                <div className={fc}>
                  <label className={lc}>Delivered so far (bu)</label>
                  <input type="number" step="1" min="0" value={form.delivered_bu}
                    onChange={(e) => set('delivered_bu', e.target.value)} className={ic} />
                </div>
              )}
            </>
          )}

          {form.instrument_type === 'option' && (
            <>
              <p className={`${secLabel} mt-4`}>Option Details</p>

              {/* Type + side toggles */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={lc}>Option Type</label>
                  <div className="flex rounded border border-glomalin-border overflow-hidden">
                    {(['call', 'put'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('option_type', v)}
                        className={`flex-1 py-1.5 font-mono text-xs transition-colors capitalize ${
                          form.option_type === v
                            ? 'bg-glomalin-accent text-glomalin-bg font-semibold'
                            : 'bg-glomalin-bg text-glomalin-muted hover:text-glomalin-text'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={lc}>Side</label>
                  <div className="flex rounded border border-glomalin-border overflow-hidden">
                    {(['long', 'short'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('option_side', v)}
                        className={`flex-1 py-1.5 font-mono text-xs transition-colors capitalize ${
                          form.option_side === v
                            ? 'bg-glomalin-accent text-glomalin-bg font-semibold'
                            : 'bg-glomalin-bg text-glomalin-muted hover:text-glomalin-text'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={fc}>
                <label className={lc}>Contract Size (bu) <span className="text-red-400">*</span></label>
                <input type="number" step="1" min="1" value={form.bushels}
                  onChange={(e) => set('bushels', e.target.value)} className={ic} placeholder="e.g. 15000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>Strike ($/bu) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.strike_price}
                    onChange={(e) => set('strike_price', e.target.value)} className={ic} placeholder="e.g. 11.00" />
                </div>
                <div className={fc}>
                  <label className={lc}>Premium Paid ($/bu)</label>
                  <input type="number" step="0.001" min="0" value={form.premium_paid}
                    onChange={(e) => set('premium_paid', e.target.value)} className={ic} placeholder="e.g. 0.18" />
                </div>
              </div>
              <div className={fc}>
                <label className={lc}>Expiry Date</label>
                <input type="date" value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)} className={ic} />
              </div>
            </>
          )}

          {form.instrument_type === 'accumulator' && (
            <>
              <p className={`${secLabel} mt-4`}>Accumulator Details</p>

              {/* Daily / weekly cadence toggle */}
              <div className={fc}>
                <label className={lc}>Accumulation Cadence</label>
                <div className="flex rounded border border-glomalin-border overflow-hidden mb-2">
                  {(['daily', 'weekly'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('accumulator_cadence', v)}
                      className={`flex-1 py-1.5 font-mono text-xs transition-colors capitalize ${
                        form.accumulator_cadence === v
                          ? 'bg-glomalin-accent text-glomalin-bg font-semibold'
                          : 'bg-glomalin-bg text-glomalin-muted hover:text-glomalin-text'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.accumulator_cadence === 'daily' ? form.daily_bu : form.weekly_bu}
                  onChange={(e) =>
                    form.accumulator_cadence === 'daily'
                      ? set('daily_bu', e.target.value)
                      : set('weekly_bu', e.target.value)
                  }
                  className={ic}
                  placeholder={form.accumulator_cadence === 'daily' ? 'bu / day' : 'bu / week'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>KO Level ($/bu) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.ko_level}
                    onChange={(e) => set('ko_level', e.target.value)} className={ic} placeholder="e.g. 12.50" />
                </div>
                <div className={fc}>
                  <label className={lc}>KI Level ($/bu)</label>
                  <input type="number" step="0.001" min="0" value={form.ki_level}
                    onChange={(e) => set('ki_level', e.target.value)} className={ic} placeholder="optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>Window Start</label>
                  <input type="date" value={form.accumulation_start}
                    onChange={(e) => set('accumulation_start', e.target.value)} className={ic} />
                </div>
                <div className={fc}>
                  <label className={lc}>Window End</label>
                  <input type="date" value={form.accumulation_end}
                    onChange={(e) => set('accumulation_end', e.target.value)} className={ic} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={fc}>
                  <label className={lc}>Leverage Ratio</label>
                  <input type="number" step="0.1" min="1" value={form.leverage_ratio}
                    onChange={(e) => set('leverage_ratio', e.target.value)} className={ic} placeholder="1.0" />
                </div>
                <div className={fc}>
                  <label className={lc}>Accumulated so far (bu)</label>
                  <input type="number" step="1" min="0" value={form.delivered_bu}
                    onChange={(e) => set('delivered_bu', e.target.value)} className={ic} />
                </div>
              </div>
            </>
          )}

          {/* ── Notes ──────────────────────────────────────────────── */}
          <p className={`${secLabel} mt-4`}>Notes</p>
          <div className={fc}>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={`${ic} resize-none`}
              rows={2}
              placeholder="Optional notes…"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm font-mono text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 pb-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-glomalin-accent text-glomalin-bg font-mono font-bold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? isEdit ? 'Saving…' : 'Creating…'
                : isEdit ? 'Save Changes' : 'Create Instrument'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
