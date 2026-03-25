'use client'

import { useState } from 'react'

interface PricingStalenessBadgeProps {
  lastScraped: string | null
}

export function PricingStalenessBadge({ lastScraped }: PricingStalenessBadgeProps) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [currentLastScraped, setCurrentLastScraped] = useState<string | null>(lastScraped)

  // Compute days since last scrape
  const daysSince = currentLastScraped
    ? Math.floor((Date.now() - new Date(currentLastScraped).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Stale if never scraped or scraped more than 7 days ago
  const isStale = daysSince === null || daysSince > 7

  async function handleRefresh() {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/insurance/pricing/scrape', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setCurrentLastScraped(data.lastScraped ?? new Date().toISOString())
        setFeedback({ message: data.message ?? `${data.updated} prices updated`, type: 'success' })
      } else {
        setFeedback({ message: data.message ?? data.error ?? 'Scrape failed', type: 'error' })
      }
    } catch {
      setFeedback({ message: 'Network error — could not reach scrape endpoint', type: 'error' })
    } finally {
      setLoading(false)
      // Auto-clear feedback after 6 seconds
      setTimeout(() => setFeedback(null), 6000)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {/* Staleness indicator */}
        {isStale ? (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold bg-orange-900/40 border border-orange-600/50 text-orange-300">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            {currentLastScraped === null
              ? 'Prices never updated'
              : `Prices stale — last updated ${daysSince}d ago`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono bg-glomalin-surface border border-glomalin-border text-glomalin-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-glomalin-green inline-block" />
            {`Updated ${daysSince}d ago`}
          </span>
        )}

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-mono font-semibold border border-glomalin-border text-glomalin-accent hover:border-glomalin-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-glomalin-accent border-t-transparent rounded-full animate-spin" />
              Refreshing...
            </>
          ) : (
            'Refresh Prices'
          )}
        </button>
      </div>

      {/* Inline feedback message after refresh attempt */}
      {feedback && (
        <p
          className={`text-xs font-mono pl-1 ${
            feedback.type === 'success' ? 'text-glomalin-green' : 'text-orange-400'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}
