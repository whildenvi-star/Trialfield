import { describe, it, expect, beforeEach } from 'vitest'
import { offlineQueue, cropPlanCache } from '../db'

// Reset DB state before each test by clearing both stores
// We also need to reset the singleton so each test gets a fresh state
beforeEach(async () => {
  await offlineQueue.clear()
  await cropPlanCache.clear()
})

// --- Operation Queue Tests ---

describe('offlineQueue', () => {
  const baseOp = {
    type: 'confirm-pass' as const,
    fieldOperationId: 'op-123',
    operationDate: '2026-06-15',
    operatorId: 'user-abc',
    operatorName: 'John Hughes',
  }

  it('add() creates an operation with generated id, createdAt, status=pending, retryCount=0', async () => {
    const result = await offlineQueue.add(baseOp)

    expect(result.id).toBeTruthy()
    expect(result.createdAt).toBeTruthy()
    expect(result.status).toBe('pending')
    expect(result.retryCount).toBe(0)
    expect(result.type).toBe('confirm-pass')
    expect(result.operatorName).toBe('John Hughes')
  })

  it('add() generates unique ids for each operation', async () => {
    const op1 = await offlineQueue.add(baseOp)
    const op2 = await offlineQueue.add(baseOp)

    expect(op1.id).not.toBe(op2.id)
  })

  it('getAll() returns all added operations', async () => {
    await offlineQueue.add(baseOp)
    await offlineQueue.add({ ...baseOp, type: 'add-pass' as const })

    const all = await offlineQueue.getAll()
    expect(all).toHaveLength(2)
  })

  it('getPending() returns only status=pending operations', async () => {
    const op1 = await offlineQueue.add(baseOp)
    await offlineQueue.add(baseOp)

    // Mark op1 as synced
    await offlineQueue.update(op1.id, { status: 'synced' })

    const pending = await offlineQueue.getPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].status).toBe('pending')
  })

  it('getPending() does not return failed operations', async () => {
    const op = await offlineQueue.add(baseOp)
    await offlineQueue.update(op.id, { status: 'failed', errorMessage: 'Network error' })

    const pending = await offlineQueue.getPending()
    expect(pending).toHaveLength(0)
  })

  it('update() merges partial updates', async () => {
    const op = await offlineQueue.add(baseOp)

    await offlineQueue.update(op.id, { status: 'synced', retryCount: 1 })

    const all = await offlineQueue.getAll()
    const updated = all.find((o) => o.id === op.id)
    expect(updated?.status).toBe('synced')
    expect(updated?.retryCount).toBe(1)
    // Original fields preserved
    expect(updated?.operatorName).toBe('John Hughes')
  })

  it('delete() removes a specific operation by id', async () => {
    const op1 = await offlineQueue.add(baseOp)
    await offlineQueue.add(baseOp)

    await offlineQueue.delete(op1.id)

    const all = await offlineQueue.getAll()
    expect(all).toHaveLength(1)
    expect(all.find((o) => o.id === op1.id)).toBeUndefined()
  })

  it('clear() removes all operations', async () => {
    await offlineQueue.add(baseOp)
    await offlineQueue.add(baseOp)

    await offlineQueue.clear()

    const all = await offlineQueue.getAll()
    expect(all).toHaveLength(0)
  })

  it('getPending() returns empty array when no pending ops', async () => {
    const pending = await offlineQueue.getPending()
    expect(pending).toEqual([])
  })
})

// --- Crop Plan Cache Tests ---

describe('cropPlanCache', () => {
  const basePlan = {
    fieldId: 'field-001',
    fieldName: 'North 80',
    crop: 'Corn',
    variety: 'NK9527AM',
    acres: 78.5,
    enterprise: 'Corn - Conventional',
    inputs: [
      { product: 'Urea', rate: '150', unit: 'lbs/ac' },
    ],
    passes: [
      { id: 'pass-1', type: 'PLANTING', status: 'PLANNED' as const },
    ],
  }

  it('put() stores a crop plan keyed by fieldId with cachedAt timestamp', async () => {
    await cropPlanCache.put(basePlan)

    const result = await cropPlanCache.get('field-001')
    expect(result).toBeDefined()
    expect(result?.fieldId).toBe('field-001')
    expect(result?.cachedAt).toBeTruthy()
    expect(result?.crop).toBe('Corn')
  })

  it('put() upserts — second put with same fieldId overwrites', async () => {
    await cropPlanCache.put(basePlan)
    await cropPlanCache.put({ ...basePlan, crop: 'Soybeans', variety: 'P28A24X' })

    const all = await cropPlanCache.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].crop).toBe('Soybeans')
  })

  it('get() retrieves a specific plan by fieldId', async () => {
    await cropPlanCache.put(basePlan)
    await cropPlanCache.put({ ...basePlan, fieldId: 'field-002', fieldName: 'South 40' })

    const result = await cropPlanCache.get('field-002')
    expect(result?.fieldName).toBe('South 40')
  })

  it('get() returns undefined for non-existent key', async () => {
    const result = await cropPlanCache.get('does-not-exist')
    expect(result).toBeUndefined()
  })

  it('getAll() returns all cached plans', async () => {
    await cropPlanCache.put(basePlan)
    await cropPlanCache.put({ ...basePlan, fieldId: 'field-002', fieldName: 'South 40' })

    const all = await cropPlanCache.getAll()
    expect(all).toHaveLength(2)
  })

  it('clear() removes all cached plans', async () => {
    await cropPlanCache.put(basePlan)
    await cropPlanCache.put({ ...basePlan, fieldId: 'field-002', fieldName: 'South 40' })

    await cropPlanCache.clear()

    const all = await cropPlanCache.getAll()
    expect(all).toHaveLength(0)
  })

  it('getLastSyncTime() returns null when empty', async () => {
    const time = await cropPlanCache.getLastSyncTime()
    expect(time).toBeNull()
  })

  it('getLastSyncTime() returns the most recent cachedAt', async () => {
    await cropPlanCache.put(basePlan)
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5))
    await cropPlanCache.put({ ...basePlan, fieldId: 'field-002', fieldName: 'South 40' })

    const time = await cropPlanCache.getLastSyncTime()
    expect(time).toBeTruthy()

    const all = await cropPlanCache.getAll()
    const latest = all.map((p) => p.cachedAt).sort().at(-1)
    expect(time).toBe(latest)
  })
})

// --- Cross-call Tests ---

describe('persistence across getDb() calls', () => {
  it('operations survive across multiple getDb() calls (same DB instance)', async () => {
    // Add via first call
    await offlineQueue.add({
      type: 'confirm-pass',
      fieldOperationId: 'op-persist',
      operationDate: '2026-06-15',
      operatorId: 'user-abc',
      operatorName: 'Test User',
    })

    // Retrieve via separate call (tests singleton)
    const all = await offlineQueue.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].fieldOperationId).toBe('op-persist')
  })
})
