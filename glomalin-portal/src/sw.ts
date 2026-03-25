import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Declare Serwist globals injected at build time
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Background Sync API event — not included in TypeScript lib by default
interface SyncEvent extends ExtendableEvent {
  tag: string
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ─── Background Sync: replay queued pass confirmations ────────────────────────
//
// The service worker cannot import from app modules that use the `idb` library
// (those modules are not available in the SW bundle context). Instead, we use
// the raw IndexedDB API directly here.

const SW_DB_NAME = 'glomalin-offline'
const SW_DB_VERSION = 3

/** Open the offline IndexedDB directly using raw IDB API */
function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_DB_NAME, SW_DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        const queueStore = db.createObjectStore('operation-queue', { keyPath: 'id' })
        queueStore.createIndex('by-status', 'status')
        db.createObjectStore('crop-plan-cache', { keyPath: 'fieldId' })
      }
      if (oldVersion < 2) {
        const obsStore = db.createObjectStore('observation-queue', {
          keyPath: 'localId',
          autoIncrement: true,
        })
        obsStore.createIndex('by-synced', 'synced')
      }
      if (oldVersion < 3) {
        db.createObjectStore('sync-config', { keyPath: 'key' })
      }
    }
  })
}

/** Read the stored auth token from sync-config store */
function getStoredToken(db: IDBDatabase): Promise<string | null> {
  return new Promise((resolve) => {
    const tx = db.transaction('sync-config', 'readonly')
    const store = tx.objectStore('sync-config')
    const req = store.get('auth-token')
    req.onsuccess = () => {
      const record = req.result as { key: string; value: string } | undefined
      resolve(record?.value ?? null)
    }
    req.onerror = () => resolve(null)
  })
}

/** Read all pending operations from operation-queue store */
function getPendingOps(db: IDBDatabase): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('operation-queue', 'readonly')
    const store = tx.objectStore('operation-queue')
    const index = store.index('by-status')
    const req = index.getAll('pending')
    req.onsuccess = () => resolve(req.result as unknown[])
    req.onerror = () => reject(req.error)
  })
}

/** Delete an operation from the queue by ID */
function deleteOp(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('operation-queue', 'readwrite')
    const store = tx.objectStore('operation-queue')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Update an operation's fields in the queue */
function updateOp(db: IDBDatabase, op: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('operation-queue', 'readwrite')
    const store = tx.objectStore('operation-queue')
    const req = store.put(op)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Replay a single queued operation against the API from the service worker context.
 * Uses raw fetch — no app module imports available here.
 */
async function replayOpInSW(
  op: Record<string, unknown>,
  token: string
): Promise<'synced' | 'conflict' | 'transient-error' | 'client-error'> {
  const signal = AbortSignal.timeout(10000)

  let res: Response
  try {
    if (op['type'] === 'confirm-pass') {
      res = await fetch('/api/mobile/passes/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldId: op['fieldId'],
          passId: op['passId'],
          passType: op['passType'],
          operationDate: op['operationDate'],
          operatorCertUserId: op['operatorId'],
        }),
        signal,
      })
    } else {
      res = await fetch('/api/mobile/passes/add', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldId: op['fieldId'],
          operationType: op['operationType'],
          operationDate: op['operationDate'],
          notes: op['description'],
          operatorCertUserId: op['operatorId'],
        }),
        signal,
      })
    }
  } catch {
    return 'transient-error'
  }

  if (res.ok) return 'synced'
  if (res.status === 409) return 'conflict'

  // Check body for "already confirmed" text
  try {
    const text = await res.text()
    if (text.toLowerCase().includes('already confirmed')) return 'conflict'
  } catch {
    // ignore
  }

  if (res.status >= 500) return 'transient-error'
  return 'client-error'
}

/** Handle the pass-sync Background Sync event */
async function handlePassSync(): Promise<void> {
  let db: IDBDatabase
  try {
    db = await openOfflineDb()
  } catch {
    return
  }

  const token = await getStoredToken(db)
  if (!token) return

  const ops = await getPendingOps(db)

  // Sort FIFO by createdAt
  ops.sort((a, b) => {
    const opA = a as Record<string, unknown>
    const opB = b as Record<string, unknown>
    const aTime = String(opA['createdAt'] ?? '')
    const bTime = String(opB['createdAt'] ?? '')
    return aTime.localeCompare(bTime)
  })

  for (const rawOp of ops) {
    const op = rawOp as Record<string, unknown>
    const outcome = await replayOpInSW(op, token)

    if (outcome === 'synced' || outcome === 'conflict') {
      await deleteOp(db, String(op['id']))
    } else if (outcome === 'transient-error') {
      const retryCount = (Number(op['retryCount']) || 0) + 1
      if (retryCount >= 3) {
        await updateOp(db, {
          ...op,
          retryCount,
          status: 'failed',
          errorMessage: 'Max retries exceeded during background sync',
        })
      } else {
        await updateOp(db, { ...op, retryCount })
      }
    } else {
      // client-error — permanent failure
      await updateOp(db, {
        ...op,
        status: 'failed',
        errorMessage: 'Sync failed — check in app for details',
      })
    }
  }
}

// Register the Background Sync event listener
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'pass-sync') {
    event.waitUntil(handlePassSync())
  }
})
