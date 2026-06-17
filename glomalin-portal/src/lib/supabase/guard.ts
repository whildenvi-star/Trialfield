import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

interface GuardResult {
  user: User
  supabase: SupabaseClient
}

/** Valid commodity marketing roles — mirrors the app_role enum in Supabase. */
type MarketingRole = 'owner' | 'office'

interface MarketingGuardResult {
  user: User
  role: MarketingRole
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

/**
 * Checks authentication AND marketing role access for a commodity marketing API route.
 * Returns 401 if not authenticated, 403 if the user's app_role is not in allowedRoles.
 * On success returns the authenticated user, their marketing role, and the supabase client.
 *
 * The app_role is read from app_metadata embedded in the JWT by the custom_access_token_hook
 * registered in Phase 11 Plan 01. Set via supabase.auth.admin.updateUserById() targeting
 * raw_app_meta_data — never via client SDK updateUser() which writes raw_user_meta_data.
 *
 * @param allowedRoles - roles permitted to access this route (default: ['owner', 'office'])
 */
export async function requireMarketingAccess(
  allowedRoles: MarketingRole[] = ['owner', 'office']
): Promise<MarketingGuardResult | NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appRole = user.app_metadata?.app_role as MarketingRole | undefined

  if (!appRole || !allowedRoles.includes(appRole)) {
    return NextResponse.json(
      { error: 'Forbidden — marketing role required' },
      { status: 403 }
    )
  }

  return { user, role: appRole, supabase }
}

/** Type guard: true when requireMarketingAccess returned an error response. */
export function isMarketingGuardError(
  result: MarketingGuardResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
