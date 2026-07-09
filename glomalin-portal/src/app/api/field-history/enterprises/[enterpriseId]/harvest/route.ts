import { NextResponse } from 'next/server'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const { enterpriseId } = await params
  const token = process.env.EMBED_TOKEN ?? ''

  try {
    const body = await request.json()
    const res = await fetchCertService(`/api/field-enterprises/${enterpriseId}/harvest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to save harvest event' }, { status: 502 })
  }
}
