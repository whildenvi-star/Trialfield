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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  if (!await requireAdminOrAgronomist(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = ['name', 'cbot_symbol', 'is_hedgeable', 'sort_order']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('commodities')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commodity: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  if (!await requireAdminOrAgronomist(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Block delete if instruments reference this commodity in any year
  const { count } = await supabase
    .from('sale_instruments')
    .select('id', { count: 'exact', head: true })
    .eq('commodity_id', params.id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${count} instrument(s) reference this crop type` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('commodities')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
