import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { INTENDED_USE_VALUES } from '@/lib/fsa/calc'

// POST /api/fsa/clu-records/[id]/split
//
// Commits a CLU split: creates sub-records (CLU1a, CLU1b, ...) and marks the
// parent row superseded=true. The parent is NEVER deleted — it stays as an
// audit trail entry. Export routes filter WHERE superseded=false.
//
// Body:
//   { splits: [{ sub_label, geojson, crop, irrigated, organic, intended_use }] }
//
// Validation:
//   - Parent must exist and not already be superseded
//   - At least 2 splits required
//   - sub_labels must be unique single lowercase letters
//   - Each geometry validated against CLU boundary in the RPC (ST_Intersects)
//
// On success: returns { parent_id, children: CluRecord[] }
// On failure: if any child insert fails, parent is NOT marked superseded.

interface SplitSpec {
  sub_label: string
  geojson: string
  crop: string
  irrigated: boolean
  organic: boolean
  intended_use: string | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: { splits: SplitSpec[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { splits } = body

  if (!Array.isArray(splits) || splits.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 splits are required' },
      { status: 400 }
    )
  }

  // Validate sub_labels
  const labels = splits.map((s) => s.sub_label)
  const labelSet = new Set(labels)
  if (labelSet.size !== labels.length) {
    return NextResponse.json({ error: 'sub_label values must be unique' }, { status: 400 })
  }
  for (const label of labels) {
    if (!/^[a-z]$/.test(label)) {
      return NextResponse.json(
        { error: `Invalid sub_label "${label}" — must be a single lowercase letter` },
        { status: 400 }
      )
    }
  }

  for (const split of splits) {
    const iu = split.intended_use
    if (iu != null && iu !== '' && !INTENDED_USE_VALUES.includes(iu as (typeof INTENDED_USE_VALUES)[number])) {
      return NextResponse.json(
        { error: `intended_use must be one of: ${INTENDED_USE_VALUES.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // Validate parent exists and is not already superseded
  const { data: parent, error: parentErr } = await supabase
    .from('clu_records')
    .select('id, superseded, farm_number, tract_number, clu, crop_year, fsa_acres')
    .eq('id', id)
    .single()

  if (parentErr || !parent) {
    return NextResponse.json({ error: 'CLU record not found' }, { status: 404 })
  }

  if (parent.superseded) {
    return NextResponse.json(
      { error: 'This CLU record has already been split' },
      { status: 409 }
    )
  }

  // Create each sub-record via the SECURITY DEFINER RPC
  const childIds: string[] = []

  for (const split of splits) {
    const { data: newId, error: splitErr } = await supabase.rpc('create_clu_split', {
      p_parent_id:     id,
      p_sub_label:     split.sub_label,
      p_geojson:       split.geojson,
      p_crop:          split.crop,
      p_irrigated:     split.irrigated,
      p_organic:       split.organic,
      p_intended_use:  split.intended_use || null,
    })

    if (splitErr) {
      // Rollback: delete any children we already created
      if (childIds.length > 0) {
        await supabase.from('clu_records').delete().in('id', childIds)
      }
      return NextResponse.json(
        { error: `Failed to create sub-record "${split.sub_label}"`, details: splitErr.message },
        { status: 500 }
      )
    }

    childIds.push(newId as string)
  }

  // All children created — mark parent superseded
  const { error: supersedeErr } = await supabase
    .from('clu_records')
    .update({ superseded: true })
    .eq('id', id)

  if (supersedeErr) {
    // Children exist but parent not superseded — clean up to avoid orphaned state
    await supabase.from('clu_records').delete().in('id', childIds)
    return NextResponse.json(
      { error: 'Failed to supersede parent record', details: supersedeErr.message },
      { status: 500 }
    )
  }

  // Fetch child records to return
  const { data: children } = await supabase
    .from('clu_records')
    .select('*')
    .in('id', childIds)
    .order('sub_label')

  return NextResponse.json({
    parent_id: id,
    children:  children ?? [],
  })
}
