'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface AphRecord {
  crop: string
  crop_year: number
  actual_yield: number
  is_disaster_year: boolean
}

interface TillageOp {
  id: string
  type: string
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

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return dateStr }
}

function organicStatusLabel(status: string) {
  if (status === 'ORGANIC' || status === 'CERTIFIED') return 'Certified Organic'
  if (status === 'TRANSITIONAL') return 'Transitional'
  return 'Conventional'
}

function organicStatusClass(status: string) {
  if (status === 'ORGANIC' || status === 'CERTIFIED')
    return 'border-green-700 text-green-800 bg-green-50'
  if (status === 'TRANSITIONAL')
    return 'border-amber-700 text-amber-800 bg-amber-50'
  return 'border-gray-400 text-gray-600 bg-gray-50'
}

function fertilityTypeLabel(type: string) {
  const map: Record<string, string> = {
    MANURE: 'Manure / Compost',
    COMPOST: 'Compost',
    GREEN_MANURE: 'Green Manure / Cover Crop',
    MINERAL: 'Minerals / Rock Dust',
    FOLIAR: 'Foliar Application',
    PELLET: 'Pelleted Fertilizer',
    INOCULANT: 'Inoculant',
    OTHER: 'Other',
  }
  return map[type] ?? type
}

export default function AuditPage() {
  const { fieldId } = useParams<{ fieldId: string }>()
  const [field, setField] = useState<FieldDetail | null>(null)
  const [aphRecords, setAphRecords] = useState<AphRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fieldId) return
    Promise.all([
      fetch(`/api/field-history/${fieldId}`).then(r => r.ok ? r.json() : { field: null }),
      fetch(`/api/field-history/${fieldId}/aph`).then(r => r.ok ? r.json() : { records: [] }),
    ])
      .then(([detail, aph]) => {
        setField(detail.field ?? null)
        setAphRecords(aph.records ?? [])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [fieldId])

  if (loading) {
    return <div className="p-6 text-sm text-glomalin-muted">Loading audit record…</div>
  }

  if (error || !field) {
    return (
      <div className="p-6">
        <Link href={`/app/field-history/${fieldId}`} className="text-xs text-glomalin-muted hover:text-glomalin-text mb-4 inline-block">
          ← Back
        </Link>
        <div className="text-sm text-red-400">{error ?? 'Field not found'}</div>
      </div>
    )
  }

  const enterprises = [...field.enterprises].sort((a, b) => b.cropYear - a.cropYear)

  return (
    <div className="min-h-screen">
      {/* Print controls — hidden in print */}
      <div className="bg-glomalin-bg border-b border-glomalin-border px-6 py-3 flex items-center gap-4 print:hidden">
        <Link
          href={`/app/field-history/${fieldId}`}
          className="text-xs text-glomalin-muted hover:text-glomalin-text"
        >
          ← Field History
        </Link>
        <span className="text-xs text-glomalin-muted flex-1">
          Organic Audit Record — {field.name}
        </span>
        <Link
          href={`/app/field-timeline?field=${fieldId}`}
          className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
        >
          Activity timeline →
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 text-xs font-mono border border-glomalin-border text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent rounded transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Audit document — white background for print */}
      <div className="bg-white text-gray-900 max-w-4xl mx-auto px-8 py-10 print:px-6 print:py-8">

        {/* Document header */}
        <div className="mb-8 pb-5 border-b-2 border-gray-900">
          <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">
            Organic System Plan — Field Activity Record
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{field.name}</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Total Acres</div>
              <div className="font-semibold">{field.totalAcres.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Organic Status</div>
              <div className="font-semibold">{organicStatusLabel(field.organicStatus)}</div>
            </div>
            {field.fsaFarmNumber && (
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">FSA Farm #</div>
                <div className="font-semibold">{field.fsaFarmNumber}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Years on Record</div>
              <div className="font-semibold">{enterprises.length}</div>
            </div>
          </div>
        </div>

        {/* Crop year sections */}
        {enterprises.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-8 text-center">
            No history on record for this field.
          </p>
        ) : enterprises.map((ent) => {
          const matchingAph = aphRecords.filter(
            r => r.crop_year === ent.cropYear && r.crop.toLowerCase() === ent.crop.toLowerCase()
          )
          const fertilityByType = ent.fertilityEvents.reduce<Record<string, FertilityEvent[]>>((acc, f) => {
            if (!acc[f.type]) acc[f.type] = []
            acc[f.type].push(f)
            return acc
          }, {})

          return (
            <section key={ent.id} className="mb-10 pb-10 border-b border-gray-200 last:border-0 print:break-inside-avoid">

              {/* Year / crop header */}
              <div className="flex items-baseline flex-wrap gap-3 mb-4">
                <span className="text-xl font-bold text-gray-900">{ent.cropYear}</span>
                <span className="text-lg text-gray-800">{ent.crop}</span>
                {ent.variety && (
                  <span className="text-sm text-gray-500">{ent.variety}</span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm text-gray-600">{ent.plantedAcres.toFixed(1)} ac</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${organicStatusClass(ent.organicStatus)}`}>
                    {organicStatusLabel(ent.organicStatus)}
                  </span>
                </div>
              </div>

              {/* Seed / planting info */}
              {(ent.notes || ent.lotNumber || ent.label) && (
                <div className="mb-4 pl-3 border-l-2 border-gray-200 space-y-0.5">
                  {ent.label && (
                    <div className="text-sm text-gray-700">
                      <span className="text-xs text-gray-400 mr-2">Label:</span>{ent.label}
                    </div>
                  )}
                  {ent.lotNumber && (
                    <div className="text-sm text-gray-700">
                      <span className="text-xs text-gray-400 mr-2">Seed lot #:</span>{ent.lotNumber}
                    </div>
                  )}
                  {ent.notes && (
                    <div className="text-sm text-gray-600 whitespace-pre-wrap pt-0.5">{ent.notes}</div>
                  )}
                </div>
              )}

              {/* Field Operations */}
              {ent.fieldOperations.length > 0 && (
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Field Operations
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-32">Date</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-24">Type</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-24">Status</th>
                        <th className="py-1.5 text-xs font-medium text-gray-400">Description / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ent.fieldOperations.map((op, i) => (
                        <tr key={op.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                          <td className="py-1.5 pr-4 text-gray-500 text-xs">{fmtDate(op.operationDate)}</td>
                          <td className="py-1.5 pr-4 text-xs text-gray-500 capitalize">
                            {op.type?.toLowerCase().replace('_', ' ') ?? '—'}
                          </td>
                          <td className="py-1.5 pr-4 text-xs text-gray-500 capitalize">
                            {op.passStatus?.toLowerCase().replace('_', ' ')}
                          </td>
                          <td className="py-1.5 text-gray-800">{op.description ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Inputs & Fertility */}
              {Object.keys(fertilityByType).length > 0 && (
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Inputs &amp; Fertility
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-32">Date</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-44">Material Type</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-28">Quantity</th>
                        <th className="py-1.5 text-xs font-medium text-gray-400">Notes / Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(fertilityByType).flatMap(([type, events]) =>
                        events.map((e, i) => (
                          <tr key={e.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                            <td className="py-1.5 pr-4 text-gray-500 text-xs">{fmtDate(e.applicationDate)}</td>
                            <td className="py-1.5 pr-4 text-gray-800">{fertilityTypeLabel(type)}</td>
                            <td className="py-1.5 pr-4 text-gray-600 text-xs">
                              {e.quantityUnit !== 'imported'
                                ? `${e.quantity} ${e.quantityUnit}`
                                : 'see notes'}
                            </td>
                            <td className="py-1.5 text-gray-600">{e.notes ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Harvest */}
              {ent.harvestEvents.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Harvest
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-32">Date</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-28">Yield / Ac</th>
                        <th className="py-1.5 pr-4 text-xs font-medium text-gray-400 w-24">Acres</th>
                        <th className="py-1.5 text-xs font-medium text-gray-400">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ent.harvestEvents.map((h, i) => (
                        <tr key={h.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                          <td className="py-1.5 pr-4 text-gray-500 text-xs">{fmtDate(h.harvestDate)}</td>
                          <td className="py-1.5 pr-4 text-gray-800">
                            {h.yieldPerAcre != null
                              ? `${h.yieldPerAcre.toFixed(2)} ${h.yieldUnit ?? ''}`.trim()
                              : '—'}
                          </td>
                          <td className="py-1.5 pr-4 text-gray-600 text-xs">
                            {h.acresHarvested.toFixed(1)}
                          </td>
                          <td className="py-1.5 text-gray-600">{h.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {matchingAph.length > 0 && (
                    <div className="mt-1 text-xs text-gray-400">
                      APH: {matchingAph.map(r =>
                        `${r.actual_yield.toFixed(1)} bu/ac${r.is_disaster_year ? ' (disaster yr)' : ''}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {ent.fieldOperations.length === 0 &&
               Object.keys(fertilityByType).length === 0 &&
               ent.harvestEvents.length === 0 && (
                <p className="text-sm text-gray-400 italic">No field activity on record for this year.</p>
              )}
            </section>
          )
        })}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex items-center justify-between">
          <span>W. Hughes Farms — Glomalin Portal</span>
          <span>
            Generated{' '}
            {new Date().toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
