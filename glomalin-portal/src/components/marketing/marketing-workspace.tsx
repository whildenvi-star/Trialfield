'use client'

import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  CommodityPricing,
  YieldSummary,
} from '@/lib/marketing/types'
import type { BudgetField } from '@/lib/marketing/types'
import { Empty } from '@/components/ui/empty'
// NOTE (Phase 15): HedgingDashboard, CommodityTable, InstrumentForm, VariantSetupPanel,
// CropTypesPanel, WhatIfPanel removed. Marketing page replaced by command center (Plan 04).
// MarketingWorkspace is retained so the Macro Rollup "Sales & Marketing" tab keeps building
// until that tab is updated in a future phase.

interface MarketingWorkspaceProps {
  commodities: Commodity[]
  initialVariants: CropVariant[]
  initialInstruments: SaleInstrument[]
  initialCommodityPositions: CommodityPosition[]
  initialPricingConfigs: CommodityPricing[]
  cbotPrices: CbotPrice[]
  priceSource: string
  priceTimestamp: string | null
  yieldAvailable: boolean
  yieldSummaries: YieldSummary[]
  budgetFields: BudgetField[]
  cropYear: number
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MarketingWorkspace(_props: MarketingWorkspaceProps) {
  return (
    <div className="py-8">
      <Empty
        title="Marketing moved"
        description="Use the Marketing command center at /app/marketing for grain contract management."
      />
    </div>
  )
}
