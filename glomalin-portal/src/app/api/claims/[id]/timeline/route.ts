import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// GET /api/claims/[id]/timeline
// Returns all timeline events for a claim, ordered chronologically (oldest first).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('claims')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  const { data, error } = await supabase
    .from('claim_timeline')
    .select('*')
    .eq('claim_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch timeline events', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    events: data ?? [],
    count: data?.length ?? 0,
  })
}

// POST /api/claims/[id]/timeline
// Adds a manual note to the claim timeline.
// Body: { note: string }
export async function POST(
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

  if (typeof body.note !== 'string' || body.note.trim() === '') {
    return NextResponse.json({ error: 'note is required and must be a non-empty string' }, { status: 400 })
  }

  const { data: event, error: insertError } = await supabase
    .from('claim_timeline')
    .insert({
      claim_id: id,
      event_type: 'note',
      note: body.note.trim(),
      actor_id: user.id,
    })
    .select()
    .single()

  if (insertError || !event) {
    return NextResponse.json(
      { error: 'Failed to add timeline note', details: insertError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ event }, { status: 201 })
}
