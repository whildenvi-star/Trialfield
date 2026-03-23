import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE(
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

  // Prevent self-deletion
  if (targetId === user.id) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
      { status: 403 }
    )
  }

  // Use admin client to delete from Supabase Auth (cascades to profiles via FK)
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

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId)

  if (deleteError) {
    console.error('Delete user error:', JSON.stringify(deleteError, null, 2))
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to delete user' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
