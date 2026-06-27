import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

type MarketingRole = 'owner' | 'office'

interface MarketingAuthContext {
  role: MarketingRole
  supabase: SupabaseClient
  /**
   * Bearer token for forwarding to cert service.
   * Obtained via getSession() only AFTER getUser() has already validated
   * identity server-side, so the identity check is not bypassed.
   */
  accessToken: string
}

/**
 * RSC-safe marketing auth helper. Returns null on any auth or role failure
 * (caller is expected to redirect('/app')).
 *
 * Unlike requireMarketingAccess() — which returns NextResponse and is designed
 * for API routes — this function returns a typed result or null so it can be
 * safely used inside React Server Components.
 *
 * Auth flow:
 *   1. getUser() validates identity against Supabase Auth (re-verifies the JWT).
 *   2. app_role from app_metadata (written by custom_access_token_hook, never
 *      writable by the client) is checked for marketing access.
 *   3. getSession() is called only AFTER identity is confirmed to obtain the
 *      access token for forwarding to the cert service.
 */
export async function getMarketingAuthContext(
  allowedRoles: MarketingRole[] = ['owner', 'office']
): Promise<MarketingAuthContext | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const appRole = user.app_metadata?.app_role as MarketingRole | undefined

  if (!appRole || !allowedRoles.includes(appRole)) return null

  // Identity already verified above via getUser(). Now obtain the session token
  // to forward to the cert service. This coupling is intentional — do not remove
  // the getUser() call above without also adding a replacement identity check.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return null

  return { role: appRole, supabase, accessToken: session.access_token }
}
