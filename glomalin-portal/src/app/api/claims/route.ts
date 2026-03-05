import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addDays, INITIAL_DEADLINE_DAYS } from '@/lib/claims/calc'

// GET /api/claims
// Returns a list of claims, optionally filtered by year.
export async function GET(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional year filter from query string
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')

  let query = supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })

  if (yearParam) {
    const year = parseInt(yearParam, 10)
    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }
    // Filter by year of date_of_loss (fall back to created_at year if date_of_loss is null)
    query = query.gte('date_of_loss', `${year}-01-01`).lte('date_of_loss', `${year}-12-31`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch claims', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    claims: data ?? [],
    count: data?.length ?? 0,
  })
}

// POST /api/claims
// Creates a new claim pre-filled from an insurance policy. CLM-07.
// Body: { policy_id: string, date_of_loss: string, description: string }
export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { policy_id, date_of_loss, description } = body

  if (typeof policy_id !== 'string' || !policy_id) {
    return NextResponse.json({ error: 'policy_id is required' }, { status: 400 })
  }
  if (typeof date_of_loss !== 'string' || !date_of_loss) {
    return NextResponse.json({ error: 'date_of_loss is required' }, { status: 400 })
  }

  // Fetch the policy to carry over crop, coverage type, and guarantee fields
  const { data: policy, error: policyError } = await supabase
    .from('insurance_policies')
    .select('crop, plan_type, coverage_level, guarantee, farm_name')
    .eq('id', policy_id)
    .single()

  if (policyError || !policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  // Compute effective guarantee: guarantee * (coverage_level / 100)
  const effectiveGuarantee =
    (policy.guarantee ?? 0) * ((policy.coverage_level ?? 75) / 100)

  // Auto-calculate initial deadline: INITIAL_DEADLINE_DAYS (15) from date_of_loss
  // Per FCIC: CCC-576 must be filed within 15 calendar days of the loss event.
  const deadlineAt = addDays(new Date(date_of_loss), INITIAL_DEADLINE_DAYS).toISOString()

  // Insert the new claim
  const { data: claim, error: insertError } = await supabase
    .from('claims')
    .insert({
      policy_id,
      stage: 'notice_of_loss',
      stage_entered_at: new Date().toISOString(),
      crop: policy.crop,
      coverage_type: policy.plan_type,
      coverage_level: policy.coverage_level,
      effective_guarantee: effectiveGuarantee,
      date_of_loss,
      description: typeof description === 'string' ? description : null,
      deadline_at: deadlineAt,
      deadline_overridden: false,
    })
    .select()
    .single()

  if (insertError || !claim) {
    return NextResponse.json(
      { error: 'Failed to create claim', details: insertError?.message },
      { status: 500 }
    )
  }

  // Write creation event to timeline
  const { error: timelineError } = await supabase.from('claim_timeline').insert({
    claim_id: claim.id,
    event_type: 'created',
    event_data: { policy_id, stage: 'notice_of_loss' },
    actor_id: user.id,
  })

  if (timelineError) {
    // Non-fatal — claim was created successfully; log and continue
    console.error('Warning: Failed to write created event to claim_timeline:', timelineError.message)
  }

  return NextResponse.json({ claim }, { status: 201 })
}
