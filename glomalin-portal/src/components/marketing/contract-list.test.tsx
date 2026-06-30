// RED phase — component does not exist yet.
// Wave 4 implements ContractListClient against these stubs.
// Run: npx vitest run src/components/marketing/contract-list.test.tsx
//
// NOTE for implementation: when querying for instrument badge text (e.g. 'PRICED', 'PTF'),
// use within(document.querySelector('tbody')!) to avoid getByText multiple-match errors —
// instrument values also appear in the filter dropdown. See STATE.md Phase 12-04 accumulated
// learning: within(tbody) required when enum values appear in both filter dropdowns and table cells.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractListClient } from '@/components/marketing/contract-list'

const customers = [{ id: 'cust-1', name: 'Test Elevator', shortCode: 'TE', type: 'ELEVATOR' }]
const variants = [{ id: 'v1', name: 'Yellow Corn', cropYear: 2025 }]

const contracts = [
  {
    id: 'con-1',
    instrument: 'PRICED',
    paymentBasis: 'PER_BUSHEL',
    status: 'OPEN',
    cropYear: 2025,
    contractedBushels: 10000,
    openBushels: 7500,
    customer: { id: 'c1', name: 'Heartland Coop', shortCode: 'HC' },
    variant: { id: 'v1', name: 'Yellow Corn', cropYear: 2025 },
  },
  {
    id: 'con-2',
    instrument: 'PRICED_LATER',
    paymentBasis: 'PER_BUSHEL',
    status: 'PARTIALLY_FILLED',
    cropYear: 2025,
    contractedBushels: 5000,
    openBushels: 3000,
    customer: { id: 'c1', name: 'Heartland Coop', shortCode: 'HC' },
    variant: { id: 'v1', name: 'Yellow Corn', cropYear: 2025 },
  },
]

describe('ContractListClient', () => {
  // CONTRACT-04: Filter strip and table rendering
  it('renders filter strip with Crop Year, Variant, Instrument, and Status dropdowns', () => {
    expect(true).toBe(true)
  })

  it('renders all contracts in table when no filter is active', () => {
    expect(true).toBe(true)
  })

  it('hides non-matching rows when Status filter is set to OPEN', () => {
    expect(true).toBe(true)
  })

  // CONTRACT-05: openBushels display and danger color
  it('renders openBushels value for each contract row', () => {
    expect(true).toBe(true)
  })

  it('renders openBushels in danger color when value is negative', () => {
    expect(true).toBe(true)
  })
})
