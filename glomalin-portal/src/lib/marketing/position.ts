// Marketing position computation — pure TypeScript, no React, no external imports.

export const PRICED_INSTRUMENTS = new Set<string>([
  "PRICED",
  "FUTURES_FIXED",
  "BASIS_FIXED",
  "FOB",
  "MIN_PRICE",
])
// PRICED_LATER, SPOT, and ACCUMULATOR are deliberately excluded.

export interface PositionSummary {
  contractedBu: number
  pricedBu: number
  openBu: number
  /** Weighted average cash price in cents/bu; 0 when no priced contracts have a known price */
  avgPriceCents: number
  contractCount: number
}

export interface GrainContractForPosition {
  instrument: string
  contractedBushels: number
  finalCashPrice?: number | null   // cents/bu if known
  futuresPrice?: number | null     // cents/bu
  basis?: number | null            // cents/bu (can be negative)
}

/**
 * Compute the farm grain position summary from a list of contracts.
 *
 * Effective price for WAP calculation (per priced contract):
 *   1. Use finalCashPrice if it is a non-null number.
 *   2. Else if futuresPrice is a non-null number: use futuresPrice + (basis ?? 0).
 *      A null basis is treated as 0 — futuresPrice alone is the best known price
 *      for HTA/basis-fixed contracts where the basis leg is still open.
 *   3. Otherwise (futuresPrice is also null): no effective price — contract counts
 *      in pricedBu but is excluded from the WAP denominator to avoid divide artifacts.
 */
export function computePosition(contracts: GrainContractForPosition[]): PositionSummary {
  let contractedBu = 0
  let pricedBu = 0
  let wapNumerator = 0
  let wapDenominator = 0

  for (const c of contracts) {
    contractedBu += c.contractedBushels

    if (PRICED_INSTRUMENTS.has(c.instrument)) {
      pricedBu += c.contractedBushels

      // Determine effective price
      let effectivePrice: number | null = null
      if (c.finalCashPrice != null) {
        effectivePrice = c.finalCashPrice
      } else if (c.futuresPrice != null) {
        // Treat null basis as 0 — futures price alone is the best available estimate
        effectivePrice = c.futuresPrice + (c.basis ?? 0)
      }

      if (effectivePrice !== null) {
        wapNumerator += effectivePrice * c.contractedBushels
        wapDenominator += c.contractedBushels
      }
    }
  }

  const openBu = contractedBu - pricedBu
  const avgPriceCents = wapDenominator > 0 ? Math.round(wapNumerator / wapDenominator) : 0

  return {
    contractedBu,
    pricedBu,
    openBu,
    avgPriceCents,
    contractCount: contracts.length,
  }
}
