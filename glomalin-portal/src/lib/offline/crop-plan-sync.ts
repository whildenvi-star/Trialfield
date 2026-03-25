import { cropPlanCache, offlineQueue } from './db'
import { requestBackgroundSync, setSyncToken } from './sync-engine'
import type { CachedCropPlan } from './types'

/** Shape returned by /api/mobile/crop-plans for each field in the list */
export interface CropPlanListItem {
  fieldId: string
  fieldName: string
  crop: string
  variety: string
  acres: number
  enterprise: string
  enterpriseId: string
}

/** Shape returned by /api/mobile/crop-plans */
interface CropPlanListResponse {
  fields: CropPlanListItem[]
  syncTimestamp: string
}

/** Shape returned by /api/mobile/operators */
export interface OperatorRecord {
  supabaseId: string
  certUserId: string
  fullName: string
  role: string
}

/** Fetch fresh field list from API, cache each field, return list data */
export async function syncCropPlans(
  token: string
): Promise<{ fields: CropPlanListItem[]; syncTimestamp: string }> {
  if (typeof window === 'undefined') {
    return { fields: [], syncTimestamp: new Date().toISOString() }
  }

  const res = await fetch('/api/mobile/crop-plans', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch crop plans: ${res.status}`)
  }

  const data: CropPlanListResponse = await res.json()

  // Cache each field entry into IndexedDB
  for (const field of data.fields) {
    // Build a minimal CachedCropPlan from the list item so detail cache is at least partially warm
    // Full detail (inputs, passes) comes from syncCropPlanDetail
    await cropPlanCache.put({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      crop: field.crop,
      variety: field.variety,
      acres: field.acres,
      enterprise: field.enterprise,
      inputs: [],
      passes: [],
    })
  }

  return { fields: data.fields, syncTimestamp: data.syncTimestamp }
}

/** Fetch a single field's full detail from API and cache it */
export async function syncCropPlanDetail(
  token: string,
  fieldId: string
): Promise<CachedCropPlan> {
  if (typeof window === 'undefined') {
    throw new Error('SSR context: cannot sync crop plan detail')
  }

  const res = await fetch(`/api/mobile/crop-plans/${fieldId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch crop plan detail: ${res.status}`)
  }

  const data: CachedCropPlan = await res.json()
  await cropPlanCache.put(data)
  return data
}

/** Read all cached crop plans from IndexedDB */
export async function getCachedCropPlans(): Promise<CachedCropPlan[]> {
  if (typeof window === 'undefined') return []
  return cropPlanCache.getAll()
}

/** Read a single cached crop plan from IndexedDB */
export async function getCachedCropPlan(
  fieldId: string
): Promise<CachedCropPlan | undefined> {
  if (typeof window === 'undefined') return undefined
  return cropPlanCache.get(fieldId)
}

/** Get the ISO timestamp of the most recent cache write, or null if cache is empty */
export async function getLastSyncTime(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  return cropPlanCache.getLastSyncTime()
}

// ─── Pass write functions (Plan 02) ─────────────────────────────────────────

/**
 * Confirm a planned pass — POST /api/mobile/passes/confirm
 * Returns the created FieldOperation ID.
 * On network/offline error, queues the operation in IndexedDB and returns { queued: true }.
 */
export async function confirmPass(
  token: string,
  fieldId: string,
  passId: string,
  passType: string,
  operationDate?: string,
  operatorCertUserId?: string
): Promise<{ fieldOperationId: string; queued?: boolean }> {
  try {
    const res = await fetch('/api/mobile/passes/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fieldId, passId, passType, operationDate, operatorCertUserId }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Failed to confirm pass: ${res.status}`)
    }

    return res.json()
  } catch (err: unknown) {
    // Only queue on network/offline errors — re-throw HTTP errors
    if (err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')) {
      await offlineQueue.add({
        type: 'confirm-pass',
        fieldId,
        passId,
        passType,
        operationDate: operationDate ?? new Date().toISOString().slice(0, 10),
        operatorId: operatorCertUserId ?? '',
        operatorName: '',
      })
      await setSyncToken(token)
      requestBackgroundSync()
      return { fieldOperationId: 'pending-' + crypto.randomUUID(), queued: true }
    }
    throw err
  }
}

/**
 * Add an unplanned pass — POST /api/mobile/passes/add
 * Returns the created FieldOperation ID and the new pass object.
 * On network/offline error, queues the operation in IndexedDB and returns { queued: true }.
 */
export async function addPass(
  token: string,
  fieldId: string,
  operationType: string,
  operationDate?: string,
  notes?: string,
  operatorCertUserId?: string
): Promise<{ fieldOperationId: string; pass: object; queued?: boolean }> {
  try {
    const res = await fetch('/api/mobile/passes/add', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fieldId, operationType, operationDate, notes, operatorCertUserId }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Failed to add pass: ${res.status}`)
    }

    return res.json()
  } catch (err: unknown) {
    // Only queue on network/offline errors — re-throw HTTP errors
    if (err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')) {
      const resolvedDate = operationDate ?? new Date().toISOString().slice(0, 10)
      await offlineQueue.add({
        type: 'add-pass',
        fieldId,
        operationType,
        operationDate: resolvedDate,
        description: notes,
        operatorId: operatorCertUserId ?? '',
        operatorName: '',
      })
      await setSyncToken(token)
      requestBackgroundSync()
      return {
        fieldOperationId: 'pending-' + crypto.randomUUID(),
        pass: {
          id: 'pending',
          type: operationType,
          status: 'CONFIRMED',
          operationDate: resolvedDate,
          operatorName: '',
        },
        queued: true,
      }
    }
    throw err
  }
}

/**
 * Edit a confirmed pass (date / operator) — PUT /api/mobile/passes/[passId]
 */
export async function editPass(
  token: string,
  passId: string,
  fieldEnterpriseId: string,
  operationDate?: string,
  operatorCertUserId?: string
): Promise<void> {
  const res = await fetch(`/api/mobile/passes/${passId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fieldEnterpriseId, operationDate, operatorCertUserId }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Failed to edit pass: ${res.status}`)
  }
}

/**
 * Fetch the list of operators (operator+ roles with cert_user_id) — GET /api/mobile/operators
 */
export async function fetchOperators(token: string): Promise<OperatorRecord[]> {
  const res = await fetch('/api/mobile/operators', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch operators: ${res.status}`)
  }

  const data: { operators: OperatorRecord[] } = await res.json()
  return data.operators
}
