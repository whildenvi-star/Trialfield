// ── Core instrument types ──────────────────────────────────────────────────────

export type InstrumentType = 'cash' | 'forward_contract' | 'option' | 'accumulator'

export interface Commodity {
  id: string
  name: string
  cbot_symbol: string | null
  is_hedgeable: boolean
  sort_order: number
}

export interface CropVariant {
  id: string
  commodity_id: string
  name: string
  is_contracted: boolean
  crop_year: number
  estimated_bu: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SaleInstrument {
  id: string
  commodity_id: string
  variant_id: string | null
  instrument_type: InstrumentType
  crop_year: number
  buyer: string | null
  counterparty: string | null
  // Cash + Forward Contract
  bushels: number | null
  price_per_bushel: number | null
  basis: number | null
  futures_reference: number | null
  delivery_start: string | null
  delivery_end: string | null
  delivered_bu: number
  contract_number: string | null
  // Option
  option_type: 'call' | 'put' | null
  option_side: 'long' | 'short' | null
  strike_price: number | null
  premium_paid: number | null
  expiry_date: string | null
  // Accumulator
  ko_level: number | null
  ki_level: number | null
  daily_bu: number | null
  weekly_bu: number | null
  accumulation_start: string | null
  accumulation_end: string | null
  leverage_ratio: number
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Computed aggregates ────────────────────────────────────────────────────────

export interface VariantPosition {
  variant: CropVariant
  instruments: SaleInstrument[]
  priced_bu: number
  unpriced_bu: number
  pct_priced: number
  wap: number | null
}

export interface CommodityPosition {
  commodity: Commodity
  variants: VariantPosition[]
  total_estimated_bu: number
  total_priced_bu: number
  pct_priced: number
  wap: number | null
  cbot_price: number | null
  unpriced_bu: number
  unpriced_exposure_dollars: number | null
  instrument_mix: Record<InstrumentType, number>
}

// ── Yield summary (from grain-tickets service) ────────────────────────────────

export interface YieldSummary {
  farmId: string
  farmName: string
  registryCropId: string | null
  cropName: string
  cropYear: number
  totalNetBU: number
  acres: number | null
}

// ── CBOT prices ────────────────────────────────────────────────────────────────

export interface CbotPrice {
  commodity: string
  symbol: string
  price: number
  change: number
  timestamp: string
  source: string
}

// ── Legacy types (kept for backward compat until old contract routes are removed)

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
