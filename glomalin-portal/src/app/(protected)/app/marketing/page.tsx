import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'
import { YearSelector } from '@/components/ui/year-selector'
import { computeCommodityPositions } from '@/lib/marketing/queries'
import {
  fetchBudgetService,
  fetchGrainService,
} from '@/app/api/mobile/_lib/proxy'
import type { CbotPrice, YieldSummary, BudgetField } from '@/lib/marketing/types'

const COMMODITY_MAP = [
  { symbol: 'ZCZ26', commodity: 'Corn',     fallbackPrice: 4.5 },
  { symbol: 'ZSX26', commodity: 'Soybeans', fallbackPrice: 10.5 },
  { symbol: 'ZWZ26', commodity: 'Wheat',    fallbackPrice: 5.8 },
  { symbol: 'ZOZ26', commodity: 'Oats',     fallbackPrice: 3.5 },
]

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const cropYear = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR
  const supabase = await createClient()

  const [
    { data: commodities },
    { data: variants },
    { data: instruments },
    { data: pricingConfigs },
  ] = await Promise.all([
    supabase.from('commodities').select('*').order('sort_order'),
    supabase.from('crop_variants').select('*').eq('crop_year', cropYear).order('commodity_id').order('name'),
    supabase.from('sale_instruments').select('*').eq('crop_year', cropYear).order('commodity_id').order('created_at'),
    supabase.from('commodity_pricing').select('*').eq('crop_year', cropYear),
  ])

  // CBOT prices — farm-budget proxies Yahoo Finance, falls back to hardcoded reference prices
  let cbotPrices: CbotPrice[] = []
  let priceSource = 'unavailable'
  let priceTimestamp: string | null = null
  try {
    const results = await Promise.allSettled(
      COMMODITY_MAP.map(async (c) => {
        const res = await fetchBudgetService(`/api/cbot-fetch?symbol=${encodeURIComponent(c.symbol)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { price?: number; change?: number; timestamp?: string; source?: string }
        if (!json.price) throw new Error('No price')
        return {
          commodity:  c.commodity,
          symbol:     c.symbol,
          price:      json.price,
          change:     json.change ?? 0,
          timestamp:  json.timestamp ?? new Date().toISOString(),
          source:     json.source ?? 'barchart-delayed',
        } satisfies CbotPrice
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        cbotPrices.push(r.value)
        priceSource    = r.value.source
        priceTimestamp = r.value.timestamp
      }
    }
  } catch { /* ignore */ }

  if (cbotPrices.length === 0) {
    cbotPrices = COMMODITY_MAP.map((c) => ({
      commodity: c.commodity,
      symbol:    c.symbol,
      price:     c.fallbackPrice,
      change:    0,
      timestamp: new Date().toISOString(),
      source:    'manual-fallback',
    }))
    priceSource = 'manual-fallback'
  }

  // Yield summaries from grain-tickets (best-effort)
  let yieldSummaries: YieldSummary[] = []
  let yieldAvailable = false
  try {
    const res = await fetchGrainService(`/api/summaries?year=${cropYear}`)
    if (res.ok) {
      const json = (await res.json()) as { summaries?: YieldSummary[] }
      yieldSummaries = json.summaries ?? []
      yieldAvailable = true
    }
  } catch { /* grain-tickets may be offline */ }

  // Budget fields from farm-budget (best-effort)
  let budgetFields: BudgetField[] = []
  try {
    const res = await fetchBudgetService('/api/budget-field-details')
    if (res.ok) {
      const json = (await res.json()) as { fields?: BudgetField[] }
      budgetFields = json.fields ?? []
    }
  } catch { /* farm-budget may be offline */ }

  const positions = computeCommodityPositions(
    commodities ?? [],
    variants    ?? [],
    instruments ?? [],
    cbotPrices,
    pricingConfigs ?? []
  )

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-end px-4 pt-4 pb-0">
        <YearSelector currentYear={cropYear} />
      </div>
      <MarketingWorkspace
        commodities={commodities ?? []}
        initialVariants={variants ?? []}
        initialInstruments={instruments ?? []}
        initialCommodityPositions={positions}
        initialPricingConfigs={pricingConfigs ?? []}
        cbotPrices={cbotPrices}
        priceSource={priceSource}
        priceTimestamp={priceTimestamp}
        yieldAvailable={yieldAvailable}
        yieldSummaries={yieldSummaries}
        budgetFields={budgetFields}
        cropYear={cropYear}
      />
    </div>
  )
}
