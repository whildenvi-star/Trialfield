import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET() {
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

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, role, cert_user_id, created_at, updated_at')

  if (profilesError) {
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  // Fetch all module_access records
  const { data: moduleAccess, error: accessError } = await supabase
    .from('module_access')
    .select('user_id, module, granted')

  if (accessError) {
    return NextResponse.json({ error: 'Failed to fetch module access' }, { status: 500 })
  }

  // Fetch user emails via admin client
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

  const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers()
  if (authError) {
    return NextResponse.json({ error: 'Failed to fetch user list' }, { status: 500 })
  }

  // Build module access map: userId -> { moduleId: granted }
  const accessMap: Record<string, Record<string, boolean>> = {}
  for (const record of moduleAccess ?? []) {
    if (!accessMap[record.user_id]) {
      accessMap[record.user_id] = {}
    }
    accessMap[record.user_id][record.module] = record.granted
  }

  // Build email + lastSignIn map from auth users
  const authMap: Record<string, { email: string; lastSignIn: string | null }> = {}
  for (const authUser of authUsers ?? []) {
    authMap[authUser.id] = {
      email: authUser.email ?? '',
      lastSignIn: authUser.last_sign_in_at ?? null,
    }
  }

  // Merge into combined response
  const users = (profiles ?? []).map((profile) => ({
    id: profile.id,
    email: authMap[profile.id]?.email ?? '',
    fullName: profile.full_name ?? '',
    role: profile.role,
    lastSignIn: authMap[profile.id]?.lastSignIn ?? null,
    certUserId: profile.cert_user_id ?? null,
    modules: accessMap[profile.id] ?? {},
  }))

  return NextResponse.json({ users, currentUserId: user.id })
}
