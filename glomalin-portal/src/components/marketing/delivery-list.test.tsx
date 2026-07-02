// GREEN phase — DeliveryListClient tests.
// Run: npx vitest run src/components/marketing/delivery-list.test.tsx
//
// NOTE: when querying table cell values that may also appear in select
// option text, use within(document.querySelector('tbody')!) to avoid
// getByText multiple-match errors. See STATE.md Phase 12-04 pattern.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { DeliveryListClient } from '@/components/marketing/delivery-list'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { reload: vi.fn() },
    writable: true,
  })
})

const deliveries = [
  {
    id: 'del-1',
    farmId: 'farm-1',
    customerId: 'cust-1',
    variantId: 'var-1',
    deliveryDate: '2025-09-15T00:00:00Z',
    netWeightLbs: 56000,
    netBushels: 1000,
    unappliedBushels: 200,
    appliedBushels: 800,
    moisturePercent: null,
    testWeightLbs: null,
    foreignMatterPct: null,
    scaleTicketNum: 'SCL-001',
    loadoutEventId: null,
    settlementLineId: null,
    notes: null,
    variant: { id: 'var-1', name: 'Yellow Corn' },
    customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
  },
  {
    id: 'del-2',
    farmId: 'farm-1',
    customerId: 'cust-1',
    variantId: 'var-1',
    deliveryDate: '2025-09-20T00:00:00Z',
    netWeightLbs: 28000,
    netBushels: 500,
    unappliedBushels: 0,
    appliedBushels: 500,
    moisturePercent: null,
    testWeightLbs: null,
    foreignMatterPct: null,
    scaleTicketNum: 'SCL-002',
    loadoutEventId: null,
    settlementLineId: null,
    notes: null,
    variant: { id: 'var-1', name: 'Yellow Corn' },
    customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
  },
]

const baseProps = {
  deliveries,
  contracts: [],
  role: 'owner' as const,
}

describe('DeliveryListClient', () => {
  // DELIVERY-04: Row rendering
  it('renders a row for each delivery in props', () => {
    render(<DeliveryListClient {...baseProps} />)
    const tbody = document.querySelector('tbody')!
    const rows = within(tbody).getAllByRole('row')
    expect(rows.length).toBe(2)
  })

  // DELIVERY-04: Unmatched row warning styling (unappliedBushels > 0)
  it('row with unappliedBushels > 0 has warning class text-glomalin-warning', () => {
    render(<DeliveryListClient {...baseProps} />)
    const tbody = document.querySelector('tbody')!
    const unmatchedCell = within(tbody).getByText('(unmatched)').closest('td')!
    expect(unmatchedCell.className).toContain('text-glomalin-warning')
  })

  // DELIVERY-04: Fully applied row muted styling (unappliedBushels = 0)
  it('row with unappliedBushels = 0 has muted class text-glomalin-muted', () => {
    render(<DeliveryListClient {...baseProps} />)
    const tbody = document.querySelector('tbody')!
    const rows = within(tbody).getAllByRole('row')
    // Find the row that does NOT have (unmatched)
    const matchedRow = rows.find(
      (row) => !within(row).queryByText('(unmatched)')
    )!
    const cells = within(matchedRow).getAllByRole('cell')
    // Unapplied is the 5th cell (index 4)
    const unappliedCell = cells[4]
    expect(unappliedCell.className).toContain('text-glomalin-muted')
    expect(unappliedCell.className).not.toContain('text-glomalin-warning')
  })

  // DELIVERY-04: Log Delivery button opens drawer
  it('Log Delivery button opens the drawer', () => {
    render(<DeliveryListClient {...baseProps} />)
    const btn = screen.getByRole('button', { name: /log delivery/i })
    fireEvent.click(btn)
    // Drawer should show the DeliveryForm — check for known section label
    expect(screen.getByText('Delivery Details')).toBeTruthy()
  })

  // D-10: handleSaved uses window.location.reload not router.refresh
  it('handleSaved calls window.location.reload not router.refresh', async () => {
    // Mock fetch BEFORE render so the component picks it up
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'new-del' }), { status: 200 })
    )

    render(<DeliveryListClient {...baseProps} />)

    // Open drawer via header "Log Delivery" button
    const headerBtn = screen.getByRole('button', { name: /log delivery/i })
    fireEvent.click(headerBtn)

    // Wait for drawer to render
    expect(screen.getByText('Delivery Details')).toBeTruthy()

    // Fill required fields inside the drawer panel
    // Use form elements directly since the drawer panel contains the form
    const form = document.querySelector('form')!
    const variantSelect = within(form).getByLabelText('Grain Variant')
    fireEvent.change(variantSelect, { target: { value: 'var-1' } })

    const customerSelect = within(form).getByLabelText('Customer')
    fireEvent.change(customerSelect, { target: { value: 'cust-1' } })

    const dateInput = within(form).getByLabelText('Delivery Date')
    fireEvent.change(dateInput, { target: { value: '2025-09-15' } })

    const weightInput = within(form).getByLabelText('Net Weight (lbs)')
    fireEvent.change(weightInput, { target: { value: '56000' } })

    const bushelsInput = within(form).getByLabelText('Net Bushels')
    fireEvent.change(bushelsInput, { target: { value: '1000' } })

    // Submit the form
    await act(async () => {
      fireEvent.submit(form)
      // Wait for fetch promise + state updates to settle
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(fetchMock).toHaveBeenCalled()
    expect(window.location.reload).toHaveBeenCalled()
  })
})
