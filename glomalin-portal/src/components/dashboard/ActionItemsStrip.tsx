'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ActionItemsResponse } from '@/lib/action-items'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0 text-glomalin-muted"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

export function ActionItemsStrip() {
  const [data, setData] = useState<ActionItemsResponse | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/action-items')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d) })
      .catch(() => {})
  }, [])

  if (!data || data.totalCount === 0) return null

  const hasWarning = data.groups.some((g) => g.items.some((i) => i.severity === 'warning'))
  const accentClass = hasWarning ? 'text-amber-400' : 'text-glomalin-accent'
  const borderClass = hasWarning ? 'border-amber-500/30' : 'border-glomalin-border'
  const bgClass = hasWarning ? 'bg-amber-500/5' : 'bg-glomalin-surface'

  return (
    <div className={`rounded-lg border overflow-hidden ${borderClass} ${bgClass}`}>
      {/* Header row — always visible, tap to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className={`text-xs ${accentClass}`} aria-hidden="true">
          {hasWarning ? '⚠' : '●'}
        </span>
        <span className={`flex-1 text-xs font-mono font-medium ${accentClass}`}>
          {data.totalCount} item{data.totalCount !== 1 ? 's' : ''} need{data.totalCount === 1 ? 's' : ''} attention
        </span>
        <span className={accentClass}>
          <ChevronIcon open={expanded} />
        </span>
      </button>

      {/* Expanded item list */}
      {expanded && (
        <div className="border-t border-glomalin-border/60 divide-y divide-glomalin-border/40">
          {data.groups.map((group) => (
            <div key={group.module}>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-glomalin-highlight/30 transition-colors"
                >
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    item.severity === 'warning'
                      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      : 'text-glomalin-accent border-glomalin-accent/30 bg-glomalin-accent/10'
                  }`}>
                    {group.badge}
                  </span>
                  <span className="flex-1 text-xs font-sans text-glomalin-text leading-snug">
                    {item.summary}
                  </span>
                  <ArrowIcon />
                </Link>
              ))}
              {group.offline && (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border text-glomalin-muted border-glomalin-border flex-shrink-0">
                    {group.badge}
                  </span>
                  <span className="text-xs font-mono text-glomalin-muted">offline</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
