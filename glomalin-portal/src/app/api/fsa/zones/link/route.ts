import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// POST /api/fsa/zones/link
// Body: { crop_year: number }
//
// Runs the link_clus_to_zones(p_crop_year) RPC which spatially joins each
// clu_boundary geometry to the management_zone with the largest intersection
// area, then updates clu_records.zone_id for all unlinked rows.
// Safe to call repeatedly — idempotent (skips already-linked records).
//
// Returns: { linked, already_linked, no_geometry, no_zone_found }

export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const body      = await request.json().catch(() => ({}))
  const cropYear  = typeof body.crop_year === 'number' ? body.crop_year : 2026

  const { data, error } = await supabase.rpc('link_clus_to_zones', {
    p_crop_year: cropYear,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
