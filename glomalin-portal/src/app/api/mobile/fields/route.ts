import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../_lib/auth'
import { fetchCertService } from '../_lib/proxy'

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const res = await fetchCertService('/api/fields')
    if (!res.ok) throw new Error(`Fields: ${res.status}`)

    const data = await res.json()

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Organic-cert service unavailable' },
      { status: 502 }
    )
  }
}
