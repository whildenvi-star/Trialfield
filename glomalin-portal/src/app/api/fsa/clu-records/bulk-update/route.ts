import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type BulkAction = 'mark-reported' | 'mark-unreported' | 'assign-crop'

interface BulkUpdateBody {
  ids: string[]
  action: BulkAction
  crop?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: BulkUpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { ids, action, crop } = body

  // Validate ids
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  // Validate action
  const validActions: BulkAction[] = ['mark-reported', 'mark-unreported', 'assign-crop']
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
  } else {
    updatePayload = { crop: crop!.trim() }
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
