import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const res = await fetchCertServiceWithAuth('/api/marketing/basis-quotes/' + id, session.access_token, {
    method: 'DELETE',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
