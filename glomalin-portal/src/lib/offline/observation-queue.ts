import { getDb } from './db'
import type { PendingObservation } from './types'

const STORE = 'observation-queue' as const

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export const observationQueue = {
  async add(
    obs: Omit<PendingObservation, 'localId' | 'synced' | 'createdAt'>
  ): Promise<number> {
    if (!isAvailable()) throw new Error('IndexedDB unavailable')
    const db = await getDb()
    const record: Omit<PendingObservation, 'localId'> = {
      ...obs,
      synced: 0,
      createdAt: Date.now(),
    }
    return db.add(STORE, record as PendingObservation) as Promise<number>
  },

  async getPending(): Promise<PendingObservation[]> {
    if (!isAvailable()) return []
    const db = await getDb()
    // synced stored as 0 (pending) or 1 (synced) for reliable IDB indexing
    return db.getAllFromIndex(STORE, 'by-synced', IDBKeyRange.only(0))
  },

  async markSynced(localId: number): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    const tx = db.transaction(STORE, 'readwrite')
    const record = await tx.store.get(localId)
    if (record) {
      record.synced = 1
      await tx.store.put(record)
    }
    await tx.done
  },

  async pendingCount(): Promise<number> {
    const pending = await this.getPending()
    return pending.length
  },

  async purgeOld(maxAgeDays = 7): Promise<void> {
    if (!isAvailable()) return
    const db = await getDb()
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const tx = db.transaction(STORE, 'readwrite')
    let cursor = await tx.store.openCursor()
    while (cursor) {
      if (cursor.value.synced === 1 && cursor.value.createdAt < cutoff) {
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }
    await tx.done
  },
}
