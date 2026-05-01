import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// PATCH /api/fsa/zones/[id]
// Updates zone base fields and/or zone_year_attributes for a given crop_year.
//
// Body:
//   name               string?
//   organic_default    boolean?
//   irrigated_default  boolean?
//   notes              string?
//   crop_year          number?  if present, upserts zone_year_attributes
//   crop               string?
//   organic            boolean?
//   irrigated          boolean?
//   cover_crop         boolean?
//   intended_use       string?
//   tillage            string?
//   variety            string?
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

  const BASE_FIELDS = ['name', 'organic_default', 'irrigated_default', 'notes']
  const YEAR_FIELDS = ['crop', 'organic', 'irrigated', 'cover_crop', 'intended_use', 'tillage', 'variety']

  // Update management_zones base fields if any are present
  const baseUpdate: Record<string, unknown> = {}
  for (const key of BASE_FIELDS) {
    if (key in body) baseUpdate[key] = body[key]
  }

  if (Object.keys(baseUpdate).length > 0) {
    const { error } = await supabase
      .from('management_zones')
      .update(baseUpdate)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Upsert zone_year_attributes if crop_year provided
  const cropYear = typeof body.crop_year === 'number' ? body.crop_year : CURRENT_CROP_YEAR
  const yearUpdate: Record<string, unknown> = { zone_id: id, crop_year: cropYear }
  for (const key of YEAR_FIELDS) {
    if (key in body) yearUpdate[key] = body[key]
  }

  if (Object.keys(yearUpdate).length > 2) {
    const { error } = await supabase
      .from('zone_year_attributes')
      .upsert(yearUpdate, { onConflict: 'zone_id,crop_year' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/fsa/zones/[id]
// Deletes the zone and cascades to zone_year_attributes (via ON DELETE CASCADE).
// Also clears zone_id FK on any clu_records that reference this zone.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  // clu_records.zone_id has ON DELETE SET NULL — no explicit clear needed
  const { error } = await supabase
    .from('management_zones')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
