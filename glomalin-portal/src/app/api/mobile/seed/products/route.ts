import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchSeedService } from '../../_lib/proxy'

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const res = await fetchSeedService('/api/products?active=true')
    if (!res.ok) throw new Error(`Products: ${res.status}`)

    const products = await res.json()

    return NextResponse.json({
      products: Array.isArray(products) ? products : [],
    })
  } catch {
    return NextResponse.json(
      { error: 'Seed-inventory service unavailable' },
      { status: 502 }
    )
  }
}
