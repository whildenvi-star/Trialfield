import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
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

  // Read and validate body
  const body = await request.json()
  const validRoles = ['admin', 'agronomist', 'operator', 'viewer']
  if (!body.email || !body.role || !validRoles.includes(body.role)) {
    return NextResponse.json(
      { error: 'Missing or invalid fields: email, role' },
      { status: 400 }
    )
  }

  // Use Supabase Admin client to invite user
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Send email invite — user receives a link to set their own password
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    body.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.whughesfarms.com'}/auth/callback?type=invite` }
  )

  if (inviteError) {
    console.error('Invite user error:', JSON.stringify(inviteError, null, 2))
    return NextResponse.json(
      { error: inviteError.message ?? 'Failed to invite user', code: (inviteError as { code?: string }).code },
      { status: 500 }
    )
  }

  const newUserId = inviteData.user.id

  // If role is not viewer, update the auto-created profile (trigger creates viewer by default).
  // Use adminClient (service role) to bypass RLS — profiles_update_own only allows self-updates,
  // and we're updating another user's profile on their behalf during provisioning.
  if (body.role !== 'viewer') {
    const { error: roleError } = await adminClient
      .from('profiles')
      .update({ role: body.role })
      .eq('id', newUserId)

    if (roleError) {
      // Invite succeeded but role update failed — log and return partial success
      console.error('Invite succeeded but role update failed:', roleError)
    }
  }

  // Grant module access at invite time if modules were specified
  // Auto-grant 'crew' module for operator role
  const modules: string[] = Array.isArray(body.modules) ? [...body.modules] : []
  if (body.role === 'operator' && !modules.includes('crew')) {
    modules.push('crew')
  }
  if (modules.length > 0) {
    const moduleRows = modules.map((moduleId: string) => ({
      user_id: newUserId,
      module: moduleId,
      granted: true,
    }))
    const { error: moduleError } = await adminClient
      .from('module_access')
      .upsert(moduleRows, { onConflict: 'user_id,module' })

    if (moduleError) {
      console.error('Invite succeeded but module access grant failed:', moduleError)
    }
  }

  return NextResponse.json(
    { id: newUserId, email: body.email },
    { status: 201 }
  )
}
