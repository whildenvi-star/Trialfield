'use client'

import dynamic from 'next/dynamic'
import type { CluRecord, InsurancePolicy } from '@/lib/fsa/calc'
import type { Claim } from '@/components/claims/claim-card'
import { STAGE_ORDER, STAGE_LABELS, isOverdue, getDeadlineCountdown } from '@/lib/claims/calc'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// CRITICAL: ssr: false — ReportingMap uses maplibre-gl which requires `window`
const ReportingMap = dynamic(
  () => import('@/components/fsa/reporting-map').then((m) => m.ReportingMap),
  { ssr: false }
)

interface OverviewTabProps {
  unreportedCount: number
  activePoliciesCount: number
  openClaimsCount: number
  claims: Claim[]
  cluRecords: CluRecord[]
  policies: InsurancePolicy[]
  farmFilter?: string
  navigateTab: (tab: string, params?: Record<string, string>) => void
}

const STAGE_COLORS: Record<string, string> = {
  notice_of_loss:    'bg-amber-500',
  filed:             'bg-amber-400',
  under_review:      'bg-glomalin-accent',
  adjuster_assigned: 'bg-blue-400',
  settled:           'bg-green-400',
  closed:            'bg-glomalin-border',
}

function SectionHeader({
  label,
  linkLabel,
  onLink,
}: {
  label: string
  linkLabel: string
  onLink: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-glomalin-border shrink-0">
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-glomalin-muted">
        {label}
      </span>
      <button
        onClick={onLink}
        className="text-[9px] font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors"
      >
        {linkLabel} →
      </button>
    </div>
  )
}

