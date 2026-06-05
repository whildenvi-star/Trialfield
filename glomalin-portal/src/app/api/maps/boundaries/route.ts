import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRegistryService, fetchBudgetService } from '@/app/api/mobile/_lib/proxy'
import { PrecipAppAdapter } from '@/lib/weather/precip-adapter'
import { CURRENT_CROP_YEAR } from '@/lib/config'

/**
 * GET /api/maps/boundaries
 *
 * Returns a GeoJSON FeatureCollection of all field boundaries, enriched with:
 *   crop, organic, reportingAcres — from farm-budget + farm-registry Express services
 *   last_7d_in, last_30d_in      — from precip_summary view (null if not available)
 *
 * Also returns a top-level `meta` block:
 *   { total_acres, organic_acres, precip_configured, precip_avg_7d, precip_last_fetched }
 *
 * Used by FieldMap as a single fetch for the 30,000-ft operations view.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
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

  interface BudgetField    { id: string; name: string; crop?: string | null; registryFieldId?: string | null }
  interface RegistryField  { id: string; name: string; certStatus?: string; reportingAcres?: number }
  interface PrecipRow      { registry_field_id: string; last_7d_in: number | null; last_30d_in: number | null; last_fetched: string | null }
  interface CluRow         { registry_field_id: string | null; reported: boolean }

  // Fetch crop metadata, registry metadata, precip cache, and FSA status in parallel.
  // All use Promise.allSettled — map degrades gracefully if any source is unavailable.
  const [budgetResult, registryResult, precipResult, fsaResult] = await Promise.allSettled([
    fetchBudgetService('/api/fields').then((r) => r.ok ? r.json() as Promise<BudgetField[]> : [] as BudgetField[]),
    fetchRegistryService('/api/fields?active=true').then((r) => r.ok ? r.json() as Promise<RegistryField[]> : [] as RegistryField[]),
    supabase.from('precip_summary').select('registry_field_id, last_7d_in, last_30d_in, last_fetched'),
    supabase
      .from('clu_records')
      .select('registry_field_id, reported')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .not('registry_field_id', 'is', null),
  ])

  // Build lookup maps
  const budgetByRegistryId = new Map<string, BudgetField>()
  if (budgetResult.status === 'fulfilled') {
    for (const f of (Array.isArray(budgetResult.value) ? budgetResult.value : []) as BudgetField[]) {
      if (f.registryFieldId) budgetByRegistryId.set(f.registryFieldId, f)
    }
  }

  const registryById = new Map<string, RegistryField>()
  if (registryResult.status === 'fulfilled') {
    for (const f of (Array.isArray(registryResult.value) ? registryResult.value : []) as RegistryField[]) {
      registryById.set(f.id, f)
    }
  }

  const precipById = new Map<string, Pick<PrecipRow, 'last_7d_in' | 'last_30d_in'>>()
  let precipLastFetched: string | null = null
  if (precipResult.status === 'fulfilled' && !precipResult.value.error) {
    for (const row of (precipResult.value.data ?? []) as PrecipRow[]) {
      precipById.set(row.registry_field_id, {
        last_7d_in:  row.last_7d_in  != null ? Number(row.last_7d_in)  : null,
        last_30d_in: row.last_30d_in != null ? Number(row.last_30d_in) : null,
      })
      if (row.last_fetched && (!precipLastFetched || row.last_fetched > precipLastFetched)) {
        precipLastFetched = row.last_fetched
      }
    }
  }

  // FSA reported status: true only if ALL CLUs for a field are reported.
  // null if the field has no CLU records (not an FSA field).
  const fsaClusByField = new Map<string, boolean[]>()
  if (fsaResult.status === 'fulfilled' && !fsaResult.value.error) {
    for (const row of (fsaResult.value.data ?? []) as CluRow[]) {
      if (!row.registry_field_id) continue
      const arr = fsaClusByField.get(row.registry_field_id) ?? []
      arr.push(row.reported)
      fsaClusByField.set(row.registry_field_id, arr)
    }
  }

  // Build features
  let totalAcres = 0
  let organicAcres = 0
  let precipSum = 0
  let precipCount = 0

  const features = (rows ?? []).map((row) => {
    const budget   = budgetByRegistryId.get(row.registry_field_id)
    const registry = registryById.get(row.registry_field_id)
    const precip   = precipById.get(row.registry_field_id)

    const isOrganic      = registry?.certStatus === 'organic'
    const reportingAcres = registry?.reportingAcres ?? 0
    const last7d         = precip?.last_7d_in  ?? null
    const last30d        = precip?.last_30d_in ?? null
    const cluStatuses    = fsaClusByField.get(row.registry_field_id)
    const fsa_reported   = cluStatuses ? cluStatuses.every(Boolean) : null

    totalAcres   += reportingAcres
    if (isOrganic) organicAcres += reportingAcres
    if (last7d != null) { precipSum += last7d; precipCount++ }

    return {
      type: 'Feature' as const,
      geometry: row.geojson,
      properties: {
        registry_field_id: row.registry_field_id,
        name:              row.name,
        centroid_lat:      row.centroid_lat ?? null,
        centroid_lng:      row.centroid_lng ?? null,
        crop:              budget?.crop ?? null,
        organic:           isOrganic,
        reportingAcres,
        fsa_reported,
        last_7d_in:        last7d,
        last_30d_in:       last30d,
      },
    }
  })

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    meta: {
      total_acres:            Math.round(totalAcres   * 10) / 10,
      organic_acres:          Math.round(organicAcres * 10) / 10,
      precip_configured:      PrecipAppAdapter.isConfigured(),
      precip_avg_7d:          precipCount > 0 ? Math.round((precipSum / precipCount) * 100) / 100 : null,
      precip_last_fetched:    precipLastFetched,
      total_registry_fields:  registryById.size > 0 ? registryById.size : null,
      fields_with_boundaries: features.length,
    },
  })
}
