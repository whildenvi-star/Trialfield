import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseIcs } from '@/lib/timeline/ics'
import type { TimelineEntry, SingleSourceResponse } from '@/lib/timeline/types'

// GET /api/timeline/schedule?year=2026
// Group-calendar events as timeline entries (farm-wide, not per-field).
// Reads the ICS feed at GROUP_CALENDAR_ICS_URL (e.g. a Google Calendar
// "secret address in iCal format"). Returns entries: [] with a note in
// `error` when the feed is not configured — the client treats that as a
// silently absent source, same as other degraded sources.

let cache: { year: number; fetchedAt: number; entries: TimelineEntry[] } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000

export async function GET(req: Request) {
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

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? '', 10) || new Date().getFullYear()

  const feedUrl = process.env.GROUP_CALENDAR_ICS_URL
  if (!feedUrl) {
    const body: SingleSourceResponse = {
      source: 'schedule',
      entries: [],
      error: 'Group calendar not configured (set GROUP_CALENDAR_ICS_URL)',
    }
    return NextResponse.json(body)
  }

  if (cache && cache.year === year && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    const body: SingleSourceResponse = { source: 'schedule', entries: cache.entries, error: null }
    return NextResponse.json(body)
  }

  let entries: TimelineEntry[] = []
  try {
    const res = await fetch(feedUrl, {
      headers: { Accept: 'text/calendar' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`feed returned ${res.status}`)
    const text = await res.text()
    const todayIso = new Date().toISOString().slice(0, 10)

    entries = parseIcs(text, `${year}-01-01`, `${year}-12-31`).map((ev): TimelineEntry => ({
      id: `schedule-${ev.uid}-${ev.date}`,
      source: 'schedule',
      date: ev.date,
      sortDate: ev.date,
      activityType: 'Calendar Event',
      summary: `[Calendar] ${ev.summary}`,
      detail: {
        location: ev.location,
        description: ev.description,
        endDate: ev.endDate,
        allDay: ev.allDay,
      },
      status: ev.date >= todayIso ? 'scheduled' : 'completed',
      pairedWith: null,
      sourceLink: null,
    }))
    cache = { year, fetchedAt: Date.now(), entries }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const body: SingleSourceResponse = { source: 'schedule', entries: [], error: `Calendar feed unavailable: ${msg}` }
    return NextResponse.json(body)
  }

  const body: SingleSourceResponse = { source: 'schedule', entries, error: null }
  return NextResponse.json(body)
}
