import { createClient } from '@/lib/supabase/server'
import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { Commodity, CropVariant, SaleInstrument, CommodityPricing, CbotPrice, YieldSummary, BudgetField } from '@/lib/marketing/types'
import { computeCommodityPositions } from '@/lib/marketing/queries'

interface CbotResponse {
  prices: CbotPrice[]
  live: boolean
  message?: string
}

export default async function GrainMarketingPage() {
  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'

  const [
    commoditiesResult,
    variantsResult,
    instrumentsResult,
    pricingResult,
    cbotResult,
    yieldResult,
    budgetResult,
  ] = await Promise.allSettled([
    supabase.from('commodities').select('*').order('sort_order'),
    supabase.from('crop_variants').select('*').eq('crop_year', CURRENT_CROP_YEAR),
    supabase.from('sale_instruments').select('*').eq('crop_year', CURRENT_CROP_YEAR).order('commodity_id').order('created_at'),
    supabase.from('commodity_pricing').select('*').eq('crop_year', CURRENT_CROP_YEAR),
    fetch(`${appUrl}/api/marketing/cbot-prices`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json() as Promise<CbotResponse>),
    fetchGrainService(`/api/yield-summaries?cropYear=${CURRENT_CROP_YEAR}`)
      .then((r) => r.json() as Promise<YieldSummary[]>),
    fetchBudgetService('/api/budget-field-details')
      .then((r) => r.json() as Promise<{ fields?: BudgetField[] }>),
  ])

  const commodities: Commodity[] =
    commoditiesResult.status === 'fulfilled'
      ? ((commoditiesResult.value.data as Commodity[]) ?? [])
      : []

  const cropVariants: CropVariant[] =
    variantsResult.status === 'fulfilled'
      ? ((variantsResult.value.data as CropVariant[]) ?? [])
      : []

  const saleInstruments: SaleInstrument[] =
    instrumentsResult.status === 'fulfilled'
      ? ((instrumentsResult.value.data as SaleInstrument[]) ?? [])
      : []

  const pricingConfigs: CommodityPricing[] =
    pricingResult.status === 'fulfilled'
      ? ((pricingResult.value.data as CommodityPricing[]) ?? [])
      : []

  const cbotData: CbotResponse =
    cbotResult.status === 'fulfilled'
      ? cbotResult.value
      : { prices: [], live: false }

  const yieldSummaries: YieldSummary[] =
    yieldResult.status === 'fulfilled' && Array.isArray(yieldResult.value)
      ? yieldResult.value
      : []

  const budgetFields: BudgetField[] =
    budgetResult.status === 'fulfilled'
      ? ((budgetResult.value as { fields?: BudgetField[] }).fields ?? []).filter((f) => f.acres > 0)
      : []

  const yieldAvailable = yieldResult.status === 'fulfilled' && yieldSummaries.length > 0

  const priceSource =
    cbotData.prices.length > 0 ? cbotData.prices[0].source : 'unavailable'
  const priceTimestamp =
    cbotData.prices.length > 0 ? cbotData.prices[0].timestamp : null

  const initialCommodityPositions = computeCommodityPositions(
    commodities,
    cropVariants,
    saleInstruments,
    cbotData.prices,
    pricingConfigs
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-glomalin-text font-mono">Grain Marketing</h1>
        <p className="text-xs text-glomalin-muted font-mono mt-0.5">
          {CURRENT_CROP_YEAR} crop year · positions, contracts &amp; scenario analysis
        </p>
      </div>

      <MarketingWorkspace
        commodities={commodities}
        initialVariants={cropVariants}
        initialInstruments={saleInstruments}
        initialCommodityPositions={initialCommodityPositions}
        initialPricingConfigs={pricingConfigs}
        cbotPrices={cbotData.prices}
        priceSource={priceSource}
        priceTimestamp={priceTimestamp}
        yieldAvailable={yieldAvailable}
        yieldSummaries={yieldSummaries}
        budgetFields={budgetFields}
        cropYear={CURRENT_CROP_YEAR}
      />
    </div>
  )
}
