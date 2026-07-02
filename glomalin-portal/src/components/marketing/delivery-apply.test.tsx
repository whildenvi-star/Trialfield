// RED phase — ApplyDeliveryClient stubs; all tests fail intentionally.
// Wave 3 will implement ApplyDeliveryClient and turn these GREEN.
// Run: npx vitest run src/components/marketing/delivery-apply.test.tsx

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/components/marketing/delivery-apply', () => ({
  ApplyDeliveryClient: () => null,
}))

import { ApplyDeliveryClient } from '@/components/marketing/delivery-apply'

afterEach(cleanup)

const delivery = {
  id: 'del-1',
  netBushels: 1000,
  unappliedBushels: 800,
  deliveryDate: '2025-09-15T00:00:00Z',
  variant: { id: 'var-1', name: 'Yellow Corn', cropYear: 2025 },
  customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
}

const suggestions = [
  {
    contract: {
      id: 'con-1',
      variantId: 'var-1',
      customerId: 'cust-1',
      openBushels: 5000,
      contractedBushels: 10000,
    },
    score: 100,
  },
  {
    contract: {
      id: 'con-2',
      variantId: 'var-1',
      customerId: 'cust-1',
      openBushels: 2000,
      contractedBushels: 5000,
    },
    score: 70,
  },
]

const baseProps = {
  delivery,
  suggestions,
}

describe('ApplyDeliveryClient', () => {
  // DELIVERY-03: Client-side over-application guard (submit disabled)
  it('submit is disabled when total appliedBushels input exceeds unappliedBushels', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // DELIVERY-03: POST body shape for applications endpoint
  it('submit calls POST /api/cert-proxy/marketing/deliveries/[id]/applications with correct body', async () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })

  // DELIVERY-03: Error message when sum of inputs exceeds delivery.unappliedBushels
  it('shows error when sum of inputs exceeds delivery.unappliedBushels', () => {
    expect(true).toBe(false) // TODO: implement in Wave 3
  })
})
