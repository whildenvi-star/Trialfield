import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { computeDeadline } from '@/lib/claims/calc'

// Recognized fields for partial claim update
interface ClaimPatch {
  stage?: string
  deadline_at?: string
  deadline_overridden?: boolean
  date_of_loss?: string
  cause_of_loss?: string
  description?: string
  estimated_loss_bu?: number
  appraised_value?: number
  indemnity_amount?: number
  deductible_amount?: number
  adjuster_name?: string
  adjuster_phone?: string
  notes?: string
  clu_record_id?: string | null
}

// GET /api/claims/[id]
// Returns a single claim by ID.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('claims')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  const { data: claim, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  return NextResponse.json({ claim })
}

// PATCH /api/claims/[id]
// Partial update: stage transitions auto-recalculate deadline and write timeline events.
// Per Phase 29-02 decision: fetch current row before recompute.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('claims')
  if (isGuardError(guard)) return guard
  const { user, supabase } = guard

  const { id } = await params

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Fetch current claim first — needed for stage transition comparison and recompute
  const { data: currentClaim, error: fetchError } = await supabase
    .from('claims')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentClaim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  // Extract recognized fields from body
  const patch: ClaimPatch = {}
  if (typeof body.stage === 'string') patch.stage = body.stage
  if (typeof body.deadline_at === 'string') patch.deadline_at = body.deadline_at
  if (typeof body.deadline_overridden === 'boolean') patch.deadline_overridden = body.deadline_overridden
  if (typeof body.date_of_loss === 'string') patch.date_of_loss = body.date_of_loss
  if (typeof body.cause_of_loss === 'string') patch.cause_of_loss = body.cause_of_loss
  if (typeof body.description === 'string') patch.description = body.description
  if (typeof body.estimated_loss_bu === 'number') patch.estimated_loss_bu = body.estimated_loss_bu
  if (typeof body.appraised_value === 'number') patch.appraised_value = body.appraised_value
  if (typeof body.indemnity_amount === 'number') patch.indemnity_amount = body.indemnity_amount
  if (typeof body.deductible_amount === 'number') patch.deductible_amount = body.deductible_amount
  if (typeof body.adjuster_name === 'string') patch.adjuster_name = body.adjuster_name
  if (typeof body.adjuster_phone === 'string') patch.adjuster_phone = body.adjuster_phone
  if (typeof body.notes === 'string') patch.notes = body.notes
  if (body.clu_record_id === null || typeof body.clu_record_id === 'string') {
    patch.clu_record_id = body.clu_record_id as string | null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'No recognized fields in request body' },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { ...patch }

  // ── Stage transition logic ─────────────────────────────────────────────────
  const isStageChange = patch.stage && patch.stage !== currentClaim.stage

  if (isStageChange) {
    updateData.stage_entered_at = new Date().toISOString()

    // Recalculate deadline from STAGE_DEADLINE_DAYS unless user is explicitly overriding
    const isOverriding = patch.deadline_overridden === true || currentClaim.deadline_overridden
    if (!isOverriding && patch.stage) {
      const newDeadline = computeDeadline(patch.stage, new Date())
      if (newDeadline) {
        updateData.deadline_at = newDeadline.toISOString()
      } else if (patch.stage === 'closed') {
        // Closed claims have no deadline
        updateData.deadline_at = null
      }
    }

    // Write stage_change timeline event
    await supabase.from('claim_timeline').insert({
      claim_id: id,
      event_type: 'stage_change',
      event_data: { from_stage: currentClaim.stage, to_stage: patch.stage },
      actor_id: user.id,
    })
  }

  // ── Financial update detection ─────────────────────────────────────────────
  const financialFields: (keyof ClaimPatch)[] = [
    'estimated_loss_bu',
    'appraised_value',
    'indemnity_amount',
    'deductible_amount',
  ]
  const changedFinancialFields = financialFields.filter((f) => f in patch)
  if (changedFinancialFields.length > 0) {
    const eventData: Record<string, unknown> = {}
    for (const field of changedFinancialFields) {
      eventData[field] = patch[field]
    }
    await supabase.from('claim_timeline').insert({
      claim_id: id,
      event_type: 'financial_update',
      event_data: eventData,
      actor_id: user.id,
    })
  }

  // ── Deadline override detection ────────────────────────────────────────────
  if (patch.deadline_at && patch.deadline_overridden === true && !isStageChange) {
    await supabase.from('claim_timeline').insert({
      claim_id: id,
      event_type: 'deadline_change',
      event_data: {
        previous_deadline: currentClaim.deadline_at,
        new_deadline: patch.deadline_at,
        overridden: true,
      },
      actor_id: user.id,
    })
  }

  // ── Adjuster assignment detection ──────────────────────────────────────────
  const isNewAdjusterAssignment =
    typeof patch.adjuster_name === 'string' &&
    patch.adjuster_name.length > 0 &&
    (!currentClaim.adjuster_name || currentClaim.adjuster_name.trim() === '')

  if (isNewAdjusterAssignment) {
    await supabase.from('claim_timeline').insert({
      claim_id: id,
      event_type: 'adjuster_assigned',
      event_data: {
        adjuster_name: patch.adjuster_name,
        adjuster_phone: patch.adjuster_phone ?? null,
      },
      actor_id: user.id,
    })
  }

  // ── Apply update ───────────────────────────────────────────────────────────
  const { data: updatedClaim, error: updateError } = await supabase
    .from('claims')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updatedClaim) {
    if (updateError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update claim', details: updateError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ claim: updatedClaim })
}

// DELETE /api/claims/[id]
// Deletes a claim. CASCADE removes claim_documents and claim_timeline rows.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('claims')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  const { error } = await supabase.from('claims').delete().eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete claim', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: true })
}

