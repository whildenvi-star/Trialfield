import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.whughesfarms.com'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Invite acceptance and password recovery both need to set a password
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', siteUrl))
      }
      return NextResponse.redirect(new URL(next, siteUrl))
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=invalid', siteUrl))
}
