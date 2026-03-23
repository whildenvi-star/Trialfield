'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { observationQueue } from '@/lib/offline/observation-queue'
import type { PendingObservation } from '@/lib/offline/types'

async function uploadObservation(obs: PendingObservation): Promise<void> {
  let response: Response

  if (obs.photoBlob) {
    const formData = new FormData()
    formData.append('note', obs.note)
    formData.append('photo', new File([obs.photoBlob], 'photo.jpg', { type: 'image/jpeg' }))
    // Do NOT set Content-Type — browser sets it with boundary for multipart
    response = await fetch('/api/observations', {
      method: 'POST',
      body: formData,
    })
  } else {
    response = await fetch('/api/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: obs.note }),
    })
  }

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }
}

export function useObservationQueue() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)
  const idbAvailable = useRef(true)

  // Refresh pending count from IDB
  const refreshPendingCount = useCallback(async () => {
    if (!idbAvailable.current) return
    try {
      const count = await observationQueue.pendingCount()
      setPendingCount(count)
    } catch {
      // IDB unavailable — leave count as-is
    }
  }, [])

  // Sync all pending observations to the API
  const syncPending = useCallback(async () => {
    if (!idbAvailable.current) return
    let pending: PendingObservation[]
    try {
      pending = await observationQueue.getPending()
    } catch {
      return
    }
    if (pending.length === 0) return

    setIsSyncing(true)
    let syncedCount = 0

    for (const obs of pending) {
      try {
        await uploadObservation(obs)
        if (obs.localId !== undefined) {
          await observationQueue.markSynced(obs.localId)
        }
        syncedCount++
      } catch {
        // Leave in queue — will retry on next reconnect
      }
    }

    setIsSyncing(false)
    await refreshPendingCount()

    if (syncedCount > 0) {
      setLastSyncMessage(`${syncedCount} observation${syncedCount === 1 ? '' : 's'} synced`)
    }
  }, [refreshPendingCount])

  // Queue-first submit: write to IDB first, then attempt upload immediately
  const submitObservation = useCallback(
    async (note: string, photoBlob?: Blob): Promise<void> => {
      if (idbAvailable.current) {
        // Queue-first path: save to IDB, then try upload
        let localId: number | undefined
        try {
          localId = await observationQueue.add({ note, photoBlob })
        } catch {
          // IDB failed — fall through to direct upload
          idbAvailable.current = false
        }

        if (localId !== undefined) {
          await refreshPendingCount()
          try {
            const obs: PendingObservation = {
              localId,
              note,
              photoBlob,
              synced: 0,
              createdAt: Date.now(),
            }
            await uploadObservation(obs)
            await observationQueue.markSynced(localId)
            await refreshPendingCount()
          } catch {
            // Upload failed — observation stays in queue for later sync
          }
          return
        }
      }

      // Direct upload fallback (Safari Private Mode or IDB unavailable)
      const obs: PendingObservation = { note, photoBlob, synced: 0, createdAt: Date.now() }
      await uploadObservation(obs)
    },
    [refreshPendingCount]
  )

  // Initialize: check IDB availability, load pending count, purge old records
  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      idbAvailable.current = false
      return
    }

    // Test IDB access (catches Safari Private Mode)
    const testRequest = indexedDB.open('idb-test')
    testRequest.onerror = () => {
      idbAvailable.current = false
    }
    testRequest.onsuccess = () => {
      testRequest.result.close()
      // IDB is available — load pending count and purge old records
      observationQueue.pendingCount().then(setPendingCount).catch(() => {})
      observationQueue.purgeOld(7).catch(() => {})
    }
  }, [])

  // Register online event listener to auto-sync on reconnect
  useEffect(() => {
    const handler = () => {
      syncPending()
    }
    window.addEventListener('online', handler)
    // Also sync on mount if online (catch reconnects while app was backgrounded)
    if (navigator.onLine) {
      syncPending()
    }
    return () => window.removeEventListener('online', handler)
  }, [syncPending])

  return {
    submitObservation,
    pendingCount,
    isSyncing,
    lastSyncMessage,
  }
}
