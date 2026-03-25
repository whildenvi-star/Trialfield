/**
 * Offline Sync Engine — replay queued pass confirmations against the API.
 *
 * processQueue:          replay all pending ops FIFO with backoff + conflict handling
 * replayOperation:       fire a single queued op against the appropriate API endpoint
 * requestBackgroundSync: register a Background Sync event (best-effort, silent fallback)
 * setSyncToken:          persist auth token to IndexedDB for service worker access
 * getLastSyncTimestamp:  read the last successful sync ISO timestamp from IndexedDB
 * getQueueSummary:       return pending + failed ops and last sync timestamp
 */

import { offlineQueue, getDb } from './db'
import type { QueuedOperation } from './types'

// ─── Result types ────────────────────────────────────────────────────────────

export interface SyncSkip {
  operationId: string
  fieldId: string
  type: string
  reason: string
}

export interface SyncFailure {
  operationId: string
  fieldId: string
  type: string
  errorMessage: string
  httpStatus?: number
}

export interface SyncResult {
  synced: number
  skipped: SyncSkip[]
  failed: SyncFailure[]
  total: number
}

export interface ReplayResult {
  status: 'synced' | 'conflict' | 'error'
  errorMessage?: string
  httpStatus?: number
}

// ─── Background Sync registration ────────────────────────────────────────────

/**
 * Register a Background Sync event with the service worker.
 * Silently no-ops if Background Sync is not supported (Safari, older browsers).
 */
export function requestBackgroundSync(tag?: string): void {
  if (typeof navigator === 'undefined') return
  const syncTag = tag ?? 'pass-sync'

  navigator.serviceWorker?.ready
    .then((registration) => {
      // Background Sync API — check for support before calling
      const syncManager = (registration as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync
      if (syncManager) {
        return syncManager.register(syncTag)
      }
    })
    .catch(() => {
      // Silently ignore — Background Sync unsupported, will rely on manual/online event replay
    })
}

// ─── Auth token persistence ───────────────────────────────────────────────────

/**
 * Persist the current auth token to IndexedDB so the service worker can
 * read it during Background Sync replay (SW cannot access app module state).
 */
export async function setSyncToken(token: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put('sync-config', { key: 'auth-token', value: token })
  } catch {
    // Non-fatal — sync will fail with auth error and fall back to manual retry
  }
}

// ─── Sync timestamp helpers ───────────────────────────────────────────────────

/**
 * Write the current ISO timestamp to IndexedDB as 'last-sync' after a
 * successful processQueue run.
 */
async function writeLastSyncTimestamp(): Promise<void> {
  try {
    const db = await getDb()
    await db.put('sync-config', { key: 'last-sync', value: new Date().toISOString() })
  } catch {
    // Non-fatal
  }
}

/**
 * Read the last successful sync ISO timestamp from IndexedDB.
 * Returns null if sync has never completed successfully.
 */
export async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    const db = await getDb()
    const record = await db.get('sync-config', 'last-sync')
    return record?.value ?? null
  } catch {
    return null
  }
}

// ─── Queue summary ────────────────────────────────────────────────────────────

export interface QueueSummary {
  pending: QueuedOperation[]
  failed: QueuedOperation[]
  total: number
  lastSync: string | null
}

/**
 * Return a summary of the current queue state: pending ops, failed ops,
 * total count, and the last successful sync timestamp.
 */
export async function getQueueSummary(): Promise<QueueSummary> {
  const all = await offlineQueue.getAll()
  const pending = all.filter((op) => op.status === 'pending')
  const failed = all.filter((op) => op.status === 'failed')
  const lastSync = await getLastSyncTimestamp()
  return {
    pending,
    failed,
    total: all.length,
    lastSync,
  }
}

// ─── Single operation replay ──────────────────────────────────────────────────

/**
 * Replay a single queued operation against the API.
 * Returns a ReplayResult indicating success, conflict, or error.
 */
export async function replayOperation(
  op: QueuedOperation,
  token: string
): Promise<ReplayResult> {
  const signal = AbortSignal.timeout(10000)

  try {
    let res: Response

    if (op.type === 'confirm-pass') {
      res = await fetch('/api/mobile/passes/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldId: op.fieldId,
          passId: op.passId,
          passType: op.passType,
          operationDate: op.operationDate,
          operatorCertUserId: op.operatorId,
        }),
        signal,
      })
    } else {
      // add-pass
      res = await fetch('/api/mobile/passes/add', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldId: op.fieldId,
          operationType: op.operationType,
          operationDate: op.operationDate,
          notes: op.description,
          operatorCertUserId: op.operatorId,
        }),
        signal,
      })
    }

    if (res.ok) {
      return { status: 'synced' }
    }

    if (res.status === 409) {
      return { status: 'conflict', httpStatus: 409 }
    }

    // Check response body for "already confirmed" indicator
    let bodyText = ''
    try {
      bodyText = await res.text()
    } catch {
      bodyText = ''
    }
    const bodyLower = bodyText.toLowerCase()
    if (bodyLower.includes('already confirmed') || bodyLower.includes('already synced')) {
      return { status: 'conflict', httpStatus: res.status }
    }

    // Parse error message from body
    let errorMessage = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(bodyText) as { error?: string }
      if (parsed.error) errorMessage = parsed.error
    } catch {
      if (bodyText) errorMessage = bodyText.slice(0, 200)
    }

    return { status: 'error', errorMessage, httpStatus: res.status }
  } catch (err: unknown) {
    // Network error or timeout
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { status: 'error', errorMessage: 'Request timed out' }
    }
    if (err instanceof TypeError) {
      return { status: 'error', errorMessage: 'Network error — device may be offline' }
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { status: 'error', errorMessage: message }
  }
}

