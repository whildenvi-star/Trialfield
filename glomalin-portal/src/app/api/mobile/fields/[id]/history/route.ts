import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../../_lib/auth'
import { fetchCertService } from '../../../_lib/proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const { id } = await params

  try {
    const url = new URL(request.url)
    const offset = url.searchParams.get('offset') ?? '0'
    const res = await fetchCertService(`/api/fields/${id}/history?offset=${offset}`)
    if (!res.ok) throw new Error(`Field history: ${res.status}`)

    const data = await res.json()

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Organic-cert service unavailable' },
      { status: 502 }
    )
  }
}
