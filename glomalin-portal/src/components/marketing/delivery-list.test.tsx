// RED phase — DeliveryListClient stubs; all tests fail intentionally.
// Wave 3 will implement DeliveryListClient and turn these GREEN.
// Run: npx vitest run src/components/marketing/delivery-list.test.tsx
//
// NOTE for implementation: when querying table cell values that may also appear in select
// option text, use within(document.querySelector('tbody')!) to avoid getByText multiple-match
// errors. See STATE.md Phase 12-04 pattern: within(tbody) required.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/components/marketing/delivery-list', () => ({
  DeliveryListClient: () => null,
}))

import { DeliveryListClient } from '@/components/marketing/delivery-list'

afterEach(cleanup)

const deliveries = [
  {
    id: 'del-1',
    deliveryDate: '2025-09-15T00:00:00Z',
    netBushels: 1000,
    unappliedBushels: 200,
    variant: { id: 'var-1', name: 'Yellow Corn', cropYear: 2025 },
    customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
    scaleTicketNum: 'SCL-001',
  },
  {
    id: 'del-2',
    deliveryDate: '2025-09-20T00:00:00Z',
    netBushels: 500,
    unappliedBushels: 0,
    variant: { id: 'var-1', name: 'Yellow Corn', cropYear: 2025 },
    customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
    scaleTicketNum: 'SCL-002',
  },
]

const baseProps = {
  deliveries,
  role: 'owner' as const,
}

describe('DeliveryListClient', () => {
  // DELIVERY-04: Row rendering
  it('renders a row for each delivery in props', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // DELIVERY-04: Unmatched row warning styling (unappliedBushels > 0)
  it('row with unappliedBushels > 0 has warning class text-glomalin-warning', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // DELIVERY-04: Fully applied row muted styling (unappliedBushels = 0)
  it('row with unappliedBushels = 0 has muted class text-glomalin-muted', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // DELIVERY-04: Log Delivery button opens drawer
  it('Log Delivery button opens the drawer', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // D-10: handleSaved uses window.location.reload not router.refresh
  it('handleSaved calls window.location.reload not router.refresh', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })
})
