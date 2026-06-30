import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'

export async function GET(request: Request) {
  const supabase = await createClient()
  // getSession() is safe here because middleware calls getUser() for all non-public routes,
  // validating the token before this handler runs. Remove or change the public-path config
  // in middleware.ts if this route ever needs to be publicly accessible.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const qs = searchParams.toString()
  const res = await fetchCertServiceWithAuth(
    '/api/marketing/contracts' + (qs ? '?' + qs : ''),
    session.access_token,
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  // See GET handler comment — middleware validates the token before this runs.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const res = await fetchCertServiceWithAuth('/api/marketing/contracts', session.access_token, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
