import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cropYear = parseInt(searchParams.get('cropYear') ?? String(CURRENT_CROP_YEAR), 10)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('crop_variants')
    .select('*')
    .eq('crop_year', cropYear)
    .order('commodity_id')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'agronomist'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (!b.commodity_id || typeof b.commodity_id !== 'string') {
    return NextResponse.json({ error: 'commodity_id is required' }, { status: 400 })
  }
  if (!b.name || typeof b.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const cropYear = typeof b.crop_year === 'number' ? b.crop_year : CURRENT_CROP_YEAR

  const { data, error } = await supabase
    .from('crop_variants')
    .insert({
      commodity_id: b.commodity_id,
      name: (b.name as string).trim(),
      is_contracted: Boolean(b.is_contracted ?? false),
      crop_year: cropYear,
      estimated_bu: b.estimated_bu != null ? Number(b.estimated_bu) : null,
      notes: b.notes ? String(b.notes).trim() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variant: data }, { status: 201 })
}
