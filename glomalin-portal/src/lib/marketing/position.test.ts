// Run: npx vitest run src/lib/marketing/position.test.ts
// Note: contract prices are stored in $/bu; avgPriceCents output is integer cents/bu.
import { describe, it, expect } from "vitest"
import { computePosition, isPricedContract, PRICED_INSTRUMENTS } from "./position"

describe("computePosition", () => {
  it("returns zero summary for empty array", () => {
    const result = computePosition([])
    expect(result).toEqual({ contractedBu: 0, pricedBu: 0, openBu: 0, avgPriceCents: 0, contractCount: 0 })
  })

  it("PRICED_LATER does not count as priced — counts as open", () => {
    const result = computePosition([
      { instrument: "PRICED_LATER", contractedBushels: 5000, finalCashPrice: null, futuresPrice: null, basis: null }
    ])
    expect(result.pricedBu).toBe(0)
    expect(result.openBu).toBe(5000)
  })

  it("SPOT without a price does not count as priced — counts as open", () => {
    const result = computePosition([
      { instrument: "SPOT", contractedBushels: 3000, finalCashPrice: null }
    ])
    expect(result.pricedBu).toBe(0)
    expect(result.openBu).toBe(3000)
  })

  it("SPOT with a finalCashPrice counts as priced and contributes to WAP", () => {
    const result = computePosition([
      { instrument: "SPOT", contractedBushels: 5000, finalCashPrice: 5.10 }
    ])
    expect(result.pricedBu).toBe(5000)
    expect(result.openBu).toBe(0)
    expect(result.avgPriceCents).toBe(510)
  })

  it("PRICED instrument with finalCashPrice counts as priced and contributes to WAP", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 10000, finalCashPrice: 4.82, futuresPrice: 5.00, basis: -0.18 }
    ])
    expect(result.pricedBu).toBe(10000)
    expect(result.avgPriceCents).toBe(482)
  })

  it("WAP: weighted average across PRICED + FUTURES_FIXED contracts", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 10000, finalCashPrice: 5.00, futuresPrice: 5.00, basis: 0 },
      { instrument: "FUTURES_FIXED", contractedBushels: 5000, finalCashPrice: null, futuresPrice: 4.80, basis: null }
    ])
    expect(result.pricedBu).toBe(15000)
    expect(result.avgPriceCents).toBe(493)
  })

  it("WAP blends SPOT cash price with other priced contracts", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 5000, finalCashPrice: 5.00 },
      { instrument: "SPOT", contractedBushels: 5000, finalCashPrice: 4.50 }
    ])
    expect(result.pricedBu).toBe(10000)
    expect(result.avgPriceCents).toBe(475)
  })

  it("uses futuresPrice+basis as effective price when finalCashPrice is null", () => {
    const result = computePosition([
      { instrument: "FUTURES_FIXED", contractedBushels: 5000, finalCashPrice: null, futuresPrice: 4.90, basis: -0.10 }
    ])
    expect(result.avgPriceCents).toBe(480)
  })

  it("contract with all price fields null still counts in pricedBu but not WAP denominator", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 5000, finalCashPrice: null, futuresPrice: null, basis: null }
    ])
    expect(result.pricedBu).toBe(5000)
    expect(result.avgPriceCents).toBe(0)
  })

  it("PRICED_INSTRUMENTS set includes PRICED, FUTURES_FIXED, BASIS_FIXED, FOB, MIN_PRICE", () => {
    expect(PRICED_INSTRUMENTS.has("PRICED")).toBe(true)
    expect(PRICED_INSTRUMENTS.has("FUTURES_FIXED")).toBe(true)
    expect(PRICED_INSTRUMENTS.has("BASIS_FIXED")).toBe(true)
    expect(PRICED_INSTRUMENTS.has("FOB")).toBe(true)
    expect(PRICED_INSTRUMENTS.has("MIN_PRICE")).toBe(true)
  })

  it("PRICED_INSTRUMENTS set excludes PRICED_LATER, SPOT, ACCUMULATOR", () => {
    expect(PRICED_INSTRUMENTS.has("PRICED_LATER")).toBe(false)
    expect(PRICED_INSTRUMENTS.has("SPOT")).toBe(false)
    expect(PRICED_INSTRUMENTS.has("ACCUMULATOR")).toBe(false)
  })
})

