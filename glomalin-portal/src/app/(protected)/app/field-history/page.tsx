'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface FieldSummary {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
  mostRecentYear: number | null
  mostRecentCrop: string | null
  mostRecentVariety: string | null
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ORGANIC' || status === 'CERTIFIED') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-green-950/40 text-green-400 border-green-800/40">
        organic
      </span>
    )
  }
  if (status === 'TRANSITIONAL') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-950/30 text-amber-400 border-amber-800/40">
        transitional
      </span>
    )
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-glomalin-surface text-glomalin-muted border-glomalin-border">
      conventional
    </span>
  )
}

export default function FieldHistoryPage() {
  const [fields, setFields] = useState<FieldSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchFields = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q
        ? `/api/field-history?search=${encodeURIComponent(q)}`
        : '/api/field-history'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load fields')
      const data = await res.json()
      setFields(data.fields ?? [])
    } catch {
      setFields([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchFields(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchFields])

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-glomalin-text mb-1">Field History</h1>
        <p className="text-sm text-glomalin-muted">
          Crop rotation, tillage, fertility &amp; yield — all fields
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-glomalin-muted pointer-events-none"
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm bg-glomalin-surface border border-glomalin-border text-glomalin-text placeholder:text-glomalin-muted rounded focus:outline-none focus:border-glomalin-accent/60"
        />
      </div>

      {/* Field list */}
      {loading ? (
        <div className="text-sm text-glomalin-muted py-16 text-center">Loading...</div>
      ) : fields.length === 0 ? (
        <div className="text-sm text-glomalin-muted py-16 text-center">No fields found</div>
      ) : (
        <div className="space-y-1">
          {fields.map((field) => (
            <Link
              key={field.id}
              href={`/app/field-history/${field.id}`}
              className="flex items-center gap-3 px-4 py-3 bg-glomalin-surface border border-glomalin-border rounded hover:border-glomalin-accent/40 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-glomalin-text">{field.name}</span>
                  <StatusBadge status={field.organicStatus} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-glomalin-muted">
                    {field.totalAcres.toFixed(1)} ac
                  </span>
                  {field.mostRecentYear && (
                    <span className="text-xs text-glomalin-muted">
                      {field.mostRecentYear} · {field.mostRecentCrop}
                      {field.mostRecentVariety ? ` (${field.mostRecentVariety})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <svg
                className="text-glomalin-muted group-hover:text-glomalin-accent transition-colors shrink-0"
                width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-4 text-xs text-glomalin-muted">
          {fields.length} field{fields.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
