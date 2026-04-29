import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('commodities')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commodities: data ?? [] })
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
  const { name, cbot_symbol, is_hedgeable, sort_order } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Default sort_order to max + 10 if not provided
  let nextSort = sort_order ?? 100
  if (sort_order == null) {
    const { data: last } = await supabase
      .from('commodities')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    nextSort = ((last?.sort_order ?? 0) as number) + 10
  }

  const { data, error } = await supabase
    .from('commodities')
    .insert({
      name: name.trim(),
      cbot_symbol: cbot_symbol?.trim() || null,
      is_hedgeable: is_hedgeable ?? false,
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commodity: data }, { status: 201 })
}
