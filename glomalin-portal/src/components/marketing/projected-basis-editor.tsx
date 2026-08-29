'use client'

// Projected basis per variant — the planning placeholder that stands in for a
// contract's basis in WAP until the actual basis leg is set (like projected
// yield vs actual). Edits PATCH through the cert proxy onto the GrainVariant.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type VariantWithBasis = {
  id: string
  name: string
  cropYear?: number
  projectedBasis?: number | null
  commodity?: { name: string; symbol?: string | null }
}

function fmtSigned(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(2)
}

export function ProjectedBasisEditor({ variants }: { variants: VariantWithBasis[] }) {
  const router = useRouter()
  // Draft text per variant id; undefined = not editing, show stored value
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(v: VariantWithBasis) {
    const raw = drafts[v.id]
    if (raw === undefined) return
    const trimmed = raw.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && !Number.isFinite(value)) {
      setErrors((e) => ({ ...e, [v.id]: 'not a number' }))
      return
    }
    // No-op if unchanged
    if (value === (v.projectedBasis ?? null)) {
      setDrafts(({ [v.id]: _, ...rest }) => rest)
      return
    }
    setSaving((s) => ({ ...s, [v.id]: true }))
    setErrors(({ [v.id]: _, ...rest }) => rest)
    try {
      const res = await fetch(`/api/cert-proxy/marketing/grain-variants/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectedBasis: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setDrafts(({ [v.id]: _, ...rest }) => rest)
      router.refresh()
    } catch (err) {
      setErrors((e) => ({ ...e, [v.id]: err instanceof Error ? err.message : 'save failed' }))
    } finally {
      setSaving((s) => ({ ...s, [v.id]: false }))
    }
  }

  return (
    <div className="mx-4 mb-3 border border-glomalin-border rounded bg-glomalin-surface px-4 py-3">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-glomalin-muted">
          Projected Basis
        </h2>
        <span className="text-xs text-glomalin-muted font-sans">
          planning placeholder, $/bu — used in WAP for any sale whose basis isn&apos;t set yet
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {variants.map((v) => {
          const stored = v.projectedBasis
          const draft = drafts[v.id]
          const display = draft !== undefined ? draft : stored != null ? fmtSigned(stored) : ''
          return (
            <label key={v.id} className="flex items-center gap-2 font-mono text-sm">
              <span className="text-glomalin-text">
                {v.name}
                {v.cropYear ? <span className="text-glomalin-muted"> ’{String(v.cropYear).slice(-2)}</span> : null}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="—"
                value={display}
                disabled={saving[v.id]}
                onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                onBlur={() => save(v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className={[
                  'w-20 bg-glomalin-bg border rounded px-2 py-1 text-right font-mono text-sm',
                  'focus:outline-none focus:border-glomalin-accent',
                  errors[v.id] ? 'border-red-500' : 'border-glomalin-border',
                  saving[v.id] ? 'opacity-50' : '',
                ].join(' ')}
              />
              {errors[v.id] && (
                <span className="text-xs text-red-500 font-sans">{errors[v.id]}</span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}
