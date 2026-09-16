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
  /** buyer takes all production — no fixed quantity, so contractedBushels is 0 */
  buyerTakesAll?: boolean
  /** bushels applied from deliveries; the real quantity for a take-all contract */
  appliedBushels?: number
  paymentBasis?: string | null
  finalCashPrice?: number | null   // $/bu if known
  futuresPrice?: number | null     // $/bu
  basis?: number | null            // $/bu (can be negative)
  variant?: { id: string } | null  // for projected-basis fallback lookup
}

export interface PositionOptions {
  /**
   * Planning placeholder basis by variant id, signed $/bu. When a priced
   * contract's basis leg is still open (basis == null), its variant's projected
   * basis stands in — so WAP is a blend of actual basis where set and the
   * placeholder everywhere else, the same way projected yield fills in until
   * actuals arrive. Contracts whose variant has no placeholder fall back to 0.
   */
  projectedBasisByVariantId?: Map<string, number>
}

/**
 * Bushels this contract puts into the position.
 *
 * Take-all contracts carry no fixed quantity, so contractedBushels is 0 by
 * design — there is genuinely nothing sold until the crop comes off. Once
 * deliveries are applied the quantity IS known, and weighting by 0 would hide a
 * delivered, settled contract entirely (Albert Lea barley: 4,710 bu, $46,336).
 * So a take-all contract counts its applied bushels. Before harvest that is 0
 * and nothing changes; every other contract keeps using contractedBushels.
 */
export function positionBushels(c: GrainContractForPosition): number {
  return c.buyerTakesAll ? (c.appliedBushels ?? 0) : c.contractedBushels
}

/**
 * Compute the farm grain position summary from a list of contracts.
 *
 * Effective price for WAP calculation (per priced contract):
 *   1. Use finalCashPrice if it is a non-null number.
 *   2. Else if futuresPrice is a non-null number: use futuresPrice + basis,
 *      where basis is the contract's own basis if set, else the variant's
 *      projected basis placeholder (see PositionOptions), else 0.
 *   3. Otherwise (futuresPrice is also null): no effective price — contract counts
 *      in pricedBu but is excluded from the WAP denominator to avoid divide artifacts.
 */
export function computePosition(
  allContracts: GrainContractForPosition[],
  options?: PositionOptions
): PositionSummary {
  // PER_UNIT seed contracts are paid per unit, not per bushel — their
  // contractedBushels (0 for take-all) would pollute the bushel KPIs.
  const contracts = allContracts.filter((c) => c.paymentBasis !== 'PER_UNIT')

  let contractedBu = 0
  let pricedBu = 0
  let wapNumerator = 0
  let wapDenominator = 0

  for (const c of contracts) {
    const bu = positionBushels(c)
    contractedBu += bu

    if (isPricedContract(c)) {
      pricedBu += bu

      // Determine effective price
      let effectivePrice: number | null = null
      if (c.finalCashPrice != null) {
        effectivePrice = c.finalCashPrice
      } else if (c.futuresPrice != null) {
        // Open basis leg → variant's projected-basis placeholder, else 0
        const fallbackBasis =
          (c.variant?.id != null
            ? options?.projectedBasisByVariantId?.get(c.variant.id)
            : undefined) ?? 0
        effectivePrice = c.futuresPrice + (c.basis ?? fallbackBasis)
      }

      if (effectivePrice !== null) {
        // Prices are stored in $/bu; convert to integer cents at this boundary.
        // Rounding per-contract prevents floating-point drift from accumulating
        // across many contracts before the final WAP round.
        wapNumerator += Math.round(effectivePrice * 100) * bu
        wapDenominator += bu
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
