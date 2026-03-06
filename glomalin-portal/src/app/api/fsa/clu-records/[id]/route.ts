import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EDITABLE_FIELDS = new Set(['crop', 'irrigated', 'organic', 'grain_plant_date', 'use', 'prevented_planting'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Whitelist only editable fields
  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (EDITABLE_FIELDS.has(key)) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields provided for update' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('clu_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data })
}
