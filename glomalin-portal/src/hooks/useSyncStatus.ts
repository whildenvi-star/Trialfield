'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { offlineQueue } from '@/lib/offline/db'
import { observationQueue } from '@/lib/offline/observation-queue'
import { processQueue } from '@/lib/offline/sync-engine'

export type SyncState = 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  syncState: SyncState
  errorMessage: string | null
  drainQueue: () => void
}

/**
 * useSyncStatus — single source of truth for sync state.
 *
 * Mount ONCE at layout level and pass state down as props.
 * Do NOT instantiate in multiple components.
 *
 * @param getToken - Async function that returns the current auth token (or null if expired).
 *                   Provided by SyncStatusProvider client component in Plan 02.
 */
export function useSyncStatus(getToken: () => Promise<string | null>): SyncStatus {
  // Initialize isOnline to true (optimistic — most users are online).
  // Actual value is set in useEffect after mount via navigator.onLine.
  // Never access navigator at module scope — SSR safety.
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isSyncing = useRef(false)

  // Sum pending counts from BOTH queues: offlineQueue (QueuedOperation) + observationQueue (PendingObservation)
  const refreshCount = useCallback(async () => {
    const [ops, obs] = await Promise.all([
      offlineQueue.getPending(),
      observationQueue.getPending()
    ])
    setPendingCount(ops.length + obs.length)
  }, [])

  const drainQueue = useCallback(async () => {
    if (isSyncing.current || !navigator.onLine) return
    isSyncing.current = true
    setSyncState('syncing')
    setErrorMessage(null)
    try {
      const result = await processQueue(getToken)

      if (result.failed.length > 0 && result.synced === 0) {
        setSyncState('error')
        setErrorMessage(result.failed[0].errorMessage)
      } else {
        setSyncState('idle')
      }

      // Dispatch conflict notification for the conflict drawer (Plan 03) to react to
      if (result.conflicts.length > 0) {
        window.dispatchEvent(
          new CustomEvent('sync:conflicts', { detail: result.conflicts })
        )
      }

      // Dispatch completion notification for the SyncStatusProvider (Plan 02) to show toast
      if (result.synced > 0 && result.failed.length === 0) {
        window.dispatchEvent(
          new CustomEvent('sync:completed', { detail: { count: result.synced } })
        )
      }

      await refreshCount()
    } finally {
      isSyncing.current = false
    }
  }, [getToken, refreshCount])

  useEffect(() => {
    // Set actual online state after mount (SSR-safe: never reads navigator at module scope)
    setIsOnline(navigator.onLine)
    refreshCount()

    const handleOnline = () => {
      setIsOnline(true)
      drainQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [drainQueue, refreshCount])

  return { isOnline, pendingCount, syncState, errorMessage, drainQueue }
}
