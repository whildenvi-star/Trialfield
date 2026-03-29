import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchBudgetActivities,
  fetchCertActivities,
  fetchFieldOpsActivities,
  fetchGrainActivities,
} from '@/lib/timeline/fetch-sources'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { SingleSourceResponse, TimelineEntry, TimelineSource } from '@/lib/timeline/types'

/** Valid source values for the :source path param. */
const VALID_SOURCES: TimelineSource[] = ['budget', 'cert', 'fieldops', 'grain']

/**
 * GET /api/timeline/:fieldId/:source
 *
 * Per-source endpoint for progressive timeline loading.
 * The UI calls all 4 in parallel — each resolves independently so entries
 * can be rendered as each source responds, without waiting for the slowest one.
 *
 * Always returns HTTP 200, even on source failure — the `error` field signals
 * degraded state to the client so it can show a warning banner instead of a
 * network error.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fieldId: string; source: string }> }
) {
  // Auth guard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { fieldId, source } = await params

  // Validate source param
  if (!VALID_SOURCES.includes(source as TimelineSource)) {
    return NextResponse.json(
      {
        error: `Invalid source "${source}". Must be one of: ${VALID_SOURCES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const validSource = source as TimelineSource

  // Parse optional year query param
  const url = new URL(request.url)
  const yearParam = url.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  // Map source to its fetch function
  const fetchMap: Record<TimelineSource, () => Promise<TimelineEntry[]>> = {
    budget: () => fetchBudgetActivities(fieldId),
    cert: () => fetchCertActivities(fieldId),
    fieldops: () => fetchFieldOpsActivities(fieldId),
    grain: () => fetchGrainActivities(fieldId, year),
  }

  try {
    const entries = await fetchMap[validSource]()
    const response: SingleSourceResponse = {
      source: validSource,
      entries,
      error: null,
    }
    return NextResponse.json(response)
  } catch (err) {
    // Return 200 with error field — client treats this as degraded source,
    // not a network error, matching the partial-data-with-warnings pattern.
    const message =
      err instanceof Error ? err.message : `Failed to fetch ${validSource} activities`
    const response: SingleSourceResponse = {
      source: validSource,
      entries: [],
      error: message,
    }
    return NextResponse.json(response, { status: 200 })
  }
}
