'use client'

import type { TimelineEntry, TimelineSource } from '@/lib/timeline/types'
import { TimelineEntryCard } from './timeline-entry-card'

export type CalendarMode = 'month' | 'week'

interface CalendarViewProps {
  mode: CalendarMode
  anchor: string // ISO date inside the visible month/week
  entries: TimelineEntry[] // dated entries only
  unscheduled: TimelineEntry[] // planned entries with no date
  selectedDay: string | null
  onSelectDay: (iso: string | null) => void
  expandedIds: Set<string>
  onToggleExpanded: (id: string) => void
  sourceColors: Record<TimelineSource, string>
}

// ── date helpers (all ISO YYYY-MM-DD, UTC-safe) ──────────────────────────────

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parse(isoStr: string): Date {
  return new Date(isoStr + 'T00:00:00Z')
}

function addDaysIso(isoStr: string, days: number): string {
  const d = parse(isoStr)
  d.setUTCDate(d.getUTCDate() + days)
  return iso(d)
}

/** Sunday-start week containing the given date. */
function weekStart(isoStr: string): string {
  const d = parse(isoStr)
  return addDaysIso(isoStr, -d.getUTCDay())
}

/** 42-cell (6-week) grid covering the month of `anchor`. */
function monthGrid(anchor: string): string[] {
  const d = parse(anchor)
  const first = `${anchor.slice(0, 7)}-01`
  void d
  const start = weekStart(first)
  return Array.from({ length: 42 }, (_, i) => addDaysIso(start, i))
}

function weekDays(anchor: string): string[] {
  const start = weekStart(anchor)
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i))
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Status → chip styling. Completed activities inherit their source color. */
function chipStyle(entry: TimelineEntry, sourceColors: Record<TimelineSource, string>): React.CSSProperties {
  if (entry.status === 'planned') {
    return { borderColor: '#57534e', color: '#a8a29e', backgroundColor: 'transparent', borderStyle: 'dashed' }
  }
  if (entry.status === 'scheduled') {
    return { borderColor: '#f472b6', color: '#f9a8d4', backgroundColor: 'rgba(244,114,182,0.10)' }
  }
  const c = entry.status === 'confirmed' ? '#7A9E7E' : sourceColors[entry.source] ?? '#7A9E7E'
  return { borderColor: c, color: c, backgroundColor: `${c}1a` }
}

function chipLabel(entry: TimelineEntry): string {
  return entry.summary.replace(/^\[[^\]]+\]\s*/, '')
}

