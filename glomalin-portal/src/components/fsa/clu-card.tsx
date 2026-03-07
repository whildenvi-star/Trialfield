'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  isPpPromptDismissed?: boolean
  onDismissPpPrompt?: (id: string) => void
}

type DraftFields = {
  crop: string
  use: string
  grain_plant_date: string
  organic: boolean
  prevented_planting: boolean
}

export function CluCard({
  record,
  isExpanded,
  isSelected,
  warnings,
  onToggleExpand,
  onToggleSelect,
  onSave,
  isPpPromptDismissed = false,
  onDismissPpPrompt,
}: CluCardProps) {
  const router = useRouter()
  const [draft, setDraft] = useState<DraftFields>({
    crop: record.crop ?? '',
    use: record.use ?? '',
    grain_plant_date: record.grain_plant_date ?? '',
    organic: record.organic,
    prevented_planting: record.prevented_planting ?? false,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Linked insurance policy state for CLU-to-Policy cross-nav
  const [linkedPolicy, setLinkedPolicy] = useState<{ id: string } | null | undefined>(undefined)
  const [claimCreating, setClaimCreating] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  // Re-initialize draft when record changes or card expands
  useEffect(() => {
    if (isExpanded) {
      setDraft({
        crop: record.crop ?? '',
        use: record.use ?? '',
        grain_plant_date: record.grain_plant_date ?? '',
        organic: record.organic,
        prevented_planting: record.prevented_planting ?? false,
      })
      setFieldErrors({})
      setSaveError(null)
    }
  }, [isExpanded, record])

  // Fetch linked insurance policy when card expands
  useEffect(() => {
    if (!isExpanded) return
    if (!record.crop) {
      setLinkedPolicy(null)
      return
    }
    setLinkedPolicy(undefined) // undefined = loading

    const params = new URLSearchParams({
      farm_number: record.farm_number,
      crop: record.crop ?? '',
      year: String(record.crop_year),
    })

    fetch(`/api/insurance/policies?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        const policies: Array<{ id: string }> = json.policies ?? []
        setLinkedPolicy(policies.length > 0 ? policies[0] : null)
      })
      .catch(() => {
        setLinkedPolicy(null)
      })
  }, [isExpanded, record.farm_number, record.crop, record.crop_year])

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
          prevented_planting: draft.prevented_planting,
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
      prevented_planting: record.prevented_planting ?? false,
    })
    setFieldErrors({})
    setSaveError(null)
    onToggleExpand()
  }

  const handleCreatePreventedPlantingClaim = async () => {
    if (!linkedPolicy) return
    setClaimCreating(true)
    setClaimError(null)
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: linkedPolicy.id,
          date_of_loss: new Date().toISOString().slice(0, 10),
          description: `Prevented Planting - ${record.crop} - Farm ${record.farm_number}`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setClaimError((err as { error?: string }).error ?? 'Failed to create claim')
        return
      }
      router.push('/app/claims')
    } catch {
      setClaimError('Network error — please try again')
    } finally {
      setClaimCreating(false)
    }
  }

  const displayName = record.field_name ?? `CLU ${record.clu}`
  const errorCount = warnings.filter((w) => w.severity === 'error').length
  const warningCount = warnings.filter((w) => w.severity === 'warning').length
  const totalWarnings = errorCount + warningCount

  // Show PP prompt when prevented_planting is true (either from draft or saved record)
  const showPpPrompt =
    (draft.prevented_planting || record.prevented_planting) &&
    !isPpPromptDismissed &&
    isExpanded

  return (
    <div
      className={`bg-glomalin-surface border rounded-lg overflow-hidden transition-all duration-150 ${
        isExpanded
          ? 'border-glomalin-accent ring-1 ring-glomalin-accent'
          : 'border-glomalin-border hover:border-glomalin-muted'
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
          className="w-4 h-4 accent-glomalin-accent cursor-pointer flex-shrink-0"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${displayName}`}
        />

        {/* Field name + CLU */}
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm text-glomalin-text truncate block">
            {displayName}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-glomalin-muted">
              {record.crop ?? <span className="italic text-amber-400">no crop</span>}
            </span>
            {record.use && (
              <span className="font-mono text-xs text-glomalin-muted">&middot; {record.use}</span>
            )}
            {record.grain_plant_date && (
              <span className="font-mono text-xs text-glomalin-muted">
                &middot; {record.grain_plant_date}
              </span>
            )}
          </div>
        </div>

        {/* Acres */}
        <span className="font-mono text-xs text-glomalin-muted flex-shrink-0">
          {(record.fsa_acres || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ac
        </span>

        {/* Organic badge */}
        {record.organic && (
          <span className="font-mono text-xs font-bold text-glomalin-green bg-glomalin-green/10 border border-glomalin-green/30 rounded px-1.5 py-0.5 flex-shrink-0">
            O
          </span>
        )}

        {/* Prevented planting badge */}
        {record.prevented_planting && (
          <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/30 border border-amber-700/50 rounded px-1.5 py-0.5 flex-shrink-0">
            PP
          </span>
        )}

        {/* Status badge */}
        {record.reported ? (
          <span className="font-mono text-xs text-glomalin-green bg-glomalin-green/10 border border-glomalin-green/30 rounded px-2 py-0.5 flex-shrink-0">
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
        <div className="border-t border-glomalin-border px-4 py-4 space-y-4">
          {/* Crop */}
          <div>
            <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
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
            <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
              Practice / Use
            </label>
            <select
              className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
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
            <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
              Planting Date
            </label>
            <input
              type="date"
              className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
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
              className="w-4 h-4 accent-glomalin-accent cursor-pointer"
              checked={draft.organic}
              onChange={(e) => setDraft((d) => ({ ...d, organic: e.target.checked }))}
            />
            <label
              htmlFor={`organic-${record.id}`}
              className="font-mono text-sm text-glomalin-text cursor-pointer"
            >
              Organic
            </label>
          </div>

          {/* Prevented Planting toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`pp-${record.id}`}
              className="w-4 h-4 accent-glomalin-accent cursor-pointer"
              checked={draft.prevented_planting}
              onChange={(e) => setDraft((d) => ({ ...d, prevented_planting: e.target.checked }))}
            />
            <label
              htmlFor={`pp-${record.id}`}
              className="font-mono text-sm text-glomalin-text cursor-pointer"
            >
              Prevented Planting
            </label>
          </div>

          {/* Insurance policy link */}
          <div className="border-t border-glomalin-border pt-3">
            <p className="font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-2">
              Insurance Policy
            </p>
            {linkedPolicy === undefined && (
              <p className="font-mono text-xs text-glomalin-muted">Looking up policy...</p>
            )}
            {linkedPolicy !== undefined && linkedPolicy !== null && (
              <button
                onClick={() => router.push(`/app/insurance?highlight=${linkedPolicy.id}`)}
                className="font-mono text-xs text-glomalin-accent hover:underline underline-offset-2 transition-colors"
              >
                View Insurance Policy &rarr;
              </button>
            )}
            {linkedPolicy === null && (
              <button
                onClick={() =>
                  router.push(
                    `/app/insurance?action=create&farm=${record.farm_number}&crop=${encodeURIComponent(record.crop ?? '')}`
                  )
                }
                className="font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                No policy &mdash; Add one &rarr;
              </button>
            )}
          </div>

          {/* Prevented Planting claim prompt */}
          {showPpPrompt && (
            <div className="rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-3">
              <p className="font-mono text-xs text-amber-300 font-semibold mb-2">
                Prevented Planting detected
              </p>
              {linkedPolicy ? (
                <div className="flex items-center gap-3">
                  <p className="font-mono text-xs text-amber-300 flex-1">
                    A policy is linked. File a prevented planting claim?
                  </p>
                  <button
                    onClick={handleCreatePreventedPlantingClaim}
                    disabled={claimCreating}
                    className="font-mono text-xs font-bold bg-amber-700 text-amber-100 rounded px-3 py-1 hover:bg-amber-600 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {claimCreating ? 'Creating...' : 'Create Claim'}
                  </button>
                  <button
                    onClick={() => onDismissPpPrompt?.(record.id)}
                    className="font-mono text-xs text-amber-500 hover:text-amber-300 transition-colors flex-shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="font-mono text-xs text-amber-300 flex-1">
                    No policy found — add a policy before filing a claim.
                  </p>
                  <button
                    onClick={() =>
                      router.push(
                        `/app/insurance?action=create&farm=${record.farm_number}&crop=${encodeURIComponent(record.crop ?? '')}`
                      )
                    }
                    className="font-mono text-xs font-bold bg-amber-950 border border-amber-700/50 text-amber-300 rounded px-3 py-1 hover:bg-amber-900 transition-colors flex-shrink-0"
                  >
                    Add Policy First
                  </button>
                  <button
                    onClick={() => onDismissPpPrompt?.(record.id)}
                    className="font-mono text-xs text-amber-500 hover:text-amber-300 transition-colors flex-shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {claimError && (
                <p className="font-mono text-xs text-red-400 mt-2">{claimError}</p>
              )}
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <p className="font-mono text-xs text-red-400">{saveError}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="font-mono text-sm text-glomalin-muted hover:text-glomalin-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
