import type {
  Commodity,
  CropVariant,
  SaleInstrument,
  CbotPrice,
  CommodityPosition,
  CommodityPricing,
  VariantPosition,
  InstrumentType,
} from './types'

/**
 * Priced bushels for a single instrument.
 * - cash / forward_contract: face bushels
 * - option (long put): counts as price protection on face bushels
 * - accumulator: delivered_bu if already accumulating, otherwise estimates from window progress
 */
export function instrumentPricedBu(inst: SaleInstrument): number {
  if (inst.instrument_type === 'cash' || inst.instrument_type === 'forward_contract' || inst.instrument_type === 'hta') {
    return inst.bushels ?? 0
  }
  if (inst.instrument_type === 'option') {
    if (inst.option_side === 'long' && inst.option_type === 'put') {
      return inst.bushels ?? 0
    }
    return 0
  }
  if (inst.instrument_type === 'accumulator') {
    if (inst.delivered_bu > 0) return inst.delivered_bu
    if (!inst.accumulation_start || !inst.accumulation_end) return 0
    const start = new Date(inst.accumulation_start).getTime()
    const end = new Date(inst.accumulation_end).getTime()
    const now = Date.now()
    if (now < start) return 0
    const elapsedMs = Math.min(now, end) - start
    const totalMs = end - start
    const fraction = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0
    if (inst.daily_bu) {
      const totalDays = Math.round(totalMs / 86_400_000)
      return Math.round(inst.daily_bu * totalDays * fraction)
    }
    if (inst.weekly_bu) {
      const totalWeeks = Math.round(totalMs / (7 * 86_400_000))
      return Math.round(inst.weekly_bu * totalWeeks * fraction)
    }
    return 0
  }
  return 0
}

/**
 * Effective price per bushel for WAP calculation.
 * Options: strike net of premium. Accumulators: no fixed price, excluded from WAP.
 */
function instrumentEffectivePrice(inst: SaleInstrument): number | null {
  if (inst.instrument_type === 'cash' || inst.instrument_type === 'forward_contract') {
    return inst.price_per_bushel ?? null
  }
  if (inst.instrument_type === 'hta') {
    if (inst.futures_reference == null) return null
    // If basis is set, return full net price; if basis still open, use futures as floor
    return inst.futures_reference + (inst.basis ?? 0)
  }
  if (inst.instrument_type === 'option' && inst.option_side === 'long') {
    if (inst.strike_price == null) return null
    return inst.strike_price - (inst.premium_paid ?? 0)
  }
  return null
}

function buildVariantPosition(
  variant: CropVariant,
  instruments: SaleInstrument[]
): VariantPosition {
  const priced_bu = instruments.reduce((s, i) => s + instrumentPricedBu(i), 0)
  const estimated = variant.estimated_bu ?? 0
  const unpriced_bu = Math.max(0, estimated - priced_bu)
  const pct_priced = estimated > 0 ? Math.min(100, (priced_bu / estimated) * 100) : 0

  let weightedSum = 0
  let weightedBu = 0
  for (const inst of instruments) {
    const price = instrumentEffectivePrice(inst)
    const bu = instrumentPricedBu(inst)
    if (price != null && bu > 0) {
      weightedSum += price * bu
      weightedBu += bu
    }
  }
  const wap = weightedBu > 0 ? weightedSum / weightedBu : null

  return { variant, instruments, priced_bu, unpriced_bu, pct_priced, wap }
}

