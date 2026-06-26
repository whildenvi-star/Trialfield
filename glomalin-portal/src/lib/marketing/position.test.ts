// RED phase — position.ts does not exist until Plan 02 Task 1.
// Run: npx vitest run src/lib/marketing/position.test.ts
// Expected now: FAIL (module not found or undefined is not a function). Expected after Plan 02: PASS.
import { describe, it, expect } from 'vitest'
import { computePosition, PRICED_INSTRUMENTS } from './position'

describe('computePosition', () => {
  it('RED: module exists and exports computePosition function', () => {
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because position.ts does not exist yet.
    // Plan 02 Task 1 creates position.ts → this test turns GREEN.
    expect(typeof computePosition).toBe('function')
  })

  it.todo('returns zero summary for empty array')
  // expect: { contractedBu: 0, pricedBu: 0, openBu: 0, avgPriceCents: 0, contractCount: 0 }

  it.todo('PRICED_LATER does not count as priced — counts as open')
  // input: [{ instrument: 'PRICED_LATER', contractedBushels: 5000, finalCashPrice: null }]
  // expect: pricedBu: 0, openBu: 5000

  it.todo('SPOT does not count as priced — counts as open')
  // input: [{ instrument: 'SPOT', contractedBushels: 3000, finalCashPrice: null }]
  // expect: pricedBu: 0

  it.todo('PRICED instrument with finalCashPrice counts as priced and contributes to WAP')
  // input: [{ instrument: 'PRICED', contractedBushels: 10000, finalCashPrice: 482, futuresPrice: 500, basis: -18 }]
  // expect: pricedBu: 10000, avgPriceCents: 482

  it.todo('WAP: weighted average across PRICED + FUTURES_FIXED contracts')
  // PRICED 10000bu at finalCashPrice=500, FUTURES_FIXED 5000bu at futuresPrice=480 basis=null
  // expect: pricedBu: 15000, avgPriceCents: 493 (weighted avg)

  it.todo('uses futuresPrice+basis as effective price when finalCashPrice is null')
  // input: { instrument: 'FUTURES_FIXED', contractedBushels: 5000, finalCashPrice: null, futuresPrice: 490, basis: -10 }
  // expect: avgPriceCents: 480

  it.todo('contract with all price fields null still counts in pricedBu but not WAP denominator')
  // input: PRICED instrument, finalCashPrice: null, futuresPrice: null, basis: null
  // expect: pricedBu > 0, avgPriceCents: 0

  it.todo('PRICED_INSTRUMENTS set includes PRICED, FUTURES_FIXED, BASIS_FIXED, FOB, MIN_PRICE')
  it.todo('PRICED_INSTRUMENTS set excludes PRICED_LATER, SPOT, ACCUMULATOR')
})
