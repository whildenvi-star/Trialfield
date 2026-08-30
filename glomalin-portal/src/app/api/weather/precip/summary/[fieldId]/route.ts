import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { activePrecipAdapter } from '@/lib/weather/precip-adapter'

// GET /api/weather/precip/summary/[fieldId]
// Weekly rainfall summary for one field (registry field id) — feeds the
// field-history situation board badge. Reads precip_cache; when the cache has
// no row for yesterday/today it lazily fetches this single field from the
// active precip adapter (Open-Meteo needs no key) and upserts, so the badge
// works without any scheduled refresh job.
// Returns { fieldId, last7_in, latestDate } — last7_in null when no data.

// Per-field lazy-refresh throttle so repeated expands don't refetch upstream.
const refreshAttemptedAt = new Map<string, number>()
const REFRESH_TTL_MS = 30 * 60 * 1000

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const { fieldId } = await params

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

  const todayIso = new Date().toISOString().slice(0, 10)
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

  const readWeek = () =>
    supabase
      .from('precip_cache')
      .select('date, precip_in')
      .eq('registry_field_id', fieldId)
      .gt('date', weekAgoIso)
      .lte('date', todayIso)
      .order('date', { ascending: true })

  let { data: rows, error } = await readWeek()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const latestDate = rows && rows.length > 0 ? rows[rows.length - 1].date : null
  const yesterdayIso = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const stale = !latestDate || latestDate < yesterdayIso

  const lastAttempt = refreshAttemptedAt.get(fieldId) ?? 0
  if (stale && Date.now() - lastAttempt > REFRESH_TTL_MS) {
    refreshAttemptedAt.set(fieldId, Date.now())

    const { data: boundary } = await supabase
      .from('field_boundaries')
      .select('centroid_lat, centroid_lng')
      .eq('registry_field_id', fieldId)
      .not('centroid_lat', 'is', null)
      .maybeSingle()

    if (boundary?.centroid_lat != null && boundary?.centroid_lng != null) {
      try {
        const points = await activePrecipAdapter().fetchPrecip(
          [{ id: fieldId, lat: boundary.centroid_lat, lng: boundary.centroid_lng }],
          { days: 8 }
        )
        if (points.length > 0) {
          const serviceSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          )
          await serviceSupabase.from('precip_cache').upsert(
            points.map((p) => ({
              registry_field_id: p.registry_field_id,
              date:              p.date,
              precip_in:         p.precip_in,
              forecast_prob:     p.forecast_prob ?? null,
              lat:               p.lat,
              lng:               p.lng,
              fetched_at:        new Date().toISOString(),
            })),
            { onConflict: 'registry_field_id,date' }
          )
          const reread = await readWeek()
          rows = reread.data ?? rows
        }
      } catch {
        // upstream weather unavailable — serve whatever the cache has
      }
    }
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ fieldId, last7_in: null, latestDate: null })
  }

  const last7 = rows.reduce((sum, r) => sum + (r.precip_in ?? 0), 0)
  return NextResponse.json({
    fieldId,
    last7_in: Number(last7.toFixed(2)),
    latestDate: rows[rows.length - 1].date,
  })
}
