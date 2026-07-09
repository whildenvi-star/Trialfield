// Pure TypeScript — no React, no HTTP. Groups contracts by commodity and computes
// per-crop position summaries, sale histories, budget aggregates, and what-if
// scenario math for the marketing dashboard.

import { computePosition, PRICED_INSTRUMENTS } from './position'
import type { PositionSummary, GrainContractForPosition } from './position'

// ── Input types (shapes from the API responses) ────────────────────────────

export interface RawGrainVariant {
  id: string
  name: string
  cropYear?: number
  commodity?: {
    name: string
    symbol: string | null  // "C" = corn, "S" = soy, "W" = wheat, null for non-exchange
  }
}

export interface BudgetFieldRow {
  crop: string         // free-text, e.g. "Corn", "Soybeans" — matched case-insensitively
  acres: number
  expPerAcre: number
  yieldPerAcre: number
}

// Contract shape as consumed here — position fields plus display metadata
export interface ContractWithVariant extends GrainContractForPosition {
  id?: string
  variant?: { id: string; name: string } | null
  deliveryStartDate?: string | null
  deliveryStart?: string | null
  createdAt?: string | null
}

// ── Output types ───────────────────────────────────────────────────────────

export interface VariantPosition {
  variantId: string
  variantName: string
  contractedBu: number
  pricedBu: number
  openBu: number
  avgPriceCents: number  // 0 when no priced contracts have a known price
}

export interface SaleRow {
  id: string
  date: string | null          // deliveryStartDate ?? deliveryStart ?? createdAt
  bushels: number
  priceDollars: number | null  // effective price; null when unpriced (e.g. PRICED_LATER)
  instrument: string
  cumulativeBu: number         // running total in date order
  cumulativePctSold: number | null  // vs projected production; null when no budget
}

export interface CropBudget {
  acres: number
  expPerAcre: number       // weighted avg across all fields for this crop
  yieldPerAcre: number     // weighted avg
  copPerBu: number         // break-even: expPerAcre / yieldPerAcre (≡ totalCost / totalEstimatedBu)
  totalEstimatedBu: number // projected production: acres × yieldPerAcre
  totalCost: number        // total COP: acres × expPerAcre
}

export interface CropMarketingData {
  commodityName: string
  cbotSymbol: string | null        // "C", "S", "W", or null for non-exchange
  cbotPriceDollars: number | null  // $/bu, live from farm-budget
  position: PositionSummary
  variantBreakdown: VariantPosition[]
  sales: SaleRow[]
  budget: CropBudget | null
  /** contractedBu / projected production; null when no budget data */
  pctSold: number | null
  /** sold more than projected production */
  overhedged: boolean
  /** (WAP − break-even) on priced bushels; null when either side unknown */
  marginLockedPerBu: number | null
  marginLockedTotal: number | null
}

// ── What-if scenario (pure — stackable hypothetical sales) ─────────────────

export interface HypotheticalSale {
  bushels: number
  priceDollars: number
}

export interface ScenarioResult {
  hypoBu: number
  hypoRevenue: number
  newSoldBu: number
  newPctSold: number | null       // vs projected production; null when no budget
  newPricedBu: number
  /** blended weighted-average price across real priced + hypothetical bushels; null when nothing priced */
  newWAPDollars: number | null
  /** revenue on all priced bushels, real + hypothetical */
  lockedRevenue: number
  totalCOP: number | null
  /** lockedRevenue − totalCOP; how far locked sales cover the whole crop's cost */
  profitVsTotalCOP: number | null
  /** newWAP − break-even */
  marginPerBu: number | null
  overhedged: boolean
}

export function applyScenario(
  crop: CropMarketingData,
  hypos: HypotheticalSale[]
): ScenarioResult {
  const valid = hypos.filter((h) => h.bushels > 0 && h.priceDollars > 0)
  const hypoBu = valid.reduce((s, h) => s + h.bushels, 0)
  const hypoRevenue = valid.reduce((s, h) => s + h.bushels * h.priceDollars, 0)

  const realPricedBu = crop.position.pricedBu
  const realPricedRevenue = (crop.position.avgPriceCents / 100) * realPricedBu

  const newPricedBu = realPricedBu + hypoBu
  const newWAPDollars =
    newPricedBu > 0 ? (realPricedRevenue + hypoRevenue) / newPricedBu : null

  const newSoldBu = crop.position.contractedBu + hypoBu
  const projected = crop.budget?.totalEstimatedBu ?? null
  const newPctSold = projected && projected > 0 ? newSoldBu / projected : null

  const lockedRevenue = realPricedRevenue + hypoRevenue
  const totalCOP = crop.budget?.totalCost ?? null
  const profitVsTotalCOP = totalCOP != null ? lockedRevenue - totalCOP : null
  const marginPerBu =
    newWAPDollars != null && crop.budget != null
      ? newWAPDollars - crop.budget.copPerBu
      : null

  return {
    hypoBu,
    hypoRevenue,
    newSoldBu,
    newPctSold,
    newPricedBu,
    newWAPDollars,
    lockedRevenue,
    totalCOP,
    profitVsTotalCOP,
    marginPerBu,
    overhedged: projected != null && newSoldBu > projected,
  }
}

