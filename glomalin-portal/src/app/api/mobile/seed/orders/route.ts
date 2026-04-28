import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchSeedService } from '../../_lib/proxy'

const STRIP_FIELDS = [
  'pricePerUnit', 'totalCost', 'paymentStatus', 'amountPaid',
  'prepayDiscount', 'invoiceNumber', 'invoiceDate', 'dueDate',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanOrder(o: any) {
  const cleaned = { ...o }
  for (const f of STRIP_FIELDS) delete cleaned[f]
  return cleaned
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const url = new URL(request.url)
    const cropYear = url.searchParams.get('cropYear')
    const path = cropYear
      ? `/api/orders/open?cropYear=${cropYear}`
      : '/api/orders/open'

    const res = await fetchSeedService(path)
    if (!res.ok) throw new Error(`Orders: ${res.status}`)

    const orders = await res.json()

    return NextResponse.json({
      orders: (Array.isArray(orders) ? orders : []).map(cleanOrder),
    })
  } catch {
    return NextResponse.json(
      { error: 'Seed-inventory service unavailable' },
      { status: 502 }
    )
  }
}
