'use client'

import { useEffect, useState } from 'react'

// GrainVariant type — commodity and cropYear are optional for backward compat
type GrainVariant = {
  id: string
  name: string
  cropYear?: number
  commodity?: { name: string; symbol: string }
}

interface BasisQuoteFormState {
  variantId: string
  basisValue: string
  futuresMonth: string
  quoteDate: string
  location: string
  source: string
  confidenceTier: string
  notes: string
}

function makeEmptyForm(): BasisQuoteFormState {
  return {
    variantId: '',
    basisValue: '',
    futuresMonth: '',
    quoteDate: new Date().toISOString().split('T')[0],
    location: '',
    source: '',
    confidenceTier: 'MANUAL',
    notes: '',
  }
}

interface BasisQuoteFormProps {
  variants: GrainVariant[]
  onSuccess: () => void
  open?: boolean
  onClose?: () => void
}

const inputClass =
  'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
const labelClass = 'block text-xs text-glomalin-muted font-mono mb-1 uppercase tracking-wide'
const fieldClass = 'mb-3'

export function BasisQuoteForm({ variants, onSuccess, open, onClose }: BasisQuoteFormProps) {
  const [form, setForm] = useState<BasisQuoteFormState>(makeEmptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open === undefined || open) {
      setForm(makeEmptyForm())
      setError(null)
    }
  }, [open])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const basisTrimmed = form.basisValue.trim()
    const basisNum = parseFloat(basisTrimmed)

    const missing: string[] = []
    if (!form.variantId) missing.push('variant')
    if (!basisTrimmed || !isFinite(basisNum)) missing.push('basis')
    if (!form.futuresMonth) missing.push('futuresMonth')
    if (!form.quoteDate) missing.push('quoteDate')
    if (!form.location) missing.push('location')
    if (!form.source) missing.push('source')

    if (missing.length > 0) {
      const parts: string[] = []
      if (missing.includes('variant')) parts.push('Grain variant is required')
      if (missing.includes('basis')) parts.push('Basis value must be a valid number')
      if (missing.includes('futuresMonth')) parts.push('Futures month is required')
      if (missing.includes('quoteDate')) parts.push('Quote date is required')
      if (missing.includes('location')) parts.push('Location is required')
      if (missing.includes('source')) parts.push('Source is required')
      setError(parts.join('. ') + '.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/cert-proxy/marketing/basis-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: form.variantId,
          basisValue: basisNum,
          futuresMonth: form.futuresMonth,
          quoteDate: form.quoteDate,
          location: form.location,
          source: form.source,
          confidenceTier: form.confidenceTier || 'MANUAL',
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json?.error ?? 'Save failed')
      } else {
        onSuccess()
      }
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function variantLabel(v: GrainVariant): string {
    if (v.commodity && v.cropYear) {
      return `${v.commodity.name} — ${v.name} (${v.cropYear})`
    }
    return v.name
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

        {/* Quote Details */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
          Quote Details
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-variantId">
            Grain Variant <span className="text-red-400">*</span>
          </label>
          <select
            id="bqf-variantId"
            name="variantId"
            value={form.variantId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v)}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-basisValue">
            Basis $/bu <span className="text-red-400">*</span>
          </label>
          <input
            id="bqf-basisValue"
            name="basisValue"
            type="number"
            step="0.0001"
            aria-label="Basis $/bu"
            value={form.basisValue}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. -0.35"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-futuresMonth">
            Futures Month <span className="text-red-400">*</span>
          </label>
          <input
            id="bqf-futuresMonth"
            name="futuresMonth"
            type="text"
            value={form.futuresMonth}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. DEC25"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-quoteDate">
            Quote Date <span className="text-red-400">*</span>
          </label>
          <input
            id="bqf-quoteDate"
            name="quoteDate"
            type="date"
            value={form.quoteDate}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-location">
            Location <span className="text-red-400">*</span>
          </label>
          <input
            id="bqf-location"
            name="location"
            type="text"
            value={form.location}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Heartland Elevator, Pekin"
          />
        </div>

        {/* Source & Confidence */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Source &amp; Confidence
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-source">
            Source <span className="text-red-400">*</span>
          </label>
          <select
            id="bqf-source"
            name="source"
            value={form.source}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            <option value="ELEVATOR_QUOTE">Elevator Quote</option>
            <option value="MANUAL">Manual</option>
            <option value="BROKERED">Brokered</option>
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-confidenceTier">
            Confidence Tier
          </label>
          <select
            id="bqf-confidenceTier"
            name="confidenceTier"
            value={form.confidenceTier}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="CONFIDENT">Confident</option>
            <option value="INFERRED">Inferred</option>
            <option value="MANUAL">Manual</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>
        </div>

        {/* Notes */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Notes
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="bqf-notes">Notes</label>
          <textarea
            id="bqf-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Any notes about this quote..."
          />
        </div>

        {/* Submit */}
        <div className="pt-2 pb-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Quote'}
          </button>
        </div>
      </form>
    </div>
  )
}