// ── Internal types ─────────────────────────────────────────────────────────

interface CommodityGroup {
  commodityName: string
  cbotSymbol: string | null
  contracts: ContractWithVariant[]
  variantNameById: Map<string, string>
}

// Effective sale price in cents — mirrors computePosition's WAP rules
function effectivePriceCents(c: GrainContractForPosition): number | null {
  if (!PRICED_INSTRUMENTS.has(c.instrument)) return null
  if (c.finalCashPrice != null) return c.finalCashPrice
  if (c.futuresPrice != null) return c.futuresPrice + (c.basis ?? 0)
  return null
}

// ── Step 1: Group contracts by commodity ───────────────────────────────────

export function groupContractsByCommodity(
  contracts: ContractWithVariant[],
  variants: RawGrainVariant[]
): Map<string, CommodityGroup> {
  // Build lookup: variantId → { commodityName, cbotSymbol, variantName }
  const variantMeta = new Map<string, { commodityName: string; cbotSymbol: string | null; variantName: string }>()
  for (const v of variants) {
    if (v.commodity) {
      variantMeta.set(v.id, {
        commodityName: v.commodity.name,
        cbotSymbol: v.commodity.symbol,
        variantName: v.name,
      })
    }
  }

  const groups = new Map<string, CommodityGroup>()

  function getOrCreate(commodityName: string, cbotSymbol: string | null): CommodityGroup {
    let group = groups.get(commodityName)
    if (!group) {
      group = { commodityName, cbotSymbol, contracts: [], variantNameById: new Map() }
      groups.set(commodityName, group)
    }
    return group
  }

  for (const contract of contracts) {
    const variantId = contract.variant?.id
    const meta = variantId ? variantMeta.get(variantId) : undefined

    if (meta) {
      const group = getOrCreate(meta.commodityName, meta.cbotSymbol)
      group.contracts.push(contract)
      if (variantId) group.variantNameById.set(variantId, meta.variantName)
    } else {
      const group = getOrCreate('Other', null)
      group.contracts.push(contract)
    }
  }

  return groups
}

// ── Step 2: Build the full CropMarketingData list ─────────────────────────

// Budget crop name → CBOT short symbol, for crops with production but no contracts yet
const CROP_NAME_TO_SYMBOL: Record<string, string> = {
  corn: 'C',
  soybeans: 'S',
  soybean: 'S',
  wheat: 'W',
}

