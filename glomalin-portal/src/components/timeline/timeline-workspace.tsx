'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { TimelineEntry, TimelineSource, SingleSourceResponse } from '@/lib/timeline/types'
import { TimelineFilters } from './timeline-filters'
import { TimelineEntryCard } from './timeline-entry-card'
import { TimelineExport } from './timeline-export'

const ALL_SOURCES: TimelineSource[] = ['budget', 'cert', 'fieldops', 'grain', 'observation', 'claim']

export const SOURCE_COLORS: Record<TimelineSource, string> = {
  budget: '#C8860A',
  cert: '#7A9E7E',
  fieldops: '#6A8CAF',
  grain: '#B87333',
  observation: '#14b8a6',
  claim: '#a78bfa',
}

/** Sort entries by sortDate ascending, then by source priority (cert before budget for same date). */
const SOURCE_PRIORITY: Record<TimelineSource, number> = {
  cert: 0,
  fieldops: 1,
  budget: 2,
  grain: 3,
  observation: 4,
  claim: 5,
}

function sortByDate(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.sortDate < b.sortDate) return -1
    if (a.sortDate > b.sortDate) return 1
    return (SOURCE_PRIORITY[a.source] ?? 99) - (SOURCE_PRIORITY[b.source] ?? 99)
  })
}

function daysBetween(dateA: string | null, dateB: string | null): number {
  if (!dateA || !dateB || dateA === '9999-12-31' || dateB === '9999-12-31') return 0
  const a = new Date(dateA + 'T00:00:00').getTime()
  const b = new Date(dateB + 'T00:00:00').getTime()
  return Math.abs((b - a) / (1000 * 60 * 60 * 24))
}

