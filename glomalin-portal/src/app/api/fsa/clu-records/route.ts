import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Auth check — API route is under /api, not /app, so middleware does not enforce module access.
  // Auth check here is sufficient since only authenticated users call this endpoint.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse year from query string, default to 2026
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : 2026

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', year)
    .order('farm_number')
    .order('tract_number')
    .order('clu')

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch CLU records', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    records: data ?? [],
    count: data?.length ?? 0,
    year,
  })
}
