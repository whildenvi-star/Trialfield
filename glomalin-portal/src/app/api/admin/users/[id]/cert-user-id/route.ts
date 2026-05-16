import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetId } = await params
  const body = await request.json()
  const certUserId = body.cert_user_id === '' ? null : (body.cert_user_id ?? null)

  const { error } = await supabase
    .from('profiles')
    .update({ cert_user_id: certUserId })
    .eq('id', targetId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update cert_user_id' }, { status: 500 })
  }

  return NextResponse.json({ cert_user_id: certUserId })
}
