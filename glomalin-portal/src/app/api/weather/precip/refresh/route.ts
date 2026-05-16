import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { PrecipAppAdapter } from '@/lib/weather/precip-adapter'

// POST /api/weather/precip/refresh
// Fetches fresh precipitation data (30 days back + 7 days forecast) from Precip.ai
// for all fields that have stored centroids in field_boundaries, then upserts
// into precip_cache.
// Returns { refreshed: N, fields_updated: N, errors: string[] }
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!PrecipAppAdapter.isConfigured()) {
    return NextResponse.json(
      {
        error:  'Precip.ai not configured',
        detail: 'Set PRECIP_APP_API_KEY (and optionally PRECIP_APP_BASE_URL) in your environment.',
      },
      { status: 422 }
    )
  }

  const { data: boundaries, error: boundaryErr } = await supabase
    .from('field_boundaries')
    .select('registry_field_id, centroid_lat, centroid_lng')
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null)

  if (boundaryErr) {
    return NextResponse.json({ error: boundaryErr.message }, { status: 500 })
  }

  if (!boundaries || boundaries.length === 0) {
    return NextResponse.json({ refreshed: 0, fields_updated: 0, errors: ['No field boundaries with centroids found'] })
  }

  const fields = boundaries.map((b) => ({
    id:  b.registry_field_id as string,
    lat: b.centroid_lat      as number,
    lng: b.centroid_lng      as number,
  }))

  let points
  try {
    // 30 days historical + 7 days forecast in a single fetch pass
    points = await PrecipAppAdapter.fetchPrecip(fields, { days: 30, forecastDays: 7 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Precip fetch failed: ${msg}` }, { status: 502 })
  }

  if (points.length === 0) {
    return NextResponse.json({ refreshed: 0, fields_updated: 0, errors: ['Precip API returned no data'] })
  }

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rows = points.map((p) => ({
    registry_field_id: p.registry_field_id,
    date:              p.date,
    precip_in:         p.precip_in,
    forecast_prob:     p.forecast_prob ?? null,
    lat:               p.lat,
    lng:               p.lng,
    fetched_at:        new Date().toISOString(),
  }))

  const { error: upsertErr } = await serviceSupabase
    .from('precip_cache')
    .upsert(rows, { onConflict: 'registry_field_id,date' })

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  const fieldsUpdated = new Set(points.map((p) => p.registry_field_id)).size

  return NextResponse.json({
    refreshed:      points.length,
    fields_updated: fieldsUpdated,
    errors:         [],
  })
}
