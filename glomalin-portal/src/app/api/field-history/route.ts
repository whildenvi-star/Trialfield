import { NextResponse } from 'next/server'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const token = process.env.EMBED_TOKEN ?? ''

  try {
    const path = search
      ? `/api/field-history?search=${encodeURIComponent(search)}`
      : '/api/field-history'
    const res = await fetchCertService(path, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`organic-cert: ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Field history unavailable' }, { status: 502 })
  }
}
