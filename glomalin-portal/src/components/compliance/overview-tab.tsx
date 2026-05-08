'use client'

import type { CluRecord } from '@/lib/fsa/calc'
import { StatCard, ActionButton } from '@/components/compliance/ui'

interface OverviewTabProps {
  unreportedCount: number
  activePoliciesCount: number
  openClaimsCount: number
  claims: Record<string, unknown>[]
  cluRecords: CluRecord[]
  navigateTab: (tab: string) => void
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-muted whitespace-nowrap">
        {label}
      </h3>
      <div className="flex-1 h-px bg-glomalin-border" />
    </div>
  )
}

const flagConfig = {
  warning: {
    strip: 'bg-amber-400',
    bg:    'bg-amber-400/[0.04]',
    icon:  'text-amber-400',
    glyph: '⚠',
  },
  info: {
    strip: 'bg-blue-400',
    bg:    'bg-blue-400/[0.04]',
    icon:  'text-blue-400',
    glyph: '◆',
  },
  ok: {
    strip: 'bg-glomalin-success',
    bg:    'bg-glomalin-success/[0.04]',
    icon:  'text-glomalin-success',
    glyph: '✓',
  },
}

export function OverviewTab({
  unreportedCount,
  activePoliciesCount,
  openClaimsCount,
  claims,
  cluRecords: _cluRecords, // eslint-disable-line @typescript-eslint/no-unused-vars
  navigateTab,
}: OverviewTabProps) {
  const now = new Date()

  const overdueCount = claims.filter(c => {
    const d = c['deadline_at'] ? new Date(String(c['deadline_at'])) : null
    return d && d < now && c['stage'] !== 'closed' && c['stage'] !== 'denied'
  }).length

  const flags: {
    severity: 'warning' | 'info' | 'ok'
    message: string
    action?: string
    tab?: string
  }[] = []

  if (unreportedCount > 0)
    flags.push({
      severity: 'warning',
      message:  `${unreportedCount} CLU record${unreportedCount > 1 ? 's' : ''} not yet reported`,
      action:   'View',
      tab:      'acreage',
    })

  if (overdueCount > 0)
    flags.push({
      severity: 'warning',
      message:  `${overdueCount} claim${overdueCount > 1 ? 's' : ''} with overdue deadlines`,
      action:   'View',
      tab:      'calendar',
    })

  if (flags.length === 0)
    flags.push({ severity: 'ok', message: 'No active compliance issues' })

  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcoming = claims
    .filter(c => {
      const d = c['deadline_at'] ? new Date(String(c['deadline_at'])) : null
      return d && d >= now && d <= in30 && c['stage'] !== 'closed' && c['stage'] !== 'denied'
    })
    .sort((a, b) =>
      new Date(String(a['deadline_at'])).getTime() -
      new Date(String(b['deadline_at'])).getTime()
    )
    .slice(0, 10)

  return (
    <div>
      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Unreported CLUs"
          value={unreportedCount}
          variant={unreportedCount > 0 ? 'warning' : 'ok'}
          onClick={() => navigateTab('acreage')}
          sublabel={unreportedCount > 0 ? 'Action needed' : 'All reported'}
        />
        <StatCard
          label="Active Policies"
          value={activePoliciesCount}
          variant="default"
          onClick={() => navigateTab('insurance')}
        />
        <StatCard
          label="Open Claims"
          value={openClaimsCount}
          variant={openClaimsCount > 0 ? 'warning' : 'ok'}
          onClick={() => navigateTab('claims')}
        />
        <StatCard
          label="Overdue Deadlines"
          value={overdueCount}
          variant={overdueCount > 0 ? 'critical' : 'ok'}
          onClick={() => navigateTab('calendar')}
        />
      </div>

      {/* ── Risk flags ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeading label="Risk Flags" />
        <div className="space-y-1.5">
          {flags.map((flag, i) => {
            const cfg = flagConfig[flag.severity]
            return (
              <div
                key={i}
                className={`flex gap-0 rounded-md overflow-hidden ${cfg.bg}`}
              >
                <div className={`w-[3px] flex-shrink-0 self-stretch ${cfg.strip}`} />
                <div className="flex items-center justify-between flex-1 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`font-mono text-xs ${cfg.icon} select-none`}>
                      {cfg.glyph}
                    </span>
                    <span className="text-xs font-mono text-glomalin-text">
                      {flag.message}
                    </span>
                  </div>
                  {flag.action && flag.tab && (
                    <button
                      onClick={() => navigateTab(flag.tab!)}
                      className="text-[10px] font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors flex-shrink-0 ml-4"
                    >
                      {flag.action} →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming deadlines ─────────────────────────────────────── */}
      <div>
        <SectionHeading label="Upcoming Deadlines — 30 Days" />
        {upcoming.length === 0 ? (
          <p className="text-xs font-mono text-glomalin-muted py-2">
            No deadlines in the next 30 days.
          </p>
        ) : (
          <div>
            {upcoming.map((c, i) => {
              const deadlineDate = new Date(String(c['deadline_at']))
              const daysUntil = Math.ceil(
                (deadlineDate.getTime() - now.getTime()) / 86400000
              )
              const dateStr = deadlineDate.toLocaleDateString('en-US', {
                month: 'short',
                day:   'numeric',
              })
              const label = [
                String(c['crop'] ?? c['commodity'] ?? 'Claim'),
                c['farm_name'] ? `— ${String(c['farm_name'])}` : '',
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={i}
                  className="flex items-center gap-4 py-2.5 border-b border-glomalin-border/50 last:border-0"
                >
                  <span className="font-mono text-sm font-medium text-glomalin-bright tabular-nums w-16 flex-shrink-0">
                    {dateStr}
                  </span>
                  <span className="flex-1 text-xs font-mono text-glomalin-muted truncate">
                    {label}
                  </span>
                  <span className={`flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded ${
                    daysUntil <= 7
                      ? 'bg-amber-900/40 text-amber-300'
                      : 'bg-glomalin-border/60 text-glomalin-muted'
                  }`}>
                    in {daysUntil}d
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-4">
          <ActionButton variant="secondary" size="sm" onClick={() => navigateTab('calendar')}>
            View All Deadlines →
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
