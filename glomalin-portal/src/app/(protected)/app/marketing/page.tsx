import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { MarketingWorkspace } from '@/components/marketing/marketing-workspace'
import type { GrainContract, CbotPrice, MarketingPosition } from '@/lib/marketing/types'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface YieldSummary {
  farmId: string
  farmName: string
  registryCropId: string | null
  cropName: string
  cropYear: number
  totalNetBU: number
  acres: number | null
}

interface CbotResponse {
  prices: CbotPrice[]
  live: boolean
  message?: string
}

/**
 * Compute marketing positions from contracts + yield summaries + CBOT prices.
 * Groups contracts by registry_crop_id (if set) or crop name string.
 * Merges with yield summary totals.
 */
function computePositions(
  contracts: GrainContract[],
  yieldSummaries: YieldSummary[],
  cbotPrices: CbotPrice[]
): MarketingPosition[] {
  // Build yield totals keyed by registry_crop_id or crop name
  const yieldByRegistryId = new Map<string, number>()
  const yieldByCropName = new Map<string, number>()

  for (const ys of yieldSummaries) {
    if (ys.registryCropId) {
      yieldByRegistryId.set(
        ys.registryCropId,
        (yieldByRegistryId.get(ys.registryCropId) ?? 0) + ys.totalNetBU
      )
    }
    const key = ys.cropName.toLowerCase().trim()
    yieldByCropName.set(key, (yieldByCropName.get(key) ?? 0) + ys.totalNetBU)
  }

  // Build CBOT price lookup by commodity name (case-insensitive)
  const priceByName = new Map<string, number>()
  for (const p of cbotPrices) {
    priceByName.set(p.commodity.toLowerCase().trim(), p.price)
  }

  // Group contracts: prefer registry_crop_id grouping, fall back to crop name
  // Key: "registry:<id>" or "name:<name>"
  const positionMap = new Map<
    string,
    { crop: string; registry_crop_id: string | null; contracts: GrainContract[] }
  >()

  for (const contract of contracts) {
    const key = contract.registry_crop_id
      ? `registry:${contract.registry_crop_id}`
      : `name:${contract.crop.toLowerCase().trim()}`

    if (!positionMap.has(key)) {
      positionMap.set(key, {
        crop: contract.crop,
        registry_crop_id: contract.registry_crop_id,
        contracts: [],
      })
    }
    positionMap.get(key)!.contracts.push(contract)
  }

  // Include crops from yield summaries that have no contracts
  for (const ys of yieldSummaries) {
    const key = ys.registryCropId
      ? `registry:${ys.registryCropId}`
      : `name:${ys.cropName.toLowerCase().trim()}`

    if (!positionMap.has(key)) {
      positionMap.set(key, {
        crop: ys.cropName,
        registry_crop_id: ys.registryCropId,
        contracts: [],
      })
    }
  }

  const positions: MarketingPosition[] = []

  for (const [, entry] of Array.from(positionMap)) {
    const contracted_bu = entry.contracts.reduce((sum: number, c: GrainContract) => sum + c.bushels, 0)

    // Estimated production: try registry_crop_id first, then name match
    let estimated_production_bu = 0
    if (entry.registry_crop_id && yieldByRegistryId.has(entry.registry_crop_id)) {
      estimated_production_bu = yieldByRegistryId.get(entry.registry_crop_id)!
    } else {
      const nameKey = entry.crop.toLowerCase().trim()
      estimated_production_bu = yieldByCropName.get(nameKey) ?? 0
    }

    const unpriced_bu = Math.max(0, estimated_production_bu - contracted_bu)

    // CBOT price: try canonical name match (case-insensitive)
    const cropNameKey = entry.crop.toLowerCase().trim()
    const cbot_price = priceByName.get(cropNameKey) ?? null

    const unpriced_exposure_dollars =
      cbot_price !== null ? unpriced_bu * cbot_price : null

    positions.push({
      crop: entry.crop,
      registry_crop_id: entry.registry_crop_id,
      estimated_production_bu,
      contracted_bu,
      unpriced_bu,
      cbot_price,
      unpriced_exposure_dollars,
      contracts: entry.contracts,
    })
  }

  // Sort by crop name
  positions.sort((a, b) => a.crop.localeCompare(b.crop))

  return positions
}

export default async function MarketingPage() {
  const supabase = await createClient()

  // Load contracts + CBOT prices + yield summaries via Promise.allSettled
  // so the page works gracefully when grain-tickets is offline.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'

  const [contractsResult, cbotResult, yieldResult] = await Promise.allSettled([
    supabase
      .from('grain_contracts')
      .select('*')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .order('crop'),
    fetch(`${appUrl}/api/marketing/cbot-prices`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json() as Promise<CbotResponse>),
    fetch(`http://localhost:3007/api/yield-summaries?cropYear=${CURRENT_CROP_YEAR}`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.json() as Promise<YieldSummary[]>),
  ])

  const contractsSettled: GrainContract[] =
    contractsResult.status === 'fulfilled'
      ? ((contractsResult.value.data as GrainContract[]) ?? [])
      : []

  const cbotData: CbotResponse =
    cbotResult.status === 'fulfilled'
      ? cbotResult.value
      : { prices: [], live: false, message: 'CBOT price fetch failed' }

  const yieldSummaries: YieldSummary[] =
    yieldResult.status === 'fulfilled'
      ? (Array.isArray(yieldResult.value) ? yieldResult.value : [])
      : []

  const yieldAvailable = yieldResult.status === 'fulfilled'

  const priceSource =
    cbotData.prices.length > 0 ? cbotData.prices[0].source : 'unavailable'
  const priceTimestamp =
    cbotData.prices.length > 0 ? cbotData.prices[0].timestamp : null

  const initialPositions = computePositions(
    contractsSettled,
    yieldSummaries,
    cbotData.prices
  )

  return (
    // Suspense required: MarketingWorkspace uses useSearchParams()
    <Suspense fallback={null}>
      <MarketingWorkspace
        initialContracts={contractsSettled}
        initialPositions={initialPositions}
        cbotPrices={cbotData.prices}
        priceSource={priceSource}
        priceTimestamp={priceTimestamp}
        yieldAvailable={yieldAvailable}
        yieldSummaries={yieldSummaries}
      />
    </Suspense>
  )
}
