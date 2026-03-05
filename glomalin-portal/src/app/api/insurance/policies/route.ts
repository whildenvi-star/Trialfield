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
    .from('insurance_policies')
    .select('*')
    .eq('policy_year', year)
    .order('farm_name')

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch insurance policies', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    policies: data ?? [],
    count: data?.length ?? 0,
    year,
  })
}
