/**
 * Marketing position TypeScript types.
 *
 * Used by:
 *  - /api/marketing/contracts (CRUD endpoints)
 *  - /api/marketing/cbot-prices (futures price fetch)
 *  - Future marketing position UI components (Phase 57 Plan 02)
 */

export type ContractType = 'cash' | 'accumulator' | 'hta' | 'options' | 'min-price' | 'basis'

export interface GrainContract {
  id: string
  crop: string
  registry_crop_id: string | null
  contract_type: ContractType
  bushels: number
  price_per_bushel: number | null
  basis: number | null
  futures_reference: number | null
  buyer: string | null
  delivery_start: string | null
  delivery_end: string | null
  crop_year: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CbotPrice {
  commodity: string
  symbol: string
  price: number
  change: number
  timestamp: string
  source: string
}

export interface MarketingPosition {
  crop: string
  registry_crop_id: string | null
  estimated_production_bu: number
  contracted_bu: number
  unpriced_bu: number
  cbot_price: number | null
  unpriced_exposure_dollars: number | null
  contracts: GrainContract[]
}
