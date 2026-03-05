'use client'

import { useState, useEffect } from 'react'
import type { CluRecord, ValidationWarning } from '@/lib/fsa/calc'
import { CropTypeahead } from './crop-typeahead'

interface CluCardProps {
  record: CluRecord
  isExpanded: boolean
  isSelected: boolean
  warnings: ValidationWarning[]
  onToggleExpand: () => void
  onToggleSelect: () => void
  onSave: (updated: CluRecord) => void
}

type DraftFields = {
  crop: string
  use: string
  grain_plant_date: string
  organic: boolean
}

export function CluCard({
  record,
  isExpanded,
  isSelected,
  warnings,
  onToggleExpand,
  onToggleSelect,
  onSave,
}: CluCardProps) {
  const [draft, setDraft] = useState<DraftFields>({
    crop: record.crop ?? '',
    use: record.use ?? '',
    grain_plant_date: record.grain_plant_date ?? '',
    organic: record.organic,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Re-initialize draft when record changes or card expands
  useEffect(() => {
    if (isExpanded) {
      setDraft({
        crop: record.crop ?? '',
        use: record.use ?? '',
        grain_plant_date: record.grain_plant_date ?? '',
        organic: record.organic,
      })
      setFieldErrors({})
      setSaveError(null)
    }
  }, [isExpanded, record])

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!draft.crop.trim()) {
      errors.crop = 'Crop is required'
    }
    if (draft.grain_plant_date && !/^\d{4}-\d{2}-\d{2}$/.test(draft.grain_plant_date)) {
      errors.grain_plant_date = 'Date must be in YYYY-MM-DD format'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/fsa/clu-records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: draft.crop.trim() || null,
          use: draft.use.trim() || null,
          grain_plant_date: draft.grain_plant_date.trim() || null,
          organic: draft.organic,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(json.error ?? 'Save failed')
        return
      }
      onSave(json.record as CluRecord)
      onToggleExpand()
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft({
      crop: record.crop ?? '',
      use: record.use ?? '',
      grain_plant_date: record.grain_plant_date ?? '',
      organic: record.organic,
    })
    setFieldErrors({})
    setSaveError(null)
    onToggleExpand()
  }

  const displayName = record.field_name ?? `CLU ${record.clu}`
  const errorCount = warnings.filter((w) => w.severity === 'error').length
  const warningCount = warnings.filter((w) => w.severity === 'warning').length
  const totalWarnings = errorCount + warningCount

  return (
    <div
      className={`bg-soil-surface border rounded-lg overflow-hidden transition-all duration-150 ${
        isExpanded
          ? 'border-soil-accent ring-1 ring-soil-accent'
          : 'border-soil-border hover:border-soil-muted'
      }`}
    >
      {/* Collapsed / summary row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          className="w-4 h-4 accent-soil-accent cursor-pointer flex-shrink-0"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${displayName}`}
        />

        {/* Field name + CLU */}
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm text-soil-text truncate block">
            {displayName}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-soil-muted">
              {record.crop ?? <span className="italic text-amber-400">no crop</span>}
            </span>
            {record.use && (
              <span className="font-mono text-xs text-soil-muted">&middot; {record.use}</span>
            )}
            {record.grain_plant_date && (
              <span className="font-mono text-xs text-soil-muted">
                &middot; {record.grain_plant_date}
              </span>
            )}
          </div>
        </div>

        {/* Acres */}
        <span className="font-mono text-xs text-soil-muted flex-shrink-0">
          {(record.fsa_acres || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ac
        </span>

        {/* Organic badge */}
        {record.organic && (
          <span className="font-mono text-xs font-bold text-soil-green bg-soil-green/10 border border-soil-green/30 rounded px-1.5 py-0.5 flex-shrink-0">
            O
          </span>
        )}

        {/* Status badge */}
        {record.reported ? (
          <span className="font-mono text-xs text-soil-green bg-soil-green/10 border border-soil-green/30 rounded px-2 py-0.5 flex-shrink-0">
            Reported
          </span>
        ) : (
          <span className="font-mono text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-0.5 flex-shrink-0">
            Unreported
          </span>
        )}

        {/* Warning badge */}
        {totalWarnings > 0 && (
          <span
            className="font-mono text-xs font-bold text-red-400 bg-red-950/30 border border-red-800/40 rounded px-1.5 py-0.5 flex-shrink-0"
            title={warnings.map((w) => w.message).join('\n')}
          >
            &#9679; {totalWarnings}
          </span>
        )}
      </div>

      {/* Expanded / edit view */}
      {isExpanded && (
        <div className="border-t border-soil-border px-4 py-4 space-y-4">
          {/* Crop */}
          <div>
            <label className="block font-mono text-xs text-soil-muted uppercase tracking-wider mb-1">
              Crop
            </label>
            <CropTypeahead
              value={draft.crop}
              onChange={(v) => setDraft((d) => ({ ...d, crop: v }))}
            />
            {fieldErrors.crop && (
              <p className="font-mono text-xs text-red-400 mt-1">{fieldErrors.crop}</p>
            )}
          </div>

          {/* Practice / Use */}
          <div>
            <label className="block font-mono text-xs text-soil-muted uppercase tracking-wider mb-1">
              Practice / Use
            </label>
            <select
              className="w-full bg-soil-bg border border-soil-border rounded px-3 py-2 font-mono text-sm text-soil-text focus:outline-none focus:border-soil-accent"
              value={draft.use}
              onChange={(e) => setDraft((d) => ({ ...d, use: e.target.value }))}
            >
              <option value="">— select —</option>
              <option value="Non-Irrigated">Non-Irrigated</option>
              <option value="Irrigated">Irrigated</option>
            </select>
          </div>

          {/* Planting date */}
          <div>
            <label className="block font-mono text-xs text-soil-muted uppercase tracking-wider mb-1">
              Planting Date
            </label>
            <input
              type="date"
              className="w-full bg-soil-bg border border-soil-border rounded px-3 py-2 font-mono text-sm text-soil-text focus:outline-none focus:border-soil-accent"
              value={draft.grain_plant_date}
              onChange={(e) => setDraft((d) => ({ ...d, grain_plant_date: e.target.value }))}
            />
            {fieldErrors.grain_plant_date && (
              <p className="font-mono text-xs text-red-400 mt-1">{fieldErrors.grain_plant_date}</p>
            )}
          </div>

          {/* Organic toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`organic-${record.id}`}
              className="w-4 h-4 accent-soil-accent cursor-pointer"
              checked={draft.organic}
              onChange={(e) => setDraft((d) => ({ ...d, organic: e.target.checked }))}
            />
            <label
              htmlFor={`organic-${record.id}`}
              className="font-mono text-sm text-soil-text cursor-pointer"
            >
              Organic
            </label>
          </div>

          {/* Save error */}
          {saveError && (
            <p className="font-mono text-xs text-red-400">{saveError}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="font-mono text-sm font-bold bg-soil-accent text-soil-bg rounded px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="font-mono text-sm text-soil-muted hover:text-soil-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
