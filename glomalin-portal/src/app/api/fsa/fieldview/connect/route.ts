import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { createClient } from '@supabase/supabase-js'

const FIELDVIEW_AUTHORIZE_URL = 'https://api.climate.com/api/oauth/authorize'

// GET /api/fsa/fieldview/connect
// Initiates FieldView OAuth2 authorization code flow.
// Generates a state nonce, stores it in an httpOnly cookie, then redirects
// the user to FieldView's authorization page.
export async function GET() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard

  if (!process.env.FIELDVIEW_CLIENT_ID || !process.env.FIELDVIEW_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'FieldView not configured', detail: 'Set FIELDVIEW_CLIENT_ID and FIELDVIEW_REDIRECT_URI in environment.' },
      { status: 422 }
    )
  }

  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id:     process.env.FIELDVIEW_CLIENT_ID,
    redirect_uri:  process.env.FIELDVIEW_REDIRECT_URI,
    response_type: 'code',
    scope:         'fields:read agronomic:read',
    state,
  })

  const authorizeUrl = `${FIELDVIEW_AUTHORIZE_URL}?${params.toString()}`

  const res = NextResponse.redirect(authorizeUrl)
  // Store state for CSRF validation in callback (60s TTL)
  res.cookies.set('fv_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60,
    path:     '/',
  })
  return res
}

// DELETE /api/fsa/fieldview/connect
// Disconnects FieldView by deleting the user's token row.
export async function DELETE() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await serviceSupabase
    .from('fieldview_tokens')
    .delete()
    .eq('user_id', guard.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ disconnected: true })
}
