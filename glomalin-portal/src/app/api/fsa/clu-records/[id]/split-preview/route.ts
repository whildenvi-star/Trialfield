import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// POST /api/fsa/clu-records/[id]/split-preview
//
// Given a user-drawn polygon from the Snip tool, returns the two resulting
// pieces without writing anything to the database:
//   snip:      ST_Intersection(drawn, clu_boundary) — the carved-out piece
//   remainder: ST_Difference(clu_boundary, drawn)   — what remains
//
// Both include geojson and computed acres. The client uses these to pre-populate
// the SplitProposalPanel before the user assigns crops and confirms.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: { drawn_geojson: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.drawn_geojson) {
    return NextResponse.json({ error: 'drawn_geojson is required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('preview_clu_snip', {
    p_clu_record_id: id,
    p_drawn_geojson: body.drawn_geojson,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Snip preview failed', details: error.message },
      { status: 500 }
    )
  }

  // data is { snip: {geojson, acres}, remainder: {geojson, acres} }
  return NextResponse.json(data)
}
