'use client'

import type { CluRecord, ValidationWarning } from '@/lib/fsa/calc'
import { CluCard } from './clu-card'

interface TractAccordionProps {
  tractKey: string
  tractNumber: string
  records: CluRecord[]
  isExpanded: boolean
  onToggleExpand: () => void
  selectedIds: Set<string>
  expandedId: string | null
  onToggleExpandRecord: (id: string) => void
  onToggleSelect: (id: string) => void
  onSelectAllInTract: (tractRecords: CluRecord[]) => void
  onSave: (updated: CluRecord) => void
  warningsByRecordId: Map<string, ValidationWarning[]>
}

export function TractAccordion({
  tractNumber,
  records,
  isExpanded,
  onToggleExpand,
  selectedIds,
  expandedId,
  onToggleExpandRecord,
  onToggleSelect,
  onSelectAllInTract,
  onSave,
  warningsByRecordId,
}: TractAccordionProps) {
  const allSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id))
  const someSelected = records.some((r) => selectedIds.has(r.id))
  const unreportedCount = records.filter((r) => !r.reported).length

  return (
    <div className="ml-4 border-l border-soil-border">
      {/* Tract header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#141210] transition-colors"
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
            onSelectAllInTract(records)
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select all CLUs in Tract ${tractNumber}`}
        />

        {/* Chevron */}
        <span
          className={`text-soil-muted text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          style={{ display: 'inline-block' }}
        >
          &#9654;
        </span>

        {/* Tract info */}
        <span className="font-mono text-sm text-soil-text">
          Tract {tractNumber}
        </span>

        {/* Record count badge */}
        <span className="font-mono text-xs text-soil-muted bg-[#1a1714] border border-soil-border rounded px-2 py-0.5">
          {records.length} CLU{records.length !== 1 ? 's' : ''}
        </span>

        {/* Unreported badge */}
        {unreportedCount > 0 && (
          <span className="font-mono text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-0.5">
            {unreportedCount} unreported
          </span>
        )}
      </div>

      {/* CLU cards */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {records.map((record) => (
            <CluCard
              key={record.id}
              record={record}
              isExpanded={expandedId === record.id}
              isSelected={selectedIds.has(record.id)}
              warnings={warningsByRecordId.get(record.id) ?? []}
              onToggleExpand={() => onToggleExpandRecord(record.id)}
              onToggleSelect={() => onToggleSelect(record.id)}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </div>
  )
}
