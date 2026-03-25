import { openDB, IDBPDatabase } from 'idb'
import type { QueuedOperation, CachedCropPlan, OfflineDB } from './types'

const DB_NAME = 'glomalin-offline'
const DB_VERSION = 3

// Singleton db promise — reuse connection across calls
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

export function getDb(): Promise<IDBPDatabase<OfflineDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available (SSR context)'))
  }

  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1 stores
        if (oldVersion < 1) {
          const queueStore = db.createObjectStore('operation-queue', {
            keyPath: 'id',
          })
          queueStore.createIndex('by-status', 'status')

          db.createObjectStore('crop-plan-cache', {
            keyPath: 'fieldId',
          })
        }

        // Version 2: observation queue
        if (oldVersion < 2) {
          const obsStore = db.createObjectStore('observation-queue', {
            keyPath: 'localId',
            autoIncrement: true,
          })
          obsStore.createIndex('by-synced', 'synced')
        }

        // Version 3: sync-config store for Background Sync auth token
        if (oldVersion < 3) {
          db.createObjectStore('sync-config', { keyPath: 'key' })
        }
      },
    })
  }

  return dbPromise
}

// SSR guard helper — silently no-op if IndexedDB unavailable
function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

// --- Operation Queue API ---

export const offlineQueue = {
  async add(
    op: Omit<QueuedOperation, 'id' | 'createdAt' | 'status' | 'retryCount'>
  ): Promise<QueuedOperation> {
    if (!isAvailable()) return Promise.reject(new Error('IndexedDB unavailable'))
    const db = await getDb()
    const full: QueuedOperation = {
      ...op,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    }
    await db.put('operation-queue', full)
    return full
  },

  async getAll(): Promise<QueuedOperation[]> {
    if (!isAvailable()) return []
    const db = await getDb()
    return db.getAll('operation-queue')
  },

  async getPending(): Promise<QueuedOperation[]> {
    if (!isAvailable()) return []
    const db = await getDb()
    return db.getAllFromIndex('operation-queue', 'by-status', 'pending')
  },

  async update(id: string, updates: Partial<QueuedOperation>): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    const existing = await db.get('operation-queue', id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    await db.put('operation-queue', updated)
  },

  async delete(id: string): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    await db.delete('operation-queue', id)
  },

  async clear(): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    await db.clear('operation-queue')
  },
}

// --- Crop Plan Cache API ---

export const cropPlanCache = {
  async put(plan: Omit<CachedCropPlan, 'cachedAt'> & { cachedAt?: string }): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    const withTimestamp: CachedCropPlan = {
      ...plan,
      cachedAt: new Date().toISOString(),
    }
    await db.put('crop-plan-cache', withTimestamp)
  },

  async get(fieldId: string): Promise<CachedCropPlan | undefined> {
    if (!isAvailable()) return undefined
    const db = await getDb()
    return db.get('crop-plan-cache', fieldId)
  },

  async getAll(): Promise<CachedCropPlan[]> {
    if (!isAvailable()) return []
    const db = await getDb()
    return db.getAll('crop-plan-cache')
  },

  async clear(): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    await db.clear('crop-plan-cache')
  },

  async getLastSyncTime(): Promise<string | null> {
    if (!isAvailable()) return null
    const db = await getDb()
    const all = await db.getAll('crop-plan-cache')
    if (all.length === 0) return null
    const sorted = all.map((p) => p.cachedAt).sort()
    return sorted[sorted.length - 1]
  },
}
