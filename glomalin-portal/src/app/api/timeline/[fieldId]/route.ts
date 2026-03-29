import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchBudgetActivities,
  fetchCertActivities,
  fetchFieldOpsActivities,
  fetchGrainActivities,
  mergeTimeline,
} from '@/lib/timeline/fetch-sources'
import { fetchRegistryService } from '@/app/api/mobile/_lib/proxy'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { TimelineResponse } from '@/lib/timeline/types'

/**
 * GET /api/timeline/:fieldId
 *
 * Aggregated timeline endpoint — fetches all 4 sources in parallel via
 * Promise.allSettled, merges entries into a single chronological list,
 * and returns a TimelineResponse with partial data + warnings if any
 * source is unavailable.
 *
 * Primarily used for export/PDF flows that need all entries in one request.
 * The live UI uses the per-source endpoint at /api/timeline/:fieldId/:source
 * for progressive loading.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  try {
    // Auth guard
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fieldId } = await params

    // Parse optional year query param
    const url = new URL(request.url)
    const yearParam = url.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

    // Resolve field name from farm-registry
    const registryRes = await fetchRegistryService('/api/fields')
    if (!registryRes.ok) {
      return NextResponse.json(
        { error: 'Farm registry unavailable' },
        { status: 502 }
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registryFields: any[] = await registryRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registryField = Array.isArray(registryFields)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registryFields.find((f: any) => f.id === fieldId)
      : null

    if (!registryField) {
      return NextResponse.json(
        { error: 'Field not found in registry' },
        { status: 404 }
      )
    }

    const fieldName: string = registryField.name ?? fieldId

    // Fetch all 4 sources in parallel — partial failures produce warnings, not errors
    const results = await Promise.allSettled([
      fetchBudgetActivities(fieldId),
      fetchCertActivities(fieldId),
      fetchFieldOpsActivities(fieldId),
      fetchGrainActivities(fieldId, year),
    ])

    const { entries, warnings } = mergeTimeline(results, [
      'budget',
      'cert',
      'fieldops',
      'grain',
    ])

    const response: TimelineResponse = {
      fieldId,
      fieldName,
      entries,
      warnings,
      year,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    )
  }
}
