import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/weather/precip/field/[fieldId]
// Returns all cached daily rows for a single field, ordered by date ASC.
// Includes both historical (date <= today) and forecast (date > today) rows.
// Used by History and Forecast tabs in the weather page.
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

  const { data, error } = await supabase
    .from('precip_cache')
    .select('date, precip_in, forecast_prob')
    .eq('registry_field_id', fieldId)
    .order('date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fieldId, rows: data ?? [] })
}