function fmtDateLabel(dateStr: string | null): string {
  if (!dateStr || dateStr === '9999-12-31') return 'Unscheduled'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SkeletonCard() {
  return (
    <div className="border border-glomalin-border rounded overflow-hidden" style={{ borderLeftWidth: '4px', borderLeftColor: '#2a2218' }}>
      <div className="flex items-center gap-3 px-4 py-3 bg-glomalin-surface">
        <div className="w-16 h-4 bg-glomalin-border rounded animate-pulse" />
        <div className="w-14 h-4 bg-glomalin-border rounded animate-pulse" />
        <div className="w-20 h-4 bg-glomalin-border rounded animate-pulse" />
        <div className="flex-1 h-4 bg-glomalin-border rounded animate-pulse" />
      </div>
    </div>
  )
}

interface TimelineWorkspaceProps {
  fieldId: string
  fieldName: string
}

export function TimelineWorkspace({ fieldId, fieldName }: TimelineWorkspaceProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [sourceLoading, setSourceLoading] = useState<Record<TimelineSource, boolean>>({
    budget: false,
    cert: false,
    fieldops: false,
    grain: false,
    observation: false,
    claim: false,
  })
  const [activeSources, setActiveSources] = useState<Set<TimelineSource>>(
    new Set(ALL_SOURCES)
  )
  const [year, setYear] = useState<number>(CURRENT_CROP_YEAR)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Abort controller ref — cancelled when fieldId or year changes
  const abortRef = useRef<AbortController | null>(null)

  const loadTimeline = useCallback(() => {
    // Abort any in-flight fetches from previous fieldId/year
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    // Reset state
    setEntries([])
    setWarnings([])
    setExpandedIds(new Set())
    setSourceLoading({ budget: true, cert: true, fieldops: true, grain: true, observation: true, claim: true })

    // Fire independent parallel fetches per source — each resolves/fails independently
    ALL_SOURCES.forEach((source) => {
      fetch(`/api/timeline/${fieldId}/${source}?year=${year}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: SingleSourceResponse) => {
          if (data.error) {
            setWarnings((prev) =>
              prev.includes(`${source}: ${data.error}`) ? prev : [...prev, `${source}: ${data.error}`]
            )
          } else {
            setEntries((prev) => sortByDate([...prev, ...data.entries]))
          }
          setSourceLoading((prev) => ({ ...prev, [source]: false }))
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return
          setWarnings((prev) => {
            const msg = `${source}: network error`
            return prev.includes(msg) ? prev : [...prev, msg]
          })
          setSourceLoading((prev) => ({ ...prev, [source]: false }))
        })
    })
  }, [fieldId, year])

  useEffect(() => {
    loadTimeline()
    return () => {
      abortRef.current?.abort()
    }
  }, [loadTimeline])

  const isAnyLoading = ALL_SOURCES.some((s) => sourceLoading[s])

  // Build pairedMap after all sources resolve
  const pairedMap = new Map<string, TimelineEntry>()
  if (!isAnyLoading) {
    const entryById = new Map(entries.map((e) => [e.id, e]))
    for (const entry of entries) {
      if (entry.pairedWith) {
        const paired = entryById.get(entry.pairedWith)
        if (paired) {
          pairedMap.set(entry.id, paired)
          pairedMap.set(paired.id, entry)
        }
      }
    }
  }

  // Filtered entries
  const filteredEntries = entries.filter((e) => activeSources.has(e.source))

  // Available years
  const availableYears = [CURRENT_CROP_YEAR - 2, CURRENT_CROP_YEAR - 1, CURRENT_CROP_YEAR]

  // Summary stats
  const plannedCount = filteredEntries.filter((e) => e.status === 'planned').length
  const lastActivityDate =
    filteredEntries
      .filter((e) => e.date && e.date !== '9999-12-31')
      .reduce<string | null>((latest, e) => {
        if (!latest) return e.date
        return e.date! > latest ? e.date : latest
      }, null)

  function toggleSource(source: TimelineSource) {
    setActiveSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Group by date for rendering with gap markers
  type DateGroup = { date: string | null; entries: TimelineEntry[] }
  const dateGroups: DateGroup[] = []
  for (const entry of filteredEntries) {
    const last = dateGroups[dateGroups.length - 1]
    if (last && last.date === entry.date) {
      last.entries.push(entry)
    } else {
      dateGroups.push({ date: entry.date, entries: [entry] })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar: field name, filters, export */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h2 className="text-base font-mono font-semibold text-glomalin-text">{fieldName}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs font-mono text-glomalin-muted">Activity Timeline</p>
              <Link
                href={`/app/field-history/${fieldId}`}
                className="text-xs font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                Field history →
              </Link>
              <Link
                href={`/app/field-history/${fieldId}/audit`}
                className="text-xs font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                Organic audit →
              </Link>
            </div>
          </div>
          <TimelineExport
            entries={filteredEntries}
            fieldName={fieldName}
            year={year}
            fieldId={fieldId}
          />
        </div>

        <TimelineFilters
          sources={ALL_SOURCES}
          activeSources={activeSources}
          onToggleSource={toggleSource}
          year={year}
          onYearChange={setYear}
          availableYears={availableYears}
          sourceLoading={sourceLoading}
          totalCount={filteredEntries.length}
          plannedCount={plannedCount}
          lastActivityDate={lastActivityDate}
        />
      </div>

      {/* Warning banner */}
      {warnings.length > 0 && (
        <div className="flex-shrink-0 mx-4 mt-3 px-3 py-2 rounded border border-glomalin-accent bg-glomalin-accent/10 text-xs font-mono text-glomalin-accent">
          <span className="font-semibold">Partial data:</span>{' '}
          {warnings.join(' | ')}
        </div>
      )}

      {/* Timeline scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {filteredEntries.length === 0 && !isAnyLoading && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm font-mono text-glomalin-muted">
              No activities found for {fieldName} in {year}.
            </p>
          </div>
        )}

        {dateGroups.map((group, gi) => {
          const prevGroup = dateGroups[gi - 1]
          const gap = prevGroup ? daysBetween(prevGroup.date, group.date) : 0
          const showGap = gap > 14

          const weeksApart = Math.round(gap / 7)

          return (
            <div key={gi}>
              {/* Gap marker */}
              {showGap && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 border-t border-glomalin-border border-dashed" />
                  <span className="text-xs font-mono text-glomalin-muted px-2">
                    {weeksApart === 1 ? '... 1 week ...' : `... ${weeksApart} weeks ...`}
                  </span>
                  <div className="flex-1 border-t border-glomalin-border border-dashed" />
                </div>
              )}

              {/* Date label */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <span className="text-xs font-mono text-glomalin-muted font-semibold">
                  {fmtDateLabel(group.date)}
                </span>
                <div className="flex-1 border-t border-glomalin-border" />
              </div>

              {/* Entries for this date */}
              <div className="space-y-1 pl-2">
                {group.entries.map((entry) => (
                  <TimelineEntryCard
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedIds.has(entry.id)}
                    onToggle={() => toggleExpanded(entry.id)}
                    pairedEntry={pairedMap.get(entry.id) ?? null}
                    sourceColor={SOURCE_COLORS[entry.source]}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Skeleton shimmers while any source is loading */}
        {isAnyLoading && (
          <div className="space-y-1 mt-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    </div>
  )
}
