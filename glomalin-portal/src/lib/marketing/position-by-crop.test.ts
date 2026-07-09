import { describe, it, expect } from 'vitest'
import {
  groupContractsByCommodity,
  buildCropMarketingDataList,
  applyScenario,
} from './position-by-crop'
import type { ContractWithVariant, RawGrainVariant, BudgetFieldRow } from './position-by-crop'

// ── Fixtures ───────────────────────────────────────────────────────────────

const VARIANTS: RawGrainVariant[] = [
  { id: 'v-corn', name: 'Shell Corn', commodity: { name: 'Corn', symbol: 'C' } },
  { id: 'v-soy', name: 'Soybeans', commodity: { name: 'Soybeans', symbol: 'S' } },
  { id: 'v-food', name: 'Non-GMO Food Beans', commodity: { name: 'Soybeans', symbol: 'S' } },
]

function pricedContract(
  variantId: string,
  bushels: number,
  priceCents: number,
  extra: Partial<ContractWithVariant> = {}
): ContractWithVariant {
  const variant = VARIANTS.find((v) => v.id === variantId)!
  return {
    id: `c-${variantId}-${bushels}-${priceCents}`,
    instrument: 'PRICED',
    contractedBushels: bushels,
    finalCashPrice: priceCents,
    variant: { id: variant.id, name: variant.name },
    ...extra,
  }
}

// 100 ac × 200 bu/ac @ $800/ac → 20,000 bu projected, $80,000 total cost, $4.00/bu break-even
const CORN_BUDGET: BudgetFieldRow[] = [
  { crop: 'Corn', acres: 100, expPerAcre: 800, yieldPerAcre: 200 },
]

const NO_PRICES: Record<string, number | null> = { C: null, S: null, W: null }

function buildCorn(
  contracts: ContractWithVariant[],
  budget: BudgetFieldRow[] = CORN_BUDGET
) {
  const groups = groupContractsByCommodity(contracts, VARIANTS)
  const crops = buildCropMarketingDataList(groups, budget, NO_PRICES)
  return crops.find((c) => c.commodityName === 'Corn')!
}

// ── Blended weighted average ───────────────────────────────────────────────

describe('blended average price (weighted, never simple)', () => {
  it('weights by bushels — 10k @ $5.00 + 30k @ $4.00 = $4.25, not $4.50', () => {
    const crop = buildCorn([
      pricedContract('v-corn', 10_000, 500),
      pricedContract('v-corn', 30_000, 400),
    ])
    expect(crop.position.avgPriceCents).toBe(425)
  })

  it('scenario blends real + hypothetical bushels by weight', () => {
    // Real: 20,000 bu @ $4.00. Hypo: 20,000 bu @ $5.00 → blended $4.50
    const crop = buildCorn([pricedContract('v-corn', 20_000, 400)])
    const result = applyScenario(crop, [{ bushels: 20_000, priceDollars: 5.0 }])
    expect(result.newWAPDollars).toBeCloseTo(4.5, 4)
  })

  it('stacked hypothetical sales all count toward the blend', () => {
    // Real: 10,000 @ $4.00. Hypos: 10,000 @ $5.00 and 20,000 @ $4.50
    // → (40,000 + 50,000 + 90,000) / 40,000 = $4.50
    const crop = buildCorn([pricedContract('v-corn', 10_000, 400)])
    const result = applyScenario(crop, [
      { bushels: 10_000, priceDollars: 5.0 },
      { bushels: 20_000, priceDollars: 4.5 },
    ])
    expect(result.hypoBu).toBe(30_000)
    expect(result.newWAPDollars).toBeCloseTo(4.5, 4)
  })

  it('ignores hypothetical sales with zero bushels or zero price', () => {
    const crop = buildCorn([pricedContract('v-corn', 10_000, 400)])
    const result = applyScenario(crop, [
      { bushels: 0, priceDollars: 5.0 },
      { bushels: 5_000, priceDollars: 0 },
    ])
    expect(result.hypoBu).toBe(0)
    expect(result.newWAPDollars).toBeCloseTo(4.0, 4)
  })
})

