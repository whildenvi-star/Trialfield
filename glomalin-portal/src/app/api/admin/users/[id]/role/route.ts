import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetId } = await params

  // Prevent self-role-change
  if (targetId === user.id) {
    return NextResponse.json(
      { error: 'Cannot change your own role' },
      { status: 403 }
    )
  }

  // Read and validate body
  const body = await request.json()
  const validRoles = ['admin', 'owner', 'agronomist', 'operator', 'viewer']
  if (!body.role || !validRoles.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Update profile role
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ role: body.role })
    .eq('id', targetId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  // NOTE: profiles.role (module access) and app_metadata.app_role (marketing
  // financials) are independent axes — live users combine them freely
  // (e.g. operator + office). Role changes deliberately do NOT touch
  // app_role; use the marketing-access endpoint for that.
  return NextResponse.json({ profile: updated })
}
