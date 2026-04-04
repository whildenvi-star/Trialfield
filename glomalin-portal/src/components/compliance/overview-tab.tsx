'use client'

import type { CluRecord } from '@/lib/fsa/calc'
import { StatCard, ActionButton } from '@/components/compliance/ui'

interface OverviewTabProps {
  unreportedCount: number
  activePoliciesCount: number
  openClaimsCount: number
  claims: Record<string, unknown>[]   // raw claims array for deadline + flag computation
  cluRecords: CluRecord[]              // for risk flags
  navigateTab: (tab: string) => void
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

  // Compute overdue count
  const overdueCount = claims.filter(c => {
    const deadlineAt = c['deadline_at']
    const d = deadlineAt ? new Date(String(deadlineAt)) : null
    return d && d < now && c['stage'] !== 'closed' && c['stage'] !== 'denied'
  }).length

  // Compute risk flags
  const flags: { severity: 'warning' | 'info' | 'ok'; message: string }[] = []

  if (unreportedCount > 0)
    flags.push({ severity: 'warning', message: `${unreportedCount} CLU record${unreportedCount > 1 ? 's' : ''} not yet reported` })

  if (overdueCount > 0)
    flags.push({ severity: 'warning', message: `${overdueCount} claim${overdueCount > 1 ? 's' : ''} with overdue deadlines` })

  if (flags.length === 0)
    flags.push({ severity: 'ok', message: 'No active compliance issues' })

  // Compute upcoming deadlines (next 30 days)
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcoming = claims
    .filter(c => {
      const deadlineAt = c['deadline_at']
      const d = deadlineAt ? new Date(String(deadlineAt)) : null
      return d && d >= now && d <= in30 && c['stage'] !== 'closed' && c['stage'] !== 'denied'
    })
    .sort((a, b) => new Date(String(a['deadline_at'])).getTime() - new Date(String(b['deadline_at'])).getTime())
    .slice(0, 10)

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Unreported CLUs"
          value={unreportedCount}
          variant={unreportedCount > 0 ? 'warning' : 'ok'}
          onClick={() => navigateTab('acreage')}
          sublabel="Click to view"
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

      {/* Risk flags panel */}
      <div className="mb-6">
        <h3 className="text-xs font-mono text-glomalin-muted uppercase tracking-wider mb-3">Risk Flags</h3>
        <div className="bg-glomalin-surface border border-glomalin-border rounded-lg px-4 py-2">
          {flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 py-2 border-b border-glomalin-border last:border-0">
              <span
                className={[
                  'w-2 h-2 rounded-full mt-1 flex-shrink-0',
                  flag.severity === 'warning' ? 'bg-amber-400' : flag.severity === 'info' ? 'bg-blue-400' : 'bg-green-400',
                ].join(' ')}
              />
              <span className="text-xs font-mono text-glomalin-text">{flag.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming deadlines */}
      <div className="mb-4">
        <h3 className="text-xs font-mono text-glomalin-muted uppercase tracking-wider mb-3">Upcoming Deadlines — Next 30 Days</h3>
        <div className="bg-glomalin-surface border border-glomalin-border rounded-lg px-4 py-2 mb-3">
          {upcoming.length === 0 ? (
            <p className="text-xs font-mono text-glomalin-muted py-2">No deadlines in the next 30 days.</p>
          ) : (
            upcoming.map((c, i) => {
              const daysUntil = Math.ceil((new Date(String(c['deadline_at'])).getTime() - now.getTime()) / 86400000)
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-glomalin-border last:border-0">
                  <span className="text-xs font-mono text-glomalin-text">
                    {String(c['crop'] ?? c['commodity'] ?? 'Claim')} &mdash; {String(c['farm_name'] ?? '')}
                  </span>
                  <span className={`text-xs font-mono ${daysUntil <= 7 ? 'text-amber-400' : 'text-green-400'}`}>
                    {new Date(String(c['deadline_at'])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })
          )}
        </div>
        <ActionButton variant="secondary" size="sm" onClick={() => navigateTab('calendar')}>
          View All Deadlines
        </ActionButton>
      </div>
    </div>
  )
}
