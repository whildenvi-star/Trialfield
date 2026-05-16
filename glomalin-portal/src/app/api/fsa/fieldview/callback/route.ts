import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const FIELDVIEW_TOKEN_URL = 'https://api.climate.com/api/oauth/token'
const RETURN_PATH = '/app/compliance?tab=acreage'

// GET /api/fsa/fieldview/callback
// Receives the authorization code from FieldView, validates the state cookie,
// exchanges the code for tokens, and upserts into fieldview_tokens.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.whughesfarms.com'
  const returnUrl = `${siteUrl}${RETURN_PATH}`
  const errorUrl  = `${siteUrl}/app/compliance?tab=acreage&fv_error=`

  if (error) {
    return NextResponse.redirect(`${errorUrl}${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${errorUrl}missing_params`)
  }

  // Validate CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('fv_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${errorUrl}invalid_state`)
  }

  // Get authenticated user from Supabase session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`)
  }

  // Exchange code for tokens
  let tokenData: { access_token: string; refresh_token: string; expires_in: number; scope?: string }
  try {
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.FIELDVIEW_REDIRECT_URI ?? '',
      client_id:    process.env.FIELDVIEW_CLIENT_ID ?? '',
      client_secret: process.env.FIELDVIEW_CLIENT_SECRET ?? '',
    })
    const res = await fetch(FIELDVIEW_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })
    if (!res.ok) {
      await res.text().catch(() => '')
      return NextResponse.redirect(`${errorUrl}token_exchange_failed_${res.status}`)
    }
    tokenData = await res.json()
  } catch {
    return NextResponse.redirect(`${errorUrl}token_fetch_error`)
  }

  // Upsert tokens using service role (bypasses RLS for server-side write)
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  const { error: upsertErr } = await serviceSupabase
    .from('fieldview_tokens')
    .upsert({
      user_id:       user.id,
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at:    expiresAt,
      scope:         tokenData.scope ?? null,
      connected_at:  new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (upsertErr) {
    return NextResponse.redirect(`${errorUrl}token_store_failed`)
  }

  // Clear the state cookie and redirect back to compliance hub
  const response = NextResponse.redirect(returnUrl)
  response.cookies.set('fv_oauth_state', '', { maxAge: 0, path: '/' })
  return response
}
