'use client'

import { useEffect, useState } from 'react'
import type { GrainContract, ContractType } from '@/lib/marketing/types'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface ContractFormData {
  crop: string
  contract_type: ContractType
  bushels: string
  price_per_bushel: string
  basis: string
  futures_reference: string
  buyer: string
  delivery_start: string
  delivery_end: string
  notes: string
}

interface ContractDrawerProps {
  open: boolean
  mode: 'create' | 'edit'
  contract: GrainContract | null
  onClose: () => void
  onSave: () => void
}

const EMPTY_FORM: ContractFormData = {
  crop: '',
  contract_type: 'cash',
  bushels: '',
  price_per_bushel: '',
  basis: '',
  futures_reference: '',
  buyer: '',
  delivery_start: '',
  delivery_end: '',
  notes: '',
}

function contractToForm(c: GrainContract): ContractFormData {
  return {
    crop: c.crop,
    contract_type: c.contract_type,
    bushels: c.bushels > 0 ? String(c.bushels) : '',
    price_per_bushel: c.price_per_bushel !== null ? String(c.price_per_bushel) : '',
    basis: c.basis !== null ? String(c.basis) : '',
    futures_reference: c.futures_reference !== null ? String(c.futures_reference) : '',
    buyer: c.buyer ?? '',
    delivery_start: c.delivery_start ?? '',
    delivery_end: c.delivery_end ?? '',
    notes: c.notes ?? '',
  }
}

/**
 * Which fields are shown/required per contract type:
 *   price: shown for cash, accumulator, options, min-price
 *   basis: shown for hta, basis
 *   futures: shown for hta, basis
 */
function showPrice(type: ContractType): boolean {
  return ['cash', 'accumulator', 'options', 'min-price'].includes(type)
}

function showBasis(type: ContractType): boolean {
  return ['hta', 'basis'].includes(type)
}

function showFutures(type: ContractType): boolean {
  return ['hta', 'basis'].includes(type)
}

function priceLabel(type: ContractType): string {
  if (type === 'options') return 'Strike Price ($/bu)'
  if (type === 'min-price') return 'Floor Price ($/bu)'
  return 'Price per Bushel ($/bu)'
}

const CONTRACT_TYPES: Array<{ value: ContractType; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'accumulator', label: 'Accumulator' },
  { value: 'hta', label: 'HTA (Hedge-to-Arrive)' },
  { value: 'options', label: 'Options' },
  { value: 'min-price', label: 'Min-Price' },
  { value: 'basis', label: 'Basis' },
]

