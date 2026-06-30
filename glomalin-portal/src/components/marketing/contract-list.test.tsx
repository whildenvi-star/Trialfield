// GREEN phase — ContractListClient implemented.
// Wave 4 implements ContractListClient against these stubs.
// Run: npx vitest run src/components/marketing/contract-list.test.tsx
//
// NOTE for implementation: when querying for instrument badge text (e.g. 'PRICED', 'PTF'),
// use within(document.querySelector('tbody')!) to avoid getByText multiple-match errors —
// instrument values also appear in the filter dropdown. See STATE.md Phase 12-04 accumulated
// learning: within(tbody) required when enum values appear in both filter dropdowns and table cells.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { ContractListClient } from '@/components/marketing/contract-list'

afterEach(cleanup)

const customers = [{ id: 'cust-1', name: 'Test Elevator', shortCode: 'TE', type: 'ELEVATOR' }]
const variants = [{ id: 'v1', name: 'Yellow Corn', cropYear: 2025 }]

const contracts = [
  {
    id: 'con-1',
    instrument: 'PRICED' as const,
    paymentBasis: 'PER_BUSHEL',
    status: 'OPEN' as const,
    cropYear: 2025,
    contractedBushels: 10000,
    openBushels: 7500,
    customer: { id: 'c1', name: 'Heartland Coop', shortCode: 'HC' },
    variant: { id: 'v1', name: 'Yellow Corn', cropYear: 2025 },
  },
  {
    id: 'con-2',
    instrument: 'PRICED_LATER' as const,
    paymentBasis: 'PER_BUSHEL',
    status: 'PARTIALLY_FILLED' as const,
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
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    // Each dropdown should have its default "All X" option
    expect(screen.getByRole('option', { name: 'All Years' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'All Variants' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'All Types' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'All Status' })).toBeTruthy()
  })

  it('renders all contracts in table when no filter is active', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    const tbody = document.querySelector('tbody')!
    // Both contracts belong to Heartland Coop — check both rows appear via instrument badges
    expect(within(tbody).getByText('PRICED')).toBeTruthy()
    expect(within(tbody).getByText('PTF')).toBeTruthy()
  })

  it('hides non-matching rows when Status filter is set to OPEN', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    // Change Status filter to OPEN
    const statusSelect = screen.getByRole('combobox', { name: /status/i })
    fireEvent.change(statusSelect, { target: { value: 'OPEN' } })

    const tbody = document.querySelector('tbody')!
    // PRICED (status=OPEN) should remain; PTF (status=PARTIALLY_FILLED) should be gone
    expect(within(tbody).getByText('PRICED')).toBeTruthy()
    expect(within(tbody).queryByText('PTF')).toBeFalsy()
  })

  // CONTRACT-05: openBushels display and danger color
  it('renders openBushels value for each contract row', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    const tbody = document.querySelector('tbody')!
    // con-1 has openBushels=7500 → formatBu → "7,500"
    expect(within(tbody).getAllByText('7,500').length).toBeGreaterThan(0)
    // con-2 has openBushels=3000 → formatBu → "3,000"
    expect(within(tbody).getAllByText('3,000').length).toBeGreaterThan(0)
  })

  it('renders openBushels in danger color when value is negative', () => {
    const negativeContract = [
      {
        id: 'con-neg',
        instrument: 'PRICED' as const,
        paymentBasis: 'PER_BUSHEL',
        status: 'OPEN' as const,
        cropYear: 2025,
        contractedBushels: 5000,
        openBushels: -500,
        customer: { id: 'c1', name: 'Heartland Coop', shortCode: 'HC' },
        variant: { id: 'v1', name: 'Yellow Corn', cropYear: 2025 },
      },
    ]
    const { container } = render(
      <ContractListClient
        contracts={negativeContract}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    // Cell should have the danger color class
    const dangerCell = container.querySelector('[class*="glomalin-danger"]')
    expect(dangerCell).toBeTruthy()
    // '(over-applied)' label should appear
    expect(screen.getByText('(over-applied)')).toBeTruthy()
  })
})