export function buildCropMarketingDataList(
  groups: Map<string, CommodityGroup>,
  budgetFields: BudgetFieldRow[],
  cbotPricesBySymbol: Record<string, number | null>
): CropMarketingData[] {
  // Aggregate budget rows by crop name (case-insensitive)
  const budgetByCrop = new Map<string, CropBudget>()
  const budgetDisplayName = new Map<string, string>()
  const budgetGrouped = groupBudgetByCrop(budgetFields)
  for (const [cropKey, fields] of Array.from(budgetGrouped.entries())) {
    const totalAcres = fields.reduce((s: number, f: BudgetFieldRow) => s + f.acres, 0)
    if (totalAcres === 0) continue
    const expPerAcre = fields.reduce((s: number, f: BudgetFieldRow) => s + f.expPerAcre * f.acres, 0) / totalAcres
    const yieldPerAcre = fields.reduce((s: number, f: BudgetFieldRow) => s + f.yieldPerAcre * f.acres, 0) / totalAcres
    if (yieldPerAcre <= 0) continue
    budgetByCrop.set(cropKey, {
      acres: totalAcres,
      expPerAcre,
      yieldPerAcre,
      copPerBu: expPerAcre / yieldPerAcre,
      totalEstimatedBu: totalAcres * yieldPerAcre,
      totalCost: totalAcres * expPerAcre,
    })
    budgetDisplayName.set(cropKey, fields[0].crop.trim())
  }

  const result: CropMarketingData[] = []
  const coveredBudgetKeys = new Set<string>()

  for (const group of Array.from(groups.values())) {
    const position = computePosition(group.contracts)

    // Per-variant breakdown
    const contractsByVariant = new Map<string, ContractWithVariant[]>()
    for (const c of group.contracts) {
      const key = c.variant?.id ?? '__unmatched__'
      if (!contractsByVariant.has(key)) contractsByVariant.set(key, [])
      contractsByVariant.get(key)!.push(c)
    }

    const variantBreakdown: VariantPosition[] = []
    for (const [variantId, vContracts] of Array.from(contractsByVariant.entries())) {
      const vPos = computePosition(vContracts)
      variantBreakdown.push({
        variantId,
        variantName: group.variantNameById.get(variantId) ?? vContracts[0]?.variant?.name ?? 'Unknown',
        contractedBu: vPos.contractedBu,
        pricedBu: vPos.pricedBu,
        openBu: vPos.openBu,
        avgPriceCents: vPos.avgPriceCents,
      })
    }
    variantBreakdown.sort((a, b) => b.contractedBu - a.contractedBu)

    // Budget match
    const budgetKey = group.commodityName.toLowerCase().trim()
    const budget = budgetByCrop.get(budgetKey) ?? null
    if (budget) coveredBudgetKeys.add(budgetKey)

    // CBOT price match
    const cbotPriceDollars =
      group.cbotSymbol != null ? (cbotPricesBySymbol[group.cbotSymbol] ?? null) : null

    result.push(
      assembleCrop(group.commodityName, group.cbotSymbol, cbotPriceDollars, position, variantBreakdown, buildSaleRows(group.contracts, budget), budget)
    )
  }

  // Crops with projected production but zero contracts still get a card
  for (const [cropKey, budget] of Array.from(budgetByCrop.entries())) {
    if (coveredBudgetKeys.has(cropKey)) continue
    const symbol = CROP_NAME_TO_SYMBOL[cropKey] ?? null
    const cbotPriceDollars = symbol != null ? (cbotPricesBySymbol[symbol] ?? null) : null
    result.push(
      assembleCrop(budgetDisplayName.get(cropKey) ?? cropKey, symbol, cbotPriceDollars, computePosition([]), [], [], budget)
    )
  }

  // Largest position first; zero-sale budget crops and "Other" sink naturally
  result.sort((a, b) => b.position.contractedBu - a.position.contractedBu)

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────

function assembleCrop(
  commodityName: string,
  cbotSymbol: string | null,
  cbotPriceDollars: number | null,
  position: PositionSummary,
  variantBreakdown: VariantPosition[],
  sales: SaleRow[],
  budget: CropBudget | null
): CropMarketingData {
  const projected = budget?.totalEstimatedBu ?? null
  const pctSold = projected && projected > 0 ? position.contractedBu / projected : null

  const wapDollars = position.avgPriceCents > 0 ? position.avgPriceCents / 100 : null
  const marginLockedPerBu =
    wapDollars != null && budget != null ? wapDollars - budget.copPerBu : null
  const marginLockedTotal =
    marginLockedPerBu != null ? marginLockedPerBu * position.pricedBu : null

  return {
    commodityName,
    cbotSymbol,
    cbotPriceDollars,
    position,
    variantBreakdown,
    sales,
    budget,
    pctSold,
    overhedged: projected != null && position.contractedBu > projected,
    marginLockedPerBu,
    marginLockedTotal,
  }
}

function buildSaleRows(contracts: ContractWithVariant[], budget: CropBudget | null): SaleRow[] {
  const projected = budget?.totalEstimatedBu ?? null

  const dated = contracts.map((c, i) => ({
    id: c.id ?? `contract-${i}`,
    date: c.deliveryStartDate ?? c.deliveryStart ?? c.createdAt ?? null,
    bushels: c.contractedBushels,
    priceDollars: (() => {
      const cents = effectivePriceCents(c)
      return cents != null ? cents / 100 : null
    })(),
    instrument: c.instrument,
  }))

  // Date ascending, undated last
  dated.sort((a, b) => {
    if (a.date == null && b.date == null) return 0
    if (a.date == null) return 1
    if (b.date == null) return -1
    return a.date.localeCompare(b.date)
  })

  let cumulative = 0
  return dated.map((s) => {
    cumulative += s.bushels
    return {
      ...s,
      cumulativeBu: cumulative,
      cumulativePctSold: projected && projected > 0 ? cumulative / projected : null,
    }
  })
}

function groupBudgetByCrop(fields: BudgetFieldRow[]): Map<string, BudgetFieldRow[]> {
  const m = new Map<string, BudgetFieldRow[]>()
  for (const f of fields) {
    const key = f.crop.toLowerCase().trim()
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(f)
  }
  return m
}
