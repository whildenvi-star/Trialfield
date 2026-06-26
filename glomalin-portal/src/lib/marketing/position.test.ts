// RED phase → GREEN after Plan 02 Task 1.
// Run: npx vitest run src/lib/marketing/position.test.ts
import { describe, it, expect } from "vitest"
import { computePosition, PRICED_INSTRUMENTS } from "./position"

describe("computePosition", () => {
  it("RED: module exists and exports computePosition function", () => {
    expect(typeof computePosition).toBe("function")
  })

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

  it("SPOT does not count as priced — counts as open", () => {
    const result = computePosition([
      { instrument: "SPOT", contractedBushels: 3000, finalCashPrice: null }
    ])
    expect(result.pricedBu).toBe(0)
    expect(result.openBu).toBe(3000)
  })

  it("PRICED instrument with finalCashPrice counts as priced and contributes to WAP", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 10000, finalCashPrice: 482, futuresPrice: 500, basis: -18 }
    ])
    expect(result.pricedBu).toBe(10000)
    expect(result.avgPriceCents).toBe(482)
  })

  it("WAP: weighted average across PRICED + FUTURES_FIXED contracts", () => {
    const result = computePosition([
      { instrument: "PRICED", contractedBushels: 10000, finalCashPrice: 500, futuresPrice: 500, basis: 0 },
      { instrument: "FUTURES_FIXED", contractedBushels: 5000, finalCashPrice: null, futuresPrice: 480, basis: null }
    ])
    expect(result.pricedBu).toBe(15000)
    expect(result.avgPriceCents).toBe(493)
  })

  it("uses futuresPrice+basis as effective price when finalCashPrice is null", () => {
    const result = computePosition([
      { instrument: "FUTURES_FIXED", contractedBushels: 5000, finalCashPrice: null, futuresPrice: 490, basis: -10 }
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
