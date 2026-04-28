import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchSeedService } from '../../_lib/proxy'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanReturn(r: any) {
  const cleaned = { ...r }
  delete cleaned.creditAmount
  delete cleaned.creditReceived
  return cleaned
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const url = new URL(request.url)
    const cropYear = url.searchParams.get('cropYear')
    const path = cropYear
      ? `/api/returns?cropYear=${cropYear}`
      : '/api/returns'

    const res = await fetchSeedService(path)
    if (!res.ok) throw new Error(`Returns: ${res.status}`)

    const returns = await res.json()

    return NextResponse.json({
      returns: (Array.isArray(returns) ? returns : []).map(cleanReturn),
    })
  } catch {
    return NextResponse.json(
      { error: 'Seed-inventory service unavailable' },
      { status: 502 }
    )
  }
}
