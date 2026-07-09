'use client'

import { useState, useEffect } from 'react'
import { INTENDED_USE_VALUES } from '@/lib/fsa/calc'

export type ReportingStatus = 'orange' | 'yellow' | 'green'

export interface CluMapProperties {
  id: string
  farm_number: string
  tract_number: string
  clu: string
  field_name: string | null
  farm_name: string | null
  registry_field_id: string | null
  crop: string | null
  grain_plant_date: string | null
  fsa_acres: number
  reported: boolean
  organic: boolean
  irrigated: boolean
  intended_use: string | null
  prevented_planting: boolean
  status: ReportingStatus
}

export interface CluAnomalyResult {
  clu_record_id: string
  farm_number: string
  tract_number: string
  clu_label: string
  field_name: string | null
  fsa_acres: number
  zone_count: number
  zone_names: string[]
  zone_crops: string[]
  zone_organics: boolean[]
  intersection_acs: number[]
}

interface ReportingCluPanelProps {
  clu: CluMapProperties
  onClose: () => void
  onRecordUpdated: (updated: Partial<CluMapProperties> & { id: string }) => void
  onNavigateNext?: () => void
  anomalyData?: CluAnomalyResult
}

const statusConfig: Record<ReportingStatus, { label: string; className: string }> = {
  orange: { label: 'Undeclared', className: 'text-orange-400 bg-orange-950 border border-orange-800' },
  yellow: { label: 'Entered',    className: 'text-yellow-400 bg-yellow-950 border border-yellow-800' },
  green:  { label: 'Reported',   className: 'text-green-400  bg-green-950  border border-green-800'  },
}

