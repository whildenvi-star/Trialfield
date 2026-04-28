import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

// Routes that are accessible without authentication
const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/reset-password']
const PUBLIC_PREFIXES = ['/_next', '/favicon.ico', '/api/auth', '/auth/callback', '/api/mobile']
const PUBLIC_EXTENSIONS = ['.js', '.css', '.json', '.ico', '.svg', '.png', '.jpg', '.webp']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (PUBLIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true
  return false
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin')
}

function isModuleRoute(pathname: string): boolean {
  return pathname.startsWith('/app/')
}

function getModuleId(pathname: string): string | null {
  // Extract module slug from /app/{moduleId} or /app/{moduleId}/...
  const parts = pathname.split('/')
  // parts = ['', 'app', '{moduleId}', ...]
  return parts[2] || null
}

// Copy session cookies from the Supabase response to a redirect so the
// browser receives refreshed tokens even when we redirect.
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redir = NextResponse.redirect(url)
  source.cookies.getAll().forEach((cookie) => {
    redir.cookies.set(cookie.name, cookie.value)
  })
  return redir
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets in public/ — skip auth entirely
  if (PUBLIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next()
  }

  // Create Supabase client with session refresh support
  const { supabase, response } = createClient(request)

  // Get the current user (also refreshes the session)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes: pass through (but redirect authenticated users on / to dashboard)
  if (isPublicRoute(pathname)) {
    if (pathname === '/' && user) {
      return redirectWithCookies(new URL('/dashboard', request.url), response)
    }
    return response
  }

  // Unauthenticated — redirect to /login
  if (!user) {
    // Check if a Supabase session cookie existed but getUser() failed → session expired
    const hasSessionCookie = request.cookies
      .getAll()
      .some((c) => c.name.includes('sb-'))

    const loginUrl = new URL('/login', request.url)
    if (hasSessionCookie) {
      loginUrl.searchParams.set('expired', 'true')
    }

    return redirectWithCookies(loginUrl, response)
  }

  // Admin route protection (/admin*)
  if (isAdminRoute(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      // Silent redirect — non-admins should not know the admin panel exists
      return redirectWithCookies(new URL('/dashboard', request.url), response)
    }

    return response
  }

  // Module route protection (/app/{moduleId}*)
  if (isModuleRoute(pathname)) {
    const moduleId = getModuleId(pathname)

    if (moduleId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Admins bypass module_access checks
      if (profile?.role !== 'admin') {
        const { data: access } = await supabase
          .from('module_access')
          .select('granted')
          .eq('user_id', user.id)
          .eq('module', moduleId)
          .single()

        if (!access || access.granted === false) {
          const dashboardUrl = new URL('/dashboard', request.url)
          dashboardUrl.searchParams.set('denied', moduleId)
          return redirectWithCookies(dashboardUrl, response)
        }
      }
    }

    return response
  }

  // All other protected routes (/dashboard, etc.) — user is authenticated, pass through
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|platform-tokens\\.css|settings-panel\\.js|formatting-agent\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
