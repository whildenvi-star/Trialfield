'use client'

import type { TimelineSource } from '@/lib/timeline/types'

interface TimelineFiltersProps {
  sources: TimelineSource[]
  activeSources: Set<TimelineSource>
  onToggleSource: (s: TimelineSource) => void
  year: number
  onYearChange: (y: number) => void
  availableYears: number[]
  sourceLoading: Record<TimelineSource, boolean>
  totalCount: number
  plannedCount: number
  lastActivityDate: string | null
}

const SOURCE_LABELS: Record<TimelineSource, string> = {
  budget: 'Budget',
  cert: 'Organic',
  fieldops: 'FieldOps',
  grain: 'Grain',
}

const SOURCE_COLORS: Record<TimelineSource, string> = {
  budget: '#C8860A',
  cert: '#7A9E7E',
  fieldops: '#6A8CAF',
  grain: '#B87333',
}

function SmallSpinner() {
  return (
    <span
      className="inline-block w-3 h-3 border border-current rounded-full animate-spin ml-1"
      style={{ borderTopColor: 'transparent' }}
      aria-label="loading"
    />
  )
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return 'None'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'None'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TimelineFilters({
  sources,
  activeSources,
  onToggleSource,
  year,
  onYearChange,
  availableYears,
  sourceLoading,
  totalCount,
  plannedCount,
  lastActivityDate,
}: TimelineFiltersProps) {
  return (
    <div className="flex flex-col gap-3 p-4 border-b border-glomalin-border bg-glomalin-surface">
      {/* Row 1: Source toggle chips + year selector */}
      <div className="flex flex-wrap items-center gap-2">
        {sources.map((source) => {
          const isActive = activeSources.has(source)
          const isLoading = sourceLoading[source]
          const color = SOURCE_COLORS[source]

          return (
            <button
              key={source}
              onClick={() => onToggleSource(source)}
              className="relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
              style={{
                backgroundColor: isActive ? color : 'transparent',
                color: isActive ? '#080604' : color,
                border: `1px solid ${color}`,
                opacity: isActive ? 1 : 0.55,
              }}
              aria-pressed={isActive}
              title={isLoading ? `Loading ${SOURCE_LABELS[source]}...` : SOURCE_LABELS[source]}
            >
              {SOURCE_LABELS[source]}
              {isLoading && <SmallSpinner />}
            </button>
          )
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Year selector */}
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="bg-glomalin-bg border border-glomalin-border text-glomalin-text text-xs font-mono rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Summary stats */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-glomalin-muted">
        <span>
          <span className="text-glomalin-text font-semibold">{totalCount}</span> activities
        </span>
        {plannedCount > 0 && (
          <span>
            <span className="text-glomalin-accent font-semibold">{plannedCount}</span> planned pending
          </span>
        )}
        <span>
          Last activity:{' '}
          <span className="text-glomalin-text">{fmtDate(lastActivityDate)}</span>
        </span>
      </div>
    </div>
  )
}
