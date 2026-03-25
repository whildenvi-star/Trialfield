import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { isOrganicCrop } from '@/lib/fsa/calc'

const EDITABLE_FIELDS = new Set(['crop', 'registry_crop_id', 'irrigated', 'organic', 'grain_plant_date', 'use', 'prevented_planting', 'registry_field_id', 'field_name'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

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

  // Auto-sync organic flag when crop changes and organic wasn't explicitly set
  if ('crop' in updates && !('organic' in body)) {
    updates.organic = isOrganicCrop(updates.crop as string)
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  const { error } = await supabase
    .from('clu_records')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
