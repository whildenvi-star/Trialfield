// GREEN phase — ApplyDeliveryClient tests.
// Run: npx vitest run src/components/marketing/delivery-apply.test.tsx

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { ApplyDeliveryClient } from '@/components/marketing/delivery-apply'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const delivery = {
  id: 'del-1',
  netBushels: 1000,
  unappliedBushels: 800,
  deliveryDate: '2025-09-15T00:00:00Z',
  variant: { id: 'var-1', name: 'Yellow Corn' },
  customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
}

// Single suggestion: pre-fill = min(5000, 800) = 800 → total=800, not overApplied
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
]

// Two-suggestion fixture for over-application test
const twoSuggestions = [
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

describe('ApplyDeliveryClient', () => {
  // DELIVERY-03: Client-side over-application guard (submit disabled)
  it('submit is disabled when total appliedBushels input exceeds unappliedBushels', () => {
    render(<ApplyDeliveryClient delivery={delivery} suggestions={twoSuggestions} />)

    // Default: con-1=800, con-2=800 → total=1600 > 800, button disabled
    const submitBtn = screen.getByRole('button', { name: /apply to contracts/i })
    expect(submitBtn).toHaveProperty('disabled', true)

    // Confirm with explicit over-application values
    const inputs = screen.getAllByRole('spinbutton')
    act(() => {
      fireEvent.change(inputs[0], { target: { value: '600' } })
      fireEvent.change(inputs[1], { target: { value: '300' } })
    })
    expect(submitBtn).toHaveProperty('disabled', true)
  })

  // DELIVERY-03: POST body shape for applications endpoint
  it('submit calls POST /api/cert-proxy/marketing/deliveries/[id]/applications with correct body', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )

    // Single suggestion: pre-fill = min(5000, 800) = 800 ≤ 800 → not overApplied
    render(<ApplyDeliveryClient delivery={delivery} suggestions={suggestions} />)

    // Change to 300 bu (under the 800 limit)
    const inputs = screen.getAllByRole('spinbutton')
    act(() => {
      fireEvent.change(inputs[0], { target: { value: '300' } })
    })

    const submitBtn = screen.getByRole('button', { name: /apply to contracts/i })
    expect(submitBtn).toHaveProperty('disabled', false)

    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/cert-proxy/marketing/deliveries/del-1/applications')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body).toEqual({
      applications: [{ contractId: 'con-1', appliedBushels: 300 }],
    })
  })

  // DELIVERY-03: Error message when sum of inputs exceeds delivery.unappliedBushels
  it('shows error when sum of inputs exceeds delivery.unappliedBushels', async () => {
    render(<ApplyDeliveryClient delivery={delivery} suggestions={twoSuggestions} />)

    // Default: total=1600 > 800 → submit triggers error (guard fires in handleSubmit)
    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('exceeds')
  })
})