export function OverviewTab({
  unreportedCount,
  activePoliciesCount,
  openClaimsCount: _openClaimsCount, // eslint-disable-line @typescript-eslint/no-unused-vars
  claims,
  cluRecords: _cluRecords, // eslint-disable-line @typescript-eslint/no-unused-vars
  policies,
  farmFilter,
  navigateTab,
}: OverviewTabProps) {
  // ── Insurance computed ──────────────────────────────────────────
  const alertPolicies = policies.filter((p) => p.claim_alert === 'potential')
  const totalPlantedAcres = Math.round(
    policies.reduce((s, p) => s + (p.planted_acres || 0), 0)
  )
  const cropMap: Record<string, { crop: string; count: number }> = {}
  for (const p of policies) {
    const k = p.crop ?? '(no crop)'
    if (!cropMap[k]) cropMap[k] = { crop: k, count: 0 }
    cropMap[k].count++
  }
  const cropBreakdown = Object.values(cropMap).sort((a, b) => b.count - a.count)

  // ── Claims computed ─────────────────────────────────────────────
  const openClaims = claims.filter((c) => c.stage !== 'closed')
  const claimsByStage: Record<string, number> = {}
  for (const s of STAGE_ORDER) {
    claimsByStage[s] = openClaims.filter((c) => c.stage === s).length
  }
  const overdueCount = openClaims.filter((c) =>
    isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage })
  ).length
  const overdueOrOpenClaims = openClaims
    .sort((a, b) => {
      const aOver = isOverdue({ deadline_at: a.deadline_at ?? null, stage: a.stage }) ? 0 : 1
      const bOver = isOverdue({ deadline_at: b.deadline_at ?? null, stage: b.stage }) ? 0 : 1
      return aOver - bOver
    })
    .slice(0, 4)

  // ── Deadlines assembled ─────────────────────────────────────────
  const now = new Date()
  const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  interface DeadlineRow {
    date: Date
    label: string
    source: 'FSA' | 'Claim' | 'Notice'
    urgency: 'overdue' | 'urgent' | 'soon' | 'ok'
  }

  const deadlines: DeadlineRow[] = []

  // FSA hardcoded
  const fsaDeadline = new Date(CURRENT_CROP_YEAR, 6, 15) // July 15
  if (fsaDeadline <= cutoff) {
    const daysLeft = Math.ceil((fsaDeadline.getTime() - now.getTime()) / 86400000)
    deadlines.push({
      date: fsaDeadline,
      label: 'FSA Acreage Reporting',
      source: 'FSA',
      urgency: daysLeft < 0 ? 'overdue' : daysLeft < 7 ? 'urgent' : daysLeft <= 30 ? 'soon' : 'ok',
    })
  }

  // Claim deadlines
  for (const c of claims) {
    if (c.stage === 'closed') continue
    if (c.deadline_at) {
      const d = new Date(c.deadline_at)
      if (d <= cutoff) {
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000)
        const farmName = c['farm_name'] as string | null | undefined
        const label = [c.crop ?? (c['commodity'] as string | null) ?? 'Claim', farmName ? `— ${farmName}` : ''].filter(Boolean).join(' ')
        deadlines.push({
          date: d,
          label,
          source: 'Claim',
          urgency: daysLeft < 0 ? 'overdue' : daysLeft < 7 ? 'urgent' : daysLeft <= 30 ? 'soon' : 'ok',
        })
      }
    }
    // Notice window: date_of_loss + 15 days
    if (c.stage === 'notice_of_loss' && c.date_of_loss) {
      const lossDate = new Date(c.date_of_loss)
      const noticeDeadline = new Date(lossDate.getTime() + 15 * 86400000)
      if (noticeDeadline <= cutoff) {
        const daysLeft = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86400000)
        const label = `Notice of Loss — ${c.crop ?? (c['commodity'] as string | null) ?? 'Claim'}`
        deadlines.push({
          date: noticeDeadline,
          label,
          source: 'Notice',
          urgency: daysLeft < 0 ? 'overdue' : daysLeft < 7 ? 'urgent' : daysLeft <= 30 ? 'soon' : 'ok',
        })
      }
    }
  }

  deadlines.sort((a, b) => a.date.getTime() - b.date.getTime())
  const visibleDeadlines = deadlines.slice(0, 5)

  const urgencyStrip: Record<string, string> = {
    overdue: 'bg-red-600',
    urgent:  'bg-red-500',
    soon:    'bg-amber-500',
    ok:      'bg-glomalin-border',
  }
  const urgencyText: Record<string, string> = {
    overdue: 'text-red-400',
    urgent:  'text-red-400',
    soon:    'text-amber-400',
    ok:      'text-glomalin-muted',
  }
  const sourceBadge: Record<string, string> = {
    FSA:    'bg-amber-900/40 text-amber-400',
    Notice: 'bg-orange-900/40 text-orange-400',
    Claim:  'bg-glomalin-accent/10 text-glomalin-accent',
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] mt-5 gap-0">
      {/* ── Map hero ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden h-full">
        <ReportingMap
          farmFilter={farmFilter}
          className="relative flex h-full border border-glomalin-border overflow-hidden"
        />
      </div>

      {/* ── Dashboard panel ──────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col bg-glomalin-surface border-l border-glomalin-border overflow-hidden">

        {/* ── INSURANCE ─────────────────────────────────────────── */}
        <SectionHeader label="Insurance" linkLabel="All" onLink={() => navigateTab('insurance')} />
        <div className="px-3 py-2.5 border-b border-glomalin-border shrink-0">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <div className="text-center">
              <p className="font-mono text-base font-semibold text-glomalin-text">{activePoliciesCount}</p>
              <p className="text-[9px] font-mono text-glomalin-muted">policies</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-base font-semibold text-glomalin-text">{totalPlantedAcres.toLocaleString()}</p>
              <p className="text-[9px] font-mono text-glomalin-muted">planted ac</p>
            </div>
            <div className="text-center">
              <p className={`font-mono text-base font-semibold ${alertPolicies.length > 0 ? 'text-amber-400' : 'text-glomalin-muted'}`}>
                {alertPolicies.length}
              </p>
              <p className="text-[9px] font-mono text-glomalin-muted">alerts</p>
            </div>
          </div>

          {/* Alert policies */}
          {alertPolicies.length > 0 && (
            <div className="space-y-1 mb-2">
              {alertPolicies.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[10px] font-mono text-glomalin-text truncate">{p.crop ?? '(no crop)'}</span>
                  {p.farm_name && (
                    <span className="text-[9px] font-mono text-glomalin-muted truncate ml-auto">{p.farm_name}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Crop breakdown */}
          <div className="max-h-[72px] overflow-y-auto space-y-0.5">
            {cropBreakdown.slice(0, 5).map((c) => (
              <div key={c.crop} className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-glomalin-muted truncate">{c.crop}</span>
                <span className="text-[10px] font-mono text-glomalin-muted shrink-0 ml-2">{c.count} pol</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CLAIMS ────────────────────────────────────────────── */}
        <SectionHeader label="Claims" linkLabel="Kanban" onLink={() => navigateTab('claims')} />
        <div className="px-3 py-2.5 border-b border-glomalin-border shrink-0">
          {/* Stage pipeline bars */}
          <div className="flex items-end gap-1 mb-2.5 h-10">
            {STAGE_ORDER.filter((s) => s !== 'closed').map((stage) => {
              const count = claimsByStage[stage] ?? 0
              const maxCount = Math.max(...STAGE_ORDER.map((s) => claimsByStage[s] ?? 0), 1)
              const barH = count === 0 ? 4 : Math.max(8, Math.round((count / maxCount) * 32))
              return (
                <div key={stage} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-mono text-glomalin-muted">{count}</span>
                  <div
                    className={`w-full rounded-sm ${STAGE_COLORS[stage]} ${count === 0 ? 'opacity-20' : 'opacity-80'}`}
                    style={{ height: barH }}
                    title={STAGE_LABELS[stage]}
                  />
                </div>
              )
            })}
          </div>
          {/* Stage labels */}
          <div className="flex gap-1 mb-2">
            {STAGE_ORDER.filter((s) => s !== 'closed').map((stage) => (
              <div key={stage} className="flex-1">
                <span className="text-[7px] font-mono text-glomalin-muted/60 leading-tight block text-center truncate">
                  {STAGE_LABELS[stage].split(' ')[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Overdue banner */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded px-2 py-1 bg-red-900/15 border border-red-800/30 mb-2">
              <span className="text-red-400 text-[10px] font-mono">▲ {overdueCount} overdue</span>
            </div>
          )}

          {/* Open claims list */}
          {openClaims.length === 0 ? (
            <p className="text-[10px] font-mono text-glomalin-muted">No open claims</p>
          ) : (
            <div className="space-y-1">
              {overdueOrOpenClaims.map((c) => {
                const overdue = isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage })
                const countdown = getDeadlineCountdown(c.deadline_at ?? null, c.stage)
                return (
                  <div key={c.id} className="flex items-center gap-1.5">
                    {overdue ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-glomalin-border shrink-0" />
                    )}
                    <span className="text-[10px] font-mono text-glomalin-text truncate flex-1">
                      {c.crop ?? (c['commodity'] as string | null) ?? 'Claim'}
                    </span>
                    {countdown && (
                      <span className={`text-[9px] font-mono shrink-0 ${overdue ? 'text-red-400' : 'text-glomalin-muted'}`}>
                        {countdown}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── DEADLINES ─────────────────────────────────────────── */}
        <SectionHeader label="Deadlines — 90 days" linkLabel="90-day" onLink={() => navigateTab('calendar')} />
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {/* FSA unreported count indicator */}
          {unreportedCount > 0 && (
            <div className="flex items-center gap-1.5 mb-2 text-[9px] font-mono text-amber-400">
              <span>⚠</span>
              <span>{unreportedCount} CLU{unreportedCount > 1 ? 's' : ''} unreported</span>
            </div>
          )}
          {visibleDeadlines.length === 0 ? (
            <p className="text-[10px] font-mono text-glomalin-muted">No upcoming deadlines.</p>
          ) : (
            <div className="space-y-1.5">
              {visibleDeadlines.map((dl, i) => {
                const dateStr = dl.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const daysLeft = Math.ceil((dl.date.getTime() - now.getTime()) / 86400000)
                return (
                  <div key={i} className="flex gap-0 rounded overflow-hidden border border-glomalin-border/40">
                    <div className={`w-[3px] shrink-0 self-stretch ${urgencyStrip[dl.urgency]}`} />
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${sourceBadge[dl.source]}`}>
                        {dl.source}
                      </span>
                      <span className="text-[10px] font-mono text-glomalin-text truncate flex-1">
                        {dl.label}
                      </span>
                      <span className={`text-[9px] font-mono shrink-0 tabular-nums ${urgencyText[dl.urgency]}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : daysLeft === 0 ? 'today' : `${dateStr}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
