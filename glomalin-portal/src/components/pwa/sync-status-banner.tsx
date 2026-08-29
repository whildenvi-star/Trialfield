'use client'

import { useState } from 'react'
import type { SyncState } from '@/hooks/useSyncStatus'
import { QueueDetailSheet } from './queue-detail-sheet'

interface SyncStatusBannerProps {
  isOnline: boolean
  pendingCount: number
  syncState: SyncState
  syncDone: number
  syncTotal: number
  errorMessage: string | null
  onRetry: () => void
}

// Offline-sync state grammar (Google OHS field-app guideline):
//  - offline is neutral/informational, never error-styled — dead zones are
//    normal out here, and red trains operators to distrust the queue
//  - sync progress is a determinate "N of M" bar, never a spinner — a spinner
//    can't distinguish stalled from progressing on a one-bar connection
//  - success confirms with icon + color change together (reads through glare)
//  - failure is explicit, with retry, and only when it's NOT a connectivity drop
export function SyncStatusBanner({
  isOnline,
  pendingCount,
  syncState,
  syncDone,
  syncTotal,
  errorMessage,
  onRetry,
}: SyncStatusBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Silent when online, idle, and nothing pending
  if (isOnline && syncState === 'idle' && pendingCount === 0) {
    return null
  }

  function handleClick() {
    if (pendingCount > 0) {
      setSheetOpen(true)
    }
  }

  function handleRetry(e: React.MouseEvent) {
    e.stopPropagation()
    onRetry()
  }

  let colorClass: string
  let content: React.ReactNode

  if (syncState === 'syncing') {
    const total = Math.max(syncTotal, 1)
    const current = Math.min(syncDone + 1, total)
    const pct = Math.round((syncDone / total) * 100)
    colorClass = 'bg-glomalin-info/10 text-glomalin-info border-glomalin-info/20'
    content = (
      <span className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0">
          {syncTotal > 0 ? `Syncing ${current} of ${total}` : 'Syncing…'}
        </span>
        <span
          className="h-1 flex-1 max-w-[160px] rounded-full bg-glomalin-info/20 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span
            className="block h-full rounded-full bg-glomalin-info transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    )
  } else if (syncState === 'synced') {
    colorClass = 'bg-glomalin-success/10 text-glomalin-success border-glomalin-success/20'
    content = (
      <span className="flex items-center gap-2">
        <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All synced
      </span>
    )
  } else if (syncState === 'error' && isOnline) {
    colorClass = 'bg-glomalin-danger/10 text-glomalin-danger border-glomalin-danger/20'
    content = (
      <span className="flex items-center gap-2">
        {pendingCount > 0
          ? `Sync failed • ${pendingCount} still queued`
          : 'Sync failed'}
        {errorMessage && (
          <span className="truncate text-glomalin-danger/70 max-w-[140px]">
            {errorMessage}
          </span>
        )}
      </span>
    )
  } else {
    // Offline (or an error whose cause is the connection) — neutral grey,
    // informational, and reassuring: queued work is safe on this device
    colorClass = 'bg-glomalin-surface text-glomalin-muted border-glomalin-border'
    content = (
      <span className="flex items-center gap-2">
        <span className="inline-block size-2 rounded-full bg-glomalin-muted shrink-0" aria-hidden="true" />
        {pendingCount > 0
          ? `Offline • ${pendingCount} saved on this phone — uploads when signal returns`
          : 'Offline — changes will save on this phone'}
      </span>
    )
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        onClick={handleClick}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-xs font-mono border-b ${colorClass} ${pendingCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {content}

        {syncState === 'error' && isOnline && (
          <button
            onClick={handleRetry}
            className="ml-2 px-2 py-0.5 shrink-0 rounded text-xs font-mono border border-glomalin-danger/30 text-glomalin-danger hover:bg-glomalin-danger/10 transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      <QueueDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
