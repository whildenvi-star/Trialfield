'use client'

import type { InsurancePolicy } from '@/lib/fsa/calc'

interface ProductionTrackerProps {
  policies: InsurancePolicy[]
}

export function ProductionTracker({ policies }: ProductionTrackerProps) {
  const tracked = policies.filter((p) => p.guarantee > 0 && p.planted_acres > 0)
  if (tracked.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="font-mono font-semibold text-glomalin-accent text-base mb-3">
        Production vs Guarantee
      </h2>
      <p className="text-xs text-glomalin-muted mb-4">
        Effective guarantee = APH guarantee × coverage level. Sync yield from grain tickets to populate actuals.
      </p>
      <div className="rounded-lg border border-glomalin-border overflow-hidden">
        {tracked.map((policy) => {
          const threshold = policy.guarantee * (policy.coverage_level / 100)
          const actual = policy.actual ?? 0
          const pct = threshold > 0 ? Math.min((actual / threshold) * 100, 100) : 0
          const status: 'none' | 'ok' | 'warning' | 'critical' =
            actual <= 0
              ? 'none'
              : actual >= threshold
              ? 'ok'
              : actual >= threshold * 0.8
              ? 'warning'
              : 'critical'

          const barColor =
            status === 'ok'
              ? 'bg-glomalin-green'
              : status === 'warning'
              ? 'bg-amber-400'
              : status === 'critical'
              ? 'bg-red-400'
              : 'bg-glomalin-border'

          return (
            <div
              key={policy.id}
              className="px-4 py-3 border-b border-glomalin-border last:border-0"
            >
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-glomalin-text">
                  {policy.farm_name ?? '(no farm)'}
                  {policy.crop && (
                    <span className="text-glomalin-muted"> — {policy.crop}</span>
                  )}
                  {policy.plan_type && (
                    <span className="ml-2 text-[10px] text-glomalin-accent font-semibold">
                      {policy.plan_type}
                    </span>
                  )}
                </span>
                <span className="text-xs font-mono text-glomalin-muted whitespace-nowrap ml-4">
                  {actual > 0
                    ? `${actual.toFixed(1)} / ${threshold.toFixed(1)} bu/ac`
                    : `— / ${threshold.toFixed(1)} bu/ac`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-glomalin-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Sub-label */}
              <div className="flex items-center justify-between mt-1">
                {status === 'none' && (
                  <span className="text-[10px] font-mono text-glomalin-muted">
                    No yield data yet — use Sync Yield to pull from grain tickets
                  </span>
                )}
                {status === 'critical' && (
                  <span className="text-[10px] font-mono text-red-400 font-semibold">
                    Below guarantee threshold — claim may be warranted
                  </span>
                )}
                {status === 'warning' && (
                  <span className="text-[10px] font-mono text-amber-400">
                    Approaching threshold — monitor closely
                  </span>
                )}
                {status === 'ok' && (
                  <span className="text-[10px] font-mono text-glomalin-green">
                    Above guarantee threshold
                  </span>
                )}
                <span className="text-[10px] font-mono text-glomalin-muted ml-auto">
                  {policy.planted_acres.toFixed(1)} ac · {policy.coverage_level}% coverage
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
