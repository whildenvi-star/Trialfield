import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdminOrAgronomist(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agronomist'].includes(profile.role)) return null
  return user
}

const PATCHABLE = [
  'commodity_id', 'variant_id', 'buyer', 'counterparty', 'notes',
  'bushels', 'price_per_bushel', 'basis', 'futures_reference',
  'delivery_start', 'delivery_end', 'delivered_bu', 'contract_number',
  'option_type', 'option_side', 'strike_price', 'premium_paid', 'expiry_date',
  'ko_level', 'ki_level', 'daily_bu', 'weekly_bu',
  'accumulation_start', 'accumulation_end', 'leverage_ratio',
] as const

const NUMERIC_FIELDS = new Set([
  'bushels', 'price_per_bushel', 'basis', 'futures_reference', 'delivered_bu',
  'strike_price', 'premium_paid', 'ko_level', 'ki_level',
  'daily_bu', 'weekly_bu', 'leverage_ratio',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdminOrAgronomist(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  for (const field of PATCHABLE) {
    if (!(field in b)) continue
    const val = b[field]
    if (val === null || val === undefined) {
      patch[field] = null
    } else if (NUMERIC_FIELDS.has(field)) {
      patch[field] = Number(val)
    } else if (typeof val === 'string') {
      patch[field] = val.trim() || null
    } else {
      patch[field] = val
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sale_instruments')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ instrument: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdminOrAgronomist(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('sale_instruments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
