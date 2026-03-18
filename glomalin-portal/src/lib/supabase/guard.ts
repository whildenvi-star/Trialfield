import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

interface GuardResult {
  user: User
  supabase: SupabaseClient
}

/**
 * Checks authentication AND module-level access for an API route.
 * Returns 401 if not authenticated, 403 if the user lacks access to the module.
 * On success returns the authenticated user and supabase client.
 */
export async function requireModuleAccess(
  moduleId: string
): Promise<GuardResult | NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admins bypass module access checks
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    const { data: access } = await supabase
      .from('module_access')
      .select('granted')
      .eq('user_id', user.id)
      .eq('module', moduleId)
      .single()

    if (!access || access.granted === false) {
      return NextResponse.json(
        { error: 'Forbidden — module access denied' },
        { status: 403 }
      )
    }
  }

  return { user, supabase }
}

/** Type guard: true when requireModuleAccess returned an error response. */
export function isGuardError(
  result: GuardResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
