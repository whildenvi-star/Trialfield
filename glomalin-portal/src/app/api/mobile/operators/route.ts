import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUser, isErrorResponse } from '../_lib/auth'

// Service-role client bypasses RLS to read all operator profiles
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/mobile/operators
 *
 * Returns all Supabase profiles with operator, agronomist, or admin roles
 * that have a linked organic-cert account (cert_user_id IS NOT NULL).
 *
 * Used by the mobile UI's operator override picker.
 *
 * Returns: { operators: [{ supabaseId, certUserId, fullName, role }] }
 */
export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, cert_user_id, role')
    .in('role', ['operator', 'agronomist', 'admin'])
    .not('cert_user_id', 'is', null)
    .order('full_name', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch operators', details: error.message },
      { status: 500 }
    )
  }

  const operators = (profiles ?? []).map((p) => ({
    supabaseId: p.id,
    certUserId: p.cert_user_id,
    fullName: p.full_name ?? p.id,
    role: p.role,
  }))

  return NextResponse.json({ operators })
}
