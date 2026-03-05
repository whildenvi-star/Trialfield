import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export function createClient(request: NextRequest) {
  // Create a response we can mutate to forward refreshed session cookies
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request so Server Components can read the refreshed session
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-create the response with updated request headers so the refreshed
          // cookies are forwarded to downstream Server Components
          supabaseResponse = NextResponse.next({
            request,
          })
          // Also set cookies on the response so the browser receives the refresh
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response: supabaseResponse }
}
