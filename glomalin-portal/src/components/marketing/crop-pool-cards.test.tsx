// Run: npx vitest run src/components/marketing/crop-pool-cards.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CropPoolCards } from './crop-pool-cards'

afterEach(cleanup)

// Corn: 100k projected, 40k priced at $5.00, board $4.00, no basis on file.
// F-IT = (500¢×40k + 60k×400¢) / 100k = 440¢ = $4.40/bu — below the $5.00 WAP,
// which is the whole point of showing it.
const CORN = {
  commodityName: 'Corn',
  tier: 'futures' as const,
  cropYear: 2026,
  cbotSymbol: 'C',
  cbotContract: 'ZCZ26',
  cbotPriceDollars: 4.0,
  acres: 500,
  projYieldPerAcre: 200,
  projectedBu: 100000,
  actualBu: null,
  soldBu: 40000,
  pricedBu: 40000,
  pctSold: 0.4,
  overhedged: false,
  poolWapCents: 500,
  wapCents: 500,
  copPerBu: 4.2,
  copPerAcre: 840,
  totalCost: 420000,
  grossSalesDollars: 200000,
  settledRevenue: null,
  blendedIfSoldTodayCents: 440,
  variants: [
    {
      variantName: 'Shell Corn',
      budgetCropNames: ['Corn'],
      acres: 500,
      projYieldPerAcre: 200,
      projectedBu: 100000,
      actualBu: null,
      soldBu: 40000,
      pctSold: 0.4,
      wapCents: 500,
      premiumPerBu: 0,
      pooledPriceCents: 500,
      copPerBu: 4.2,
      settledRevenue: null,
      pricedBu: 40000,
      blendedIfSoldTodayCents: 440,
    },
  ],
}

describe('CropPoolCards F-IT', () => {
  it('shows F-IT and its gap to WAP for the owner', () => {
    render(<CropPoolCards rows={[CORN]} isOwner contracts={[]} />)
    expect(screen.getByText('F-IT')).toBeDefined()
    expect(screen.getByText('$4.40/bu')).toBeDefined()
    // selling the rest today drags the season average down $0.60
    expect(screen.getByText(/-\$0\.60\/bu vs WAP/)).toBeDefined()
  })

  it('hides F-IT from the office role', () => {
    const { blendedIfSoldTodayCents, wapCents, poolWapCents, cbotPriceDollars, ...office } = CORN
    void blendedIfSoldTodayCents; void wapCents; void poolWapCents; void cbotPriceDollars
    render(<CropPoolCards rows={[office as never]} isOwner={false} contracts={[]} />)
    expect(screen.queryByText('F-IT')).toBeNull()
  })

  it('omits F-IT when there is no live quote to blend against', () => {
    render(
      <CropPoolCards
        rows={[{ ...CORN, blendedIfSoldTodayCents: null }]}
        isOwner
        contracts={[]}
      />
    )
    expect(screen.queryByText('F-IT')).toBeNull()
    // WAP still renders — only the blend is missing
    expect(screen.getAllByText('$5.00/bu').length).toBeGreaterThan(0)
  })
})
