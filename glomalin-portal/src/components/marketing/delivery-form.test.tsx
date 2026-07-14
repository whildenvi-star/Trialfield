// GREEN phase — DeliveryForm implemented; tests exercise real component behavior.
// Run: npx vitest run src/components/marketing/delivery-form.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeliveryForm } from '@/components/marketing/delivery-form'

const customers = [{ id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' }]
const variants = [{ id: 'var-1', name: 'Yellow Corn' }]
const onSuccess = vi.fn()

const baseProps = {
  customers,
  variants,
  onSuccess,
  open: true,
  delivery: null,
}

describe('DeliveryForm', () => {
  beforeEach(() => {
    onSuccess.mockReset()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)
  })

  // DELIVERY-01: Required fields presence
  it('renders required fields: variantId, customerId, deliveryDate, netWeightLbs, netBushels', () => {
    render(<DeliveryForm {...baseProps} />)

    // Grain Variant select
    expect(screen.getByLabelText(/grain variant/i)).toBeDefined()
    // Buyer select
    expect(screen.getByLabelText(/buyer/i)).toBeDefined()
    // Delivery Date input
    expect(screen.getByLabelText(/delivery date/i)).toBeDefined()
    // Net Weight input
    expect(screen.getByLabelText(/net weight/i)).toBeDefined()
    // Net Bushels input
    expect(screen.getByLabelText(/net bushels/i)).toBeDefined()
  })

  // DELIVERY-01: Optional grade factor fields presence
  it('renders optional grade factor fields: moisturePercent, testWeightLbs, foreignMatterPct', () => {
    render(<DeliveryForm {...baseProps} />)

    expect(screen.getByLabelText(/moisture %/i)).toBeDefined()
    expect(screen.getByLabelText(/test weight/i)).toBeDefined()
    expect(screen.getByLabelText(/foreign matter %/i)).toBeDefined()
  })

  // DELIVERY-01: Scale ticket field presence
  it('renders scaleTicketNum field', () => {
    render(<DeliveryForm {...baseProps} />)

    expect(screen.getByLabelText(/scale ticket/i)).toBeDefined()
  })

  // DELIVERY-01: POST body on submit includes required fields with correct types
  it('POST body on submit includes required fields with correct types', async () => {
    render(<DeliveryForm {...baseProps} />)

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/grain variant/i), {
      target: { name: 'variantId', value: 'var-1' },
    })
    fireEvent.change(screen.getByLabelText(/buyer/i), {
      target: { name: 'customerId', value: 'cust-1' },
    })
    fireEvent.change(screen.getByLabelText(/delivery date/i), {
      target: { name: 'deliveryDate', value: '2025-10-15' },
    })
    fireEvent.change(screen.getByLabelText(/net weight/i), {
      target: { name: 'netWeightLbs', value: '56200' },
    })
    fireEvent.change(screen.getByLabelText(/net bushels/i), {
      target: { name: 'netBushels', value: '1004.5' },
    })

    // Submit
    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body as string)

    expect(typeof body.netWeightLbs).toBe('number')
    expect(body.netWeightLbs).toBe(56200)
    expect(typeof body.netBushels).toBe('number')
    expect(body.netBushels).toBe(1004.5)
    expect(opts.method).toBe('POST')
  })

  // DELIVERY-01: Grade factors absent from POST body when left empty (null not string)
  it('grade factors absent from POST body when left empty', async () => {
    render(<DeliveryForm {...baseProps} />)

    // Fill only required fields; leave grade factors empty
    fireEvent.change(screen.getByLabelText(/grain variant/i), {
      target: { name: 'variantId', value: 'var-1' },
    })
    fireEvent.change(screen.getByLabelText(/buyer/i), {
      target: { name: 'customerId', value: 'cust-1' },
    })
    fireEvent.change(screen.getByLabelText(/delivery date/i), {
      target: { name: 'deliveryDate', value: '2025-10-15' },
    })
    fireEvent.change(screen.getByLabelText(/net weight/i), {
      target: { name: 'netWeightLbs', value: '56200' },
    })
    fireEvent.change(screen.getByLabelText(/net bushels/i), {
      target: { name: 'netBushels', value: '1004.5' },
    })

    // Submit with empty grade factors
    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body as string)

    // Empty grade factors must be null, not empty string
    expect(body.moisturePercent).toBeNull()
    expect(body.testWeightLbs).toBeNull()
    expect(body.foreignMatterPct).toBeNull()
  })
})
