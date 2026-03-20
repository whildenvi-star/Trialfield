import { cropPlanCache } from './db'
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
