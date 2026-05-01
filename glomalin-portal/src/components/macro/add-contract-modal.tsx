'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AddContractModalProps {
  crops: string[]
  cropYear: number
  onClose: () => void
}

const CONTRACT_TYPES = ['Cash', 'HTA', 'Basis', 'Futures', 'DP']

export function AddContractModal({ crops, cropYear, onClose }: AddContractModalProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    crop: crops[0] ?? '',
    buyer: '',
    bushels: '',
    price_per_bushel: '',
    contract_type: 'Cash',
    delivery_start: '',
    delivery_end: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const bushels = parseFloat(form.bushels)
    if (!form.crop || isNaN(bushels) || bushels <= 0) {
      setError('Crop and bushels are required.')
      return
    }

    setSaving(true)
    try {
      const body = {
        crop: form.crop,
        buyer: form.buyer || null,
        bushels,
        price_per_bushel: form.price_per_bushel ? parseFloat(form.price_per_bushel) : null,
        contract_type: form.contract_type,
        delivery_start: form.delivery_start || null,
        delivery_end: form.delivery_end || null,
        crop_year: cropYear,
      }

      const res = await fetch('/api/macro/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Save failed')
      }

      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-md bg-glomalin-surface border border-glomalin-border rounded-t-2xl sm:rounded-2xl p-5 font-mono">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-glomalin-text">New Contract</h2>
          <button
            onClick={onClose}
            className="text-glomalin-muted hover:text-glomalin-text transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Crop */}
          <div>
            <label className="block text-xs text-glomalin-muted mb-1">Crop</label>
            <select
              value={form.crop}
              onChange={(e) => set('crop', e.target.value)}
              className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent"
            >
              {crops.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Buyer + Contract type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Buyer</label>
              <input
                type="text"
                value={form.buyer}
                onChange={(e) => set('buyer', e.target.value)}
                placeholder="e.g. Heartland Coop"
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted/50"
              />
            </div>
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Type</label>
              <select
                value={form.contract_type}
                onChange={(e) => set('contract_type', e.target.value)}
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bushels + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Bushels <span className="text-glomalin-accent">*</span></label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.bushels}
                onChange={(e) => set('bushels', e.target.value)}
                placeholder="0"
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted/50"
              />
            </div>
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Price/bu</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price_per_bushel}
                onChange={(e) => set('price_per_bushel', e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted/50"
              />
            </div>
          </div>

          {/* Delivery window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Delivery Start</label>
              <input
                type="date"
                value={form.delivery_start}
                onChange={(e) => set('delivery_start', e.target.value)}
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-glomalin-muted mb-1">Delivery End</label>
              <input
                type="date"
                value={form.delivery_end}
                onChange={(e) => set('delivery_end', e.target.value)}
                className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text px-3 py-2 text-sm focus:outline-none focus:border-glomalin-accent"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-glomalin-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-glomalin-accent py-2.5 font-mono text-sm font-semibold text-glomalin-bg hover:bg-glomalin-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
          >
            {saving ? 'Saving…' : 'Save Contract'}
          </button>
        </form>
      </div>
    </div>
  )
}
