'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AphRecord {
  crop: string
  crop_year: number
  actual_yield: number
  is_disaster_year: boolean
}

interface TillageOp {
  id: string
  operationDate: string | null
  description: string | null
  dataSource: string
  passStatus: string
}

interface HarvestEvent {
  id: string
  harvestDate: string
  yieldPerAcre: number | null
  yieldUnit: string | null
  acresHarvested: number
  dataSource: string
  notes: string | null
}

interface FertilityEvent {
  id: string
  type: string
  applicationDate: string
  quantity: number
  quantityUnit: string
  notes: string | null
}

interface Enterprise {
  id: string
  cropYear: number
  crop: string
  variety: string | null
  label: string | null
  plantedAcres: number
  organicStatus: string
  lotNumber: string | null
  notes: string | null
  enterpriseType: string
  fieldOperations: TillageOp[]
  harvestEvents: HarvestEvent[]
  fertilityEvents: FertilityEvent[]
}

interface FieldDetail {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
  fsaFarmNumber: string | null
  enterprises: Enterprise[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function fertilityLabel(type: string) {
  const map: Record<string, string> = {
    MANURE: 'manure/compost',
    COMPOST: 'compost',
    GREEN_MANURE: 'green manure',
    MINERAL: 'minerals',
    FOLIAR: 'foliar',
    PELLET: 'pellets',
    INOCULANT: 'inoculant',
    OTHER: 'other',
  }
  return map[type] ?? type.toLowerCase()
}

// ── Year Card ─────────────────────────────────────────────────────────────────

function YearCard({ ent, aphRecords }: { ent: Enterprise; aphRecords: AphRecord[] }) {
  const [open, setOpen] = useState(false)
  const isImported =
    ent.fieldOperations.some((o) => o.dataSource === 'IMPORTED') ||
    ent.harvestEvents.some((h) => h.dataSource === 'IMPORTED')

  const matchingAph = aphRecords.filter(
    (r) =>
      r.crop_year === ent.cropYear &&
      r.crop.toLowerCase() === ent.crop.toLowerCase()
  )

  const fertilityByType = ent.fertilityEvents.reduce<Record<string, FertilityEvent[]>>(
    (acc, f) => {
      if (!acc[f.type]) acc[f.type] = []
      acc[f.type].push(f)
      return acc
    },
    {}
  )

  return (
    <div className="border border-glomalin-border bg-glomalin-surface rounded overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-glomalin-bg transition-colors text-left"
      >
        <span className="text-sm font-medium text-glomalin-accent w-12 shrink-0">
          {ent.cropYear}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-glomalin-text">
              {ent.crop}
              {ent.label ? ` · ${ent.label}` : ''}
            </span>
            {ent.variety && (
              <span className="text-xs text-glomalin-muted">{ent.variety}</span>
            )}
            {isImported && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-glomalin-bg text-glomalin-muted border-glomalin-border">
                imported
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-glomalin-muted">{ent.plantedAcres.toFixed(1)} ac</span>
            {ent.harvestEvents[0]?.yieldPerAcre && (
              <span className="text-xs text-green-400">
                {ent.harvestEvents[0].yieldPerAcre.toFixed(1)}{' '}
                {ent.harvestEvents[0].yieldUnit ?? 'unit'}/ac
              </span>
            )}
            <span className="text-xs text-glomalin-muted">
              {ent.fieldOperations.length} tillage pass
              {ent.fieldOperations.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
        <svg
          className="text-glomalin-muted shrink-0"
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          {open
            ? <path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />}
        </svg>
      </button>

      {open && (
        <div className="border-t border-glomalin-border px-4 py-3 space-y-4">
          {/* Planting notes */}
          {ent.notes && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1">
                planting
              </div>
              <p className="text-xs text-glomalin-text/70 whitespace-pre-wrap">{ent.notes}</p>
            </div>
          )}

          {/* Harvest */}
          {ent.harvestEvents.length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">
                harvest
              </div>
              <div className="space-y-1">
                {ent.harvestEvents.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted w-24 shrink-0">
                      {h.harvestDate ? formatDate(h.harvestDate) : 'date unknown'}
                    </span>
                    <span className="text-glomalin-text/80">
                      {h.yieldPerAcre != null
                        ? `${h.yieldPerAcre.toFixed(2)} ${h.yieldUnit ?? 'unit'}/ac`
                        : h.notes ?? '—'}
                    </span>
                    {h.notes && h.yieldPerAcre != null && (
                      <span className="text-glomalin-muted truncate max-w-xs">{h.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tillage */}
          {ent.fieldOperations.length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">
                tillage
              </div>
              <div className="space-y-0.5">
                {ent.fieldOperations.map((op, i) => (
                  <div key={op.id} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted shrink-0 w-5">{i + 1}.</span>
                    {op.operationDate && (
                      <span className="text-glomalin-muted w-24 shrink-0">
                        {formatDate(op.operationDate)}
                      </span>
                    )}
                    <span className="text-glomalin-text/80">{op.description ?? 'pass'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fertility */}
          {Object.keys(fertilityByType).length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">
                fertility
              </div>
              <div className="space-y-2">
                {Object.entries(fertilityByType).map(([type, events]) => (
                  <div key={type}>
                    <div className="text-[10px] text-glomalin-muted mb-0.5 pl-1 border-l border-glomalin-border">
                      {fertilityLabel(type)}
                    </div>
                    {events.map((e) => (
                      <div key={e.id} className="text-xs text-glomalin-text/70 pl-3">
                        {e.notes ??
                          (e.quantityUnit !== 'imported'
                            ? `${e.quantity} ${e.quantityUnit}`
                            : '—')}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APH yield */}
          {matchingAph.length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">
                APH yield
              </div>
              <div className="space-y-1">
                {matchingAph.map((record) => (
                  <div key={record.crop_year} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted w-24 shrink-0">{record.crop_year}</span>
                    <span className="text-green-400">{record.actual_yield.toFixed(1)} bu/ac</span>
                    {record.is_disaster_year && (
                      <span className="text-amber-400 text-[10px]">disaster yr</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lot number */}
          {ent.lotNumber && (
            <div className="text-xs text-glomalin-muted">
              lot: <span className="text-glomalin-text/60">{ent.lotNumber}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FieldHistoryDetailPage() {
  const { fieldId } = useParams<{ fieldId: string }>()
  const [field, setField] = useState<FieldDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aphRecords, setAphRecords] = useState<AphRecord[]>([])

  useEffect(() => {
    if (!fieldId) return
    fetch(`/api/field-history/${fieldId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Field not found')
        return r.json()
      })
      .then((d) => setField(d.field))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    fetch(`/api/field-history/${fieldId}/aph`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d) => setAphRecords(d.records ?? []))
      .catch(() => {})
  }, [fieldId])

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-glomalin-muted">Loading...</div>
      </div>
    )
  }

  if (error || !field) {
    return (
      <div className="p-6">
        <Link
          href="/app/field-history"
          className="text-xs text-glomalin-muted hover:text-glomalin-text flex items-center gap-1 mb-4"
        >
          ← Field History
        </Link>
        <div className="text-sm text-red-400">{error ?? 'Field not found'}</div>
      </div>
    )
  }

  const statusLabel =
    field.organicStatus === 'ORGANIC' || field.organicStatus === 'CERTIFIED'
      ? 'organic'
      : field.organicStatus === 'TRANSITIONAL'
        ? 'transitional'
        : 'conventional'

  const statusClass =
    field.organicStatus === 'ORGANIC' || field.organicStatus === 'CERTIFIED'
      ? 'bg-green-950/40 text-green-400 border-green-800/40'
      : field.organicStatus === 'TRANSITIONAL'
        ? 'bg-amber-950/30 text-amber-400 border-amber-800/40'
        : 'bg-glomalin-surface text-glomalin-muted border-glomalin-border'

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <Link
        href="/app/field-history"
        className="text-xs text-glomalin-muted hover:text-glomalin-text flex items-center gap-1 mb-4 w-fit"
      >
        ← Field History
      </Link>

      {/* Field header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-semibold text-glomalin-text">{field.name}</h1>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-glomalin-muted">
          <span>{field.totalAcres.toFixed(1)} ac</span>
          {field.fsaFarmNumber && <span>FSA {field.fsaFarmNumber}</span>}
          <span>
            {field.enterprises.length} crop year
            {field.enterprises.length !== 1 ? 's' : ''} on record
          </span>
        </div>
      </div>

      {/* Year cards */}
      {field.enterprises.length === 0 ? (
        <div className="text-sm text-glomalin-muted py-16 text-center border border-glomalin-border rounded">
          No history on record for this field
        </div>
      ) : (
        <div className="space-y-1">
          {field.enterprises.map((ent) => (
            <YearCard key={ent.id} ent={ent} aphRecords={aphRecords} />
          ))}
        </div>
      )}
    </div>
  )
}
