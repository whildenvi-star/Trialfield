'use client'

import { useState } from 'react'
import {
  getDeadlineDaysRemaining,
  getDeadlineCountdown,
  isOverdue,
} from '@/lib/claims/calc'

interface Claim {
  id: string
  crop?: string | null
  deadline_at?: string | null
  stage: string
  [key: string]: unknown
}

interface DeadlineAlertBannerProps {
  claims: Claim[]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

/**
 * Persistent deadline warning banner at the top of the Claims page.
 * Shows when any claim has a deadline within 7 days.
 * Not dismissible — reappears on every page load while approaching deadlines exist.
 * Click to expand the list of approaching/overdue claims.
 */
export function DeadlineAlertBanner({ claims }: DeadlineAlertBannerProps) {
  const [expanded, setExpanded] = useState(false)

  const approaching = claims.filter((c) => {
    const days = getDeadlineDaysRemaining(c.deadline_at ?? null, c.stage)
    return days !== null && days <= 7
  })

  if (approaching.length === 0) return null

  const hasOverdue = approaching.some((c) =>
    isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage }),
  )

  return (
    <div
      className={[
        'mb-6 rounded border px-4 py-3 font-mono text-sm',
        hasOverdue
          ? 'border-red-600 bg-red-900/10 text-red-400 animate-pulse'
          : 'border-amber-600 bg-amber-900/10 text-amber-400',
      ].join(' ')}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left flex items-center justify-between"
      >
        <span>
          {approaching.length} claim{approaching.length > 1 ? 's' : ''}{' '}
          {hasOverdue ? 'overdue or approaching deadline —' : 'have deadlines'} within 7 days
        </span>
        <span className="ml-4 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-1 text-xs border-t border-current/20 pt-2">
          {approaching.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="font-semibold">{c.crop ?? '—'}</span>
              <span className="text-current/60">·</span>
              <span>Deadline: {formatDate(c.deadline_at)}</span>
              <span className="text-current/60">·</span>
              <span>{getDeadlineCountdown(c.deadline_at ?? null, c.stage)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
