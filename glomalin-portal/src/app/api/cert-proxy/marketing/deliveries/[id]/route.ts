import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  // getSession() is safe here because middleware calls getUser() for all non-public routes,
  // validating the token before this handler runs. Remove or change the public-path config
  // in middleware.ts if this route ever needs to be publicly accessible.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const res = await fetchCertServiceWithAuth(
    '/api/marketing/deliveries/' + id,
    session.access_token,
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  // See GET handler comment — middleware validates the token before this runs.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const res = await fetchCertServiceWithAuth('/api/marketing/deliveries/' + id, session.access_token, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