export function ReportingCluPanel({ clu, onClose, onRecordUpdated, onNavigateNext, anomalyData }: ReportingCluPanelProps) {
  const [crop, setCrop] = useState(clu.crop ?? '')
  const [plantDate, setPlantDate] = useState(clu.grain_plant_date ?? '')
  const [organic, setOrganic] = useState(clu.organic)
  const [irrigated, setIrrigated] = useState(clu.irrigated)
  const [intendedUse, setIntendedUse] = useState(clu.intended_use ?? '')
  const [cropChoices, setCropChoices] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/fsa/crop-choices')
      .then((r) => r.json())
      .then((d) => setCropChoices(d.crops ?? []))
      .catch(() => {})
  }, [])
  const [reporting, setReporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sc = statusConfig[clu.status]

  async function patchRecord(payload: Record<string, unknown>): Promise<boolean> {
    setError(null)
    const res = await fetch(`/api/fsa/clu-records/${clu.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Save failed')
      return false
    }
    return true
  }

  async function handleSave() {
    setSaving(true)
    const ok = await patchRecord({
      crop: crop.trim() || null,
      grain_plant_date: plantDate || null,
      organic,
      irrigated,
      intended_use: intendedUse || null,
    })
    if (ok) {
      onRecordUpdated({ id: clu.id, crop: crop.trim() || null, grain_plant_date: plantDate || null, organic, irrigated, intended_use: intendedUse || null })
    }
    setSaving(false)
  }

  async function handleMarkReported() {
    setReporting(true)
    const ok = await patchRecord({ reported: true })
    if (ok) {
      onRecordUpdated({ id: clu.id, reported: true })
    }
    setReporting(false)
  }

  async function handleMarkUnreported() {
    setReporting(true)
    const ok = await patchRecord({ reported: false })
    if (ok) {
      onRecordUpdated({ id: clu.id, reported: false })
    }
    setReporting(false)
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-glomalin-surface border-l border-glomalin-border flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-glomalin-border shrink-0">
        <div>
          <p className="font-mono text-xs text-glomalin-muted">
            Farm {clu.farm_number} / T{clu.tract_number} / CLU {clu.clu}
          </p>
          <p className="font-mono text-sm text-glomalin-text mt-0.5">
            {clu.field_name ?? clu.farm_name ?? 'Unnamed'}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${sc.className}`}>
              {sc.label}
            </span>
            <span className="text-xs font-mono text-glomalin-muted">
              {clu.fsa_acres} ac
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-glomalin-muted hover:text-glomalin-text font-mono text-lg leading-none mt-0.5 ml-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-xs font-mono text-glomalin-muted mb-1">Crop</label>
          <input
            type="text"
            list="clu-crop-choices"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="e.g. Corn"
            className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 text-sm font-mono text-glomalin-text placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent"
          />
          <datalist id="clu-crop-choices">
            {cropChoices.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-mono text-glomalin-muted mb-1">Planting Date</label>
          <input
            type="date"
            value={plantDate}
            onChange={(e) => setPlantDate(e.target.value)}
            className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 text-sm font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-glomalin-muted mb-1">Intended Use</label>
          <select
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value)}
            className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 text-sm font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
          >
            <option value="">—</option>
            {INTENDED_USE_VALUES.map((v) => (
              <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              id="organic-check"
              type="checkbox"
              checked={organic}
              onChange={(e) => setOrganic(e.target.checked)}
              className="accent-glomalin-accent"
            />
            <label htmlFor="organic-check" className="text-sm font-mono text-glomalin-text cursor-pointer">
              Organic
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="irrigated-check"
              type="checkbox"
              checked={irrigated}
              onChange={(e) => setIrrigated(e.target.checked)}
              className="accent-glomalin-accent"
            />
            <label htmlFor="irrigated-check" className="text-sm font-mono text-glomalin-text cursor-pointer">
              Irrigated
            </label>
          </div>
        </div>

        {anomalyData && (
          <div className="rounded border border-red-800 bg-red-950/20 px-3 py-2.5 space-y-2">
            <p className="text-xs font-mono text-red-400 font-semibold">⚠ Split Recommended</p>
            <p className="text-[10px] font-mono text-glomalin-muted">
              This CLU crosses {anomalyData.zone_count} zones with different attributes.
            </p>
            {anomalyData.zone_names.map((name, i) => (
              <div key={name} className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-glomalin-text truncate mr-2">{name}</span>
                <span className="text-glomalin-muted shrink-0">
                  {anomalyData.zone_crops[i] ?? '(none)'}
                  {anomalyData.zone_organics[i] ? ' · Org' : ''}
                  {' · '}{anomalyData.intersection_acs[i]} ac
                </span>
              </div>
            ))}
            <p className="text-[10px] font-mono text-glomalin-muted/60 pt-1 border-t border-glomalin-border/50">
              Suggested:{' '}
              {anomalyData.zone_names.map((_, i) => {
                const suffix = String.fromCharCode(65 + i)
                return `CLU ${clu.clu}${suffix} (${anomalyData.intersection_acs[i]} ac)`
              }).join(', ')}. Actual split requires FSA office action.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs font-mono text-red-400">{error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-glomalin-border space-y-2 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || reporting}
          className="w-full px-4 py-2 rounded bg-glomalin-accent text-black font-mono text-sm font-semibold hover:bg-glomalin-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {!clu.reported && (
          <button
            onClick={handleMarkReported}
            disabled={saving || reporting}
            className="w-full px-4 py-2 rounded border border-green-700 text-green-400 font-mono text-sm hover:bg-green-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {reporting ? 'Marking…' : 'Mark Reported'}
          </button>
        )}
        {clu.reported && (
          <button
            onClick={handleMarkUnreported}
            disabled={saving || reporting}
            className="w-full px-4 py-2 rounded border border-glomalin-danger text-glomalin-danger font-mono text-sm hover:bg-glomalin-danger/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {reporting ? 'Undoing…' : '↩ Undo Report'}
          </button>
        )}
        {onNavigateNext && (
          <button
            onClick={onNavigateNext}
            className="w-full px-4 py-1.5 rounded border border-glomalin-border text-glomalin-muted font-mono text-xs hover:text-glomalin-text transition-colors"
          >
            Next Unreported →
          </button>
        )}
      </div>
    </div>
  )
}
