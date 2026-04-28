import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchSeedService } from '../../_lib/proxy'

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const url = new URL(request.url)
    const params = new URLSearchParams()
    const orderId = url.searchParams.get('orderId')
    const productId = url.searchParams.get('productId')
    if (orderId) params.set('orderId', orderId)
    if (productId) params.set('productId', productId)

    const query = params.toString() ? `?${params}` : ''
    const res = await fetchSeedService(`/api/receipts${query}`)
    if (!res.ok) throw new Error(`Receipts: ${res.status}`)

    const receipts = await res.json()

    return NextResponse.json({
      receipts: Array.isArray(receipts) ? receipts : [],
    })
  } catch {
    return NextResponse.json(
      { error: 'Seed-inventory service unavailable' },
      { status: 502 }
    )
  }
}
