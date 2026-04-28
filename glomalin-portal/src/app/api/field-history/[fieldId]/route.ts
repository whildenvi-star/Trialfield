import { NextResponse } from 'next/server'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const { fieldId } = await params
  const token = process.env.EMBED_TOKEN ?? ''

  try {
    const res = await fetchCertService(`/api/field-history/${fieldId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`organic-cert: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Field history unavailable' }, { status: 502 })
  }
}
