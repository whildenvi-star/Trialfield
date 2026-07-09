'use client'

import { useState } from 'react'
import { INTENDED_USE_VALUES } from '@/lib/fsa/calc'
import { CropTypeahead } from './crop-typeahead'
import { ConfirmDialog } from './confirm-dialog'

/** Fields a batch apply may set. Only keys the user actually filled in are included. */
export interface BatchEditFields {
  crop?: string
  registry_crop_id?: string
  irrigated?: boolean
  intended_use?: string
  grain_plant_date?: string
}

interface MapBatchEditBarProps {
  selectedCount: number
  busy: boolean
  onApply: (fields: BatchEditFields) => void
  onClear: () => void
}

export function MapBatchEditBar({ selectedCount, busy, onApply, onClear }: MapBatchEditBarProps) {
  const [crop, setCrop] = useState('')
  const [registryCropId, setRegistryCropId] = useState('')
  const [irrigated, setIrrigated] = useState('')       // '' | 'true' | 'false'
  const [intendedUse, setIntendedUse] = useState('')   // '' | grain | forage | seed | silage
  const [plantDate, setPlantDate] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const buildFields = (): BatchEditFields => {
    const fields: BatchEditFields = {}
    if (crop.trim()) {
      fields.crop = crop.trim()
      if (registryCropId) fields.registry_crop_id = registryCropId
    }
    if (irrigated) fields.irrigated = irrigated === 'true'
    if (intendedUse) fields.intended_use = intendedUse
    if (plantDate) fields.grain_plant_date = plantDate
    return fields
  }

  const fieldCount = Object.keys(buildFields()).filter((k) => k !== 'registry_crop_id').length
  const canApply = !busy && selectedCount > 0 && fieldCount > 0

  const summarize = (): string => {
    const parts: string[] = []
    if (crop.trim()) parts.push(`crop → ${crop.trim()}`)
    if (irrigated) parts.push(irrigated === 'true' ? 'irrigated' : 'non-irrigated')
    if (intendedUse) parts.push(`use → ${intendedUse}`)
    if (plantDate) parts.push(`planted ${plantDate}`)
    return parts.join(', ')
  }

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          open={true}
          title="Apply Batch Edit"
          message={`Set ${summarize()} on ${selectedCount} CLU${selectedCount !== 1 ? 's' : ''}? Unset fields are left unchanged.`}
          onConfirm={() => {
            setShowConfirm(false)
            onApply(buildFields())
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="w-72 rounded border border-glomalin-accent/60 bg-glomalin-surface/95 backdrop-blur shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-glomalin-border">
          <span className="font-mono text-xs font-bold text-glomalin-accent">
            {selectedCount} CLU{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClear}
            className="font-mono text-[10px] text-glomalin-muted hover:text-glomalin-text transition-colors"
          >
            Clear selection
          </button>
        </div>

        <div className="px-3 py-2.5 space-y-2.5">
          <div>
            <label className="block text-[10px] font-mono text-glomalin-muted uppercase tracking-wide mb-1">Crop</label>
            <CropTypeahead
              value={crop}
              onChange={(v, id) => {
                setCrop(v)
                if (id !== undefined) setRegistryCropId(id)
                else if (!v) setRegistryCropId('')
              }}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-glomalin-muted uppercase tracking-wide mb-1">Practice</label>
              <select
                value={irrigated}
                onChange={(e) => setIrrigated(e.target.value)}
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
              >
                <option value="">— no change —</option>
                <option value="false">Non-Irrigated</option>
                <option value="true">Irrigated</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-glomalin-muted uppercase tracking-wide mb-1">Intended Use</label>
              <select
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
              >
                <option value="">— no change —</option>
                {INTENDED_USE_VALUES.map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-glomalin-muted uppercase tracking-wide mb-1">Planting Date</label>
            <input
              type="date"
              value={plantDate}
              onChange={(e) => setPlantDate(e.target.value)}
              className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
            />
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canApply}
            className="w-full px-3 py-2 rounded bg-glomalin-accent text-black font-mono text-xs font-semibold hover:bg-glomalin-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Applying…' : `Apply to ${selectedCount} CLU${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}
