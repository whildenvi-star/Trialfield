import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cropYear = parseInt(searchParams.get('cropYear') ?? '0', 10)
  if (!cropYear) return NextResponse.json({ error: 'cropYear required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('commodity_pricing')
    .select('*')
    .eq('crop_year', cropYear)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pricing: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agronomist'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { commodity_id, crop_year, pricing_mode, price_value, price_unit, notes } = body

  if (!commodity_id || !crop_year || !pricing_mode) {
    return NextResponse.json({ error: 'commodity_id, crop_year, and pricing_mode required' }, { status: 400 })
  }

  // Upsert on commodity_id + crop_year conflict
  const { data, error } = await supabase
    .from('commodity_pricing')
    .upsert({
      commodity_id,
      crop_year,
      pricing_mode,
      price_value: price_value ?? null,
      price_unit: price_unit ?? 'per_bu',
      notes: notes ?? null,
    }, { onConflict: 'commodity_id,crop_year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pricing: data })
}
