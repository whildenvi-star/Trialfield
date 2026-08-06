// Marketing position computation — pure TypeScript, no React, no external imports.

export const PRICED_INSTRUMENTS = new Set<string>([
  "PRICED",
  "FUTURES_FIXED",
  "BASIS_FIXED",
  "FOB",
  "MIN_PRICE",
])
// PRICED_LATER, SPOT, and ACCUMULATOR are deliberately excluded.
// SPOT is priced only when it carries a finalCashPrice — see isPricedContract.

/**
 * A contract counts as priced if its instrument is inherently priced, or if it
 * is a SPOT sale with a known cash price. A SPOT row without a price is just a
 * delivery record and must stay in the open position.
 */
export function isPricedContract(c: GrainContractForPosition): boolean {
  return (
    PRICED_INSTRUMENTS.has(c.instrument) ||
    (c.instrument === "SPOT" && c.finalCashPrice != null)
  )
}

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
  paymentBasis?: string | null
  finalCashPrice?: number | null   // $/bu if known
  futuresPrice?: number | null     // $/bu
  basis?: number | null            // $/bu (can be negative)
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
export function computePosition(allContracts: GrainContractForPosition[]): PositionSummary {
  // PER_UNIT seed contracts are paid per unit, not per bushel — their
  // contractedBushels (0 for take-all) would pollute the bushel KPIs.
  const contracts = allContracts.filter((c) => c.paymentBasis !== 'PER_UNIT')

  let contractedBu = 0
  let pricedBu = 0
  let wapNumerator = 0
  let wapDenominator = 0

  for (const c of contracts) {
    contractedBu += c.contractedBushels

    if (isPricedContract(c)) {
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
        // Prices are stored in $/bu; convert to integer cents at this boundary.
        // Rounding per-contract prevents floating-point drift from accumulating
        // across many contracts before the final WAP round.
        wapNumerator += Math.round(effectivePrice * 100) * c.contractedBushels
        wapDenominator += c.contractedBushels
      }
    }
  }

  const openBu = contractedBu - pricedBu
  // Integer cent precision: wapNumerator is a sum of (cents * bushels), so the
  // quotient is cents/bu. Math.round produces the nearest integer cent, which is
  // the correct unit for avgPriceCents.
  const avgPriceCents = wapDenominator > 0 ? Math.round(wapNumerator / wapDenominator) : 0

  return {
    contractedBu,
    pricedBu,
    openBu,
    avgPriceCents,
    contractCount: contracts.length,
  }
}
