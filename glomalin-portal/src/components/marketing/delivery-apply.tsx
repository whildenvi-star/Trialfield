'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatBu } from '@/lib/fmt'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryForApply {
  id: string
  deliveryDate: string
  netBushels: number
  unappliedBushels: number
  variant: { id?: string; name: string }
  customer: { id?: string; name: string; shortCode: string }
}

// The suggestion shape returned by POST /suggestions — contract is nested
export interface SuggestionResult {
  contract: {
    id: string
    variantId?: string
    customerId?: string
    openBushels: number
    contractedBushels: number
    instrument?: string
    customer?: { name: string; shortCode: string }
    variant?: { name: string }
  }
  score: number
}

// ── ApplyDeliveryClient ───────────────────────────────────────────────────────

interface ApplyDeliveryClientProps {
  delivery: DeliveryForApply
  suggestions: SuggestionResult[]
}

export function ApplyDeliveryClient({
  delivery,
  suggestions,
}: ApplyDeliveryClientProps) {
  const router = useRouter()

  // ── State ─────────────────────────────────────────────────────────────────
  const initialInputs = useMemo(
    () =>
      suggestions.reduce<Record<string, string>>((acc, s) => {
        const prefill = Math.min(s.contract.openBushels, delivery.unappliedBushels)
        return { ...acc, [s.contract.id]: prefill.toFixed(2) }
      }, {}),
    [suggestions, delivery.unappliedBushels]
  )

  const [inputs, setInputs] = useState<Record<string, string>>(initialInputs)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────────
  const totalInput = Object.values(inputs).reduce(
    (s, v) => s + (parseFloat(v) || 0),
    0
  )
  const overApplied = totalInput > delivery.unappliedBushels + 0.001

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (overApplied) {
      setError('Total applied bushels exceeds delivery unmatched amount')
      return
    }

    const applications = Object.entries(inputs)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([contractId, v]) => ({
        contractId,
        appliedBushels: Number(v),
      }))

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/cert-proxy/marketing/deliveries/${delivery.id}/applications`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applications }),
        }
      )

      if (res.ok) {
        router.push('/app/marketing/deliveries')
      } else {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? 'Application failed')
      }
    } catch {
      setError('Application failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Delivery summary */}
      <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4 mb-6">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent mb-3">
          Delivery
        </h2>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          <div>
            <span className="text-glomalin-muted">Date: </span>
            <span className="text-glomalin-text">{delivery.deliveryDate.slice(0, 10)}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Customer: </span>
            <span className="text-glomalin-text">{delivery.customer.name}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Variant: </span>
            <span className="text-glomalin-text">{delivery.variant.name}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Net Bu: </span>
            <span className="text-glomalin-text">{formatBu(delivery.netBushels)}</span>
          </div>
          <div>
            <span className="text-glomalin-muted">Unmatched: </span>
            <span className={delivery.unappliedBushels > 0 ? 'text-glomalin-warning' : 'text-glomalin-text'}>
              {formatBu(delivery.unappliedBushels)}
            </span>
          </div>
        </div>
      </div>

      {/* Suggestion cards */}
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-glomalin-accent mb-3">
        Contract Suggestions
      </h2>

      {suggestions.length === 0 ? (
        <p className="font-mono text-sm text-glomalin-muted">
          No matching contracts found for this delivery.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="bg-red-900/20 border border-glomalin-danger text-glomalin-danger text-sm font-mono px-3 py-2 rounded mb-4"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 mb-4">
            {suggestions.map((s) => {
              const cid = s.contract.id
              const customerName = s.contract.customer?.name ?? '—'
              const variantName = s.contract.variant?.name ?? '—'
              const instrument = s.contract.instrument ?? ''

              return (
                <div
                  key={cid}
                  className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-glomalin-text">
                        {variantName}
                      </p>
                      <p className="font-mono text-xs text-glomalin-muted">
                        {customerName}
                        {instrument && ` · ${instrument}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-glomalin-muted">Score</p>
                      <p className="font-mono text-sm font-semibold text-glomalin-accent">
                        {s.score}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-mono text-xs text-glomalin-muted mb-1">
                        Open: {formatBu(s.contract.openBushels)}
                      </p>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Applied bushels for contract ${cid}`}
                        value={inputs[cid] ?? '0.00'}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [cid]: e.target.value }))
                        }
                        className="w-full bg-glomalin-elevated border border-glomalin-border text-glomalin-text font-mono text-sm rounded-md px-2.5 py-1.5 focus:outline-none focus:border-glomalin-accent transition-colors"
                      />
                    </div>
                    <p className="font-mono text-xs text-glomalin-muted whitespace-nowrap">
                      bu applied
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total indicator */}
          <div className="flex items-center justify-between font-mono text-sm mb-4">
            <span className="text-glomalin-muted">Total applied:</span>
            <span className={overApplied ? 'text-glomalin-warning font-semibold' : 'text-glomalin-text'}>
              {formatBu(totalInput)} / {formatBu(delivery.unappliedBushels)}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || overApplied}
            className="w-full bg-glomalin-accent text-black font-mono font-semibold text-sm rounded-md px-4 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Applying…' : 'Apply to Contracts'}
          </button>
        </form>
      )}

      {/* Back link */}
      <a
        href="/app/marketing/deliveries"
        className="block mt-4 font-mono text-xs text-glomalin-accent hover:opacity-80 transition-opacity"
      >
        ← Back to Deliveries
      </a>
    </div>
  )
}
