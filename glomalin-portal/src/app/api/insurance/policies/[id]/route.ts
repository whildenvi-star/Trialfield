import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeClaimAlert } from '@/lib/insurance/calc'

// Recognized updatable fields (partial policy update)
interface PolicyPatch {
  actual?: number
  guarantee?: number
  coverage_level?: number
  aph_computed?: number
  aph_clu_count?: number
  notes?: string
}

// Trigger fields: presence of any of these requires claim_alert recompute
const CLAIM_ALERT_TRIGGER_FIELDS: (keyof PolicyPatch)[] = [
  'actual',
  'guarantee',
  'coverage_level',
]

// GET /api/insurance/policies/[id]
// Returns a single insurance policy by ID.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  return NextResponse.json({ policy })
}

// PATCH /api/insurance/policies/[id]
// Accepts partial policy update; auto-recomputes claim_alert when
// actual, guarantee, or coverage_level is in the payload.
// INS-07: Claim alert computation on policy updates.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Parse and validate request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Extract only recognized fields from body
  const patch: PolicyPatch = {}
  if (typeof body.actual === 'number') patch.actual = body.actual
  if (typeof body.guarantee === 'number') patch.guarantee = body.guarantee
  if (typeof body.coverage_level === 'number') patch.coverage_level = body.coverage_level
  if (typeof body.aph_computed === 'number') patch.aph_computed = body.aph_computed
  if (typeof body.aph_clu_count === 'number') patch.aph_clu_count = body.aph_clu_count
  if (typeof body.notes === 'string') patch.notes = body.notes

  // Reject empty or unrecognized updates
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'No recognized fields in request body' },
      { status: 400 }
    )
  }

  // Determine if claim_alert recompute is needed
  const needsClaimAlertRecompute = CLAIM_ALERT_TRIGGER_FIELDS.some(
    (field) => field in patch
  )

  // Build the final update data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateData: Record<string, any> = { ...patch }

  if (needsClaimAlertRecompute) {
    // Fetch current policy to merge — we need all three values for computeClaimAlert
    const { data: current, error: fetchError } = await supabase
      .from('insurance_policies')
      .select('guarantee, actual, coverage_level')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    // Merge patch onto current values
    const merged = {
      guarantee: patch.guarantee ?? current.guarantee ?? 0,
      actual: patch.actual ?? current.actual ?? 0,
      coverage_level: patch.coverage_level ?? current.coverage_level ?? 75,
    }

    const claimAlert = computeClaimAlert(merged)
    updateData = { ...updateData, claim_alert: claimAlert }
  }

  // Apply Supabase update
  const { data: updatedPolicy, error: updateError } = await supabase
    .from('insurance_policies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updatedPolicy) {
    // If no row returned, policy not found
    if (updateError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to update policy', details: updateError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ policy: updatedPolicy })
}
