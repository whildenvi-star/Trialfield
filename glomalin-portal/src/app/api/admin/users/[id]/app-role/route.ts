import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * PATCH /api/admin/users/[id]/app-role
 *
 * Sets marketing RBAC access (System B) independently of profiles.role
 * (System A) — live users combine the two axes freely (e.g. an operator
 * with office marketing access). Body: { appRole: 'owner' | 'office' | null }.
 *
 * Stored in app_metadata so the custom_access_token_hook embeds it in the
 * JWT — clients cannot write it. Takes effect on the user's next token
 * refresh (~1 hour) or next sign-in.
 */
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

  // Prevent self-change — mirrors the role route, and stops an admin from
  // accidentally stripping their own financial access.
  if (targetId === user.id) {
    return NextResponse.json(
      { error: 'Cannot change your own marketing access' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const validAppRoles = ['owner', 'office', null]
  if (!('appRole' in body) || !validAppRoles.includes(body.appRole)) {
    return NextResponse.json({ error: 'Invalid appRole' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    targetId,
    { app_metadata: { app_role: body.appRole } }
  )

  if (updateError) {
    console.error('app_role update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update marketing access' }, { status: 500 })
  }

  return NextResponse.json({ id: targetId, appRole: body.appRole })
}
