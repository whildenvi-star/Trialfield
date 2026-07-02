// RED phase — DeliveryForm stubs; all tests fail intentionally.
// Wave 2b will implement DeliveryForm and turn these GREEN.
// Run: npx vitest run src/components/marketing/delivery-form.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/marketing/delivery-form', () => ({
  DeliveryForm: () => null,
}))

import { DeliveryForm } from '@/components/marketing/delivery-form'

const customers = [{ id: 'cust-1', name: 'Test Elevator', shortCode: 'TE', type: 'ELEVATOR' }]
const variants = [{ id: 'var-1', name: 'Yellow Corn', cropYear: 2025, commodity: { name: 'Corn' } }]
const onSuccess = vi.fn()

const baseProps = {
  customers,
  variants,
  onSuccess,
  open: true,
}

describe('DeliveryForm', () => {
  beforeEach(() => {
    onSuccess.mockReset()
  })

  // DELIVERY-01: Required fields presence
  it('renders required fields: variantId, customerId, deliveryDate, netWeightLbs, netBushels', () => {
    expect(true).toBe(false) // TODO: implement in Wave 2b
  })

  // DELIVERY-01: Optional grade factor fields presence
  it('renders optional grade factor fields: moisturePercent, testWeightLbs, foreignMatterPct', () => {
    expect(true).toBe(false) // TODO: implement in Wave 2b
  })

  // DELIVERY-01: Scale ticket field presence
  it('renders scaleTicketNum field', () => {
    expect(true).toBe(false) // TODO: implement in Wave 2b
  })

  // DELIVERY-01: POST body on submit includes required fields with correct types
  it('POST body on submit includes required fields with correct types', async () => {
    expect(true).toBe(false) // TODO: implement in Wave 2b
  })

  // DELIVERY-01: Grade factors absent from POST body when left empty (null not string)
  it('grade factors absent from POST body when left empty', async () => {
    expect(true).toBe(false) // TODO: implement in Wave 2b
  })
})
