'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface DashboardSummary {
  fsa: { reported: number; total: number } | null
  insurance: { claimAlerts: number } | null
  claims: { openCount: number } | null
  cachedAt: number
}

interface OfflineSummaryCardsProps {
  /** Initial data pre-fetched by the server component on first load */
  initial: DashboardSummary | null
}

/** Format a timestamp as a human-readable relative time string */
function formatRelativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs
  const diffMins = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export function OfflineSummaryCards({ initial }: OfflineSummaryCardsProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(initial ?? null)
  const [isOnline, setIsOnline] = useState(true)
  const [showRefreshed, setShowRefreshed] = useState(false)
  const [noCache, setNoCache] = useState(false)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Fetch fresh summary data from the portal API */
  const fetchSummary = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/dashboard/summary', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) return

      const data = (await res.json()) as DashboardSummary & { offline?: boolean }

      if (data.offline) {
        // SW returned offline sentinel — no cached data available
        setNoCache(true)
        return
      }

      setSummary(data)
      setNoCache(false)
    } catch {
      // Network failure — keep existing cached summary
    }
  }, [])

  /** Read the SW-stored timestamp for the summary endpoint */
  const readSwTimestamp = useCallback(async (): Promise<number | null> => {
    if (!('caches' in window)) return null
    try {
      const cache = await caches.open('dashboard-cache')
      const tsResponse = await cache.match('/api/dashboard/summary__timestamp')
      if (!tsResponse) return null
      const data = (await tsResponse.json()) as { cachedAt?: number }
      return data.cachedAt ?? null
    } catch {
      return null
    }
  }, [])

  // On mount: initialise online state, fetch fresh data, check SW timestamp
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      // Wait 2 seconds for network to stabilise, then refresh
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = setTimeout(async () => {
        await fetchSummary()
        setShowRefreshed(true)
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = setTimeout(() => setShowRefreshed(false), 3000)
      }, 2000)
    }

    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Fetch on mount if online; read SW timestamp to set an accurate cachedAt
    if (navigator.onLine) {
      fetchSummary()
    } else {
      // Offline on mount — try to read timestamp from SW cache
      readSwTimestamp().then((swCachedAt) => {
        if (swCachedAt && summary) {
          setSummary((prev) => (prev ? { ...prev, cachedAt: swCachedAt } : prev))
        } else if (!summary) {
          setNoCache(true)
        }
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [fetchSummary, readSwTimestamp]) // eslint-disable-line react-hooks/exhaustive-deps

  const cachedAt = summary?.cachedAt ?? null
  const isStale = cachedAt !== null && Date.now() - cachedAt > STALE_THRESHOLD_MS
  const relativeTime = cachedAt ? formatRelativeTime(cachedAt) : null

  const fsa = summary?.fsa ?? null
  const insurance = summary?.insurance ?? null
  const claims = summary?.claims ?? null
  const insuranceAlerts = insurance?.claimAlerts ?? 0
  const hasAlerts = insurance !== null && insuranceAlerts > 0

  return (
    <div>
      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 px-3 py-2 bg-amber-950/60 border border-amber-700/50 rounded text-xs font-mono text-amber-400">
          You&apos;re offline — showing cached data
        </div>
      )}

      {/* Stale data warning (older than 24h) */}
      {isStale && relativeTime && (
        <div className="mb-4 px-3 py-2 bg-amber-950/40 border border-amber-700/40 rounded text-xs font-mono text-amber-500 flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Data may be outdated — last updated {relativeTime}
        </div>
      )}

      {/* Online refresh toast */}
      {showRefreshed && (
        <div className="mb-4 px-3 py-2 bg-glomalin-green/10 border border-glomalin-green/40 rounded text-xs font-mono text-glomalin-green">
          Data refreshed
        </div>
      )}

      {/* No cached data message */}
      {noCache && !isOnline ? (
        <div className="mb-6 px-4 py-3 bg-glomalin-surface border border-glomalin-border rounded text-sm font-mono text-glomalin-muted">
          No cached data available — connect to load dashboard
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
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

          {/* Last updated timestamp (shown when we have data, not stale warning already shown) */}
          {!isStale && relativeTime && (
            <p className="text-xs font-mono text-glomalin-muted mb-6">
              Last updated: {relativeTime}
            </p>
          )}
          {/* Spacer when no timestamp yet */}
          {!relativeTime && <div className="mb-6" />}
        </>
      )}
    </div>
  )
}
