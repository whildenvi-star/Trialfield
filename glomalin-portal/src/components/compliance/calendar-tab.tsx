'use client'

import type { CluRecord } from '@/lib/fsa/calc'

// Minimal claim shape needed for calendar rendering.
// Uses deadline_at (confirmed field name from claim-card.tsx).
interface ClaimDeadline {
  deadline_at?: string | null
  stage?: string | null
  crop?: string | null
  commodity?: string | null
  farm_name?: string | null
}

interface CalendarTabProps {
  claims: ClaimDeadline[]
  cluRecords: CluRecord[]
}

// CluRecord extended with optional fields that may be present
// (reporting_deadline is not in the base type but may exist on Supabase rows)
interface CluRecordExtended extends CluRecord {
  reporting_deadline?: string | null
  reported_date?: string | null
}

type DeadlineEntry = {
  date: Date
  label: string
  source: 'FSA' | 'Claim'
  urgency: 'ok' | 'warning' | 'critical'
}

export function CalendarTab({ claims, cluRecords }: CalendarTabProps) {
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const entries: DeadlineEntry[] = []

  // Claim deadlines — use deadline_at (NOT deadline_date)
  for (const claim of claims) {
    if (!claim.deadline_at || claim.stage === 'closed' || claim.stage === 'denied') continue
    const d = new Date(claim.deadline_at)
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date: d,
      label: `${claim.crop ?? claim.commodity ?? 'Claim'} — ${claim.farm_name ?? ''} (${claim.stage ?? ''})`,
      source: 'Claim',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
    })
  }

  // FSA reporting deadlines — use reporting_deadline field if present on CLU records
  // If no reporting_deadline field exists, skip FSA entries (do not error)
  for (const clu of cluRecords as CluRecordExtended[]) {
    const deadline = clu.reporting_deadline
    if (!deadline || clu.reported_date) continue
    const d = new Date(deadline)
    if (d > in90) continue
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date: d,
      label: `FSA Reporting — Farm ${clu.farm_number ?? ''} Tract ${clu.tract_number ?? ''} CLU ${clu.clu ?? ''}`,
      source: 'FSA',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
    })
  }

  // Sort chronologically (overdue first, then soonest)
  entries.sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <div>
      <h3 className="text-sm font-mono font-bold text-glomalin-text mb-4">
        Compliance Deadlines &mdash; Next 90 Days
      </h3>

      {/* Source legend */}
      <div className="flex gap-4 mb-4 text-xs font-mono text-glomalin-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
          FSA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-glomalin-accent" />
          Claim
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs font-mono text-glomalin-muted">
          No compliance deadlines in the next 90 days.
        </p>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-3 border-b border-glomalin-border last:border-0 ${entry.urgency === 'critical' ? 'opacity-75' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    entry.source === 'FSA'
                      ? 'bg-amber-900/40 text-amber-400'
                      : 'bg-glomalin-border text-glomalin-accent'
                  }`}
                >
                  {entry.source}
                </span>
                <span className="text-xs font-mono text-glomalin-text">{entry.label}</span>
              </div>
              <span
                className={`text-xs font-mono font-bold ml-4 whitespace-nowrap ${
                  entry.urgency === 'critical'
                    ? 'text-red-400'
                    : entry.urgency === 'warning'
                    ? 'text-amber-400'
                    : 'text-green-400'
                }`}
              >
                {entry.date < now
                  ? `Overdue ${Math.abs(Math.ceil((entry.date.getTime() - now.getTime()) / 86400000))}d`
                  : entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
