// Enterprise rollup — pure TypeScript, no React, no HTTP.
//
// Implements the owner's pooled-marketing model (2026-08-06):
//   * All futures sales of a commodity form ONE pool. The pool's weighted avg
//     futures-equivalent price applies to every bushel of the commodity,
//     regardless of variant or farm. Nobody "owns" a good sale.
//   * Variety premiums (high oil +2.15, food +1.50, seed +3.50 …) are applied
//     per bushel at delivery — they stay with the acres that earned them.
//   * A contract's cash price decomposes as
//       futuresEquivalent = finalCashPrice − ContractPremium.netPremium
//     so premium-carrying sales enter the pool at their futures-equivalent.
//
// Rollup rows are commodity × crop year, with variant sub-rows keyed by the
// farm-budget crop line (the true enterprise grain: "RR Soybeans" vs
// "High Oil Soybeans" vs "Soybeans" stay distinct there).

import { computePosition, isPricedContract } from './position'
import type { GrainContractForPosition } from './position'

// ── Crosswalk ──────────────────────────────────────────────────────────────
// Marketing GrainVariant name ↔ farm-budget crop line ↔ grain-tickets crop
// names. Vocabularies differ per app; string matching is NOT safe — every
// link is explicit. Edit here when a new crop line or trade name appears.
// premiumDefault mirrors farm-budget cropTypes[].subCrops[].basisDefault:
// the expected $/bu over (or under) CBOT for unsold bushels of that variant.

/**
 * Marketing tier — the hard wall between the two jobs:
 *   'futures'  — job 1: crops marketed on CBOT futures. Their totals drive
 *                selling decisions and must NEVER be padded by other bushels.
 *   'tracking' — organics & specialty: tracked, but never blended into a
 *                futures total (blue corn bushels are not shell corn bushels).
 */
export type MarketingTier = 'futures' | 'tracking'

export interface CrosswalkEntry {
  variantName: string       // marketing GrainVariant.name
  budgetCrops: string[]     // farm-budget field.crop values (case-insensitive)
  ticketCrops: string[]     // grain-tickets crop names (case-insensitive)
  premiumDefault: number    // $/bu vs CBOT for unsold bu (0 = trades flat)
  tier: MarketingTier
}

