'use client'

import { useState } from 'react'

export interface AphRecord {
  crop: string
  crop_year: number
  actual_yield: number
  is_disaster_year: boolean
}

export interface FieldOp {
  id: string
  type: string
  operationDate: string | null
  description: string | null
  dataSource: string
  passStatus: string
}

export interface HarvestEvent {
  id: string
  harvestDate: string
  yieldPerAcre: number | null
  yieldUnit: string | null
  acresHarvested: number
  dataSource: string
  notes: string | null
}

export interface FertilityEvent {
  id: string
  type: string
  applicationDate: string
  quantity: number
  quantityUnit: string
  notes: string | null
}

export interface Enterprise {
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
  fieldOperations: FieldOp[]
  harvestEvents: HarvestEvent[]
  fertilityEvents: FertilityEvent[]
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

function fertilityLabel(type: string) {
  const map: Record<string, string> = {
    MANURE: 'manure/compost', COMPOST: 'compost', GREEN_MANURE: 'green manure',
    MINERAL: 'minerals', FOLIAR: 'foliar', PELLET: 'pellets', INOCULANT: 'inoculant', OTHER: 'other',
  }
  return map[type] ?? type.toLowerCase()
}

function opTypeLabel(type: string) {
  const map: Record<string, string> = {
    TILLAGE: 'tillage', PLANTING: 'planting', CULTIVATION: 'cultivation',
    HARVEST: 'harvest', SPRAYING: 'spraying', MOWING: 'mowing',
    IRRIGATION: 'irrigation', FLAMING: 'flaming', OTHER: 'other',
  }
  return map[type] ?? type.toLowerCase()
}

const INPUT_TYPES = [
  { value: 'MANURE', label: 'Manure / Compost' },
  { value: 'COMPOST', label: 'Compost' },
  { value: 'GREEN_MANURE', label: 'Green Manure / Cover Crop' },
  { value: 'MINERAL', label: 'Minerals / Rock Dust' },
  { value: 'FOLIAR', label: 'Foliar Application' },
  { value: 'PELLET', label: 'Pelleted Fertilizer' },
  { value: 'INOCULANT', label: 'Inoculant' },
  { value: 'OTHER', label: 'Other' },
]

const inputBase = 'w-full px-2 py-1 text-xs bg-glomalin-surface border border-glomalin-border text-glomalin-text rounded placeholder:text-glomalin-muted'

export function YearCard({ ent, aphRecords }: { ent: Enterprise; aphRecords: AphRecord[] }) {
  const [open, setOpen] = useState(false)

  // Local copies of mutable event lists — updated optimistically on submit
  const [localFertility, setLocalFertility] = useState<FertilityEvent[]>(ent.fertilityEvents)
  const [localHarvest, setLocalHarvest] = useState<HarvestEvent[]>(ent.harvestEvents)

  // Log Input form
  const [showInputForm, setShowInputForm] = useState(false)
  const [inputType, setInputType] = useState('MANURE')
  const [inputDate, setInputDate] = useState(todayIso)
  const [inputQty, setInputQty] = useState('')
  const [inputUnit, setInputUnit] = useState('tons')
  const [inputNotes, setInputNotes] = useState('')
  const [submittingInput, setSubmittingInput] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  // Log Harvest form
  const [showHarvestForm, setShowHarvestForm] = useState(false)
  const [harvestDate, setHarvestDate] = useState(todayIso)
  const [harvestYield, setHarvestYield] = useState('')
  const [harvestUnit, setHarvestUnit] = useState('bu')
  const [harvestAcres, setHarvestAcres] = useState(ent.plantedAcres.toFixed(1))
  const [harvestMoisture, setHarvestMoisture] = useState('')
  const [harvestNotes, setHarvestNotes] = useState('')
  const [submittingHarvest, setSubmittingHarvest] = useState(false)
  const [harvestError, setHarvestError] = useState<string | null>(null)

  const isImported =
    ent.fieldOperations.some(o => o.dataSource === 'IMPORTED') ||
    localHarvest.some(h => h.dataSource === 'IMPORTED')

  const matchingAph = aphRecords.filter(
    r => r.crop_year === ent.cropYear && r.crop.toLowerCase() === ent.crop.toLowerCase()
  )

  const fertilityByType = localFertility.reduce<Record<string, FertilityEvent[]>>((acc, f) => {
    if (!acc[f.type]) acc[f.type] = []
    acc[f.type].push(f)
    return acc
  }, {})

  async function submitInput(e: React.FormEvent) {
    e.preventDefault()
    if (!inputQty || !inputDate) return
    setSubmittingInput(true)
    setInputError(null)
    try {
      const res = await fetch(`/api/field-history/enterprises/${ent.id}/fertility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: inputType,
          applicationDate: inputDate,
          quantity: parseFloat(inputQty),
          quantityUnit: inputUnit || 'unit',
          notes: inputNotes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const created = await res.json() as FertilityEvent
      setLocalFertility(prev => [...prev, created])
      setInputQty('')
      setInputNotes('')
      setInputDate(todayIso())
      setShowInputForm(false)
    } catch (err) {
      setInputError((err as Error).message)
    } finally {
      setSubmittingInput(false)
    }
  }

  async function submitHarvest(e: React.FormEvent) {
    e.preventDefault()
    if (!harvestDate || !harvestAcres) return
    setSubmittingHarvest(true)
    setHarvestError(null)
    try {
      const res = await fetch(`/api/field-history/enterprises/${ent.id}/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harvestDate,
          acresHarvested: parseFloat(harvestAcres),
          yieldPerAcre: harvestYield ? parseFloat(harvestYield) : null,
          yieldUnit: harvestUnit || null,
          moisturePercent: harvestMoisture ? parseFloat(harvestMoisture) : null,
          notes: harvestNotes || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { harvestEvent: HarvestEvent }
      setLocalHarvest(prev => [...prev, data.harvestEvent])
      setHarvestYield('')
      setHarvestMoisture('')
      setHarvestNotes('')
      setHarvestDate(todayIso())
      setShowHarvestForm(false)
    } catch (err) {
      setHarvestError((err as Error).message)
    } finally {
      setSubmittingHarvest(false)
    }
  }

  return (
    <div className="border border-glomalin-border bg-glomalin-surface rounded overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-glomalin-bg transition-colors text-left"
      >
        <span className="text-sm font-medium text-glomalin-accent w-12 shrink-0">{ent.cropYear}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-glomalin-text">
              {ent.crop}{ent.label ? ` · ${ent.label}` : ''}
            </span>
            {ent.variety && <span className="text-xs text-glomalin-muted">{ent.variety}</span>}
            {isImported && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-glomalin-bg text-glomalin-muted border-glomalin-border">imported</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-glomalin-muted">{ent.plantedAcres.toFixed(1)} ac</span>
            {localHarvest[0]?.yieldPerAcre && (
              <span className="text-xs text-green-400">
                {localHarvest[0].yieldPerAcre.toFixed(1)} {localHarvest[0].yieldUnit ?? 'unit'}/ac
              </span>
            )}
            <span className="text-xs text-glomalin-muted">
              {ent.fieldOperations.length} operation{ent.fieldOperations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <svg className="text-glomalin-muted shrink-0" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1">planting</div>
              <p className="text-xs text-glomalin-text/70 whitespace-pre-wrap">{ent.notes}</p>
            </div>
          )}

          {/* Harvest */}
          <div>
            <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">harvest</div>
            {localHarvest.length > 0 && (
              <div className="space-y-1 mb-2">
                {localHarvest.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted w-24 shrink-0">{h.harvestDate ? formatDate(h.harvestDate) : 'date unknown'}</span>
                    <span className="text-glomalin-text/80">
                      {h.yieldPerAcre != null ? `${h.yieldPerAcre.toFixed(2)} ${h.yieldUnit ?? 'unit'}/ac` : h.notes ?? '—'}
                    </span>
                    {h.notes && h.yieldPerAcre != null && (
                      <span className="text-glomalin-muted truncate max-w-xs">{h.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!showHarvestForm ? (
              <button
                onClick={() => setShowHarvestForm(true)}
                className="text-[10px] text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                + log harvest
              </button>
            ) : (
              <form onSubmit={submitHarvest} className="mt-2 space-y-2 p-3 bg-glomalin-bg border border-glomalin-border rounded">
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-24">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Date *</label>
                    <input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} required className={inputBase} />
                  </div>
                  <div className="flex-1 min-w-20">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Acres *</label>
                    <input type="number" step="0.1" value={harvestAcres} onChange={e => setHarvestAcres(e.target.value)} required className={inputBase} />
                  </div>
                  <div className="flex-1 min-w-20">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Yield/ac</label>
                    <input type="number" step="0.01" value={harvestYield} onChange={e => setHarvestYield(e.target.value)} placeholder="0.00" className={inputBase} />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Unit</label>
                    <input type="text" value={harvestUnit} onChange={e => setHarvestUnit(e.target.value)} placeholder="bu" className={inputBase} />
                  </div>
                  <div className="w-20">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Moisture %</label>
                    <input type="number" step="0.1" value={harvestMoisture} onChange={e => setHarvestMoisture(e.target.value)} placeholder="15.0" className={inputBase} />
                  </div>
                </div>
                <input type="text" value={harvestNotes} onChange={e => setHarvestNotes(e.target.value)} placeholder="Notes (optional)" className={inputBase} />
                {harvestError && <div className="text-xs text-red-400">{harvestError}</div>}
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={submittingHarvest}
                    className="px-3 py-1 text-xs bg-glomalin-accent/20 border border-glomalin-accent/40 text-glomalin-accent rounded hover:bg-glomalin-accent/30 disabled:opacity-50 transition-colors">
                    {submittingHarvest ? 'Saving…' : 'Save harvest'}
                  </button>
                  <button type="button" onClick={() => { setShowHarvestForm(false); setHarvestError(null) }}
                    className="text-xs text-glomalin-muted hover:text-glomalin-text transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Field operations */}
          {ent.fieldOperations.length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">field operations</div>
              <div className="space-y-0.5">
                {ent.fieldOperations.map((op, i) => (
                  <div key={op.id} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted shrink-0 w-5">{i + 1}.</span>
                    {op.operationDate && (
                      <span className="text-glomalin-muted w-24 shrink-0">{formatDate(op.operationDate)}</span>
                    )}
                    <span className="text-[10px] text-glomalin-accent/60 w-16 shrink-0">{opTypeLabel(op.type)}</span>
                    <span className="text-glomalin-text/80">{op.description ?? 'pass'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fertility & inputs */}
          <div>
            <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">fertility &amp; inputs</div>
            {Object.keys(fertilityByType).length > 0 && (
              <div className="space-y-2 mb-2">
                {Object.entries(fertilityByType).map(([type, events]) => (
                  <div key={type}>
                    <div className="text-[10px] text-glomalin-muted mb-0.5 pl-1 border-l border-glomalin-border">{fertilityLabel(type)}</div>
                    {events.map(e => (
                      <div key={e.id} className="text-xs text-glomalin-text/70 pl-3">
                        {e.notes ?? (e.quantityUnit !== 'imported' ? `${e.quantity} ${e.quantityUnit}` : '—')}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {!showInputForm ? (
              <button
                onClick={() => setShowInputForm(true)}
                className="text-[10px] text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                + log input
              </button>
            ) : (
              <form onSubmit={submitInput} className="mt-2 space-y-2 p-3 bg-glomalin-bg border border-glomalin-border rounded">
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-36">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Type *</label>
                    <select value={inputType} onChange={e => setInputType(e.target.value)} className={inputBase}>
                      {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-24">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Date *</label>
                    <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} required className={inputBase} />
                  </div>
                  <div className="flex-1 min-w-20">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Quantity *</label>
                    <input type="number" step="0.1" value={inputQty} onChange={e => setInputQty(e.target.value)} required placeholder="0" className={inputBase} />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] text-glomalin-muted block mb-0.5">Unit</label>
                    <input type="text" value={inputUnit} onChange={e => setInputUnit(e.target.value)} placeholder="tons" className={inputBase} />
                  </div>
                </div>
                <input type="text" value={inputNotes} onChange={e => setInputNotes(e.target.value)} placeholder="Material name / notes (optional)" className={inputBase} />
                {inputError && <div className="text-xs text-red-400">{inputError}</div>}
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={submittingInput}
                    className="px-3 py-1 text-xs bg-glomalin-accent/20 border border-glomalin-accent/40 text-glomalin-accent rounded hover:bg-glomalin-accent/30 disabled:opacity-50 transition-colors">
                    {submittingInput ? 'Saving…' : 'Save input'}
                  </button>
                  <button type="button" onClick={() => { setShowInputForm(false); setInputError(null) }}
                    className="text-xs text-glomalin-muted hover:text-glomalin-text transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* APH yield */}
          {matchingAph.length > 0 && (
            <div>
              <div className="text-[10px] text-glomalin-muted uppercase tracking-wider mb-1.5">APH yield</div>
              <div className="space-y-1">
                {matchingAph.map(record => (
                  <div key={record.crop_year} className="flex items-start gap-2 text-xs">
                    <span className="text-glomalin-muted w-24 shrink-0">{record.crop_year}</span>
                    <span className="text-green-400">{record.actual_yield.toFixed(1)} bu/ac</span>
                    {record.is_disaster_year && <span className="text-amber-400 text-[10px]">disaster yr</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ent.lotNumber && (
            <div className="text-xs text-glomalin-muted">lot: <span className="text-glomalin-text/60">{ent.lotNumber}</span></div>
          )}
        </div>
      )}
    </div>
  )
}
