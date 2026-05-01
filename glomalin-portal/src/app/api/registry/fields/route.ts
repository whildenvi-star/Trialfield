import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchRegistryService } from '../../mobile/_lib/proxy'

/**
 * GET /api/registry/fields
 *
 * Proxies farm-registry /api/fields and returns the full field list.
 * Used by the zone setup panel to display fields as top-level groupings.
 *
 * Query params forwarded: active (default true)
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const active = searchParams.get('active') ?? 'true'

  try {
    const resp = await fetchRegistryService(`/api/fields?active=${active}`)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
    }
    const data = await resp.json()
    return NextResponse.json(Array.isArray(data) ? data : (data.fields ?? []))
  } catch {
    return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
  }
}