export function ContractDrawer({
  open,
  mode,
  contract,
  onClose,
  onSave,
}: ContractDrawerProps) {
  const isEdit = mode === 'edit' && contract !== null
  const [form, setForm] = useState<ContractFormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cropSuggestions, setCropSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setForm(isEdit ? contractToForm(contract!) : EMPTY_FORM)
      setError(null)
    }
  }, [open, contract, isEdit])

  // Fetch crop autocomplete from farm-registry
  useEffect(() => {
    if (!form.crop || form.crop.length < 2) {
      setCropSuggestions([])
      return
    }
    const controller = new AbortController()
    fetch(
      `http://localhost:3005/api/crops/autocomplete?q=${encodeURIComponent(form.crop)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data: { name: string }[] | string[]) => {
        if (Array.isArray(data)) {
          // Handle both [{name:...}] and [string] shapes
          const suggestions = data.map((d) =>
            typeof d === 'string' ? d : (d as { name: string }).name
          )
          setCropSuggestions(suggestions.slice(0, 6))
        }
      })
      .catch(() => {
        // Registry offline — free-text input still works
      })
    return () => controller.abort()
  }, [form.crop])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'crop') setShowSuggestions(true)
  }

  function selectSuggestion(name: string) {
    setForm((prev) => ({ ...prev, crop: name }))
    setShowSuggestions(false)
    setCropSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const bushelNum = parseFloat(form.bushels)
    if (!form.crop.trim()) {
      setError('Crop name is required.')
      return
    }
    if (isNaN(bushelNum) || bushelNum <= 0) {
      setError('Bushels must be a positive number.')
      return
    }
    if (showPrice(form.contract_type) && !form.price_per_bushel) {
      setError(`Price per bushel is required for ${form.contract_type} contracts.`)
      return
    }
    if (showFutures(form.contract_type) && !form.futures_reference) {
      setError(`Futures reference price is required for ${form.contract_type} contracts.`)
      return
    }

    const body = {
      crop: form.crop.trim(),
      contract_type: form.contract_type,
      bushels: bushelNum,
      price_per_bushel: form.price_per_bushel ? parseFloat(form.price_per_bushel) : null,
      basis: form.basis ? parseFloat(form.basis) : null,
      futures_reference: form.futures_reference ? parseFloat(form.futures_reference) : null,
      buyer: form.buyer.trim() || null,
      delivery_start: form.delivery_start || null,
      delivery_end: form.delivery_end || null,
      notes: form.notes.trim() || null,
      crop_year: CURRENT_CROP_YEAR,
    }

    setSubmitting(true)
    try {
      let res: Response
      if (isEdit) {
        res = await fetch(`/api/marketing/contracts/${contract!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/marketing/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

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

  const inputClass =
    'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
  const labelClass = 'block text-xs text-glomalin-muted font-mono mb-1'
  const fieldClass = 'mb-3'

  const contractType = form.contract_type

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-[480px] bg-glomalin-surface border-l border-glomalin-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-glomalin-border">
          <h2 className="font-mono font-semibold text-glomalin-text text-base">
            {isEdit ? 'Edit Contract' : 'New Contract'}
          </h2>
          <button
            onClick={onClose}
            className="text-glomalin-muted hover:text-glomalin-text transition-colors font-mono text-xl leading-none"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          {/* Contract Basics */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
            Contract Details
          </p>

          {/* Crop with autocomplete */}
          <div className={`${fieldClass} relative`}>
            <label className={labelClass} htmlFor="crop">
              Crop <span className="text-red-400">*</span>
            </label>
            <input
              id="crop"
              name="crop"
              type="text"
              required
              value={form.crop}
              onChange={handleChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => cropSuggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              className={inputClass}
              placeholder="e.g. Yellow Corn, Soybeans"
            />
            {showSuggestions && cropSuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 bg-glomalin-surface border border-glomalin-border rounded shadow-lg">
                {cropSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-1.5 text-sm font-mono text-glomalin-text hover:bg-glomalin-bg transition-colors"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contract type */}
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="contract_type">
              Contract Type <span className="text-red-400">*</span>
            </label>
            <select
              id="contract_type"
              name="contract_type"
              value={form.contract_type}
              onChange={handleChange}
              className={inputClass}
            >
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bushels */}
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="bushels">
              Bushels <span className="text-red-400">*</span>
            </label>
            <input
              id="bushels"
              name="bushels"
              type="number"
              step="1"
              min="1"
              required
              value={form.bushels}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 5000"
            />
          </div>

          {/* Price per bushel — shown for cash, accumulator, options, min-price */}
          {showPrice(contractType) && (
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="price_per_bushel">
                {priceLabel(contractType)} <span className="text-red-400">*</span>
              </label>
              <input
                id="price_per_bushel"
                name="price_per_bushel"
                type="number"
                step="0.001"
                min="0"
                required
                value={form.price_per_bushel}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 4.85"
              />
            </div>
          )}

          {/* Basis — shown for hta, basis */}
          {showBasis(contractType) && (
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="basis">
                Basis (cents over/under futures)
                {contractType === 'basis' && <span className="text-red-400"> *</span>}
              </label>
              <input
                id="basis"
                name="basis"
                type="number"
                step="0.001"
                value={form.basis}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. -0.25 (25 under)"
              />
            </div>
          )}

          {/* Futures reference — shown for hta, basis */}
          {showFutures(contractType) && (
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="futures_reference">
                Futures Reference ($/bu) <span className="text-red-400">*</span>
              </label>
              <input
                id="futures_reference"
                name="futures_reference"
                type="number"
                step="0.001"
                min="0"
                required
                value={form.futures_reference}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 4.75 (Dec corn at time of contract)"
              />
            </div>
          )}

          {/* Buyer */}
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="buyer">
              Buyer <span className="text-glomalin-muted font-normal normal-case">(optional)</span>
            </label>
            <input
              id="buyer"
              name="buyer"
              type="text"
              value={form.buyer}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Heartland Co-op"
            />
          </div>

          {/* Delivery window */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
            Delivery Window
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass} htmlFor="delivery_start">
                Start Date
              </label>
              <input
                id="delivery_start"
                name="delivery_start"
                type="date"
                value={form.delivery_start}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="delivery_end">
                End Date
              </label>
              <input
                id="delivery_end"
                name="delivery_end"
                type="date"
                value={form.delivery_end}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Notes */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
            Notes
          </p>

          <div className={fieldClass}>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Optional notes about this contract..."
            />
          </div>

          {/* Error message */}
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
                ? isEdit
                  ? 'Saving...'
                  : 'Creating...'
                : isEdit
                ? 'Save Changes'
                : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
