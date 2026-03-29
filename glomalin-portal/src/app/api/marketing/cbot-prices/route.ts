import { NextResponse } from 'next/server'
import type { CbotPrice } from '@/lib/marketing/types'

// Cache CBOT prices for 15 minutes — delayed quotes don't need real-time refresh
export const revalidate = 900

// Commodity map: symbol → canonical crop registry name
// Canonical names match Phase 50 crop registry so the UI can join on crop name.
const COMMODITY_MAP: Array<{
  symbol: string
  commodity: string
  canonicalName: string
  fallbackPrice: number
}> = [
  {
    symbol: 'ZCZ26',
    commodity: 'Corn',
    canonicalName: 'Yellow Corn',
    fallbackPrice: 4.5,
  },
  {
    symbol: 'ZSX26',
    commodity: 'Soybeans',
    canonicalName: 'Soybeans',
    fallbackPrice: 10.5,
  },
  {
    symbol: 'ZWZ26',
    commodity: 'Wheat',
    canonicalName: 'Soft Red Winter Wheat',
    fallbackPrice: 5.8,
  },
  {
    symbol: 'ZOZ26',
    commodity: 'Oats',
    canonicalName: 'Oats',
    fallbackPrice: 3.5,
  },
]

// GET /api/marketing/cbot-prices
// Returns CBOT delayed futures prices for major grain commodities.
// MKT-02: Live or fallback CBOT prices for unpriced exposure calculation.
//
// When BARCHART_API_KEY is set: fetches delayed quotes from Barchart OnDemand API.
// When not set: returns manual fallback prices clearly labeled as stale.
// The UI always works regardless of API key availability.
export async function GET() {
  const apiKey = process.env.BARCHART_API_KEY

  if (!apiKey) {
    // Return manual fallback prices — clearly labeled so users know they're stale
    const fallbackPrices: CbotPrice[] = COMMODITY_MAP.map((c) => ({
      commodity: c.canonicalName,
      symbol: c.symbol,
      price: c.fallbackPrice,
      change: 0,
      timestamp: new Date().toISOString(),
      source: 'manual-fallback',
    }))

    return NextResponse.json({
      prices: fallbackPrices,
      live: false,
      message:
        'BARCHART_API_KEY not configured. Set this env var for live delayed quotes. ' +
        'Get a free key at https://www.barchart.com/ondemand/api',
    })
  }

  // Fetch from Barchart OnDemand free delayed quotes API
  const symbols = COMMODITY_MAP.map((c) => c.symbol).join(',')
  const url = `https://ondemand.websol.barchart.com/getQuote.json?apikey=${apiKey}&symbols=${symbols}`

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      throw new Error(`Barchart API returned HTTP ${response.status}`)
    }

    const json = await response.json()

    // Barchart OnDemand response shape: { status: {...}, results: [{symbol, lastPrice, tradeTime, ...}] }
    if (!json.results || !Array.isArray(json.results)) {
      throw new Error('Unexpected Barchart response shape: missing results array')
    }

    const resultMap = new Map<string, { lastPrice: number; percentChange: number; tradeTime: string }>(
      json.results.map(
        (r: { symbol: string; lastPrice: number; percentChange: number; tradeTime: string }) => [
          r.symbol,
          r,
        ]
      )
    )

    const prices: CbotPrice[] = COMMODITY_MAP.map((c) => {
      const result = resultMap.get(c.symbol)
      return {
        commodity: c.canonicalName,
        symbol: c.symbol,
        price: result?.lastPrice ?? c.fallbackPrice,
        change: result?.percentChange ?? 0,
        timestamp: result?.tradeTime ? new Date(result.tradeTime).toISOString() : new Date().toISOString(),
        source: result ? 'barchart-delayed' : 'manual-fallback',
      }
    })

    return NextResponse.json({ prices, live: true })
  } catch (err) {
    // On any fetch error, fall back to hardcoded prices with error context
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const fallbackPrices: CbotPrice[] = COMMODITY_MAP.map((c) => ({
      commodity: c.canonicalName,
      symbol: c.symbol,
      price: c.fallbackPrice,
      change: 0,
      timestamp: new Date().toISOString(),
      source: 'manual-fallback',
    }))

    return NextResponse.json({
      prices: fallbackPrices,
      live: false,
      message: `Live prices unavailable: ${errorMessage}. Showing manual fallback prices.`,
    })
  }
}
