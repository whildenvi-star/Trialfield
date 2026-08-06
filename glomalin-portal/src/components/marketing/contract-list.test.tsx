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
  {
    // NOTE: instrument deliberately 'SPOT', not 'PRICED' as literally specified in
    // 16-00-PLAN.md — 'PRICED' collides with con-1's badge text and breaks the
    // pre-existing "renders all contracts"/"hides non-matching rows" assertions that
    // query within(tbody).getByText('PRICED') expecting exactly one match (Rule 1 fix;
    // the plan's own acceptance criteria requires pre-existing GREEN tests to still pass).
    id: 'con-3',
    instrument: 'SPOT' as const,
    paymentBasis: 'PER_UNIT',
    status: 'OPEN' as const,
    cropYear: 2025,
    contractedBushels: 2000,
    openBushels: 2000,
    customer: { id: 'c2', name: 'KWS Cereals', shortCode: 'KWS' },
    variant: { id: 'v2', name: 'KWS Aviator Rye', cropYear: 2025 },
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

  // Dashboard deep-link: ?edit=<id> opens the edit drawer (contract-table pencil)
  describe('?edit= query param', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/')
    })

    it('opens the edit drawer for the matching contract on mount', () => {
      window.history.replaceState(null, '', '/app/marketing/contracts?edit=con-2')
      render(
        <ContractListClient
          contracts={contracts}
          customers={customers}
          variants={variants}
          role="owner"
        />
      )
      expect(screen.getByText('Edit Contract')).toBeTruthy()
      // Pre-filled with con-2's bushels
      const bushelsInput = screen.getByRole('spinbutton', { name: /contracted bushels/i })
      expect((bushelsInput as HTMLInputElement).value).toBe('5000')
      // Param stripped so refresh doesn't reopen
      expect(window.location.search).not.toContain('edit=')
    })

    it('renders the plain list when the edit id matches no contract', () => {
      window.history.replaceState(null, '', '/app/marketing/contracts?edit=nope')
      render(
        <ContractListClient
          contracts={contracts}
          customers={customers}
          variants={variants}
          role="owner"
        />
      )
      expect(screen.queryByText('Edit Contract')).toBeNull()
    })
  })

  // Dashboard deep-link: ?new=1 opens the create drawer (dashboard "New Contract" CTA)
  describe('?new= query param', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/')
    })

    it('opens the create drawer on mount and strips the param', () => {
      window.history.replaceState(null, '', '/app/marketing/contracts?new=1')
      render(
        <ContractListClient
          contracts={contracts}
          customers={customers}
          variants={variants}
          role="owner"
        />
      )
      // Two matches = list button + open drawer title; closed drawer would yield one
      expect(screen.getAllByText('New Contract')).toHaveLength(2)
      expect(screen.queryByText('Edit Contract')).toBeNull()
      expect(window.location.search).not.toContain('new=')
    })
  })
})

// D-05: the "Lots" action renders only on PER_UNIT contract rows. Per 16-UI-SPEC.md the
// Lots control is a plain <a href> (NOT a router.push button), so no next/navigation mock
// is needed and none must be added to this file. The D-06 addendum in 16-CONTEXT.md records
// why the decision's literal "router.push()" wording was superseded.
describe('ContractListClient — Lots action (D-05)', () => {
  it('renders a Lots link only on the PER_UNIT row', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    const tbody = document.querySelector('tbody')!
    // Only con-3 (paymentBasis PER_UNIT) should contribute a Lots link; the two
    // PER_BUSHEL rows (con-1, con-2) must not.
    const lotsLinks = within(tbody).getAllByRole('link', { name: /lot settlements/i })
    expect(lotsLinks).toHaveLength(1)
  })

  it('the Lots link points at /app/marketing/contracts/con-3/settlements', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="owner"
      />
    )
    const tbody = document.querySelector('tbody')!
    const lotsLink = within(tbody).getByRole('link', { name: /lot settlements/i })
    expect(lotsLink.getAttribute('href')).toBe('/app/marketing/contracts/con-3/settlements')
  })

  it('renders the Lots link for office role too — not owner-gated (D-04)', () => {
    render(
      <ContractListClient
        contracts={contracts}
        customers={customers}
        variants={variants}
        role="office"
      />
    )
    const tbody = document.querySelector('tbody')!
    const lotsLinks = within(tbody).getAllByRole('link', { name: /lot settlements/i })
    expect(lotsLinks).toHaveLength(1)
  })
})
