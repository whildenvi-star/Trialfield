import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'

const VALID_TYPES = ['cash', 'forward_contract', 'option', 'accumulator'] as const

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cropYear = parseInt(searchParams.get('cropYear') ?? String(CURRENT_CROP_YEAR), 10)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sale_instruments')
    .select('*')
    .eq('crop_year', cropYear)
    .order('commodity_id')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ instruments: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
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
  if (!b.instrument_type || !VALID_TYPES.includes(b.instrument_type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: 'instrument_type must be cash|forward_contract|option|accumulator' }, { status: 400 })
  }

  const cropYear = typeof b.crop_year === 'number' ? b.crop_year : CURRENT_CROP_YEAR

  const row: Record<string, unknown> = {
    commodity_id:    b.commodity_id,
    instrument_type: b.instrument_type,
    crop_year:       cropYear,
    variant_id:      b.variant_id ?? null,
    buyer:           b.buyer ? String(b.buyer).trim() : null,
    counterparty:    b.counterparty ? String(b.counterparty).trim() : null,
    notes:           b.notes ? String(b.notes).trim() : null,
    // Cash + Forward
    bushels:           b.bushels != null ? Number(b.bushels) : null,
    price_per_bushel:  b.price_per_bushel != null ? Number(b.price_per_bushel) : null,
    basis:             b.basis != null ? Number(b.basis) : null,
    futures_reference: b.futures_reference != null ? Number(b.futures_reference) : null,
    delivery_start:    b.delivery_start ?? null,
    delivery_end:      b.delivery_end ?? null,
    delivered_bu:      b.delivered_bu != null ? Number(b.delivered_bu) : 0,
    contract_number:   b.contract_number ? String(b.contract_number).trim() : null,
    // Option
    option_type:  b.option_type ?? null,
    option_side:  b.option_side ?? null,
    strike_price: b.strike_price != null ? Number(b.strike_price) : null,
    premium_paid: b.premium_paid != null ? Number(b.premium_paid) : null,
    expiry_date:  b.expiry_date ?? null,
    // Accumulator
    ko_level:           b.ko_level != null ? Number(b.ko_level) : null,
    ki_level:           b.ki_level != null ? Number(b.ki_level) : null,
    daily_bu:           b.daily_bu != null ? Number(b.daily_bu) : null,
    weekly_bu:          b.weekly_bu != null ? Number(b.weekly_bu) : null,
    accumulation_start: b.accumulation_start ?? null,
    accumulation_end:   b.accumulation_end ?? null,
    leverage_ratio:     b.leverage_ratio != null ? Number(b.leverage_ratio) : 1.0,
  }

  const { data, error } = await supabase
    .from('sale_instruments')
    .insert(row)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ instrument: data }, { status: 201 })
}
