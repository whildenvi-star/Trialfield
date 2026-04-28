import { createClient } from '@/lib/supabase/server'
import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'
import { MobileMacroView } from '@/components/macro/mobile-macro-view'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { FieldRow, ContractEntry, InputEntry } from '@/components/macro/field-table'
import type { Commodity, CropVariant, SaleInstrument, CbotPrice } from '@/lib/marketing/types'
import { computeCommodityPositions } from '@/lib/marketing/queries'

const ROLE_MAP: Record<string, string> = {
  admin: 'admin',
  agronomist: 'agronomist',
  operator: 'operator',
  viewer: 'office',
}

// ── Types for farm-budget /api/budget-field-details response ──────────────────

interface BudgetField {
  fieldId: string
  fieldName: string
  crop: string
  acres: number
  rentPerAcre: number
  fertPerAcre: number
  seedPerAcre: number
  machineryPerAcre: number
  laborPerAcre: number
  fuelPerAcre: number
  dryingPerAcre: number
  interestPerAcre: number
  insurancePerAcre: number
  expPerAcre: number
  cropIncomePerAcre: number
  profitPerAcre: number
}

export type { BudgetField }

interface RawField {
  id: string
  seed?: { variety?: string; population?: number }
  inputs?: Array<{ id?: string; productName?: string; quantity?: number; season?: string; unit?: string }>
}

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MacroRollupPage() {
  const supabase = await createClient()

  // 1. Resolve user role
  const { data: { user } } = await supabase.auth.getUser()
  let role = 'office'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const dbRole = profile?.role ?? 'viewer'
    role = ROLE_MAP[dbRole] ?? 'office'
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'

  // 2. Fetch everything in parallel — budget data + marketing data
  const [
    budgetRes,
    fieldsRes,
    productNamesRes,
    cropNamesRes,
    commoditiesResult,
    variantsResult,
    instrumentsResult,
    cbotResult,
    yieldResult,
  ] = await Promise.allSettled([
    fetchBudgetService('/api/budget-field-details'),
    fetchBudgetService('/api/fields?all=true'),
    fetchBudgetService('/api/product-names'),
    fetchBudgetService('/api/crop-names'),
    supabase.from('commodities').select('*').order('sort_order'),
    supabase.from('crop_variants').select('*').eq('crop_year', CURRENT_CROP_YEAR),
    supabase.from('sale_instruments').select('*').eq('crop_year', CURRENT_CROP_YEAR).order('commodity_id'),
    fetch(`${appUrl}/api/marketing/cbot-prices`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json() as Promise<CbotResponse>),
    fetchGrainService(`/api/yield-summaries?cropYear=${CURRENT_CROP_YEAR}`)
      .then((r) => r.json() as Promise<YieldSummary[]>),
  ])

  // ── Budget fields ─────────────────────────────────────────────────────────

  let budgetFields: BudgetField[] = []
  let budgetOffline = false

  if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
    const data = await budgetRes.value.json() as { fields?: BudgetField[] }
    budgetFields = (data.fields ?? []).filter((f) => f.acres > 0)
  } else {
    budgetOffline = true
  }

  // Build crop plan lookup keyed by fieldId
  const cropPlanById = new Map<string, { variety: string | null; population: number | null; inputs: InputEntry[] }>()
  if (fieldsRes.status === 'fulfilled' && fieldsRes.value.ok) {
    const rawFields = await fieldsRes.value.json() as RawField[]
    for (const f of Array.isArray(rawFields) ? rawFields : []) {
      const inputs: InputEntry[] = (f.inputs ?? [])
        .filter((i) => i.productName)
        .map((i, idx) => ({
          id: i.id ?? `inp_${idx}`,
          productName: i.productName!,
          quantity: i.quantity ?? 0,
          season: i.season ?? 'Spring',
          unit: i.unit ?? 'per acre',
        }))
      cropPlanById.set(f.id, {
        variety: f.seed?.variety ?? null,
        population: f.seed?.population ?? null,
        inputs,
      })
    }
  }

  let productNames: string[] = []
  let cropNames: string[] = []

  if (productNamesRes.status === 'fulfilled' && productNamesRes.value.ok) {
    const data = await productNamesRes.value.json()
    productNames = Array.isArray(data) ? data as string[] : []
  }
  if (cropNamesRes.status === 'fulfilled' && cropNamesRes.value.ok) {
    const data = await cropNamesRes.value.json()
    cropNames = Array.isArray(data) ? data as string[] : []
  }

  // ── Marketing data ────────────────────────────────────────────────────────

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

  const cbotData: CbotResponse =
    cbotResult.status === 'fulfilled'
      ? cbotResult.value
      : { prices: [], live: false }

  const yieldSummaries: YieldSummary[] =
    yieldResult.status === 'fulfilled' && Array.isArray(yieldResult.value)
      ? yieldResult.value
      : []

  const yieldAvailable = yieldResult.status === 'fulfilled'

  const priceSource =
    cbotData.prices.length > 0 ? cbotData.prices[0].source : 'unavailable'
  const priceTimestamp =
    cbotData.prices.length > 0 ? cbotData.prices[0].timestamp : null

  const initialCommodityPositions = computeCommodityPositions(
    commodities,
    cropVariants,
    saleInstruments,
    cbotData.prices
  )

  // ── Legacy grain_contracts (for overview tab revenue allocation) ───────────

  const { data: contractData } = await supabase
    .from('grain_contracts')
    .select('id, crop, bushels, price_per_bushel, contract_type, buyer, delivery_start, delivery_end, crop_year')
    .eq('crop_year', CURRENT_CROP_YEAR)
    .order('crop')
    .order('created_at')

  const allContracts = contractData ?? []
  const hasContracts = allContracts.length > 0

  const contractsByCrop = new Map<string, typeof allContracts>()
  for (const c of allContracts) {
    const cropKey = (c.crop as string).toLowerCase()
    if (!contractsByCrop.has(cropKey)) contractsByCrop.set(cropKey, [])
    contractsByCrop.get(cropKey)!.push(c)
  }

  const contractRevByCrop = new Map<string, number>()
  contractsByCrop.forEach((contracts, cropKey) => {
    const rev = contracts.reduce((s: number, c: Record<string, unknown>) => {
      return s + (Number(c.bushels) || 0) * (Number(c.price_per_bushel) || 0)
    }, 0)
    contractRevByCrop.set(cropKey, rev)
  })

  const totalAcresByCrop = new Map<string, number>()
  for (const f of budgetFields) {
    const key = f.crop.toLowerCase()
    totalAcresByCrop.set(key, (totalAcresByCrop.get(key) ?? 0) + f.acres)
  }

  // ── Build per-field rows ──────────────────────────────────────────────────

  const rows: FieldRow[] = budgetFields.map((f) => {
    const cropKey = f.crop.toLowerCase()
    const cropTotalAcres = totalAcresByCrop.get(cropKey) ?? 0
    const cropRev = contractRevByCrop.get(cropKey) ?? 0
    const share = cropTotalAcres > 0 ? f.acres / cropTotalAcres : 0
    const revenue = hasContracts ? cropRev * share : null
    const revenuePerAcre = revenue !== null && f.acres > 0 ? revenue / f.acres : null
    const rawContracts = contractsByCrop.get(cropKey) ?? []
    const fieldContracts: ContractEntry[] = rawContracts.map((c) => ({
      id: c.id as string,
      buyer: c.buyer as string | null,
      contractType: c.contract_type as string,
      bushels: Number(c.bushels) || 0,
      pricePerBushel: c.price_per_bushel != null ? Number(c.price_per_bushel) : null,
      deliveryStart: c.delivery_start as string | null,
      deliveryEnd: c.delivery_end as string | null,
      total: c.price_per_bushel != null
        ? (Number(c.bushels) || 0) * Number(c.price_per_bushel)
        : null,
    }))

    const totalCost = f.expPerAcre * f.acres
    const margin = revenue !== null ? revenue - totalCost : null
    const marginPerAcre = margin !== null && f.acres > 0 ? margin / f.acres : null

    const missingData: string[] = []
    if (f.rentPerAcre === 0) missingData.push('Land rent')
    if (f.fertPerAcre === 0) missingData.push('Fertilizer costs')
    if (f.seedPerAcre === 0) missingData.push('Seed costs')

    const cropPlan = cropPlanById.get(f.fieldId)

    return {
      fieldId: f.fieldId,
      fieldName: f.fieldName,
      crop: f.crop,
      acres: f.acres,
      totalCost,
      costPerAcre: f.expPerAcre,
      costBreakdown: {
        rent: f.rentPerAcre,
        fert: f.fertPerAcre,
        seed: f.seedPerAcre,
        machinery: f.machineryPerAcre,
        labor: f.laborPerAcre,
        fuel: f.fuelPerAcre,
        drying: f.dryingPerAcre,
        interest: f.interestPerAcre,
        insurance: f.insurancePerAcre,
      },
      revenue,
      revenuePerAcre,
      margin,
      marginPerAcre,
      budgetMarginPerAcre: f.profitPerAcre,
      budgetRevenuePerAcre: f.cropIncomePerAcre,
      contracts: fieldContracts,
      missingData,
      variety: cropPlan?.variety ?? null,
      population: cropPlan?.population ?? null,
      inputs: cropPlan?.inputs ?? [],
    }
  })

  rows.sort((a, b) => b.budgetMarginPerAcre - a.budgetMarginPerAcre)

  const heroValueProjected = rows.length > 0
    ? rows.reduce((s, r) => s + r.budgetMarginPerAcre * r.acres, 0)
    : null

  const heroValueLocked = hasContracts && rows.length > 0
    ? rows.reduce((s, r) => s + (r.margin ?? 0), 0)
    : null

  return (
    <MobileMacroView
      rows={rows}
      hasContracts={hasContracts}
      budgetOffline={budgetOffline}
      heroValueProjected={heroValueProjected}
      heroValueLocked={heroValueLocked}
      cropYear={CURRENT_CROP_YEAR}
      role={role}
      productNames={productNames}
      cropNames={cropNames}
      marketingData={{
        commodities,
        cropVariants,
        saleInstruments,
        initialCommodityPositions,
        cbotPrices: cbotData.prices,
        priceSource,
        priceTimestamp,
        yieldAvailable,
        yieldSummaries,
        budgetFields,
      }}
    />
  )
}