function EntryChip({
  entry,
  sourceColors,
  full,
}: {
  entry: TimelineEntry
  sourceColors: Record<TimelineSource, string>
  full?: boolean
}) {
  return (
    <div
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border leading-tight ${full ? '' : 'truncate'}`}
      style={chipStyle(entry, sourceColors)}
      title={entry.summary}
    >
      {chipLabel(entry)}
    </div>
  )
}

// ── unscheduled / planned strip ──────────────────────────────────────────────

export function UnscheduledStrip({
  unscheduled,
  sourceColors,
}: {
  unscheduled: TimelineEntry[]
  sourceColors: Record<TimelineSource, string>
}) {
  if (unscheduled.length === 0) return null
  return (
    <div className="mx-4 mt-2 px-3 py-2 rounded border border-dashed border-glomalin-border bg-glomalin-surface/50">
      <span className="text-[10px] font-mono uppercase tracking-wider text-glomalin-muted mr-2">
        Planned · not scheduled ({unscheduled.length})
      </span>
      <div className="mt-1 flex flex-wrap gap-1">
        {unscheduled.map(e => (
          <EntryChip key={e.id} entry={e} sourceColors={sourceColors} />
        ))}
      </div>
    </div>
  )
}

// ── calendar body ────────────────────────────────────────────────────────────

const MAX_CHIPS_MONTH = 3

export function CalendarView({
  mode,
  anchor,
  entries,
  unscheduled,
  selectedDay,
  onSelectDay,
  expandedIds,
  onToggleExpanded,
  sourceColors,
}: CalendarViewProps) {
  const todayIso = iso(new Date())
  const anchorMonth = anchor.slice(0, 7)

  const byDay = new Map<string, TimelineEntry[]>()
  for (const e of entries) {
    if (!e.date) continue
    const list = byDay.get(e.date) ?? []
    list.push(e)
    byDay.set(e.date, list)
  }

  const days = mode === 'month' ? monthGrid(anchor) : weekDays(anchor)
  const selectedEntries = selectedDay ? byDay.get(selectedDay) ?? [] : []

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Grid area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <UnscheduledStrip unscheduled={unscheduled} sourceColors={sourceColors} />

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px mt-3 mb-1">
          {WEEKDAY_LABELS.map(w => (
            <div key={w} className="text-[10px] font-mono uppercase tracking-wider text-glomalin-muted text-center py-1">
              {w}
            </div>
          ))}
        </div>

        {mode === 'month' ? (
          <div className="grid grid-cols-7 gap-px bg-glomalin-border rounded overflow-hidden border border-glomalin-border">
            {days.map(day => {
              const inMonth = day.slice(0, 7) === anchorMonth
              const dayEntries = byDay.get(day) ?? []
              const isToday = day === todayIso
              const isSelected = day === selectedDay
              return (
                <button
                  key={day}
                  onClick={() => onSelectDay(dayEntries.length > 0 || isSelected ? (isSelected ? null : day) : day)}
                  className={`min-h-[72px] md:min-h-[92px] p-1 text-left align-top transition-colors ${
                    isSelected
                      ? 'bg-glomalin-accent/15'
                      : inMonth
                        ? 'bg-glomalin-bg hover:bg-glomalin-surface'
                        : 'bg-glomalin-bg/40 hover:bg-glomalin-surface/60'
                  }`}
                >
                  <div
                    className={`text-[11px] font-mono mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-glomalin-accent text-glomalin-bg font-bold'
                        : inMonth
                          ? 'text-glomalin-text/80'
                          : 'text-glomalin-muted/50'
                    }`}
                  >
                    {parseInt(day.slice(8), 10)}
                  </div>
                  {/* Desktop: chips; mobile: dots */}
                  <div className="hidden md:block space-y-0.5">
                    {dayEntries.slice(0, MAX_CHIPS_MONTH).map(e => (
                      <EntryChip key={e.id} entry={e} sourceColors={sourceColors} />
                    ))}
                    {dayEntries.length > MAX_CHIPS_MONTH && (
                      <div className="text-[10px] font-mono text-glomalin-muted px-1">
                        +{dayEntries.length - MAX_CHIPS_MONTH} more
                      </div>
                    )}
                  </div>
                  <div className="md:hidden flex flex-wrap gap-0.5">
                    {dayEntries.slice(0, 6).map(e => (
                      <span
                        key={e.id}
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: (chipStyle(e, sourceColors).borderColor as string) ?? '#7A9E7E' }}
                      />
                    ))}
                    {dayEntries.length > 6 && (
                      <span className="text-[9px] font-mono text-glomalin-muted">+{dayEntries.length - 6}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          /* Week view — 7 columns desktop, stacked days mobile */
          <div className="grid grid-cols-1 md:grid-cols-7 gap-1">
            {days.map(day => {
              const dayEntries = byDay.get(day) ?? []
              const isToday = day === todayIso
              const isSelected = day === selectedDay
              return (
                <button
                  key={day}
                  onClick={() => onSelectDay(isSelected ? null : day)}
                  className={`rounded border p-1.5 text-left min-h-[48px] md:min-h-[180px] transition-colors ${
                    isSelected
                      ? 'border-glomalin-accent/60 bg-glomalin-accent/10'
                      : 'border-glomalin-border bg-glomalin-bg hover:bg-glomalin-surface'
                  }`}
                >
                  <div className={`text-[11px] font-mono mb-1.5 ${isToday ? 'text-glomalin-accent font-bold' : 'text-glomalin-muted'}`}>
                    {parse(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    {isToday && ' · today'}
                  </div>
                  <div className="space-y-1">
                    {dayEntries.map(e => (
                      <EntryChip key={e.id} entry={e} sourceColors={sourceColors} full />
                    ))}
                    {dayEntries.length === 0 && (
                      <div className="text-[10px] font-mono text-glomalin-muted/40">—</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="md:w-96 md:border-l border-t md:border-t-0 border-glomalin-border flex flex-col max-h-[45vh] md:max-h-none">
          <div className="flex items-center justify-between px-3 py-2 border-b border-glomalin-border flex-shrink-0">
            <span className="text-xs font-mono font-semibold text-glomalin-text">
              {parse(selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </span>
            <button
              onClick={() => onSelectDay(null)}
              className="text-xs font-mono text-glomalin-muted hover:text-glomalin-text px-1"
              aria-label="Close day panel"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {selectedEntries.length === 0 ? (
              <p className="text-xs font-mono text-glomalin-muted p-3">No activity on this day.</p>
            ) : (
              selectedEntries.map(entry => (
                <TimelineEntryCard
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedIds.has(entry.id)}
                  onToggle={() => onToggleExpanded(entry.id)}
                  pairedEntry={null}
                  sourceColor={sourceColors[entry.source]}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