// ── Break-even ─────────────────────────────────────────────────────────────

describe('break-even (COP per bushel)', () => {
  it('single field: expPerAcre / yieldPerAcre', () => {
    const crop = buildCorn([pricedContract('v-corn', 1_000, 400)])
    expect(crop.budget!.copPerBu).toBeCloseTo(4.0, 4)
    expect(crop.budget!.totalEstimatedBu).toBeCloseTo(20_000, 2)
    expect(crop.budget!.totalCost).toBeCloseTo(80_000, 2)
  })

  it('multiple fields: acre-weighted, equals totalCost / projected bushels', () => {
    const budget: BudgetFieldRow[] = [
      { crop: 'Corn', acres: 100, expPerAcre: 800, yieldPerAcre: 200 },
      { crop: 'corn ', acres: 100, expPerAcre: 700, yieldPerAcre: 100 }, // case/space-insensitive match
    ]
    const crop = buildCorn([pricedContract('v-corn', 1_000, 400)], budget)
    // weighted exp = 750, weighted yield = 150 → cop = 5.00
    expect(crop.budget!.copPerBu).toBeCloseTo(5.0, 4)
    // invariant: copPerBu ≡ totalCost / totalEstimatedBu
    expect(crop.budget!.copPerBu).toBeCloseTo(
      crop.budget!.totalCost / crop.budget!.totalEstimatedBu,
      6
    )
  })

  it('margin locked = (WAP − break-even) × priced bushels', () => {
    // 10,000 bu @ $4.50 vs $4.00 break-even → +$0.50/bu, +$5,000 total
    const crop = buildCorn([pricedContract('v-corn', 10_000, 450)])
    expect(crop.marginLockedPerBu).toBeCloseTo(0.5, 4)
    expect(crop.marginLockedTotal).toBeCloseTo(5_000, 2)
  })
})

// ── % sold vs projected production ─────────────────────────────────────────

describe('percent sold', () => {
  it('is sold bushels over projected production', () => {
    // 5,000 sold of 20,000 projected → 25%
    const crop = buildCorn([pricedContract('v-corn', 5_000, 400)])
    expect(crop.pctSold).toBeCloseTo(0.25, 4)
    expect(crop.overhedged).toBe(false)
  })

  it('exceeds 100% uncapped and flags overhedged', () => {
    const crop = buildCorn([pricedContract('v-corn', 25_000, 400)])
    expect(crop.pctSold).toBeCloseTo(1.25, 4)
    expect(crop.overhedged).toBe(true)
  })

  it('scenario can push into overhedged', () => {
    const crop = buildCorn([pricedContract('v-corn', 15_000, 400)])
    expect(crop.overhedged).toBe(false)
    const result = applyScenario(crop, [{ bushels: 10_000, priceDollars: 4.5 }])
    expect(result.newPctSold).toBeCloseTo(1.25, 4)
    expect(result.overhedged).toBe(true)
  })

  it('is null when no budget data exists', () => {
    const crop = buildCorn([pricedContract('v-corn', 5_000, 400)], [])
    expect(crop.pctSold).toBeNull()
    expect(crop.budget).toBeNull()
  })
})

// ── Missing COP: never fabricate ───────────────────────────────────────────

describe('missing cost data', () => {
  it('margin and profit are null, never zero or fabricated', () => {
    const crop = buildCorn([pricedContract('v-corn', 10_000, 450)], [])
    expect(crop.marginLockedPerBu).toBeNull()
    expect(crop.marginLockedTotal).toBeNull()
    const result = applyScenario(crop, [{ bushels: 5_000, priceDollars: 5.0 }])
    expect(result.marginPerBu).toBeNull()
    expect(result.profitVsTotalCOP).toBeNull()
    expect(result.totalCOP).toBeNull()
    // But revenue math still works
    expect(result.lockedRevenue).toBeCloseTo(45_000 + 25_000, 2)
  })

  it('zero-yield fields are excluded from budget aggregation', () => {
    const budget: BudgetFieldRow[] = [
      { crop: 'Corn', acres: 100, expPerAcre: 800, yieldPerAcre: 0 },
    ]
    const crop = buildCorn([pricedContract('v-corn', 1_000, 400)], budget)
    expect(crop.budget).toBeNull()
  })
})