describe("isPricedContract", () => {
  it("true for inherently priced instruments regardless of price fields", () => {
    expect(isPricedContract({ instrument: "PRICED", contractedBushels: 1000, finalCashPrice: null })).toBe(true)
    expect(isPricedContract({ instrument: "FUTURES_FIXED", contractedBushels: 1000 })).toBe(true)
  })

  it("SPOT is priced only when finalCashPrice is present", () => {
    expect(isPricedContract({ instrument: "SPOT", contractedBushels: 1000, finalCashPrice: 5.10 })).toBe(true)
    expect(isPricedContract({ instrument: "SPOT", contractedBushels: 1000, finalCashPrice: null })).toBe(false)
    expect(isPricedContract({ instrument: "SPOT", contractedBushels: 1000 })).toBe(false)
  })

  it("false for PRICED_LATER and ACCUMULATOR even with a price", () => {
    expect(isPricedContract({ instrument: "PRICED_LATER", contractedBushels: 1000, finalCashPrice: 5.10 })).toBe(false)
    expect(isPricedContract({ instrument: "ACCUMULATOR", contractedBushels: 1000, finalCashPrice: 5.10 })).toBe(false)
  })
})

describe("computePosition — PER_UNIT exclusion", () => {
  it("excludes PER_UNIT contracts from contractedBu, pricedBu, WAP, and contractCount", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 10000, finalCashPrice: 5.00, paymentBasis: "PER_BUSHEL" },
      // PER_UNIT seed rye — must not pollute the bushel KPIs
      { instrument: "SPOT", contractedBushels: 2000, finalCashPrice: 4.00, paymentBasis: "PER_UNIT" },
      // take-all PER_UNIT with the 0-bushel sentinel
      { instrument: "SPOT", contractedBushels: 0, finalCashPrice: null, paymentBasis: "PER_UNIT" },
    ])
    expect(result.contractedBu).toBe(10000)
    expect(result.pricedBu).toBe(10000)
    expect(result.avgPriceCents).toBe(500)
    expect(result.contractCount).toBe(1)
  })

  it("keeps contracts with no paymentBasis field (legacy rows)", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 5000, finalCashPrice: 5.00 },
    ])
    expect(result.contractedBu).toBe(5000)
  })
})

describe("computePosition — projected basis placeholder", () => {
  const projectedBasisByVariantId = new Map<string, number>([
    ["v-shell", -0.35],
    ["v-food", 1.50],
  ])

  it("open basis leg uses the variant's projected basis", () => {
    const result = computePosition(
      [{ instrument: "FUTURES_FIXED", contractedBushels: 1000, futuresPrice: 4.50, basis: null, variant: { id: "v-shell" } }],
      { projectedBasisByVariantId }
    )
    expect(result.avgPriceCents).toBe(415) // 4.50 - 0.35
  })

  it("actual basis wins over the placeholder once set", () => {
    const result = computePosition(
      [{ instrument: "FUTURES_FIXED", contractedBushels: 1000, futuresPrice: 4.50, basis: -0.20, variant: { id: "v-shell" } }],
      { projectedBasisByVariantId }
    )
    expect(result.avgPriceCents).toBe(430) // 4.50 - 0.20 (actual, not -0.35)
  })

  it("WAP blends actual-basis and placeholder-basis contracts by bushels", () => {
    const result = computePosition(
      [
        { instrument: "FUTURES_FIXED", contractedBushels: 1000, futuresPrice: 4.50, basis: -0.20, variant: { id: "v-shell" } },
        { instrument: "FUTURES_FIXED", contractedBushels: 3000, futuresPrice: 4.50, basis: null, variant: { id: "v-shell" } },
      ],
      { projectedBasisByVariantId }
    )
    // (430*1000 + 415*3000) / 4000 = 418.75 → 419
    expect(result.avgPriceCents).toBe(419)
  })

  it("positive projected basis (food-grade premium) adds to futures", () => {
    const result = computePosition(
      [{ instrument: "FUTURES_FIXED", contractedBushels: 500, futuresPrice: 10.00, basis: null, variant: { id: "v-food" } }],
      { projectedBasisByVariantId }
    )
    expect(result.avgPriceCents).toBe(1150) // 10.00 + 1.50
  })

  it("variant without a placeholder falls back to 0 (legacy behavior)", () => {
    const result = computePosition(
      [{ instrument: "FUTURES_FIXED", contractedBushels: 500, futuresPrice: 10.00, basis: null, variant: { id: "v-rr" } }],
      { projectedBasisByVariantId }
    )
    expect(result.avgPriceCents).toBe(1000)
  })

  it("finalCashPrice ignores the placeholder entirely", () => {
    const result = computePosition(
      [{ instrument: "PRICED", contractedBushels: 500, finalCashPrice: 4.10, futuresPrice: 4.50, basis: null, variant: { id: "v-shell" } }],
      { projectedBasisByVariantId }
    )
    expect(result.avgPriceCents).toBe(410)
  })

  it("no options at all behaves exactly as before", () => {
    const result = computePosition([
      { instrument: "FUTURES_FIXED", contractedBushels: 1000, futuresPrice: 4.50, basis: null, variant: { id: "v-shell" } },
    ])
    expect(result.avgPriceCents).toBe(450)
  })
})