export function computeCommodityPositions(
  commodities: Commodity[],
  variants: CropVariant[],
  instruments: SaleInstrument[],
  cbotPrices: CbotPrice[],
  pricingConfigs: CommodityPricing[] = []
): CommodityPosition[] {
  const priceBySymbol = new Map<string, number>()
  for (const p of cbotPrices) {
    if (p.symbol) priceBySymbol.set(p.symbol.toUpperCase(), p.price)
    priceBySymbol.set(p.commodity.toLowerCase(), p.price)
  }

  const configByCommodity = new Map<string, CommodityPricing>()
  for (const pc of pricingConfigs) {
    configByCommodity.set(pc.commodity_id, pc)
  }

  const instrumentsByVariant = new Map<string, SaleInstrument[]>()
  const instrumentsByCommodity = new Map<string, SaleInstrument[]>()
  for (const inst of instruments) {
    const vk = inst.variant_id ?? '__none__'
    if (!instrumentsByVariant.has(vk)) instrumentsByVariant.set(vk, [])
    instrumentsByVariant.get(vk)!.push(inst)
    if (!instrumentsByCommodity.has(inst.commodity_id))
      instrumentsByCommodity.set(inst.commodity_id, [])
    instrumentsByCommodity.get(inst.commodity_id)!.push(inst)
  }

  const variantsByCommodity = new Map<string, CropVariant[]>()
  for (const v of variants) {
    if (!variantsByCommodity.has(v.commodity_id))
      variantsByCommodity.set(v.commodity_id, [])
    variantsByCommodity.get(v.commodity_id)!.push(v)
  }

  const sorted = [...commodities].sort((a, b) => a.sort_order - b.sort_order)

  return sorted.map((commodity) => {
    const commodityVariants = variantsByCommodity.get(commodity.id) ?? []
    const variantPositions: VariantPosition[] = commodityVariants.map((v) =>
      buildVariantPosition(v, instrumentsByVariant.get(v.id) ?? [])
    )

    // Instruments not tied to any variant still count toward the commodity
    const unassigned = (instrumentsByCommodity.get(commodity.id) ?? []).filter(
      (i) => i.variant_id == null
    )
    if (unassigned.length > 0) {
      const synthetic: CropVariant = {
        id: `__unassigned_${commodity.id}`,
        commodity_id: commodity.id,
        name: 'Unassigned',
        is_contracted: false,
        crop_year: unassigned[0].crop_year,
        estimated_bu: null,
        notes: null,
        created_at: '',
        updated_at: '',
      }
      variantPositions.push(buildVariantPosition(synthetic, unassigned))
    }

    const total_estimated_bu = commodityVariants.reduce(
      (s, v) => s + (v.estimated_bu ?? 0),
      0
    )
    const total_priced_bu = variantPositions.reduce((s, vp) => s + vp.priced_bu, 0)
    const unpriced_bu = Math.max(0, total_estimated_bu - total_priced_bu)
    const pct_priced =
      total_estimated_bu > 0 ? Math.min(100, (total_priced_bu / total_estimated_bu) * 100) : 0

    let wadSum = 0
    let wadBu = 0
    for (const vp of variantPositions) {
      if (vp.wap != null && vp.priced_bu > 0) {
        wadSum += vp.wap * vp.priced_bu
        wadBu += vp.priced_bu
      }
    }
    const wap = wadBu > 0 ? wadSum / wadBu : null

    const config = configByCommodity.get(commodity.id)
    const isFlat = config?.pricing_mode === 'flat_contract'

    let cbot_price: number | null = null
    if (commodity.cbot_symbol) {
      cbot_price = priceBySymbol.get(commodity.cbot_symbol.toUpperCase()) ?? null
    }

    let unpriced_exposure_dollars: number | null = null
    if (isFlat) {
      // Flat contract: exposure uses the configured price (no CBOT lookup)
      if (config?.price_value != null && unpriced_bu > 0) {
        unpriced_exposure_dollars = unpriced_bu * config.price_value
      }
    } else if (commodity.is_hedgeable && cbot_price != null) {
      // CBOT basis: exposure = unpriced_bu × (CBOT + basis offset)
      const basis = config?.price_value ?? 0
      unpriced_exposure_dollars = unpriced_bu * (cbot_price + basis)
    }

    const allInstruments = instrumentsByCommodity.get(commodity.id) ?? []
    const instrument_mix: Record<InstrumentType, number> = {
      cash: 0,
      forward_contract: 0,
      hta: 0,
      option: 0,
      accumulator: 0,
    }
    for (const inst of allInstruments) {
      instrument_mix[inst.instrument_type] += instrumentPricedBu(inst)
    }

    return {
      commodity,
      variants: variantPositions,
      total_estimated_bu,
      total_priced_bu,
      pct_priced,
      wap,
      cbot_price,
      unpriced_bu,
      unpriced_exposure_dollars,
      instrument_mix,
    }
  })
}
