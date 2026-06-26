// RED phase — basis-exposure-panel.tsx does not exist until Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/basis-exposure-panel.test.tsx
// Expected now: FAIL (module not found). Expected after Plan 02: PASS.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BasisExposurePanel } from './basis-exposure-panel'

const HTA_UNPRICED = {
  id: 'c1', instrument: 'FUTURES_FIXED' as const,
  contractedBushels: 5000, appliedBushels: 0,
  futuresPrice: null, basis: null, finalCashPrice: null,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Corn' },
  status: 'OPEN' as const,
}

const HTA_PRICED = {
  ...HTA_UNPRICED, id: 'c2', futuresPrice: 490,
}

const BASIS_UNSET = {
  id: 'c3', instrument: 'BASIS_FIXED' as const,
  contractedBushels: 3000, appliedBushels: 0,
  futuresPrice: 490, basis: null, finalCashPrice: null,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Corn' },
  status: 'OPEN' as const,
}

const PRICED_CONTRACT = {
  id: 'c4', instrument: 'PRICED' as const,
  contractedBushels: 10000, appliedBushels: 0,
  futuresPrice: 500, basis: -18, finalCashPrice: 482,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Corn' },
  status: 'OPEN' as const,
}

describe('BasisExposurePanel', () => {
  it('RED: module exists and exports BasisExposurePanel component', () => {
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because basis-exposure-panel.tsx does not exist yet.
    // Plan 02 Task 2 creates basis-exposure-panel.tsx → this test turns GREEN.
    expect(typeof BasisExposurePanel).toBe('function')
  })

  it.todo('renders empty state when no contracts have open pricing leg')
  // render(<BasisExposurePanel contracts={[HTA_PRICED, PRICED_CONTRACT]} />)
  // expect: "No open pricing legs" empty state

  it.todo('shows FUTURES_FIXED contract with null futuresPrice as exposed')
  // render(<BasisExposurePanel contracts={[HTA_UNPRICED]} />)
  // expect: HTA badge visible, customer shortCode visible

  it.todo('shows BASIS_FIXED contract with null basis as exposed')
  // render(<BasisExposurePanel contracts={[BASIS_UNSET]} />)
  // expect: BASIS badge visible

  it.todo('does NOT show fully-priced FUTURES_FIXED contract')
  // render(<BasisExposurePanel contracts={[HTA_PRICED]} />)
  // expect: empty state (HTA_PRICED has futuresPrice set)

  it.todo('does NOT show non-HTA/BASIS_FIXED contracts regardless of price state')
  // render(<BasisExposurePanel contracts={[PRICED_CONTRACT]} />)
  // expect: empty state

  it.todo('shows count of exposed contracts in CardDescription')
  // render(<BasisExposurePanel contracts={[HTA_UNPRICED, BASIS_UNSET]} />)
  // expect: "2 contracts with open pricing leg"
})