// ── Zero-sales crops ───────────────────────────────────────────────────────

describe('crop with zero sales', () => {
  it('still gets a card when budget projects production', () => {
    const groups = groupContractsByCommodity([], VARIANTS)
    const crops = buildCropMarketingDataList(groups, CORN_BUDGET, NO_PRICES)
    const corn = crops.find((c) => c.commodityName.toLowerCase() === 'corn')
    expect(corn).toBeDefined()
    expect(corn!.position.contractedBu).toBe(0)
    expect(corn!.pctSold).toBe(0)
    expect(corn!.sales).toHaveLength(0)
    expect(corn!.cbotSymbol).toBe('C')
  })

  it('scenario on a zero-sale crop prices from scratch', () => {
    const groups = groupContractsByCommodity([], VARIANTS)
    const crops = buildCropMarketingDataList(groups, CORN_BUDGET, NO_PRICES)
    const corn = crops.find((c) => c.commodityName.toLowerCase() === 'corn')!
    const result = applyScenario(corn, [{ bushels: 10_000, priceDollars: 4.2 }])
    expect(result.newWAPDollars).toBeCloseTo(4.2, 4)
    expect(result.newPctSold).toBeCloseTo(0.5, 4)
    expect(result.lockedRevenue).toBeCloseTo(42_000, 2)
    // profit vs total COP: 42,000 − 80,000 = −38,000
    expect(result.profitVsTotalCOP).toBeCloseTo(-38_000, 2)
  })
})

// ── Sales list ─────────────────────────────────────────────────────────────

describe('sales list', () => {
  it('orders by date with running cumulative % of projected', () => {
    const crop = buildCorn([
      pricedContract('v-corn', 4_000, 420, { deliveryStartDate: '2026-10-01' }),
      pricedContract('v-corn', 6_000, 450, { deliveryStartDate: '2026-03-15' }),
    ])
    expect(crop.sales.map((s) => s.date)).toEqual(['2026-03-15', '2026-10-01'])
    expect(crop.sales[0].cumulativeBu).toBe(6_000)
    expect(crop.sales[0].cumulativePctSold).toBeCloseTo(0.3, 4)
    expect(crop.sales[1].cumulativeBu).toBe(10_000)
    expect(crop.sales[1].cumulativePctSold).toBeCloseTo(0.5, 4)
  })

  it('unpriced instruments show a null price but still count as sold', () => {
    const crop = buildCorn([
      {
        id: 'c-later',
        instrument: 'PRICED_LATER',
        contractedBushels: 8_000,
        variant: { id: 'v-corn', name: 'Shell Corn' },
      },
    ])
    expect(crop.sales[0].priceDollars).toBeNull()
    expect(crop.position.contractedBu).toBe(8_000)
    expect(crop.position.pricedBu).toBe(0)
    expect(crop.pctSold).toBeCloseTo(0.4, 4) // sold ≠ priced
  })
})

// ── Variant separation within a commodity ──────────────────────────────────

describe('variant breakdown', () => {
  it('keeps food beans separate from commodity beans under one Soybeans card', () => {
    const groups = groupContractsByCommodity(
      [pricedContract('v-soy', 20_000, 1000), pricedContract('v-food', 5_000, 1300)],
      VARIANTS
    )
    const crops = buildCropMarketingDataList(groups, [], NO_PRICES)
    const soy = crops.find((c) => c.commodityName === 'Soybeans')!
    expect(soy.variantBreakdown).toHaveLength(2)
    const food = soy.variantBreakdown.find((v) => v.variantName === 'Non-GMO Food Beans')!
    expect(food.avgPriceCents).toBe(1300)
    // commodity-level WAP is still bushel-weighted across variants:
    // (20,000×1000 + 5,000×1300) / 25,000 = 1060
    expect(soy.position.avgPriceCents).toBe(1060)
  })
})
