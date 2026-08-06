import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, settlementId } = await params
  const body = await request.json()
  const res = await fetchCertServiceWithAuth(
    '/api/marketing/contracts/' + id + '/settlements/' + settlementId,
    session.access_token,
    { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, settlementId } = await params
  const res = await fetchCertServiceWithAuth(
    '/api/marketing/contracts/' + id + '/settlements/' + settlementId,
    session.access_token,
    { method: 'DELETE' }
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
