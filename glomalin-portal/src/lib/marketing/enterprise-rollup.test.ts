// Run: npx vitest run src/lib/marketing/enterprise-rollup.test.ts
// Pooled-marketing model: futures sales pool per commodity, premiums per variant.
import { describe, it, expect } from 'vitest'
import {
  buildEnterpriseRollup,
  futuresEquivalentCents,
  stripRollupFinancials,
} from './enterprise-rollup'
import type { RollupInput, RollupContract, RollupVariantMeta } from './enterprise-rollup'

const VARIANTS: RollupVariantMeta[] = [
  { id: 'v-rr', name: 'Soybeans', cropYear: 2026, commodity: { name: 'Soybeans', symbol: 'S' } },
  { id: 'v-food', name: 'Non-GMO Food Beans', cropYear: 2026, commodity: { name: 'Soybeans', symbol: 'S' } },
  { id: 'v-ho', name: 'High Oil Soybeans', cropYear: 2026, commodity: { name: 'Soybeans', symbol: 'S' } },
  { id: 'v-corn', name: 'Shell Corn', cropYear: 2026, commodity: { name: 'Corn', symbol: 'C' } },
]

function baseInput(overrides: Partial<RollupInput> = {}): RollupInput {
  return {
    cropYear: 2026,
    contracts: [],
    variants: VARIANTS,
    budgetRows: null,
    actualBuByTicketCrop: {},
    settledRevenueByTicketCrop: {},
    cbotBySymbol: {},
    ...overrides,
  }
}

describe('futuresEquivalentCents', () => {
  it('strips the premium from a cash-priced contract', () => {
    const c: RollupContract = {
      cropYear: 2026, instrument: 'PRICED', contractedBushels: 5000,
      finalCashPrice: 14.06, contractPremium: { netPremium: 2.15 },
    }
    expect(futuresEquivalentCents(c)).toBe(1191)
  })

  it('uses futures + basis for HTA legs (no premium involved)', () => {
    const c: RollupContract = {
      cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 10000,
      futuresPrice: 12.53, basis: -0.75,
    }
    expect(futuresEquivalentCents(c)).toBe(1178)
  })

  it('returns null for unpriced and PER_UNIT contracts', () => {
    expect(futuresEquivalentCents({ cropYear: 2026, instrument: 'ACCUMULATOR', contractedBushels: 5000 })).toBeNull()
    expect(futuresEquivalentCents({
      cropYear: 2026, instrument: 'PRICED', contractedBushels: 0,
      paymentBasis: 'PER_UNIT', finalCashPrice: 15.7,
    })).toBeNull()
  })
})

describe('buildEnterpriseRollup — pool math', () => {
  const beanContracts: RollupContract[] = [
    // high oil: cash 14.06 = 11.91 futures-equiv + 2.15 premium
    { id: 'a', cropYear: 2026, instrument: 'PRICED', contractedBushels: 5000, finalCashPrice: 14.06, variant: { id: 'v-ho', name: 'High Oil Soybeans' }, contractPremium: { netPremium: 2.15 } },
    // RR HTA: futures-equiv 11.78
    { id: 'b', cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 10000, futuresPrice: 12.53, basis: -0.75, variant: { id: 'v-rr', name: 'Soybeans' } },
    // unpriced accumulator: contracted but not in the pool
    { id: 'c', cropYear: 2026, instrument: 'ACCUMULATOR', contractedBushels: 5000, variant: { id: 'v-food', name: 'Non-GMO Food Beans' } },
  ]

  it('pools futures-equivalent prices across variants of a commodity', () => {
    const [row] = buildEnterpriseRollup(baseInput({ contracts: beanContracts }))
    expect(row.commodityName).toBe('Soybeans')
    // pool = (1191×5000 + 1178×10000) / 15000 = 1182.33 → 1182
    expect(row.poolWapCents).toBe(1182)
    expect(row.soldBu).toBe(20000)
    expect(row.pricedBu).toBe(15000)
  })

  it('gross sales use the full delivered price (premium back on top)', () => {
    const [row] = buildEnterpriseRollup(baseInput({ contracts: beanContracts }))
    // 14.06×5000 + 11.78×10000 = 70,300 + 117,800 = 188,100
    expect(row.grossSalesDollars).toBeCloseTo(188100, 0)
  })

  it('variant pooled price = pool WAP + that variant premium', () => {
    const [row] = buildEnterpriseRollup(baseInput({ contracts: beanContracts }))
    const ho = row.variants.find((v) => v.variantName === 'High Oil Soybeans')!
    const rr = row.variants.find((v) => v.variantName === 'Soybeans')!
    expect(ho.pooledPriceCents).toBe(1182 + 215)
    // RR has no ContractPremium rows → crosswalk default −0.75
    expect(rr.premiumPerBu).toBe(-0.75)
    expect(rr.pooledPriceCents).toBe(1182 - 75)
  })
})

