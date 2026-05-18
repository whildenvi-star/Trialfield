'use client'

import { useState } from 'react'
import type { SyncState } from '@/hooks/useSyncStatus'
import { QueueDetailSheet } from './queue-detail-sheet'

interface SyncStatusBannerProps {
  isOnline: boolean
  pendingCount: number
  syncState: SyncState
  errorMessage: string | null
  onRetry: () => void
}

export function SyncStatusBanner({
  isOnline,
  pendingCount,
  syncState,
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

  // Determine label and color class
  let label: React.ReactNode
  let colorClass: string

  if (syncState === 'syncing') {
    colorClass = 'bg-glomalin-info/10 text-glomalin-info border-glomalin-info/20'
    label = (
      <span className="flex items-center gap-2">
        <span
          className="inline-block size-3 rounded-full border-2 border-glomalin-info border-t-transparent animate-spin"
          aria-hidden="true"
        />
        {pendingCount > 0
          ? `Syncing… ${pendingCount} item${pendingCount !== 1 ? 's' : ''}`
          : 'Syncing…'}
      </span>
    )
  } else if (syncState === 'error') {
    colorClass = 'bg-glomalin-danger/10 text-glomalin-danger border-glomalin-danger/20'
    label = (
      <span className="flex items-center gap-2">
        {pendingCount > 0
          ? `Sync error • ${pendingCount} queued`
          : 'Sync error'}
        {errorMessage && (
          <span className="truncate text-glomalin-danger/70 max-w-[120px]">
            {errorMessage}
          </span>
        )}
      </span>
    )
  } else {
    // Offline (idle but not online)
    colorClass = 'bg-glomalin-danger/10 text-glomalin-danger border-glomalin-danger/20'
    label = pendingCount > 0
      ? `Offline • ${pendingCount} item${pendingCount !== 1 ? 's' : ''} queued`
      : 'Offline'
  }

  return (
    <>
      <button
        role="status"
        aria-live="polite"
        onClick={handleClick}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-mono border-b ${colorClass} ${pendingCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span>{label}</span>

        {syncState === 'error' && (
          <button
            onClick={handleRetry}
            className="ml-2 px-2 py-0.5 rounded text-xs font-mono border border-glomalin-danger/30 text-glomalin-danger hover:bg-glomalin-danger/10 transition-colors"
          >
            Retry
          </button>
        )}
      </button>

      <QueueDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
