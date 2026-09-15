// GREEN after Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/basis-exposure-panel.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BasisExposurePanel, rollDeadline } from './basis-exposure-panel'

afterEach(cleanup)

const HTA_UNPRICED = {
  id: 'c1', instrument: 'FUTURES_FIXED' as const,
  contractedBushels: 5000, appliedBushels: 0,
  futuresPrice: null, basis: null, finalCashPrice: null,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Corn' },
  status: 'OPEN' as const,
}

// Both legs locked — futures AND basis — so nothing is exposed.
const HTA_PRICED = {
  ...HTA_UNPRICED, id: 'c2', futuresPrice: 490, basis: -15,
}

// Basis-fixed: basis leg locked, futures leg still open — exposed.
const BASIS_UNSET = {
  id: 'c3', instrument: 'BASIS_FIXED' as const,
  contractedBushels: 3000, appliedBushels: 0,
  futuresPrice: null, basis: -15, finalCashPrice: null,
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
    expect(typeof BasisExposurePanel).toBe('function')
  })

  it('renders empty state when no contracts have open pricing leg', () => {
    render(<BasisExposurePanel contracts={[HTA_PRICED, PRICED_CONTRACT]} />)
    expect(screen.getByText('No open pricing legs')).toBeTruthy()
  })

  it('shows FUTURES_FIXED contract with null futuresPrice as exposed', () => {
    render(<BasisExposurePanel contracts={[HTA_UNPRICED]} />)
    expect(screen.getByText('HTA')).toBeTruthy()
    expect(screen.getByText('ACM')).toBeTruthy()
  })

  it('shows BASIS_FIXED contract with open futures leg as exposed', () => {
    render(<BasisExposurePanel contracts={[BASIS_UNSET]} />)
    expect(screen.getByText('BASIS')).toBeTruthy()
  })

  it('does NOT show fully-priced FUTURES_FIXED contract', () => {
    render(<BasisExposurePanel contracts={[HTA_PRICED]} />)
    expect(screen.getByText('No open pricing legs')).toBeTruthy()
  })

  it('does NOT show non-HTA/BASIS_FIXED contracts regardless of price state', () => {
    render(<BasisExposurePanel contracts={[PRICED_CONTRACT]} />)
    expect(screen.getByText('No open pricing legs')).toBeTruthy()
  })

  it('shows count of exposed contracts in CardDescription', () => {
    render(<BasisExposurePanel contracts={[HTA_UNPRICED, BASIS_UNSET]} />)
    expect(screen.getByText('2 contracts with open pricing leg')).toBeTruthy()
  })

  it('renders futures month and roll deadline when htaDetails is present', () => {
    const withMonth = { ...HTA_UNPRICED, htaDetails: { futuresMonth: 'Dec 2026' } }
    render(<BasisExposurePanel contracts={[withMonth]} />)
    expect(screen.getByText('Dec 2026')).toBeTruthy()
    // Dec 2026: first notice Mon Nov 30, minus 2 business days -> Thu Nov 26
    expect(screen.getByText(/roll (~Nov 26|passed)/)).toBeTruthy()
  })

  it('sorts soonest roll deadline first; missing futures month sinks last', () => {
    const dec = { ...HTA_UNPRICED, id: 'dec', htaDetails: { futuresMonth: 'Dec 2026' },
      customer: { id: 'cu1', name: 'Acme', shortCode: 'DEC' } }
    const nov = { ...HTA_UNPRICED, id: 'nov', htaDetails: { futuresMonth: 'Nov 2026' },
      customer: { id: 'cu1', name: 'Acme', shortCode: 'NOV' } }
    const none = { ...HTA_UNPRICED, id: 'none',
      customer: { id: 'cu1', name: 'Acme', shortCode: 'NON' } }
    render(<BasisExposurePanel contracts={[none, dec, nov]} />)
    const codes = screen.getAllByText(/^(DEC|NOV|NON)$/).map((el) => el.textContent)
    expect(codes).toEqual(['NOV', 'DEC', 'NON'])
  })
})

describe('rollDeadline', () => {
  it('Dec 2026: first notice last business day of Nov (Mon 11/30), deadline 2 business days prior', () => {
    const d = rollDeadline('Dec 2026')!
    expect([d.getMonth(), d.getDate()]).toEqual([10, 26]) // ~Thu Nov 26 (weekday math, no holiday calendar)
  })

  it('Nov 2026: Nov 1 is a Sunday — first notice Fri Oct 30, deadline Wed Oct 28', () => {
    const d = rollDeadline('Nov 2026')!
    expect([d.getMonth(), d.getDate()]).toEqual([9, 28])
  })

  it('Sep 2027: Sep 1 is a Wednesday — first notice Tue Aug 31, deadline Fri Aug 27', () => {
    const d = rollDeadline('Sep 2027')!
    expect([d.getMonth(), d.getDate()]).toEqual([7, 27])
  })

  it('returns null for missing or unparseable input', () => {
    expect(rollDeadline(null)).toBeNull()
    expect(rollDeadline(undefined)).toBeNull()
    expect(rollDeadline('December 2026')).toBeNull()
    expect(rollDeadline('CZ26')).toBeNull()
  })
})
