// Run: npx vitest run src/components/marketing/priced-breakdown-cards.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  buildCropSlices,
  FuturesPercentPricedCard,
  PricedBushelsCard,
  PricedBreakdownCards,
} from './priced-breakdown-cards'
import type { CommodityRollupRow } from '../../lib/marketing/enterprise-rollup'

afterEach(cleanup)

function row(over: Partial<CommodityRollupRow>): CommodityRollupRow {
  return {
    commodityName: 'Corn',
    tier: 'futures',
    cropYear: 2026,
    cbotSymbol: 'C',
    cbotContract: 'ZCZ26.CBT',
    cbotPriceDollars: 4.5,
    acres: 1000,
    projYieldPerAcre: 200,
    projectedBu: 200_000,
    actualBu: null,
    soldBu: 100_000,
    pricedBu: 80_000,
    pctSold: 0.5,
    overhedged: false,
    poolWapCents: 470,
    wapCents: 470,
    copPerBu: 3.9,
    copPerAcre: 780,
    totalCost: 780_000,
    grossSalesDollars: 376_000,
    settledRevenue: null,
    blendedIfSoldTodayCents: null,
    variants: [],
    ...over,
  }
}

const ROWS: CommodityRollupRow[] = [
  row({ commodityName: 'Corn', cbotSymbol: 'C', projectedBu: 200_000, pricedBu: 80_000, soldBu: 100_000 }),
  row({ commodityName: 'Soybeans', cbotSymbol: 'S', projectedBu: 60_000, pricedBu: 45_000, soldBu: 50_000 }),
  row({ commodityName: 'Wheat', cbotSymbol: 'W', projectedBu: 30_000, pricedBu: 33_000, soldBu: 33_000 }),
  row({
    commodityName: 'Corn — Specialty/Organic',
    tier: 'tracking',
    projectedBu: 500_000,
    pricedBu: 400_000,
  }),
]

describe('buildCropSlices', () => {
  it('keeps futures-tier rows only — organics never enter a futures total', () => {
    const slices = buildCropSlices(ROWS)
    expect(slices.map((s) => s.commodityName)).toEqual(['Corn', 'Soybeans', 'Wheat'])
  })

  it('orders by pool size, largest first', () => {
    const slices = buildCropSlices(ROWS)
    expect(slices[0].projectedBu).toBe(200_000)
    expect(slices[2].projectedBu).toBe(30_000)
  })

  it('computes pct priced per crop, not farm-wide', () => {
    const [corn, beans] = buildCropSlices(ROWS)
    expect(corn.pctPriced).toBeCloseTo(0.4)
    expect(beans.pctPriced).toBeCloseTo(0.75)
  })

  it('flags a crop priced beyond its projection', () => {
    const wheat = buildCropSlices(ROWS)[2]
    expect(wheat.overhedged).toBe(true)
  })

  it('gives a null pct — not a divide-by-zero — when there is no projection', () => {
    const slices = buildCropSlices([row({ projectedBu: null, pricedBu: 10_000 })])
    expect(slices[0].pctPriced).toBeNull()
    expect(slices[0].overhedged).toBe(false)
  })

  it('drops crops with neither projected nor priced bushels', () => {
    expect(buildCropSlices([row({ projectedBu: 0, pricedBu: 0, soldBu: 0 })])).toHaveLength(0)
  })

  it('assigns a distinct color per commodity', () => {
    const colors = buildCropSlices(ROWS).map((s) => s.color)
    expect(new Set(colors).size).toBe(3)
  })
})

describe('FuturesPercentPricedCard', () => {
  it('shows the farm-wide headline plus a row per crop', () => {
    render(
      <FuturesPercentPricedCard
        slices={buildCropSlices(ROWS)}
        totalProjectedBu={290_000}
        totalPricedBu={158_000}
      />
    )
    expect(screen.getByText('FUTURES % PRICED')).toBeTruthy()
    expect(screen.getByText('Corn')).toBeTruthy()
    expect(screen.getByText('Soybeans')).toBeTruthy()
    expect(screen.getByText('Wheat')).toBeTruthy()
    // per-crop percentages, not just the blended one
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('falls back to an empty state with no futures crops', () => {
    render(
      <FuturesPercentPricedCard slices={[]} totalProjectedBu={0} totalPricedBu={0} />
    )
    expect(screen.getByText(/No futures crop plan/)).toBeTruthy()
  })
})

describe('PricedBushelsCard', () => {
  it('breaks the total into per-crop bushels', () => {
    render(
      <PricedBushelsCard
        slices={buildCropSlices(ROWS)}
        totalPricedBu={158_000}
        totalSoldBu={183_000}
      />
    )
    expect(screen.getByText('PRICED BUSHELS')).toBeTruthy()
    expect(screen.getByText('158,000')).toBeTruthy()
    expect(screen.getByText('80,000')).toBeTruthy()
    expect(screen.getByText('45,000')).toBeTruthy()
    expect(screen.getByText('33,000')).toBeTruthy()
  })
})

describe('PricedBreakdownCards', () => {
  it('renders both cards off one set of slices', () => {
    render(
      <PricedBreakdownCards
        rows={ROWS}
        totalProjectedBu={290_000}
        totalPricedBu={158_000}
        totalSoldBu={183_000}
      />
    )
    expect(screen.getByText('FUTURES % PRICED')).toBeTruthy()
    expect(screen.getByText('PRICED BUSHELS')).toBeTruthy()
    expect(screen.getAllByText('Corn')).toHaveLength(2)
  })
})
