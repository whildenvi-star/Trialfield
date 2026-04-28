import { NextResponse } from 'next/server'
import { fetchBudgetService } from '@/app/api/mobile/_lib/proxy'
import type { CbotPrice } from '@/lib/marketing/types'

// Cache CBOT prices for 15 minutes — delayed quotes don't need real-time refresh
export const revalidate = 900

// Commodity map: symbol → canonical crop registry name
const COMMODITY_MAP: Array<{
  symbol: string
  commodity: string
  canonicalName: string
  fallbackPrice: number
}> = [
  { symbol: 'ZCZ26', commodity: 'Corn', canonicalName: 'Yellow Corn', fallbackPrice: 4.5 },
  { symbol: 'ZSX26', commodity: 'Soybeans', canonicalName: 'Soybeans', fallbackPrice: 10.5 },
  { symbol: 'ZWZ26', commodity: 'Wheat', canonicalName: 'Soft Red Winter Wheat', fallbackPrice: 5.8 },
  { symbol: 'ZOZ26', commodity: 'Oats', canonicalName: 'Oats', fallbackPrice: 3.5 },
]

// GET /api/marketing/cbot-prices
// Proxies through farm-budget's /api/cbot-fetch (Yahoo Finance, no API key needed).
// MKT-02: Live or fallback CBOT prices for unpriced exposure calculation.
export async function GET() {
  const results = await Promise.allSettled(
    COMMODITY_MAP.map(async (c) => {
      const res = await fetchBudgetService(`/api/cbot-fetch?symbol=${encodeURIComponent(c.symbol)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.price) throw new Error(json.error || 'No price returned')
      return {
        commodity: c.canonicalName,
        symbol: c.symbol,
        price: json.price as number,
        change: 0,
        timestamp: json.timestamp ?? new Date().toISOString(),
        source: json.source === 'cache' ? 'yahoo-cached' : 'yahoo',
      } satisfies CbotPrice
    })
  )

  const prices: CbotPrice[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const c = COMMODITY_MAP[i]
    return {
      commodity: c.canonicalName,
      symbol: c.symbol,
      price: c.fallbackPrice,
      change: 0,
      timestamp: new Date().toISOString(),
      source: 'manual-fallback',
    }
  })

  const live = results.some((r) => r.status === 'fulfilled')
  return NextResponse.json({ prices, live })
}