describe('buildEnterpriseRollup — budget join', () => {
  const budgetRows = [
    { crop: 'RR Soybeans', acres: 533.2, avgYield: 62.5, projectedTotal: 33325, cop: 8.71 },
    { crop: 'High Oil Soybeans', acres: 493.3, avgYield: 60, projectedTotal: 29598, cop: 9.1 },
    { crop: 'Soybeans', acres: 254.1, avgYield: 58, projectedTotal: 14738, cop: 9.4 },
  ]

  it('rolls acres/projection/COP up from crosswalked budget crop lines', () => {
    const [row] = buildEnterpriseRollup(baseInput({
      contracts: [
        { id: 'b', cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 10000, futuresPrice: 12.53, basis: -0.75, variant: { id: 'v-rr', name: 'Soybeans' } },
      ],
      budgetRows,
    }))
    expect(row.acres).toBeCloseTo(1280.6, 1)
    expect(row.projectedBu).toBeCloseTo(77661, 0)
    expect(row.pctSold).toBeCloseTo(10000 / 77661, 5)
    // COP is projection-weighted across crop lines
    expect(row.copPerBu).toBeGreaterThan(8.7)
    expect(row.copPerBu).toBeLessThan(9.4)
    // the marketing variant "Soybeans" (RR) maps to budget crop "RR Soybeans"
    const rr = row.variants.find((v) => v.variantName === 'Soybeans')!
    expect(rr.acres).toBeCloseTo(533.2, 1)
    expect(rr.budgetCropNames).toEqual(['RR Soybeans'])
  })

  it('budget crops with no contracts still produce commodity + variant rows', () => {
    const rows = buildEnterpriseRollup(baseInput({
      budgetRows: [{ crop: 'Yellow Corn', acres: 1061.1, avgYield: 220, projectedTotal: 233442, cop: 3.9 }],
    }))
    const corn = rows.find((r) => r.commodityName === 'Corn')!
    expect(corn.soldBu).toBe(0)
    expect(corn.acres).toBeCloseTo(1061.1, 1)
    const shell = corn.variants.find((v) => v.variantName === 'Shell Corn')!
    expect(shell.projectedBu).toBeCloseTo(233442, 0)
  })

  it('no budget for the crop year → volumes present, plan fields null', () => {
    const [row] = buildEnterpriseRollup(baseInput({
      cropYear: 2027,
      contracts: [
        { id: 'x', cropYear: 2027, instrument: 'FUTURES_FIXED', contractedBushels: 20000, futuresPrice: 4.97, basis: -0.3, variant: { id: 'v-corn', name: 'Shell Corn' } },
      ],
      budgetRows: null,
    }))
    expect(row.soldBu).toBe(20000)
    expect(row.acres).toBeNull()
    expect(row.pctSold).toBeNull()
    expect(row.blendedIfSoldTodayCents).toBeNull()
  })
})

