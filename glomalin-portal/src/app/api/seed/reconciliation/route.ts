import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchSeedService } from '@/app/api/mobile/_lib/proxy'

/**
 * GET /api/seed/reconciliation
 *
 * Thin proxy to seed-inventory /api/reconciliation.
 * Returns per-product forecast/ordered/delivered/on-hand data.
 *
 * Query params:
 *   cropYear  — e.g. 2026 (defaults to seed-inventory store setting)
 *   type      — SEED | INPUT (optional filter)
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const params = new URLSearchParams()
  const cropYear = url.searchParams.get('cropYear')
  const type = url.searchParams.get('type')
  if (cropYear) params.set('cropYear', cropYear)
  if (type) params.set('type', type)

  try {
    const res = await fetchSeedService(`/api/reconciliation${params.size ? '?' + params : ''}`)
    if (!res.ok) throw new Error(`seed-inventory: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-cache' } })
  } catch {
    return NextResponse.json({ error: 'seed-inventory unavailable' }, { status: 502 })
  }
}