// ─── Queue processor ──────────────────────────────────────────────────────────

/**
 * Process all pending queued operations FIFO with exponential backoff.
 *
 * - Sequential (one at a time in confirmation order)
 * - Conflicts (409 / already confirmed) are skipped and deleted
 * - Transient errors (500, timeout, network) retry up to 3 times
 * - Auth errors (401) attempt token refresh once; if refresh fails, mark all remaining failed
 * - Other 4xx errors move the item to failed with the server's error message
 */
export async function processQueue(
  getToken: () => Promise<string | null>
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: [], failed: [], total: 0 }

  const pending = await offlineQueue.getPending()
  // Sort FIFO by creation time
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  result.total = pending.length

  if (pending.length === 0) return result

  let token = await getToken()
  if (!token) {
    // No token at all — mark everything failed
    for (const op of pending) {
      await offlineQueue.update(op.id, {
        status: 'failed',
        errorMessage: 'Session expired — sign in to sync',
      })
      result.failed.push({
        operationId: op.id,
        fieldId: op.fieldId,
        type: op.type,
        errorMessage: 'Session expired — sign in to sync',
      })
    }
    return result
  }

  for (const op of pending) {
    // Exponential backoff before retry: 1s, 4s, 16s
    if (op.retryCount > 0) {
      const backoffMs = 1000 * Math.pow(4, op.retryCount - 1)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }

    const replay = await replayOperation(op, token)

    if (replay.status === 'synced') {
      await offlineQueue.delete(op.id)
      result.synced++
      continue
    }

    if (replay.status === 'conflict') {
      // Already confirmed server-side — skip silently
      await offlineQueue.delete(op.id)
      result.skipped.push({
        operationId: op.id,
        fieldId: op.fieldId,
        type: op.type,
        reason: 'Already confirmed — skipped',
      })
      continue
    }

    // replay.status === 'error'
    const httpStatus = replay.httpStatus

    if (httpStatus === 401) {
      // Try to refresh the token once
      token = await getToken()
      if (!token) {
        // Refresh failed — mark all remaining ops failed
        const remaining = pending.filter(
          (p) =>
            p.id === op.id ||
            (p.createdAt >= op.createdAt && p.id !== op.id)
        )
        for (const rem of remaining) {
          await offlineQueue.update(rem.id, {
            status: 'failed',
            errorMessage: 'Session expired — sign in to sync',
          })
          result.failed.push({
            operationId: rem.id,
            fieldId: rem.fieldId,
            type: rem.type,
            errorMessage: 'Session expired — sign in to sync',
          })
        }
        // Break since we've accounted for remaining
        break
      }

      // Retry with fresh token
      const retry = await replayOperation(op, token)
      if (retry.status === 'synced') {
        await offlineQueue.delete(op.id)
        result.synced++
      } else if (retry.status === 'conflict') {
        await offlineQueue.delete(op.id)
        result.skipped.push({
          operationId: op.id,
          fieldId: op.fieldId,
          type: op.type,
          reason: 'Already confirmed — skipped',
        })
      } else {
        await offlineQueue.update(op.id, {
          status: 'failed',
          errorMessage: retry.errorMessage ?? 'Auth failed after token refresh',
        })
        result.failed.push({
          operationId: op.id,
          fieldId: op.fieldId,
          type: op.type,
          errorMessage: retry.errorMessage ?? 'Auth failed after token refresh',
          httpStatus: retry.httpStatus,
        })
      }
      continue
    }

    // Transient server/network errors — increment retry count
    const isTransient =
      !httpStatus || // network error (no HTTP status)
      httpStatus >= 500 ||
      replay.errorMessage?.includes('timed out') ||
      replay.errorMessage?.includes('Network error')

    if (isTransient) {
      const newRetryCount = op.retryCount + 1
      if (newRetryCount >= 3) {
        await offlineQueue.update(op.id, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage: replay.errorMessage ?? 'Max retries exceeded',
        })
        result.failed.push({
          operationId: op.id,
          fieldId: op.fieldId,
          type: op.type,
          errorMessage: replay.errorMessage ?? 'Max retries exceeded',
          httpStatus,
        })
      } else {
        await offlineQueue.update(op.id, {
          retryCount: newRetryCount,
        })
        // Leave as 'pending' for next processQueue call
      }
      continue
    }

    // Other client error (4xx) — permanent failure
    await offlineQueue.update(op.id, {
      status: 'failed',
      errorMessage: replay.errorMessage ?? `HTTP ${httpStatus}`,
    })
    result.failed.push({
      operationId: op.id,
      fieldId: op.fieldId,
      type: op.type,
      errorMessage: replay.errorMessage ?? `HTTP ${httpStatus}`,
      httpStatus,
    })
  }

  // Write last-sync timestamp if at least one item was synced or skipped
  if (result.synced > 0 || result.skipped.length > 0) {
    await writeLastSyncTimestamp()
  }

  return result
}
