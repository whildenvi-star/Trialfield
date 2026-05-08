'use client'

import type { CluRecord } from '@/lib/fsa/calc'

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

interface CluRecordExtended extends CluRecord {
  reporting_deadline?: string | null
}

type DeadlineEntry = {
  date: Date
  label: string
  source: 'FSA' | 'Claim' | 'Notice'
  urgency: 'ok' | 'warning' | 'critical'
  note?: string
}

const WI_FSA_DEADLINES: { label: string; month: number; day: number; note: string }[] = [
  { label: 'FSA Acreage Reporting Deadline', month: 7, day: 15, note: 'Rock County WI — all crops' },
]

const SOURCE_BADGE: Record<'FSA' | 'Claim' | 'Notice', string> = {
  FSA:    'bg-amber-900/40 text-amber-400',
  Notice: 'bg-orange-900/40 text-orange-400',
  Claim:  'bg-glomalin-accent/10 text-glomalin-accent',
}

const URGENCY_STRIP: Record<'ok' | 'warning' | 'critical', string> = {
  ok:       'bg-glomalin-success',
  warning:  'bg-amber-400',
  critical: 'bg-red-400',
}

const URGENCY_BAR: Record<'ok' | 'warning' | 'critical', string> = {
  ok:       'bg-glomalin-success/60',
  warning:  'bg-amber-400/60',
  critical: 'bg-red-400/60',
}

const URGENCY_COUNT: Record<'ok' | 'warning' | 'critical', string> = {
  ok:       'text-glomalin-success',
  warning:  'text-amber-300',
  critical: 'text-red-400',
}

export function CalendarTab({ claims, cluRecords }: CalendarTabProps) {
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const entries: DeadlineEntry[] = []

  for (const wd of WI_FSA_DEADLINES) {
    const d = new Date(now.getFullYear(), wd.month - 1, wd.day)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    if (d > in90) continue
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date:    d,
      label:   wd.label,
      source:  'FSA',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 14 ? 'warning' : 'ok',
      note:    wd.note,
    })
  }

  for (const claim of claims) {
    if (claim.stage === 'closed' || claim.stage === 'denied') continue
    if (claim.date_of_loss && !claim.deadline_at) {
      const noticeDeadline = new Date(
        new Date(claim.date_of_loss).getTime() + 15 * 24 * 60 * 60 * 1000
      )
      if (noticeDeadline <= in90) {
        const daysUntil = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86400000)
        entries.push({
          date:    noticeDeadline,
          label:   `Notice of Loss — ${claim.crop ?? claim.commodity ?? 'Claim'}${claim.farm_name ? ` (${claim.farm_name})` : ''}`,
          source:  'Notice',
          urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
          note:    '15-day RMA notice requirement',
        })
      }
    }
  }

  for (const claim of claims) {
    if (!claim.deadline_at || claim.stage === 'closed' || claim.stage === 'denied') continue
    const d = new Date(claim.deadline_at)
    if (d > in90) continue
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date:    d,
      label:   `${claim.crop ?? claim.commodity ?? 'Claim'} — ${claim.farm_name ?? ''} (${claim.stage ?? ''})`,
      source:  'Claim',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
    })
  }

  for (const clu of cluRecords as CluRecordExtended[]) {
    const deadline = clu.reporting_deadline
    if (!deadline || clu.reported) continue
    const d = new Date(deadline)
    if (d > in90) continue
    const daysUntil = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    entries.push({
      date:    d,
      label:   `FSA Reporting — Farm ${clu.farm_number ?? ''} Tract ${clu.tract_number ?? ''} CLU ${clu.clu ?? ''}`,
      source:  'FSA',
      urgency: daysUntil < 0 ? 'critical' : daysUntil <= 7 ? 'warning' : 'ok',
    })
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <div>
      {/* ── Header row with legend ──────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-muted whitespace-nowrap">
          Compliance Deadlines — Next 90 Days
        </h3>
        <div className="flex-1 h-px bg-glomalin-border" />
        <div className="flex items-center gap-2">
          {(['FSA', 'Notice', 'Claim'] as const).map((src) => (
            <span
              key={src}
              className={`text-[9px] font-mono px-2 py-0.5 rounded ${SOURCE_BADGE[src]}`}
            >
              {src}
            </span>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs font-mono text-glomalin-muted">
            No compliance deadlines in the next 90 days.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const daysUntil   = Math.ceil((entry.date.getTime() - now.getTime()) / 86400000)
            const isOverdue   = daysUntil < 0
            const barWidth    = isOverdue ? 0 : Math.round(Math.min(100, (daysUntil / 90) * 100))
            const dateStr     = entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const countdown   = isOverdue
              ? `${Math.abs(daysUntil)}d overdue`
              : `in ${daysUntil}d`

            return (
              <div
                key={i}
                className="flex gap-0 rounded-lg overflow-hidden border border-glomalin-border"
              >
                {/* Urgency strip */}
                <div className={`w-[3px] flex-shrink-0 ${URGENCY_STRIP[entry.urgency]}`} />

                {/* Card body */}
                <div className="flex-1 px-4 py-3 bg-glomalin-surface/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0 ${SOURCE_BADGE[entry.source]}`}>
                        {entry.source}
                      </span>
                      <span className="text-xs font-mono text-glomalin-text truncate">
                        {entry.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="font-mono text-sm font-medium text-glomalin-bright tabular-nums">
                        {dateStr}
                      </span>
                      <span className={`text-[10px] font-mono font-bold tabular-nums ${URGENCY_COUNT[entry.urgency]}`}>
                        {countdown}
                      </span>
                    </div>
                  </div>

                  {entry.note && (
                    <p className="text-[10px] font-mono text-glomalin-muted mt-1.5 ml-[3.25rem]">
                      {entry.note}
                    </p>
                  )}

                  {/* Time-remaining bar — depletes as deadline approaches */}
                  <div className="mt-2.5 h-[2px] rounded-full bg-glomalin-border/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${URGENCY_BAR[entry.urgency]}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
