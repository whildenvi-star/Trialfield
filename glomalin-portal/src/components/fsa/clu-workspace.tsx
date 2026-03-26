'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { CluRecord, ValidationWarning } from '@/lib/fsa/calc'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { FarmAccordion } from './farm-accordion'
import { BulkActionBar } from './bulk-action-bar'

// CRITICAL: ssr: false required — @react-pdf/renderer crashes Next.js App Router SSR
// with "Component is not a constructor" if imported server-side.
const AcreagePdfButton = dynamic(
  () =>
    import('@/components/fsa/acreage-pdf-button').then((mod) => ({
      default: mod.AcreagePdfButton,
    })),
  {
    ssr: false,
    loading: () => (
      <span className="text-glomalin-muted font-mono text-sm">Loading PDF...</span>
    ),
  }
)

// CSV export — full data dump of all CLU record fields including IDs, timestamps, and validation flags
const CSV_HEADERS = [
  'id',
  'legacy_id',
  'farm_number',
  'tract_number',
  'clu',
  'field_name',
  'farm_name',
  'fsa_acres',
  'crop',
  'irrigated',
  'organic',
  'double_crop',
  'cover_crop',
  'grain_plant_date',
  'use',
  'reported',
  'aph',
  'tillage_2024',
  'tillage_2025',
  'cc_2024',
  'cc_2025',
  'nt_adoption_2024',
  'nt_adoption_2025',
  'cc_adoption_2024',
  'cc_adoption_2025',
  'unit_number',
  'line_number',
  'policy_number',
  'crop_year',
] as const

