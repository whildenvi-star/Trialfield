import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRegistryService, fetchBudgetService } from '@/app/api/mobile/_lib/proxy'

/**
 * GET /api/maps/boundaries
 *
 * Returns all field_boundaries rows as a GeoJSON FeatureCollection.
 *
 * Each feature's properties include:
 *   registry_field_id, name, centroid_lat, centroid_lng  — from Supabase field_boundaries
 *   crop          — from farm-budget /api/fields (matched by registryFieldId)
 *   organic       — derived from farm-registry certStatus === 'organic'
 *   reportingAcres — from farm-registry /api/fields
 *
 * Registry/budget data is merged server-side so the client only needs one fetch.
 * If the Express services are unavailable, features fall back to crop=null, organic=false.
 *
 * Requires authenticated session.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch field boundaries from Supabase
  const { data: rows, error } = await supabase
    .from('field_boundaries')
    .select('registry_field_id, name, geojson, centroid_lat, centroid_lng')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch crop and organic metadata from Express services in parallel.
  // Both fetches use Promise.allSettled — map renders with gray fills if services are down.
  interface BudgetField {
    id: string
    name: string
    crop?: string | null
    registryFieldId?: string | null
  }
  interface RegistryField {
    id: string
    name: string
    certStatus?: string
    reportingAcres?: number
  }

  const [budgetResult, registryResult] = await Promise.allSettled([
    fetchBudgetService('/api/fields').then((r) => r.ok ? r.json() as Promise<BudgetField[]> : []),
    fetchRegistryService('/api/fields?active=true').then((r) => r.ok ? r.json() as Promise<RegistryField[]> : []),
  ])

  // Build lookup maps keyed by registry field ID
  const budgetByRegistryId = new Map<string, BudgetField>()
  if (budgetResult.status === 'fulfilled') {
    const budgetFields: BudgetField[] = Array.isArray(budgetResult.value) ? budgetResult.value : []
    for (const f of budgetFields) {
      if (f.registryFieldId) {
        budgetByRegistryId.set(f.registryFieldId, f)
      }
    }
  }

  const registryById = new Map<string, RegistryField>()
  if (registryResult.status === 'fulfilled') {
    const registryFields: RegistryField[] = Array.isArray(registryResult.value) ? registryResult.value : []
    for (const f of registryFields) {
      registryById.set(f.id, f)
    }
  }

  const features = (rows ?? []).map((row) => {
    const budget = budgetByRegistryId.get(row.registry_field_id)
    const registry = registryById.get(row.registry_field_id)

    return {
      type: 'Feature' as const,
      geometry: row.geojson,
      properties: {
        registry_field_id: row.registry_field_id,
        name: row.name,
        centroid_lat: row.centroid_lat ?? null,
        centroid_lng: row.centroid_lng ?? null,
        // Crop from farm-budget field record (null if not set or service unavailable)
        crop: budget?.crop ?? null,
        // Organic status from farm-registry certStatus field
        organic: registry?.certStatus === 'organic',
        // Reporting acres from farm-registry
        reportingAcres: registry?.reportingAcres ?? 0,
      },
    }
  })

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
  })
}
