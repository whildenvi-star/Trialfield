import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admin, agronomist, and office (viewer) can enter contracts
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'viewer'
  if (role === 'operator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { crop, buyer, bushels, price_per_bushel, contract_type, delivery_start, delivery_end, crop_year } = body

  if (!crop || typeof bushels !== 'number' || bushels <= 0) {
    return NextResponse.json({ error: 'crop and bushels are required' }, { status: 400 })
  }

  const { error } = await supabase.from('grain_contracts').insert({
    crop,
    buyer: buyer ?? null,
    bushels,
    price_per_bushel: price_per_bushel ?? null,
    contract_type: contract_type ?? 'Cash',
    delivery_start: delivery_start ?? null,
    delivery_end: delivery_end ?? null,
    crop_year: crop_year ?? new Date().getFullYear(),
    created_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
