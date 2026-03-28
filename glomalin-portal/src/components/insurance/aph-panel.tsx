'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AphRecord } from '@/lib/insurance/calc'

interface AphPanelProps {
  policyId: string
  coverageLevel: number
  onGuaranteeChange?: (guarantee: number) => void
}

interface AphApiResponse {
  records: AphRecord[]
  computedAph: number
  includedCount: number
  excludedCount: number
  totalCount: number
  guarantee: number
  coverageLevel: number
}

const CURRENT_YEAR = new Date().getFullYear()

function SourceBadge({ source }: { source: AphRecord['source'] }) {
  if (source === 'grain-tickets') {
    return (
      <span className="inline-block bg-green-800/50 text-green-300 text-xs px-1.5 py-0.5 rounded font-mono">
        GT
      </span>
    )
  }
  if (source === 'import') {
    return (
      <span className="inline-block bg-blue-800/50 text-blue-300 text-xs px-1.5 py-0.5 rounded font-mono">
        IMP
      </span>
    )
  }
  // manual
  return (
    <span className="inline-block bg-glomalin-border/50 text-glomalin-muted text-xs px-1.5 py-0.5 rounded font-mono">
      MAN
    </span>
  )
}

export function AphPanel({ policyId, coverageLevel, onGuaranteeChange }: AphPanelProps) {
  const [data, setData] = useState<AphApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [addYear, setAddYear] = useState<number>(CURRENT_YEAR - 1)
  const [addYield, setAddYield] = useState<string>('')
  const [addSource, setAddSource] = useState<AphRecord['source']>('manual')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Per-row toggle loading state
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insurance/aph?policyId=${encodeURIComponent(policyId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? 'Failed to load APH records')
        return
      }
      const json = (await res.json()) as AphApiResponse
      setData(json)
      onGuaranteeChange?.(json.guarantee)
    } catch {
      setError('Network error loading APH records')
    } finally {
      setLoading(false)
    }
  }, [policyId, onGuaranteeChange])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId])

  async function handleToggleDisaster(record: AphRecord) {
    setTogglingId(record.id)
    try {
      const res = await fetch(`/api/insurance/aph/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_disaster_year: !record.is_disaster_year }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to toggle disaster year:', err)
        return
      }
      await fetchData()
    } catch (err) {
      console.error('Network error toggling disaster year:', err)
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(record: AphRecord) {
    if (!confirm(`Remove ${record.crop_year} APH record?`)) return
    setDeletingId(record.id)
    try {
      const res = await fetch(`/api/insurance/aph/${record.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to delete APH record:', err)
        return
      }
      await fetchData()
    } catch (err) {
      console.error('Network error deleting APH record:', err)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAddYear(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)

    const yieldVal = parseFloat(addYield)
    if (isNaN(yieldVal) || yieldVal < 0) {
      setAddError('Actual yield must be a non-negative number')
      return
    }

    setAddSubmitting(true)
    try {
      const res = await fetch('/api/insurance/aph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: policyId,
          crop_year: addYear,
          actual_yield: yieldVal,
          source: addSource,
        }),
      })

      if (res.status === 409) {
        setAddError('Year already exists')
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddError((err as { error?: string }).error ?? 'Failed to add year')
        return
      }

      // Reset form and refetch
      setAddYear(CURRENT_YEAR - 1)
      setAddYield('')
      setAddSource('manual')
      await fetchData()
    } catch {
      setAddError('Network error adding year')
    } finally {
      setAddSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-5 py-6">
        <p className="text-glomalin-muted text-sm font-mono">Loading APH records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-5 py-4">
        <p className="text-red-400 text-sm font-mono">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 text-xs text-glomalin-muted hover:text-glomalin-accent font-mono underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const records = data?.records ?? []
  const computedAph = data?.computedAph ?? 0
  const includedCount = data?.includedCount ?? 0
  const excludedCount = data?.excludedCount ?? 0
  const totalCount = data?.totalCount ?? 0
  const guarantee = data?.guarantee ?? 0

  // Build formula string from included yields
  const includedYields = records
    .filter((r) => !r.is_disaster_year && r.actual_yield > 0)
    .map((r) => r.actual_yield.toFixed(1))
  const formulaStr =
    includedYields.length > 0
      ? `APH = avg(${includedYields.join(' + ')}) = ${computedAph}`
      : 'APH = no included years = 0'

  return (
    <div className="rounded-lg border border-glomalin-border bg-glomalin-surface overflow-hidden">
      {/* Computed APH summary */}
      <div className="px-5 py-4 border-b border-glomalin-border">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
          <span className="text-xl font-mono font-bold text-glomalin-accent">
            {computedAph > 0 ? `${computedAph} bu/ac` : '— bu/ac'}
          </span>
          <span className="text-xs text-glomalin-muted font-mono">
            from {includedCount} of {totalCount} year{totalCount !== 1 ? 's' : ''}
            {excludedCount > 0 ? `, ${excludedCount} excluded` : ''}
          </span>
        </div>
        <p className="text-sm font-mono text-glomalin-text mb-1">
          Guarantee at {coverageLevel}%:{' '}
          <span className="text-glomalin-accent font-semibold">
            {guarantee > 0 ? `${guarantee} bu/ac` : '—'}
          </span>
        </p>
        <p className="text-xs text-glomalin-muted font-mono italic">{formulaStr}</p>
      </div>

      {/* Year table */}
      {records.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-glomalin-muted text-sm font-mono">
            No APH records yet. Add a year below.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-glomalin-border">
                <th className="px-4 py-2 text-left text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
                  Year
                </th>
                <th className="px-4 py-2 text-right text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
                  Actual Yield (bu/ac)
                </th>
                <th className="px-4 py-2 text-center text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
                  Source
                </th>
                <th className="px-4 py-2 text-center text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
                  Disaster Year
                </th>
                <th className="px-4 py-2 text-center text-glomalin-accent font-semibold text-xs uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isDisaster = record.is_disaster_year
                const isToggling = togglingId === record.id
                const isDeleting = deletingId === record.id

                return (
                  <tr
                    key={record.id}
                    className={`border-b border-glomalin-border last:border-0 transition-colors ${
                      isDisaster ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Year */}
                    <td className="px-4 py-2.5">
                      <span className={`${isDisaster ? 'text-glomalin-muted' : 'text-glomalin-text'}`}>
                        {record.crop_year}
                      </span>
                    </td>

                    {/* Actual yield */}
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`${
                          isDisaster
                            ? 'line-through text-glomalin-muted'
                            : 'text-glomalin-text'
                        }`}
                      >
                        {record.actual_yield.toFixed(1)}
                      </span>
                    </td>

                    {/* Source badge */}
                    <td className="px-4 py-2.5 text-center">
                      <SourceBadge source={record.source} />
                    </td>

                    {/* Disaster year toggle */}
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isDisaster}
                        disabled={isToggling}
                        onChange={() => handleToggleDisaster(record)}
                        className="cursor-pointer accent-glomalin-accent disabled:opacity-50"
                        title={isDisaster ? 'Mark as normal year' : 'Mark as disaster year (exclude from APH)'}
                      />
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleDelete(record)}
                        disabled={isDeleting}
                        className="text-xs text-glomalin-muted hover:text-red-400 transition-colors font-mono disabled:opacity-50"
                        title={`Remove ${record.crop_year} APH record`}
                      >
                        {isDeleting ? '...' : 'x'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add year form */}
      <form
        onSubmit={handleAddYear}
        className="px-5 py-4 border-t border-glomalin-border bg-glomalin-bg"
      >
        <p className="text-xs text-glomalin-muted font-mono mb-2 uppercase tracking-wide">
          Add APH Year
        </p>
        <div className="flex flex-wrap items-end gap-2">
          {/* Crop year */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-glomalin-muted font-mono">Crop Year</label>
            <input
              type="number"
              value={addYear}
              min={2010}
              max={2026}
              step={1}
              required
              onChange={(e) => setAddYear(parseInt(e.target.value, 10))}
              className="w-24 bg-glomalin-surface border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent"
            />
          </div>

          {/* Actual yield */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-glomalin-muted font-mono">Actual Yield (bu/ac)</label>
            <input
              type="number"
              value={addYield}
              min={0}
              step={0.1}
              required
              placeholder="e.g. 185.5"
              onChange={(e) => setAddYield(e.target.value)}
              className="w-32 bg-glomalin-surface border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted"
            />
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-glomalin-muted font-mono">Source</label>
            <select
              value={addSource}
              onChange={(e) => setAddSource(e.target.value as AphRecord['source'])}
              className="bg-glomalin-surface border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent"
            >
              <option value="manual">manual</option>
              <option value="grain-tickets">grain-tickets</option>
              <option value="import">import</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={addSubmitting}
            className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addSubmitting ? 'Adding...' : 'Add Year'}
          </button>
        </div>

        {addError && (
          <p className="mt-2 text-xs text-red-400 font-mono">{addError}</p>
        )}
      </form>
    </div>
  )
}
