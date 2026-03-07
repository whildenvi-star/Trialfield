import Link from 'next/link'

interface SummaryCardsProps {
  fsa: { reported: number; total: number } | null // null = query failed
  insurance: { claimAlerts: number } | null
  claims: { openCount: number } | null
}

export function SummaryCards({ fsa, insurance, claims }: SummaryCardsProps) {
  const insuranceAlerts = insurance?.claimAlerts ?? 0
  const hasAlerts = insurance !== null && insuranceAlerts > 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* FSA Reporting Card */}
      <Link href="/app/fsa-578">
        <div className="bg-glomalin-surface border border-glomalin-border hover:border-glomalin-accent rounded-lg p-5 transition-colors cursor-pointer">
          <p className="text-xs font-mono uppercase tracking-wider text-glomalin-muted mb-2">
            FSA Reporting
          </p>
          {fsa !== null ? (
            <p className="font-mono">
              <span className="text-2xl font-bold text-glomalin-text">
                {fsa.reported}
              </span>
              <span className="text-base text-glomalin-muted"> / {fsa.total}</span>
            </p>
          ) : (
            <p className="text-2xl font-bold font-mono text-glomalin-muted">—</p>
          )}
          <p className="text-xs font-mono text-glomalin-muted mt-1">CLUs reported</p>
        </div>
      </Link>

      {/* Insurance Card */}
      <Link href="/app/insurance">
        <div
          className={`bg-glomalin-surface rounded-lg p-5 transition-colors cursor-pointer border ${
            hasAlerts
              ? 'border-yellow-700 hover:border-yellow-500'
              : 'border-glomalin-border hover:border-glomalin-accent'
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-glomalin-muted mb-2">
            Insurance
          </p>
          {insurance !== null ? (
            <p
              className={`text-2xl font-bold font-mono ${
                hasAlerts ? 'text-yellow-400' : 'text-glomalin-text'
              }`}
            >
              {insuranceAlerts}
            </p>
          ) : (
            <p className="text-2xl font-bold font-mono text-glomalin-muted">—</p>
          )}
          <p className="text-xs font-mono text-glomalin-muted mt-1">
            potential claim alerts
          </p>
        </div>
      </Link>

      {/* Claims Card */}
      <Link href="/app/claims">
        <div className="bg-glomalin-surface border border-glomalin-border hover:border-glomalin-accent rounded-lg p-5 transition-colors cursor-pointer">
          <p className="text-xs font-mono uppercase tracking-wider text-glomalin-muted mb-2">
            Claims
          </p>
          {claims !== null ? (
            <p className="text-2xl font-bold font-mono text-glomalin-text">
              {claims.openCount}
            </p>
          ) : (
            <p className="text-2xl font-bold font-mono text-glomalin-muted">—</p>
          )}
          <p className="text-xs font-mono text-glomalin-muted mt-1">open claims</p>
        </div>
      </Link>
    </div>
  )
}
