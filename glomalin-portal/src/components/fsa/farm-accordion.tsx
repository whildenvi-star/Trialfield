'use client'

import type { CluRecord, ValidationWarning } from '@/lib/fsa/calc'
import { TractAccordion } from './tract-accordion'

interface FarmAccordionProps {
  farmNumber: string
  farmName: string | null
  tracts: Record<string, CluRecord[]>
  isExpanded: boolean
  onToggleExpand: () => void
  expandedTracts: Set<string>
  onToggleExpandTract: (key: string) => void
  selectedIds: Set<string>
  expandedId: string | null
  onToggleExpandRecord: (id: string) => void
  onToggleSelect: (id: string) => void
  onSelectAllInFarm: (farmRecords: CluRecord[]) => void
  onSelectAllInTract: (tractRecords: CluRecord[]) => void
  onSave: (updated: CluRecord) => void
  warningsByRecordId: Map<string, ValidationWarning[]>
  dismissedPpIds: Set<string>
  onDismissPpPrompt: (id: string) => void
}

export function FarmAccordion({
  farmNumber,
  farmName,
  tracts,
  isExpanded,
  onToggleExpand,
  expandedTracts,
  onToggleExpandTract,
  selectedIds,
  expandedId,
  onToggleExpandRecord,
  onToggleSelect,
  onSelectAllInFarm,
  onSelectAllInTract,
  onSave,
  warningsByRecordId,
  dismissedPpIds,
  onDismissPpPrompt,
}: FarmAccordionProps) {
  const farmRecords = Object.values(tracts).flat()
  const totalAcres = farmRecords.reduce((sum, r) => sum + (r.fsa_acres || 0), 0)
  const allSelected = farmRecords.length > 0 && farmRecords.every((r) => selectedIds.has(r.id))
  const someSelected = farmRecords.some((r) => selectedIds.has(r.id))

  const tractEntries = Object.entries(tracts)

  return (
    <div className="bg-soil-surface border border-soil-border rounded-lg overflow-hidden">
      {/* Farm header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#141210] transition-colors"
        onClick={onToggleExpand}
      >
        {/* Select All checkbox */}
        <input
          type="checkbox"
          className="w-4 h-4 accent-soil-accent cursor-pointer flex-shrink-0"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = !allSelected && someSelected
          }}
          onChange={(e) => {
            e.stopPropagation()
            onSelectAllInFarm(farmRecords)
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select all CLUs in Farm ${farmNumber}`}
        />

        {/* Chevron */}
        <span
          className={`text-soil-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          style={{ display: 'inline-block' }}
        >
          &#9654;
        </span>

        {/* Farm info */}
        <div className="flex-1 min-w-0">
          <span className="font-mono font-bold text-soil-accent text-sm">
            Farm {farmNumber}
          </span>
          {farmName && (
            <span className="font-mono text-soil-muted text-sm ml-2">
              {farmName}
            </span>
          )}
        </div>

        {/* Acres badge */}
        <span className="font-mono text-xs text-soil-muted bg-[#1a1714] border border-soil-border rounded px-2 py-0.5">
          {totalAcres.toLocaleString('en-US', { maximumFractionDigits: 2 })} ac
        </span>

        {/* Tract count badge */}
        <span className="font-mono text-xs text-soil-muted">
          {tractEntries.length} tract{tractEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tract accordions */}
      {isExpanded && (
        <div className="border-t border-soil-border">
          {tractEntries.map(([tractNumber, tractRecords]) => {
            const tractKey = `${farmNumber}-${tractNumber}`
            return (
              <TractAccordion
                key={tractKey}
                tractKey={tractKey}
                tractNumber={tractNumber}
                records={tractRecords}
                isExpanded={expandedTracts.has(tractKey)}
                onToggleExpand={() => onToggleExpandTract(tractKey)}
                selectedIds={selectedIds}
                expandedId={expandedId}
                onToggleExpandRecord={onToggleExpandRecord}
                onToggleSelect={onToggleSelect}
                onSelectAllInTract={onSelectAllInTract}
                onSave={onSave}
                warningsByRecordId={warningsByRecordId}
                dismissedPpIds={dismissedPpIds}
                onDismissPpPrompt={onDismissPpPrompt}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
