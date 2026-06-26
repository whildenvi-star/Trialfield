// RED phase — position-strip.tsx does not exist until Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/position-strip.test.tsx
// Expected now: FAIL (module not found). Expected after Plan 02: PASS.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PositionStrip } from './position-strip'
import type { PositionSummary } from '../../../lib/marketing/position'

const FULL_POSITION: PositionSummary = {
  contractedBu: 182000,
  pricedBu: 91000,
  openBu: 91000,
  avgPriceCents: 482,
  contractCount: 4,
}

const ZERO_POSITION: PositionSummary = {
  contractedBu: 0,
  pricedBu: 0,
  openBu: 0,
  avgPriceCents: 0,
  contractCount: 0,
}

describe('PositionStrip', () => {
  it('RED: module exists and exports PositionStrip component', () => {
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because position-strip.tsx does not exist yet.
    // Plan 02 Task 2 creates position-strip.tsx → this test turns GREEN.
    expect(typeof PositionStrip).toBe('function')
  })

  it.todo('renders 4 StatCards for a full position')
  // render(<PositionStrip data={FULL_POSITION} cropYear={2025} />)
  // expect: "CONTRACTED", "PRICED", "OPEN / UNPRICED", "EST. AVG PRICE" labels visible

  it.todo('shows formatted contracted bu in first card')
  // expect: "182,000 bu" or similar formatBu output

  it.todo('shows "—" for avg price when avgPriceCents is 0')
  // render(<PositionStrip data={ZERO_POSITION} cropYear={2025} />)
  // expect: "—" in EST. AVG PRICE card

  it.todo('does not render when data is null (owner-gate handled by page.tsx)')
  // Note: owner gating is in page.tsx RSC — PositionStrip itself always renders if called
})
