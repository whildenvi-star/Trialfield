import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * GET /api/field-ops/operators
 *
 * Returns all Supabase profiles with operator, agronomist, or admin roles.
 *
 * Unlike /api/mobile/operators, this endpoint:
 * - Uses SSR cookie auth (not Bearer token)
 * - Does NOT require cert_user_id — TC log allows selecting any operator
 *   regardless of whether they have an organic-cert account
 *
 * Returns: { operators: [{ id, fullName, role }] }
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service-role client bypasses RLS to read all operator profiles
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['operator', 'agronomist', 'admin'])
    .order('full_name', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch operators', details: error.message },
      { status: 500 }
    )
  }

  const operators = (profiles ?? []).map((p: { id: string; full_name: string | null; role: string }) => ({
    id: p.id,
    fullName: p.full_name ?? p.id,
    role: p.role,
  }))

  return NextResponse.json({ operators })
}
