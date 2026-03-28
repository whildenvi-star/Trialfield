'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MODULES } from '@/lib/modules'
import type { ActionItemsResponse, ActionItemGroup, ActionItem, Severity } from '@/lib/action-items'

interface ActionItemsListProps {
  /** Initial data pre-fetched by the server component for SSR */
  initial: ActionItemsResponse | null
}

// Badge border colors per module within the soil-dark palette
const BADGE_BORDER: Record<string, string> = {
  FSA: 'border-amber-700/40',
  INS: 'border-yellow-700/40',
  CLM: 'border-red-700/40',
  GT: 'border-glomalin-green/40',
  BUDG: 'border-blue-700/40',
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 'warning') {
    return (
      <svg
        className="w-4 h-4 text-amber-400 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-label="Warning"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    )
  }
  return (
    <svg
      className="w-4 h-4 text-blue-400 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="Info"
    >
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

function CheckmarkIcon() {
  return (
    <svg
      className="w-10 h-10 text-glomalin-green"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-label="All clear"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-glomalin-muted flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse" aria-label="Loading action items">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-9 bg-glomalin-surface rounded" />
      ))}
    </div>
  )
}

function SourceBadge({ badge }: { badge: string }) {
  const borderClass = BADGE_BORDER[badge] ?? 'border-glomalin-border'
  return (
    <span
      className={`inline-flex items-center bg-glomalin-surface border ${borderClass} text-glomalin-muted text-xs font-mono px-2 py-0.5 rounded flex-shrink-0`}
    >
      [{badge}]
    </span>
  )
}

function ActionItemRow({ item, badge }: { item: ActionItem; badge: string }) {
  return (
    <Link href={item.link} className="block">
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-glomalin-surface/50 transition-colors cursor-pointer rounded">
        <SeverityIcon severity={item.severity} />
        <span className="flex-1 text-glomalin-text font-mono text-sm leading-snug">
          {item.summary}
        </span>
        <SourceBadge badge={badge} />
        {item.age && (
          <span className="text-glomalin-muted text-xs font-mono flex-shrink-0 hidden sm:block">
            {item.age}
          </span>
        )}
      </div>
    </Link>
  )
}

function ModuleGroup({ group }: { group: ActionItemGroup }) {
  // Find the portal route for this module
  const mod = MODULES.find((m) => m.id === group.module)
  const route = mod?.route ?? '#'

  if (group.offline) {
    return (
      <div className="mb-4 opacity-50">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-glomalin-border/50">
          <span className="text-glomalin-text font-mono font-bold text-sm">{group.label}</span>
          <span className="text-glomalin-muted font-mono text-xs">(service offline)</span>
          <span className="inline-flex items-center bg-glomalin-surface border border-glomalin-border text-glomalin-muted text-xs font-mono px-2 py-0.5 rounded ml-1">
            Unavailable
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4">
      {/* Group header — clickable, navigates to module */}
      <Link href={route} className="block">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-glomalin-border hover:border-glomalin-accent/50 transition-colors cursor-pointer group">
          <span className="flex-1 text-glomalin-text font-mono font-bold text-sm group-hover:text-glomalin-accent transition-colors">
            {group.label}
          </span>
          <ArrowRightIcon />
        </div>
      </Link>

      {/* Item rows */}
      <div className="mt-1 space-y-0.5">
        {group.items.map((item) => (
          <ActionItemRow key={item.id} item={item} badge={group.badge} />
        ))}
      </div>
    </div>
  )
}

export function ActionItemsList({ initial }: ActionItemsListProps) {
  const [data, setData] = useState<ActionItemsResponse | null>(initial ?? null)
  const [loading, setLoading] = useState<boolean>(initial === null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/action-items', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) return
      const json = (await res.json()) as ActionItemsResponse
      setData(json)
    } catch {
      // Network failure — keep existing data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      // Re-fetch when connectivity returns
      fetchItems()
    }

    window.addEventListener('online', handleOnline)

    // Fetch on mount regardless (replaces SSR partial data with full Express+Supabase set)
    fetchItems()

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchItems])

  if (loading) {
    return <LoadingSkeleton />
  }

  const totalCount = data?.totalCount ?? 0
  const groups = data?.groups ?? []

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckmarkIcon />
        <p className="text-glomalin-muted font-mono text-sm">Nothing needs attention</p>
      </div>
    )
  }

  return (
    <div>
      {/* Total count header */}
      <p className="text-glomalin-text font-mono mb-4">
        <span className="font-bold">{totalCount}</span>{' '}
        {totalCount === 1 ? 'item needs' : 'items need'} attention
      </p>

      {/* Module groups */}
      <div>
        {groups.map((group) => (
          <ModuleGroup key={group.module} group={group} />
        ))}
      </div>
    </div>
  )
}