function escapeCell(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  // If the value contains commas, quotes, or newlines, wrap in double quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportCsv(records: CluRecord[]) {
  const headerRow = CSV_HEADERS.join(',')
  const dataRows = records.map((r) =>
    CSV_HEADERS.map((h) => escapeCell(r[h as keyof CluRecord])).join(',')
  )
  const csv = [headerRow, ...dataRows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `clu-records-2026-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

interface CluWorkspaceProps {
  initialRecords: CluRecord[]
  loadError: string | null
}

// Group records: farm_number → tract_number → CluRecord[]
function groupByFarmTract(
  records: CluRecord[]
): Record<string, Record<string, CluRecord[]>> {
  const grouped: Record<string, Record<string, CluRecord[]>> = {}
  for (const record of records) {
    const farm = record.farm_number || 'Unknown'
    const tract = record.tract_number || 'Unknown'
    if (!grouped[farm]) grouped[farm] = {}
    if (!grouped[farm][tract]) grouped[farm][tract] = []
    grouped[farm][tract].push(record)
  }
  return grouped
}

type AddCluDraft = {
  farm_number: string
  tract_number: string
  clu: string
  field_name: string
  fsa_acres: string
  crop: string
}

const EMPTY_ADD_DRAFT: AddCluDraft = {
  farm_number: '',
  tract_number: '',
  clu: '',
  field_name: '',
  fsa_acres: '',
  crop: '',
}

export function CluWorkspace({ initialRecords, loadError }: CluWorkspaceProps) {
  const [records, setRecords] = useState<CluRecord[]>(initialRecords)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<ValidationWarning[]>([])
  // Track dismissed prevented planting prompt IDs — persists within a session across card expand/collapse
  const [dismissedPpIds, setDismissedPpIds] = useState<Set<string>>(new Set())
  // Add CLU form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDraft, setAddDraft] = useState<AddCluDraft>(EMPTY_ADD_DRAFT)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Smart defaults: farms/tracts with any unreported CLU start expanded
  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(() => {
    const farms = new Set<string>()
    for (const r of initialRecords) {
      if (!r.reported) farms.add(r.farm_number || 'Unknown')
    }
    return farms
  })

  const [expandedTracts, setExpandedTracts] = useState<Set<string>>(() => {
    const tracts = new Set<string>()
    for (const r of initialRecords) {
      if (!r.reported) {
        const key = `${r.farm_number || 'Unknown'}-${r.tract_number || 'Unknown'}`
        tracts.add(key)
      }
    }
    return tracts
  })

  // Fetch validation warnings on mount (non-blocking)
  useEffect(() => {
    fetch('/api/fsa/validation')
      .then((res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((json) => {
        if (json && Array.isArray(json.warnings)) {
          setWarnings(json.warnings)
        }
      })
      .catch(() => {
        // Warnings are non-blocking — silently ignore fetch errors
      })
  }, [])

  const grouped = useMemo(() => groupByFarmTract(records), [records])

  // Build warningsByRecordId — warnings keyed by CLU record id
  // ValidationWarning type doesn't have a per-record id field; warnings are aggregate.
  // We store the full warnings array indexed by type for use in card-level display.
  const warningsByRecordId = useMemo(() => {
    // For now, map warnings by their filter criteria to matching record ids
    const map = new Map<string, ValidationWarning[]>()
    for (const warning of warnings) {
      // missing-crop: apply to all records with no crop
      if (warning.type === 'missing-crop') {
        for (const r of records) {
          if (!r.crop || !r.crop.trim()) {
            const existing = map.get(r.id) ?? []
            map.set(r.id, [...existing, warning])
          }
        }
      }
      // missing-date: apply to records with crop but no planting date
      if (warning.type === 'missing-date') {
        for (const r of records) {
          if (r.crop && r.crop.trim() && (!r.grain_plant_date || !r.grain_plant_date.trim())) {
            const existing = map.get(r.id) ?? []
            map.set(r.id, [...existing, warning])
          }
        }
      }
      // unreported: apply to unreported records
      if (warning.type === 'unreported') {
        for (const r of records) {
          if (!r.reported) {
            const existing = map.get(r.id) ?? []
            map.set(r.id, [...existing, warning])
          }
        }
      }
    }
    return map
  }, [warnings, records])

  const handleSaveRecord = (updated: CluRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (expandedId === id) setExpandedId(null)
  }

  const handleAddRecord = async () => {
    setAddError(null)
    if (!addDraft.farm_number.trim() || !addDraft.tract_number.trim() || !addDraft.clu.trim()) {
      setAddError('Farm, tract, and CLU are required')
      return
    }
    const acres = parseFloat(addDraft.fsa_acres)
    if (!addDraft.fsa_acres.trim() || isNaN(acres) || acres <= 0) {
      setAddError('Acres must be a positive number')
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/fsa/clu-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_number: addDraft.farm_number.trim(),
          tract_number: addDraft.tract_number.trim(),
          clu: addDraft.clu.trim(),
          field_name: addDraft.field_name.trim() || null,
          fsa_acres: acres,
          crop: addDraft.crop.trim() || null,
          crop_year: CURRENT_CROP_YEAR,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAddError(json.error ?? 'Failed to create record')
        return
      }
      setRecords((prev) => [...prev, json.record as CluRecord])
      setAddDraft(EMPTY_ADD_DRAFT)
      setShowAddForm(false)
      // Expand the farm/tract so the new record is visible
      const farmKey = addDraft.farm_number.trim()
      const tractKey = `${farmKey}-${addDraft.tract_number.trim()}`
      setExpandedFarms((prev) => new Set(prev).add(farmKey))
      setExpandedTracts((prev) => new Set(prev).add(tractKey))
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAdding(false)
    }
  }

  const handleDismissPpPrompt = (id: string) => {
    setDismissedPpIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const handleBulkAction = async (
    action: 'mark-reported' | 'mark-unreported' | 'assign-crop',
    crop?: string
  ) => {
    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/fsa/clu-records/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, crop }),
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.records) {
        const updatedMap = new Map<string, CluRecord>()
        for (const r of json.records as CluRecord[]) {
          updatedMap.set(r.id, r)
        }
        setRecords((prev) => prev.map((r) => updatedMap.get(r.id) ?? r))
      }
      setSelectedIds(new Set())
    } catch {
      // Silently fail — user can retry
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllInTract = (tractRecords: CluRecord[]) => {
    const ids = tractRecords.map((r) => r.id)
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }

  const handleSelectAllInFarm = (farmRecords: CluRecord[]) => {
    const ids = farmRecords.map((r) => r.id)
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }

  const handleToggleExpandFarm = (farmKey: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev)
      if (next.has(farmKey)) next.delete(farmKey)
      else next.add(farmKey)
      return next
    })
  }

  const handleToggleExpandTract = (tractKey: string) => {
    setExpandedTracts((prev) => {
      const next = new Set(prev)
      if (next.has(tractKey)) next.delete(tractKey)
      else next.add(tractKey)
      return next
    })
  }

  const farmEntries = Object.entries(grouped)

  return (
    <div className={selectedIds.size > 0 ? 'pb-20' : ''}>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-glomalin-text tracking-wide">
            FSA Acreage Reporting
          </h1>
          <p className="text-glomalin-muted font-mono text-sm mt-2">
            {records.length.toLocaleString()} CLU records &middot; Crop year 2026
          </p>
        </div>
        {/* Action buttons — always visible top-right of page header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v)
              setAddError(null)
              setAddDraft(EMPTY_ADD_DRAFT)
            }}
            className="bg-glomalin-accent text-glomalin-bg px-4 py-2 rounded font-mono text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {showAddForm ? 'Cancel' : 'Add CLU'}
          </button>
          <AcreagePdfButton records={records} />
          <button
            type="button"
            onClick={() => exportCsv(records)}
            className="bg-glomalin-surface border border-glomalin-border text-glomalin-text px-4 py-2 rounded font-mono text-sm hover:border-glomalin-accent"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="bg-glomalin-surface border border-red-800 rounded-lg px-4 py-3 mb-6 font-mono text-sm text-red-400">
          Failed to load CLU records: {loadError}
        </div>
      )}

      {/* Add CLU form */}
      {showAddForm && (
        <div className="bg-glomalin-surface border border-glomalin-accent rounded-lg px-4 py-4 mb-6 space-y-3">
          <h2 className="font-mono font-bold text-sm text-glomalin-text">New CLU Record</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                Farm #
              </label>
              <input
                type="text"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.farm_number}
                onChange={(e) => setAddDraft((d) => ({ ...d, farm_number: e.target.value }))}
                placeholder="e.g. 1234"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                Tract #
              </label>
              <input
                type="text"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.tract_number}
                onChange={(e) => setAddDraft((d) => ({ ...d, tract_number: e.target.value }))}
                placeholder="e.g. 5678"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                CLU
              </label>
              <input
                type="text"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.clu}
                onChange={(e) => setAddDraft((d) => ({ ...d, clu: e.target.value }))}
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                Field Name
              </label>
              <input
                type="text"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.field_name}
                onChange={(e) => setAddDraft((d) => ({ ...d, field_name: e.target.value }))}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                FSA Acres
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.fsa_acres}
                onChange={(e) => setAddDraft((d) => ({ ...d, fsa_acres: e.target.value }))}
                placeholder="e.g. 80.5"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-glomalin-muted uppercase tracking-wider mb-1">
                Crop
              </label>
              <input
                type="text"
                className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                value={addDraft.crop}
                onChange={(e) => setAddDraft((d) => ({ ...d, crop: e.target.value }))}
                placeholder="optional"
              />
            </div>
          </div>
          {addError && (
            <p className="font-mono text-xs text-red-400">{addError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddRecord}
              disabled={adding}
              className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {adding ? 'Adding...' : 'Add Record'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setAddError(null)
                setAddDraft(EMPTY_ADD_DRAFT)
              }}
              disabled={adding}
              className="font-mono text-sm text-glomalin-muted hover:text-glomalin-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Farm accordions */}
      <div className="space-y-3">
        {farmEntries.map(([farmNumber, tracts]) => {
          const farmRecords = Object.values(tracts).flat()
          return (
            <FarmAccordion
              key={farmNumber}
              farmNumber={farmNumber}
              farmName={farmRecords[0]?.farm_name ?? null}
              tracts={tracts}
              isExpanded={expandedFarms.has(farmNumber)}
              onToggleExpand={() => handleToggleExpandFarm(farmNumber)}
              expandedTracts={expandedTracts}
              onToggleExpandTract={handleToggleExpandTract}
              selectedIds={selectedIds}
              expandedId={expandedId}
              onToggleExpandRecord={(id) =>
                setExpandedId((prev) => (prev === id ? null : id))
              }
              onToggleSelect={handleToggleSelect}
              onSelectAllInFarm={handleSelectAllInFarm}
              onSelectAllInTract={handleSelectAllInTract}
              onSave={handleSaveRecord}
              onDelete={handleDeleteRecord}
              warningsByRecordId={warningsByRecordId}
              dismissedPpIds={dismissedPpIds}
              onDismissPpPrompt={handleDismissPpPrompt}
            />
          )
        })}
      </div>

      {/* Sticky bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onAction={handleBulkAction}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  )
}
