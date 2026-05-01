import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// POST /api/fsa/zones/seed
// Seeds management_zones from existing clu_records that have a registry_field_id
// but no zone_id yet. Geometry is copied from matching clu_boundaries rows.
// zone_year_attributes are created from the CLU record's crop/organic/irrigated fields.
//
// Body: { crop_year?: number }
// Returns: { created: N, already_linked: N }
//
// This calls the seed_zones_from_clus() Postgres function (migration 011).
// The function does the full insert chain atomically in SQL:
//   clu_records → management_zones + zone_year_attributes + clu_records.zone_id update
export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: { crop_year?: number } = {}
  try {
    body = await request.json()
  } catch {
    // body is optional
  }

  const cropYear = typeof body.crop_year === 'number' ? body.crop_year : CURRENT_CROP_YEAR

  const { data, error } = await supabase.rpc('seed_zones_from_clus', {
    p_crop_year: cropYear,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as { created: number; already_linked: number })
}
