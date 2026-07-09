import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { isOrganicCrop, INTENDED_USE_VALUES } from '@/lib/fsa/calc'

type BulkAction = 'mark-reported' | 'mark-unreported' | 'assign-crop' | 'batch-edit'

interface BulkUpdateBody {
  ids: string[]
  action: BulkAction
  crop?: string
  fields?: Record<string, unknown>
}

// Fields the batch-edit action may set across many records at once
const BATCH_EDIT_FIELDS = new Set(['crop', 'registry_crop_id', 'irrigated', 'intended_use', 'grain_plant_date'])

export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: BulkUpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { ids, action, crop, fields } = body

  // Validate ids
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  // Validate action
  const validActions: BulkAction[] = ['mark-reported', 'mark-unreported', 'assign-crop', 'batch-edit']
  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate crop required for assign-crop
  if (action === 'assign-crop' && (!crop || !crop.trim())) {
    return NextResponse.json(
      { error: 'crop is required when action is assign-crop' },
      { status: 400 }
    )
  }

  // Build update payload
  let updatePayload: Record<string, unknown>
  if (action === 'mark-reported') {
    updatePayload = { reported: true }
  } else if (action === 'mark-unreported') {
    updatePayload = { reported: false }
  } else if (action === 'assign-crop') {
    const trimmedCrop = crop!.trim()
    updatePayload = { crop: trimmedCrop, organic: isOrganicCrop(trimmedCrop) }
  } else {
    // batch-edit: whitelist fields, only touch what the caller sent
    updatePayload = {}
    for (const [key, value] of Object.entries(fields ?? {})) {
      if (BATCH_EDIT_FIELDS.has(key)) {
        updatePayload[key] = value
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'fields must include at least one of: ' + Array.from(BATCH_EDIT_FIELDS).join(', ') },
        { status: 400 }
      )
    }

    if ('intended_use' in updatePayload) {
      const iu = updatePayload.intended_use
      if (iu !== null && !INTENDED_USE_VALUES.includes(iu as (typeof INTENDED_USE_VALUES)[number])) {
        return NextResponse.json(
          { error: `intended_use must be null or one of: ${INTENDED_USE_VALUES.join(', ')}` },
          { status: 400 }
        )
      }
    }

    if ('irrigated' in updatePayload && typeof updatePayload.irrigated !== 'boolean') {
      return NextResponse.json({ error: 'irrigated must be a boolean' }, { status: 400 })
    }

    if ('crop' in updatePayload) {
      const trimmedCrop = String(updatePayload.crop ?? '').trim()
      if (!trimmedCrop) {
        return NextResponse.json({ error: 'crop cannot be empty' }, { status: 400 })
      }
      updatePayload.crop = trimmedCrop
      updatePayload.organic = isOrganicCrop(trimmedCrop)
    }
  }

  const { data, error } = await supabase
    .from('clu_records')
    .update(updatePayload)
    .in('id', ids)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    records: data ?? [],
    count: (data ?? []).length,
  })
}
