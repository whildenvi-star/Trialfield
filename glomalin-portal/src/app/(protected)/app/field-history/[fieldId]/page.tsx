'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { YearCard, type Enterprise, type AphRecord } from '@/components/field-history/YearCard'
import { buildSvgThumb, type GeoJsonGeometry } from '@/lib/utils/field-thumb'

interface FieldDetail {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
  fsaFarmNumber: string | null
  enterprises: Enterprise[]
}

export default function FieldHistoryDetailPage() {
  const { fieldId } = useParams<{ fieldId: string }>()
  const [field, setField] = useState<FieldDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aphRecords, setAphRecords] = useState<AphRecord[]>([])
  const [thumbGeo, setThumbGeo] = useState<GeoJsonGeometry | null>(null)

  useEffect(() => {
    if (!fieldId) return
    fetch(`/api/field-history/${fieldId}`)
      .then(r => { if (!r.ok) throw new Error('Field not found'); return r.json() })
      .then(d => setField(d.field))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    fetch(`/api/field-history/${fieldId}/aph`)
      .then(r => r.ok ? r.json() : { records: [] })
      .then(d => setAphRecords(d.records ?? []))
      .catch(() => {})
  }, [fieldId])

  // Fetch thumbnail by name once field is loaded
  useEffect(() => {
    if (!field?.name) return
    fetch('/api/maps/boundaries')
      .then(r => r.ok ? r.json() : null)
      .then(fc => {
        if (!fc?.features) return
        const name = field.name.toLowerCase().trim()
        const feat = fc.features.find((f: { properties?: { name?: string }; geometry: GeoJsonGeometry }) =>
          f.properties?.name?.toLowerCase().trim() === name
        )
        if (feat?.geometry) setThumbGeo(feat.geometry)
      })
      .catch(() => {})
  }, [field?.name])

  if (loading) {
    return <div className="p-6"><div className="text-sm text-glomalin-muted">Loading...</div></div>
  }

  if (error || !field) {
    return (
      <div className="p-6">
        <Link href="/app/field-history" className="text-xs text-glomalin-muted hover:text-glomalin-text flex items-center gap-1 mb-4">
          ← Field History
        </Link>
        <div className="text-sm text-red-400">{error ?? 'Field not found'}</div>
      </div>
    )
  }

  const statusLabel =
    field.organicStatus === 'ORGANIC' || field.organicStatus === 'CERTIFIED' ? 'organic'
    : field.organicStatus === 'TRANSITIONAL' ? 'transitional'
    : 'conventional'

  const statusClass =
    field.organicStatus === 'ORGANIC' || field.organicStatus === 'CERTIFIED'
      ? 'bg-green-950/40 text-green-400 border-green-800/40'
      : field.organicStatus === 'TRANSITIONAL'
        ? 'bg-amber-950/30 text-amber-400 border-amber-800/40'
        : 'bg-glomalin-surface text-glomalin-muted border-glomalin-border'

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/app/field-history"
          className="text-xs text-glomalin-muted hover:text-glomalin-text flex items-center gap-1 w-fit">
          ← Field History
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/app/field-timeline?field=${field.id}`}
            className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
          >
            Activity timeline →
          </Link>
          <Link
            href={`/app/field-history/${fieldId}/audit`}
            className="text-xs px-3 py-1 border border-glomalin-border rounded text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent/60 transition-colors"
          >
            Organic Audit Record
          </Link>
        </div>
      </div>

      {/* Field header with thumbnail */}
      <div className="mb-6 flex items-start gap-4">
        <span dangerouslySetInnerHTML={{ __html: buildSvgThumb(thumbGeo, 52) }} />
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl font-semibold text-glomalin-text">{field.name}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-glomalin-muted">
            <span>{field.totalAcres.toFixed(1)} ac</span>
            {field.fsaFarmNumber && <span>FSA {field.fsaFarmNumber}</span>}
            <span>{field.enterprises.length} crop year{field.enterprises.length !== 1 ? 's' : ''} on record</span>
          </div>
        </div>
      </div>

      {/* Year cards */}
      {field.enterprises.length === 0 ? (
        <div className="text-sm text-glomalin-muted py-16 text-center border border-glomalin-border rounded">
          No history on record for this field
        </div>
      ) : (
        <div className="space-y-1">
          {field.enterprises.map(ent => (
            <YearCard key={ent.id} ent={ent} aphRecords={aphRecords} />
          ))}
        </div>
      )}
    </div>
  )
}
