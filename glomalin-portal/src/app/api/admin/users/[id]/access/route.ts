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

  // Read and validate body
  const body = await request.json()
  if (!body.module || typeof body.granted !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: module, granted' },
      { status: 400 }
    )
  }

  // Upsert module access
  const { data: record, error: upsertError } = await supabase
    .from('module_access')
    .upsert(
      { user_id: targetId, module: body.module, granted: body.granted },
      { onConflict: 'user_id,module' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to update module access' }, { status: 500 })
  }

  return NextResponse.json({ access: record })
}
