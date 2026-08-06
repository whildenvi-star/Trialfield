// RED phase — SettlementsClient + unitsSanityWarning do not exist yet.
// Wave 3 (16-03) implements the component and DELETES the vi.mock below.
// Run: npx vitest run src/components/marketing/settlements-client.test.tsx

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { SettlementsClient, unitsSanityWarning } from '@/components/marketing/settlements-client'

// Keeps this file parseable before settlements-client.tsx exists.
// Wave 3 (16-03) deletes this vi.mock when it turns the file GREEN.
vi.mock('@/components/marketing/settlements-client', () => ({
  SettlementsClient: () => null,
  unitsSanityWarning: () => null,
}))

afterEach(cleanup)

// KWS Aviator acceptance fixture (PO 5400000312) — verbatim from 16-CONTEXT.md <specifics>
const AVIATOR_SETTLEMENT = {
  id: 'lot-1',
  lotNumber: 'AV07A-B5Q-01B',
  grossLbs: 835780,
  finishedLbs: 743660,
  germPct: 98,
  purityPct: 99.99,
  seedsPerLb: 17532,
  lbsPerUnit: 59,
  units: 12604,
  settlementDate: null,
  notes: null,
}

// Owner-role reconciliation — settledRevenue present
const OWNER_RECONCILIATION = {
  physicalDeliveredLbs: 743660,
  sumGrossLbs: 835780,
  sumFinishedLbs: 743660,
  shrinkPct: 0.110221,
  sumUnits: 12604,
  contractedUnits: 12604,
  settledRevenue: 154399,
}

// Office-role reconciliation — settledRevenue KEY OMITTED entirely (Pitfall 7), not null
const OFFICE_RECONCILIATION = {
  physicalDeliveredLbs: 743660,
  sumGrossLbs: 835780,
  sumFinishedLbs: 743660,
  shrinkPct: 0.110221,
  sumUnits: 12604,
  contractedUnits: 12604,
}

describe('unitsSanityWarning', () => {
  // D-02: 743660 / 59 = 12604.4067 vs entered 12604 -> 0.003% divergence -> no warning
  it('returns null for the Aviator fixture (743660 / 59 vs entered 12604 — 0.003% divergence)', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  // D-02: dropped digit — entered 1260 instead of 12604 -> ~90% divergence -> warning
  it("returns a warning containing 'check for a typo' when a digit is dropped (entered 1260)", () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  it('returns null when lbsPerUnit is 0 or non-finite instead of dividing by zero', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })
})

describe('SettlementsClient', () => {
  it('renders one table row per settlement with lot number, finished lbs, lbs/unit and units', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  it('renders the empty state "No lots settled yet." when settlements is an empty array', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  it('renders the reconciliation panel rows: Physical Delivered Lbs, Sum Finished Lbs, Shrink %, Sum Units', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  // D-03: owner sees settledRevenue
  it('renders the Settled Revenue row when settledRevenue is present in reconciliation (owner)', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  // D-03 + Pitfall 7: office does not — key-absent, not null
  it('does NOT render a Settled Revenue row when the settledRevenue key is absent from reconciliation (office)', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  // D-02: warning banner below the Units field
  it('shows the non-blocking D-02 warning banner below the Units field when entered units diverge more than 1%', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  // D-02: warning never blocks save
  it('keeps the Save Lot button ENABLED while the D-02 warning is displayed — the warning never blocks save', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  it('POSTs to /api/cert-proxy/marketing/contracts/{id}/settlements with numeric finishedLbs, lbsPerUnit and units', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })

  it('sends optional empty fields (grossLbs, germPct, purityPct, seedsPerLb, notes) as null not empty string', () => {
    expect(true).toBe(false) // TODO: GREEN in 16-03
  })
})
