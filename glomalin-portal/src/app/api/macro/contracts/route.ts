import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TYPE_MAP: Record<string, string> = {
  Cash:    'cash',
  HTA:     'hta',
  Basis:   'basis',
  Futures: 'forward_contract',
  DP:      'cash',
}

export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Resolve commodity_id from name
  const { data: commodity } = await supabase
    .from('commodities')
    .select('id')
    .ilike('name', String(crop))
    .maybeSingle()

  const instrument_type = TYPE_MAP[String(contract_type)] ?? String(contract_type ?? 'cash').toLowerCase()

  const { error } = await supabase.from('sale_instruments').insert({
    commodity_id:    commodity?.id ?? null,
    buyer:           buyer ?? null,
    bushels,
    delivered_bu:    0,
    price_per_bushel: price_per_bushel ?? null,
    instrument_type,
    delivery_start:  delivery_start ?? null,
    delivery_end:    delivery_end ?? null,
    crop_year:       crop_year ?? new Date().getFullYear(),
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
    leverage_ratio:  1.0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
