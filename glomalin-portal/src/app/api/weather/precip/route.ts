import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { PrecipAppAdapter } from '@/lib/weather/precip-adapter'

// GET /api/weather/precip
// Returns precip_summary view (7d + 30d totals per field) from cache — no external call.
export async function GET() {
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

  const { data, error } = await supabase
    .from('precip_summary')
    .select('registry_field_id, last_7d_in, last_30d_in, last_fetched')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    precip_configured: PrecipAppAdapter.isConfigured(),
    fields:            data ?? [],
  })
}

// POST /api/weather/precip/refresh is handled via a separate route file.
// This route only handles GET (summary read).
