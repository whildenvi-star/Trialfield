import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FarmCenter {
  lat: number
  lng: number
  zoom: number
}

/**
 * GET /api/maps/center
 *
 * Returns the stored farm center from farm_map_config where key = 'farm_center'.
 * Returns { center: null } if no center has been set yet (import hasn't run).
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

  const { data, error } = await supabase
    .from('farm_map_config')
    .select('value')
    .eq('key', 'farm_center')
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found — that's expected when no center is set
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const center = data?.value as FarmCenter | null

  return NextResponse.json({ center: center ?? null })
}

/**
 * POST /api/maps/center
 *
 * Admin-only. Upserts the farm center into farm_map_config with key 'farm_center'.
 *
 * Body: { lat: number, lng: number, zoom: number }
 *
 * Returns { success: true } on success.
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin check — consistent with Phase 69 pattern
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: { lat?: number; lng?: number; zoom?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lat, lng, zoom } = body

  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof zoom !== 'number') {
    return NextResponse.json(
      { error: 'Body must contain lat, lng, and zoom as numbers' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('farm_map_config')
    .upsert({ key: 'farm_center', value: { lat, lng, zoom }, updated_at: new Date().toISOString() })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
