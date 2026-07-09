import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export interface MobileUser {
  id: string
  role: string
  certUserId: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Validate Bearer token from Authorization header and check user role.
 * Returns the authenticated user or a 401/403 response.
 */
export async function getMobileUser(
  request: Request
): Promise<MobileUser | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, cert_user_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No profile found' }, { status: 403 })
  }

  const allowedRoles = ['operator', 'agronomist', 'admin', 'owner']
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  return {
    id: user.id,
    role: profile.role,
    certUserId: profile.cert_user_id ?? null,
  }
}

export function isErrorResponse(
  result: MobileUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