describe('buildEnterpriseRollup — blended price at today CBOT', () => {
  const budgetRows = [{ crop: 'RR Soybeans', acres: 1000, avgYield: 60, projectedTotal: 60000, cop: 9 }]

  it('values the unpriced remainder of the projection at today futures', () => {
    const [row] = buildEnterpriseRollup(baseInput({
      contracts: [
        { id: 'b', cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 10000, futuresPrice: 12.0, variant: { id: 'v-rr', name: 'Soybeans' } },
      ],
      budgetRows,
      cbotBySymbol: { S: 11.0 },
    }))
    // (1200×10000 + 1100×50000) / 60000 = 1116.67 → 1117
    expect(row.blendedIfSoldTodayCents).toBe(1117)
  })

  it('clamps the remainder at zero when overhedged', () => {
    const [row] = buildEnterpriseRollup(baseInput({
      contracts: [
        { id: 'b', cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 70000, futuresPrice: 12.0, variant: { id: 'v-rr', name: 'Soybeans' } },
      ],
      budgetRows,
      cbotBySymbol: { S: 11.0 },
    }))
    expect(row.overhedged).toBe(true)
    // no remainder valued; denominator = pricedBu → blended = realized WAP
    expect(row.blendedIfSoldTodayCents).toBe(1200)
  })
})

describe('buildEnterpriseRollup — actuals join', () => {
  it('sums actual bu and settled revenue via tickets crop names', () => {
    const [row] = buildEnterpriseRollup(baseInput({
      contracts: [
        { id: 'b', cropYear: 2026, instrument: 'FUTURES_FIXED', contractedBushels: 10000, futuresPrice: 12.53, variant: { id: 'v-rr', name: 'Soybeans' } },
      ],
      actualBuByTicketCrop: { 'enlist soybeans': 4200, 'rr soybeans': 1800 },
      settledRevenueByTicketCrop: { 'enlist soybeans': 50000 },
    }))
    const rr = row.variants.find((v) => v.variantName === 'Soybeans')!
    expect(rr.actualBu).toBe(6000)
    expect(rr.settledRevenue).toBe(50000)
    expect(row.actualBu).toBe(6000)
    expect(row.settledRevenue).toBe(50000)
  })
})

describe('stripRollupFinancials — office payload', () => {
  it('omits every financial key at both levels', () => {
    const rows = buildEnterpriseRollup(baseInput({
      contracts: [
        { id: 'a', cropYear: 2026, instrument: 'PRICED', contractedBushels: 5000, finalCashPrice: 14.06, variant: { id: 'v-ho', name: 'High Oil Soybeans' }, contractPremium: { netPremium: 2.15 } },
      ],
      budgetRows: [{ crop: 'High Oil Soybeans', acres: 493.3, avgYield: 60, projectedTotal: 29598, cop: 9.1 }],
      cbotBySymbol: { S: 11.0 },
    }))
    const [stripped] = stripRollupFinancials(rows)
    // volumes survive
    expect(stripped.soldBu).toBe(5000)
    expect(stripped.acres).toBeCloseTo(493.3, 1)
    expect(stripped.pctSold).not.toBeNull()
    // financials are ABSENT, not null
    const asRecord = stripped as unknown as Record<string, unknown>
    for (const k of ['wapCents', 'poolWapCents', 'copPerBu', 'copPerAcre', 'grossSalesDollars', 'blendedIfSoldTodayCents', 'cbotPriceDollars', 'totalCost', 'settledRevenue']) {
      expect(k in asRecord, `${k} should be stripped`).toBe(false)
    }
    const v = stripped.variants[0] as unknown as Record<string, unknown>
    for (const k of ['wapCents', 'premiumPerBu', 'pooledPriceCents', 'copPerBu', 'settledRevenue']) {
      expect(k in v, `variant ${k} should be stripped`).toBe(false)
    }
  })
})
