'use client'

import type { CluRecord } from '@/lib/fsa/calc'

// Minimal claim shape needed for calendar rendering.
// Uses deadline_at (confirmed field name from claim-card.tsx).
interface ClaimDeadline {
  deadline_at?: string | null
  date_of_loss?: string | null
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
  source: 'FSA' | 'Claim' | 'Notice'
  urgency: 'ok' | 'warning' | 'critical'
  note?: string
}

// Wisconsin / Rock County FSA hard deadlines (crop year 2026).
// Acreage reporting: July 15 is the standard USDA/FSA deadline for most crops in WI.
// Notice of loss: 15 calendar days from date_of_loss per RMA handbook.
const WI_FSA_DEADLINES: { label: string; month: number; day: number; note: string }[] = [
  { label: 'FSA Acreage Reporting Deadline', month: 7, day: 15, note: 'Rock County WI — all crops' },
]

export function CalendarTab({ claims, cluRecords }: CalendarTabProps) {
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const entries: DeadlineEntry[] = []

  // Static Wisconsin FSA deadlines — inject for current crop year
  for (const wd of WI_FSA_DEADLINES) {
    const d = new Date(now.getFullYear(), wd.month - 1, wd.day)
    // If already past this year, show next year's date
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    if (d > in90) continue
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date: d,
      label: wd.label,
      source: 'FSA',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 14 ? 'warning' : 'ok',
      note: wd.note,
    })
  }

  // Notice of loss: 15 days from date_of_loss for open claims without deadline_at
  for (const claim of claims) {
    if (claim.stage === 'closed' || claim.stage === 'denied') continue
    if (claim.date_of_loss && !claim.deadline_at) {
      const lossDate = new Date(claim.date_of_loss)
      const noticeDeadline = new Date(lossDate.getTime() + 15 * 24 * 60 * 60 * 1000)
      if (noticeDeadline <= in90) {
        const daysUntil = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86400000)
        entries.push({
          date: noticeDeadline,
          label: `Notice of Loss — ${claim.crop ?? claim.commodity ?? 'Claim'} ${claim.farm_name ? `(${claim.farm_name})` : ''}`,
          source: 'Notice',
          urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
          note: '15-day RMA notice requirement',
        })
      }
    }
  }

  // Claim deadlines — use deadline_at (NOT deadline_date)
  for (const claim of claims) {
    if (!claim.deadline_at || claim.stage === 'closed' || claim.stage === 'denied') continue
    const d = new Date(claim.deadline_at)
    if (d > in90) continue
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
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
          Notice
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
              className={`flex items-start justify-between py-3 border-b border-glomalin-border last:border-0 ${entry.urgency === 'critical' ? 'opacity-80' : ''}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 ${
                    entry.source === 'FSA'
                      ? 'bg-amber-900/40 text-amber-400'
                      : entry.source === 'Notice'
                      ? 'bg-orange-900/40 text-orange-400'
                      : 'bg-glomalin-border text-glomalin-accent'
                  }`}
                >
                  {entry.source}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-mono text-glomalin-text block">{entry.label}</span>
                  {entry.note && (
                    <span className="text-[10px] font-mono text-glomalin-muted">{entry.note}</span>
                  )}
                </div>
              </div>
              <span
                className={`text-xs font-mono font-bold ml-4 whitespace-nowrap flex-shrink-0 ${
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
