import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// PATCH /api/insurance/aph/[id]
// Updates an existing APH record. Accepts partial body.
// APH-01: Supports toggling disaster-year exclusion and updating yield.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build update object from provided fields only
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.actual_yield === 'number') {
    updateData.actual_yield = body.actual_yield
  }
  if (typeof body.is_disaster_year === 'boolean') {
    updateData.is_disaster_year = body.is_disaster_year
  }
  if (typeof body.notes === 'string' || body.notes === null) {
    updateData.notes = body.notes
  }
  if (typeof body.source === 'string') {
    updateData.source = body.source
  }

  const { data: record, error } = await supabase
    .from('aph_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update APH record', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ record })
}

// DELETE /api/insurance/aph/[id]
// Removes an APH record.
// APH-01: CRUD completeness — delete individual year entries.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = params

  const { data, error } = await supabase
    .from('aph_records')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete APH record', details: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'APH record not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