export const ENTERPRISE_CROSSWALK: CrosswalkEntry[] = [
  // Corn
  { variantName: 'Shell Corn', budgetCrops: ['Yellow Corn'], ticketCrops: ['Yellow Corn', 'Non-GMO Yellow Corn'], premiumDefault: 0, tier: 'futures' },
  { variantName: 'Non-GMO Yellow Corn', budgetCrops: ['White corn'], ticketCrops: ['White Corn'], premiumDefault: 0, tier: 'futures' },
  { variantName: 'Organic Blue Corn', budgetCrops: ['ORG Blue Corn'], ticketCrops: ['Organic Blue Corn'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Yellow Corn', budgetCrops: ['ORG Yellow Corn'], ticketCrops: ['Organic Yellow Corn'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Seed Corn', budgetCrops: ['ORG Seed Corn'], ticketCrops: [], premiumDefault: 0, tier: 'tracking' }, // PER_ACRE — bushel math excluded anyway
  // Soybeans
  { variantName: 'Soybeans', budgetCrops: ['RR Soybeans'], ticketCrops: ['RR Soybeans', 'Enlist Soybeans'], premiumDefault: -0.75, tier: 'futures' },
  { variantName: 'Non-GMO Food Beans', budgetCrops: ['Soybeans'], ticketCrops: ['Food Beans', 'Pioneer 21A20 Food beans'], premiumDefault: 1.5, tier: 'futures' },
  { variantName: 'High Oil Soybeans', budgetCrops: ['High Oil Soybeans'], ticketCrops: ['High Oil Soybeans'], premiumDefault: 2.15, tier: 'futures' },
  { variantName: 'Non-GMO Seed Grade Beans', budgetCrops: ['Non-GMO Seed Grade Beans'], ticketCrops: ['Non-GMO Seed Grade Beans'], premiumDefault: 3.5, tier: 'futures' },
  { variantName: 'Organic Soybeans', budgetCrops: ['ORG Soybeans'], ticketCrops: ['Organic Soybeans'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Food Beans', budgetCrops: ['ORG Food Beans'], ticketCrops: ['Organic Food Beans'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Natto Beans', budgetCrops: ['ORG Natto Beans', 'ORG Natto Beans (ORG IRR)'], ticketCrops: ['Organic Natto Beans'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Seed Soybeans', budgetCrops: [], ticketCrops: ['262 OR Seed beans'], premiumDefault: 0, tier: 'tracking' },
  // Wheat
  { variantName: 'Wheat', budgetCrops: ['Wheat'], ticketCrops: ['Wheat'], premiumDefault: 0, tier: 'futures' },
  { variantName: 'Organic Wheat', budgetCrops: ['ORG Wheat'], ticketCrops: ['Organic Wheat'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Seed Wheat', budgetCrops: ['ORG seed wheat'], ticketCrops: ['Organic Seed Wheat'], premiumDefault: 0, tier: 'tracking' },
  // Barley / Rye — contract-grown specialty, not futures-marketed
  { variantName: 'Barley', budgetCrops: [], ticketCrops: ['Barley'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Barley', budgetCrops: ['ORG Barley', 'ORG feed barley'], ticketCrops: ['Organic Barley'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Seed Barley', budgetCrops: ['Seed grade Winter Barley'], ticketCrops: ['Seed Barley'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Organic Seed Barley', budgetCrops: [], ticketCrops: ['Organic Seed Barley'], premiumDefault: 0, tier: 'tracking' },
  { variantName: 'Hybrid Rye', budgetCrops: ['Hybrid Seed Rye'], ticketCrops: ['Hybrid Rye'], premiumDefault: 0, tier: 'tracking' },
]

// ── Input shapes ───────────────────────────────────────────────────────────

export interface RollupContract extends GrainContractForPosition {
  id?: string
  cropYear: number
  variant?: { id: string; name: string } | null
  contractPremium?: { netPremium?: number | null } | null
}

export interface RollupVariantMeta {
  id: string
  name: string
  cropYear?: number
  /** planning placeholder basis, signed $/bu — WAP fallback for open basis legs */
  projectedBasis?: number | null
  commodity?: { name: string; symbol: string | null }
}

/** One crop line from farm-budget's dashboard (computeDashboardByCrop). */
export interface BudgetCropRow {
  crop: string
  acres: number
  avgYield: number
  projectedTotal: number
  cop: number // $/bu at projected yield
}

export interface RollupInput {
  cropYear: number
  contracts: RollupContract[]          // pre-filtered to cropYear by caller
  variants: RollupVariantMeta[]
  /** farm-budget crop rows; null when no plan exists for this crop year */
  budgetRows: BudgetCropRow[] | null
  /** actual harvested bu by tickets crop name (lower-cased keys) */
  actualBuByTicketCrop: Record<string, number>
  /** settled revenue $ by tickets crop name (lower-cased keys) */
  settledRevenueByTicketCrop: Record<string, number>
  /** today's futures $/bu by commodity symbol ("C" | "S" | "W") */
  cbotBySymbol: Record<string, number | null>
  /** display label of the futures contract used, by symbol (e.g. "ZCZ26.CBT") */
  cbotContractBySymbol?: Record<string, string>
}

// ── Output shapes ──────────────────────────────────────────────────────────

export interface VariantRollupRow {
  variantName: string
  /** farm-budget crop line(s) backing this row's acres */
  budgetCropNames: string[]
  acres: number | null
  projYieldPerAcre: number | null
  projectedBu: number | null
  actualBu: number | null
  soldBu: number
  pctSold: number | null
  /** realized WAP on this variant's own priced contracts, cents/bu (0 = none) */
  wapCents: number
  /** $/bu premium this variant earns over the pool (contract-avg, else default) */
  premiumPerBu: number
  /** poolWAP + premium — what a bushel of this variant nets under pooling */
  pooledPriceCents: number | null
  copPerBu: number | null
  settledRevenue: number | null
}

export interface CommodityRollupRow {
  commodityName: string
  /** futures = job-1 marketed crops; tracking = organics & specialty. Totals never cross tiers. */
  tier: MarketingTier
  cropYear: number
  cbotSymbol: string | null
  cbotContract: string | null
  cbotPriceDollars: number | null
  acres: number | null
  projYieldPerAcre: number | null   // acre-weighted
  projectedBu: number | null
  actualBu: number | null
  soldBu: number
  pricedBu: number
  pctSold: number | null
  overhedged: boolean
  /** pool weighted-avg futures-equivalent price, cents/bu (premiums stripped) */
  poolWapCents: number | null
  /** realized WAP incl. premiums, cents/bu */
  wapCents: number
  copPerBu: number | null
  copPerAcre: number | null
  totalCost: number | null
  /** Σ effectivePrice × bu over priced contracts (incl. premiums) */
  grossSalesDollars: number
  /** actual settled revenue from grain-tickets, when present */
  settledRevenue: number | null
  /**
   * Blended $/bu if every projected bushel not yet priced were sold at today's
   * futures: (pricedRevenue + max(projected − priced, 0) × today) / max(projected, priced).
   * Unpriced-but-contracted bu (accumulators, open basis) are valued at today.
   * Null when no budget or no live quote.
   */
  blendedIfSoldTodayCents: number | null
  variants: VariantRollupRow[]
}

// ── Financial stripping (office role) ──────────────────────────────────────
// Office sees volumes only. Mirrors the API's stripFinancialFields approach:
// keys are OMITTED from the payload, not nulled.

const COMMODITY_FINANCIAL_KEYS = [
  'cbotPriceDollars', 'poolWapCents', 'wapCents', 'copPerBu', 'copPerAcre',
  'totalCost', 'grossSalesDollars', 'settledRevenue', 'blendedIfSoldTodayCents',
] as const
const VARIANT_FINANCIAL_KEYS = [
  'wapCents', 'premiumPerBu', 'pooledPriceCents', 'copPerBu', 'settledRevenue',
] as const

export type OfficeCommodityRollupRow = Omit<CommodityRollupRow, (typeof COMMODITY_FINANCIAL_KEYS)[number] | 'variants'> & {
  variants: Omit<VariantRollupRow, (typeof VARIANT_FINANCIAL_KEYS)[number]>[]
}

export function stripRollupFinancials(rows: CommodityRollupRow[]): OfficeCommodityRollupRow[] {
  return rows.map((row) => {
    const clone: Record<string, unknown> = { ...row }
    for (const k of COMMODITY_FINANCIAL_KEYS) delete clone[k]
    clone.variants = row.variants.map((v) => {
      const vc: Record<string, unknown> = { ...v }
      for (const k of VARIANT_FINANCIAL_KEYS) delete vc[k]
      return vc
    })
    return clone as OfficeCommodityRollupRow
  })
}

// ── Core computation ───────────────────────────────────────────────────────

const lower = (s: string) => s.toLowerCase().trim()

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0)
}

/** Futures-equivalent price in cents (premium stripped); null when unpriced. */
export function futuresEquivalentCents(c: RollupContract): number | null {
  if (!isPricedContract(c) || c.paymentBasis === 'PER_UNIT') return null
  const premiumCents = Math.round((c.contractPremium?.netPremium ?? 0) * 100)
  if (c.finalCashPrice != null) return Math.round(c.finalCashPrice * 100) - premiumCents
  if (c.futuresPrice != null) return Math.round((c.futuresPrice + (c.basis ?? 0)) * 100)
  return null
}

export function buildEnterpriseRollup(input: RollupInput): CommodityRollupRow[] {
  const {
    cropYear, contracts, variants, budgetRows,
    actualBuByTicketCrop, settledRevenueByTicketCrop,
    cbotBySymbol, cbotContractBySymbol,
  } = input

  // variantId → meta
  const variantMeta = new Map<string, RollupVariantMeta>()
  for (const v of variants) variantMeta.set(v.id, v)

  // Projected-basis placeholders: stand in for a contract's basis in the WAP
  // until its basis leg is actually set (analogous to projected vs actual yield)
  const projectedBasisByVariantId = new Map<string, number>()
  for (const v of variants) {
    if (v.projectedBasis != null) projectedBasisByVariantId.set(v.id, v.projectedBasis)
  }
  const positionOptions = { projectedBasisByVariantId }

  // Same placeholders keyed by variant name for the F-IT remainder valuation —
  // the variant loop works by name. Prefer the selected crop year's variant;
  // a different-year variant only fills in when the year has no row of its own.
  const projectedBasisByVariantName = new Map<string, number>()
  for (const v of variants) {
    if (v.projectedBasis == null || v.cropYear === cropYear) continue
    if (!projectedBasisByVariantName.has(lower(v.name))) {
      projectedBasisByVariantName.set(lower(v.name), v.projectedBasis)
    }
  }
  for (const v of variants) {
    if (v.projectedBasis != null && v.cropYear === cropYear) {
      projectedBasisByVariantName.set(lower(v.name), v.projectedBasis)
    }
  }

  // variantName → crosswalk entry
  const xwalkByVariant = new Map<string, CrosswalkEntry>()
  for (const e of ENTERPRISE_CROSSWALK) xwalkByVariant.set(lower(e.variantName), e)

  // budget crop name (lower) → row
  const budgetByCrop = new Map<string, BudgetCropRow>()
  for (const b of budgetRows ?? []) budgetByCrop.set(lower(b.crop), b)

  // Tier wall: a variant's bushels only ever total with its own tier —
  // organic blue corn never pads the shell corn number someone sells against.
  const tierOf = (variantName: string | undefined | null): MarketingTier =>
    xwalkByVariant.get(lower(variantName ?? ''))?.tier ?? 'tracking'

  // Group contracts by (commodity name, tier)
  const byCommodity = new Map<string, { commodityName: string; tier: MarketingTier; symbol: string | null; contracts: RollupContract[] }>()
  for (const c of contracts) {
    if (c.cropYear !== cropYear) continue
    const meta = c.variant ? variantMeta.get(c.variant.id) : undefined
    const commodityName = meta?.commodity?.name ?? 'Other'
    const symbol = meta?.commodity?.symbol ?? null
    const tier = tierOf(c.variant?.name)
    const key = tier + '|' + commodityName
    if (!byCommodity.has(key)) byCommodity.set(key, { commodityName, tier, symbol, contracts: [] })
    byCommodity.get(key)!.contracts.push(c)
  }

  // Which commodity does each crosswalk variant belong to? (from variant list)
  const commodityByVariantName = new Map<string, { name: string; symbol: string | null }>()
  for (const v of variants) {
    if (v.commodity) commodityByVariantName.set(lower(v.name), { name: v.commodity.name, symbol: v.commodity.symbol })
  }

  // Ensure (commodity, tier) groups with budget acres but zero contracts still get a row
  for (const e of ENTERPRISE_CROSSWALK) {
    const hasBudget = e.budgetCrops.some((bc) => budgetByCrop.has(lower(bc)))
    if (!hasBudget) continue
    const commodity = commodityByVariantName.get(lower(e.variantName))
    if (!commodity) continue
    const key = e.tier + '|' + commodity.name
    if (!byCommodity.has(key)) {
      byCommodity.set(key, { commodityName: commodity.name, tier: e.tier, symbol: commodity.symbol, contracts: [] })
    }
  }

  const rows: CommodityRollupRow[] = []

  for (const group of Array.from(byCommodity.values())) {
    const commodityName = group.commodityName
    const position = computePosition(group.contracts, positionOptions)

    // Pool WAP: futures-equivalent across all priced bushels of the commodity
    let poolNum = 0
    let poolDen = 0
    let grossCents = 0
    for (const c of group.contracts) {
      const fe = futuresEquivalentCents(c)
      if (fe == null) continue
      poolNum += fe * c.contractedBushels
      poolDen += c.contractedBushels
      // gross uses the full delivered price (premium back on top)
      const premiumCents = Math.round((c.contractPremium?.netPremium ?? 0) * 100)
      grossCents += (fe + (c.finalCashPrice != null ? premiumCents : 0)) * c.contractedBushels
    }
    const poolWapCents = poolDen > 0 ? Math.round(poolNum / poolDen) : null

    // Variant sub-rows: every variant of this commodity that has contracts OR
    // budget acres. Keyed by variant name.
    const variantNames = new Set<string>()
    for (const c of group.contracts) if (c.variant?.name) variantNames.add(c.variant.name)
    for (const e of ENTERPRISE_CROSSWALK) {
      if (e.tier !== group.tier) continue
      const commodity = commodityByVariantName.get(lower(e.variantName))
      if (commodity?.name === commodityName && e.budgetCrops.some((bc) => budgetByCrop.has(lower(bc)))) {
        variantNames.add(e.variantName)
      }
    }

    const variantRows: VariantRollupRow[] = []
    // F-IT remainder basis: each variant's unpriced projection carries its own
    // projected basis; these accumulate into a remainder-weighted average.
    let remainderBasisNum = 0
    let remainderBasisDen = 0
    for (const variantName of Array.from(variantNames)) {
      const xwalk = xwalkByVariant.get(lower(variantName)) ?? null
      const vContracts = group.contracts.filter((c) => c.variant?.name === variantName)
      const vPos = computePosition(vContracts, positionOptions)

      // Budget aggregation across this variant's budget crop lines
      const vBudget = (xwalk?.budgetCrops ?? [])
        .map((bc) => budgetByCrop.get(lower(bc)))
        .filter((b): b is BudgetCropRow => b != null)
      const acres = vBudget.length ? sum(vBudget.map((b) => b.acres)) : null
      const projectedBu = vBudget.length ? sum(vBudget.map((b) => b.projectedTotal)) : null
      const projYield = acres && projectedBu != null && acres > 0 ? projectedBu / acres : null
      const copPerBu = vBudget.length && projectedBu
        ? sum(vBudget.map((b) => b.cop * b.projectedTotal)) / projectedBu
        : null

      // Actuals + settled revenue via tickets crop names
      const ticketKeys = (xwalk?.ticketCrops ?? []).map(lower)
      const actualBu = ticketKeys.length
        ? sum(ticketKeys.map((k) => actualBuByTicketCrop[k] ?? 0)) || null
        : null
      const settledRevenue = ticketKeys.length
        ? sum(ticketKeys.map((k) => settledRevenueByTicketCrop[k] ?? 0)) || null
        : null

      // Premium: average of this variant's contract premiums (bushel-weighted),
      // falling back to the crosswalk default for variants with no priced sales.
      let premNum = 0
      let premDen = 0
      for (const c of vContracts) {
        if (c.contractPremium?.netPremium != null && c.contractedBushels > 0) {
          premNum += c.contractPremium.netPremium * c.contractedBushels
          premDen += c.contractedBushels
        }
      }
      const premiumPerBu = premDen > 0 ? premNum / premDen : (xwalk?.premiumDefault ?? 0)

      const vRemainingBu = Math.max((projectedBu ?? 0) - vPos.pricedBu, 0)
      if (vRemainingBu > 0) {
        remainderBasisNum += vRemainingBu * (projectedBasisByVariantName.get(lower(variantName)) ?? 0)
        remainderBasisDen += vRemainingBu
      }

      variantRows.push({
        variantName,
        budgetCropNames: xwalk?.budgetCrops ?? [],
        acres,
        projYieldPerAcre: projYield,
        projectedBu,
        actualBu,
        soldBu: vPos.contractedBu,
        pctSold: projectedBu && projectedBu > 0 ? vPos.contractedBu / projectedBu : null,
        wapCents: vPos.avgPriceCents,
        premiumPerBu,
        pooledPriceCents: poolWapCents != null ? poolWapCents + Math.round(premiumPerBu * 100) : null,
        copPerBu,
        settledRevenue,
      })
    }
    variantRows.sort((a, b) => (b.soldBu - a.soldBu) || (b.acres ?? 0) - (a.acres ?? 0))

    // Commodity totals from the sub-rows (budget side) + position (sales side)
    const budgetedVariants = variantRows.filter((v) => v.acres != null)
    const acres = budgetedVariants.length ? sum(budgetedVariants.map((v) => v.acres!)) : null
    const projectedBu = budgetedVariants.length ? sum(budgetedVariants.map((v) => v.projectedBu ?? 0)) : null
    const projYieldPerAcre = acres && projectedBu != null && acres > 0 ? projectedBu / acres : null
    const totalCost = budgetedVariants.length
      ? sum(budgetedVariants.map((v) => (v.copPerBu ?? 0) * (v.projectedBu ?? 0)))
      : null
    const copPerBu = projectedBu && totalCost != null && projectedBu > 0 ? totalCost / projectedBu : null
    const copPerAcre = acres && totalCost != null && acres > 0 ? totalCost / acres : null

    const actualVariants = variantRows.filter((v) => v.actualBu != null)
    const actualBu = actualVariants.length ? sum(actualVariants.map((v) => v.actualBu!)) : null
    const settledVariants = variantRows.filter((v) => v.settledRevenue != null)
    const settledRevenue = settledVariants.length ? sum(settledVariants.map((v) => v.settledRevenue!)) : null

    // Tracking rows carry no CBOT reference — quoting futures against organic
    // or specialty bushels implies a marketability they don't have.
    const rowSymbol = group.tier === 'futures' ? group.symbol : null
    const cbotPriceDollars = rowSymbol ? (cbotBySymbol[rowSymbol] ?? null) : null

    // F-IT — blended price if the unpriced remainder of the projection sold
    // today: remainder valued at live futures + the remainder-weighted
    // projected basis (every load pays SOMETHING in basis).
    let blendedIfSoldTodayCents: number | null = null
    if (projectedBu && projectedBu > 0 && cbotPriceDollars != null) {
      const pricedRevenueCents = position.avgPriceCents * position.pricedBu
      const remainingBu = Math.max(projectedBu - position.pricedBu, 0)
      const denominator = Math.max(projectedBu, position.pricedBu)
      const remainderBasisCents = remainderBasisDen > 0
        ? Math.round((remainderBasisNum / remainderBasisDen) * 100)
        : 0
      blendedIfSoldTodayCents = Math.round(
        (pricedRevenueCents + remainingBu * (Math.round(cbotPriceDollars * 100) + remainderBasisCents)) / denominator
      )
    }

    rows.push({
      commodityName: group.tier === 'tracking' ? commodityName + ' — Specialty/Organic' : commodityName,
      tier: group.tier,
      cropYear,
      cbotSymbol: rowSymbol,
      cbotContract: rowSymbol ? (cbotContractBySymbol?.[rowSymbol] ?? null) : null,
      cbotPriceDollars,
      acres,
      projYieldPerAcre,
      projectedBu,
      actualBu,
      soldBu: position.contractedBu,
      pricedBu: position.pricedBu,
      pctSold: projectedBu && projectedBu > 0 ? position.contractedBu / projectedBu : null,
      overhedged: projectedBu != null && position.contractedBu > projectedBu,
      poolWapCents,
      wapCents: position.avgPriceCents,
      copPerBu,
      copPerAcre,
      totalCost,
      grossSalesDollars: grossCents / 100,
      settledRevenue,
      blendedIfSoldTodayCents,
      variants: variantRows,
    })
  }

  // Futures crops (job 1) always ahead of tracking; within a tier, largest
  // sold position first, then largest planned acres
  rows.sort((a, b) =>
    (a.tier === 'futures' ? 0 : 1) - (b.tier === 'futures' ? 0 : 1) ||
    (b.soldBu - a.soldBu) || (b.acres ?? 0) - (a.acres ?? 0)
  )
  return rows
}
