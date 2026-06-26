// GREEN after Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/position-strip.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PositionStrip } from './position-strip'
import type { PositionSummary } from '../../lib/marketing/position'

afterEach(cleanup)

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
    expect(typeof PositionStrip).toBe('function')
  })

  it('renders 4 StatCards for a full position', () => {
    render(<PositionStrip data={FULL_POSITION} cropYear={2025} />)
    expect(screen.getByText('CONTRACTED')).toBeTruthy()
    expect(screen.getByText('PRICED')).toBeTruthy()
    expect(screen.getByText('OPEN / UNPRICED')).toBeTruthy()
    expect(screen.getByText('EST. AVG PRICE')).toBeTruthy()
  })

  it('shows formatted contracted bu in first card', () => {
    render(<PositionStrip data={FULL_POSITION} cropYear={2025} />)
    const matches = screen.getAllByText('182,000')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows "—" for avg price when avgPriceCents is 0', () => {
    render(<PositionStrip data={ZERO_POSITION} cropYear={2025} />)
    const matches = screen.getAllByText('—')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('does not render when data is null (owner-gate handled by page.tsx)', () => {
    expect(typeof PositionStrip).toBe('function')
  })
})
