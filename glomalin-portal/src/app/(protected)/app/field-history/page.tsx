'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { YearCard, type Enterprise, type AphRecord } from '@/components/field-history/YearCard'
import { buildSvgThumb, type GeoJsonGeometry } from '@/lib/utils/field-thumb'

interface FieldSummary {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
  mostRecentYear: number | null
  mostRecentCrop: string | null
  mostRecentVariety: string | null
}

interface DetailCache {
  enterprises: Enterprise[]
  aphRecords: AphRecord[]
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Map<string, DetailCache>>(new Map())
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, GeoJsonGeometry>>(new Map())

  // Fetch boundary thumbnails once on mount (name → geojson lookup)
  useEffect(() => {
    fetch('/api/maps/boundaries')
      .then(r => r.ok ? r.json() : null)
      .then(fc => {
        if (!fc?.features) return
        const map = new Map<string, GeoJsonGeometry>()
        for (const feat of fc.features) {
          if (feat.properties?.name && feat.geometry) {
            map.set(feat.properties.name.toLowerCase().trim(), feat.geometry)
          }
        }
        setThumbs(map)
      })
      .catch(() => {})
  }, [])

  const fetchFields = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q ? `/api/field-history?search=${encodeURIComponent(q)}` : '/api/field-history'
      const res = await fetch(url)
      if (!res.ok) throw new Error()
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

  const expandedRowRef = useRef<HTMLDivElement | null>(null)

  async function handleCardClick(field: FieldSummary) {
    if (expandedId === field.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(field.id)

    // Scroll into view after render
    setTimeout(() => expandedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)

    if (detailCache.has(field.id)) return

    setLoadingDetail(field.id)
    try {
      const [detailRes, aphRes] = await Promise.all([
        fetch(`/api/field-history/${field.id}`),
        fetch(`/api/field-history/${field.id}/aph`),
      ])
      const detail = detailRes.ok ? await detailRes.json() : { field: { enterprises: [] } }
      const aph = aphRes.ok ? await aphRes.json() : { records: [] }
      setDetailCache(prev => new Map(prev).set(field.id, {
        enterprises: detail.field?.enterprises ?? [],
        aphRecords: aph.records ?? [],
      }))
    } catch {
      setDetailCache(prev => new Map(prev).set(field.id, { enterprises: [], aphRecords: [] }))
    } finally {
      setLoadingDetail(null)
    }
  }

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
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-glomalin-muted pointer-events-none"
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search fields..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm bg-glomalin-surface border border-glomalin-border text-glomalin-text placeholder:text-glomalin-muted rounded focus:outline-none focus:border-glomalin-accent/60"
        />
      </div>

      {loading ? (
        <div className="text-sm text-glomalin-muted py-16 text-center">Loading...</div>
      ) : fields.length === 0 ? (
        <div className="text-sm text-glomalin-muted py-16 text-center">No fields found</div>
      ) : (
        <div className="space-y-1">
          {fields.map(field => {
            const isOpen = expandedId === field.id
            const isLoadingThis = loadingDetail === field.id
            const cached = detailCache.get(field.id)
            const thumbGeo = thumbs.get(field.name.toLowerCase().trim()) ?? null

            return (
              <div key={field.id}>
                {/* Field card header — clickable */}
                <button
                  onClick={() => handleCardClick(field)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border rounded transition-colors ${
                    isOpen
                      ? 'bg-glomalin-surface border-glomalin-accent/40 rounded-b-none border-b-0'
                      : 'bg-glomalin-surface border-glomalin-border hover:border-glomalin-accent/40'
                  }`}
                >
                  {/* Thumbnail */}
                  <span
                    className="shrink-0"
                    dangerouslySetInnerHTML={{ __html: buildSvgThumb(thumbGeo, 36) }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-glomalin-text">{field.name}</span>
                      <StatusBadge status={field.organicStatus} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-glomalin-muted">{field.totalAcres.toFixed(1)} ac</span>
                      {field.mostRecentYear && (
                        <span className="text-xs text-glomalin-muted">
                          {field.mostRecentYear} · {field.mostRecentCrop}
                          {field.mostRecentVariety ? ` (${field.mostRecentVariety})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg className="text-glomalin-muted shrink-0 transition-transform" width="14" height="14"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                </button>

                {/* Expanded content drops down from card */}
                {isOpen && (
                  <div
                    ref={expandedRowRef}
                    className="border border-glomalin-accent/40 border-t-0 rounded-b bg-glomalin-bg px-4 py-4"
                  >
                    {isLoadingThis ? (
                      <div className="text-xs text-glomalin-muted py-4 text-center">Loading history…</div>
                    ) : !cached || cached.enterprises.length === 0 ? (
                      <div className="text-xs text-glomalin-muted py-4 text-center">No history on record</div>
                    ) : (
                      <div className="space-y-1">
                        {cached.enterprises.map(ent => (
                          <YearCard key={ent.id} ent={ent} aphRecords={cached.aphRecords} />
                        ))}
                      </div>
                    )}
                    {/* Navigation links */}
                    <div className="mt-3 pt-3 border-t border-glomalin-border flex items-center gap-4">
                      <Link
                        href={`/app/field-history/${field.id}`}
                        className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Full detail →
                      </Link>
                      <Link
                        href={`/app/field-timeline?field=${field.id}`}
                        className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Activity timeline →
                      </Link>
                      <Link
                        href={`/app/field-history/${field.id}/audit`}
                        className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Organic audit →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
