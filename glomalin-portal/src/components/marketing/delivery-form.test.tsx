// GREEN phase — DeliveryForm implemented; tests exercise real component behavior.
// Run: npx vitest run src/components/marketing/delivery-form.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  DeliveryForm,
  findPossibleDuplicates,
  DeliveryRow,
} from '@/components/marketing/delivery-form'

afterEach(() => {
  vi.restoreAllMocks()
})

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

// ─── Duplicate guard ───────────────────────────────────────────────────────

const existingDelivery = {
  id: 'del-existing',
  scaleTicketNum: 'T-100',
  customerId: 'cust-1',
  variantId: 'var-1',
  deliveryDate: '2025-10-15T12:00:00.000Z',
  netBushels: 1000,
  source: 'grain-ticket' as const,
  customer: { name: 'Test Elevator' },
  variant: { name: 'Yellow Corn' },
}

const baseForm = {
  scaleTicketNum: '',
  customerId: 'cust-1',
  variantId: 'var-1',
  deliveryDate: '2025-10-15',
  netBushels: '1000',
}

describe('findPossibleDuplicates', () => {
  it('matches on scale ticket number, trimmed and case-insensitive', () => {
    const matches = findPossibleDuplicates(
      { ...baseForm, customerId: 'other', variantId: 'other', deliveryDate: '2020-01-01', netBushels: '5', scaleTicketNum: '  t-100 ' },
      [existingDelivery]
    )
    expect(matches).toHaveLength(1)
  })

  it('matches on buyer + variant + same day + bushels within 2%', () => {
    const matches = findPossibleDuplicates({ ...baseForm, netBushels: '1015' }, [existingDelivery])
    expect(matches).toHaveLength(1)
  })

  it('does not match a different day or a >2% bushel delta', () => {
    expect(findPossibleDuplicates({ ...baseForm, deliveryDate: '2025-10-16' }, [existingDelivery])).toHaveLength(0)
    expect(findPossibleDuplicates({ ...baseForm, netBushels: '1100' }, [existingDelivery])).toHaveLength(0)
  })
})

describe('DeliveryForm duplicate warning', () => {
  beforeEach(() => {
    onSuccess.mockReset()
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
  })

  function fillMatchingForm() {
    fireEvent.change(screen.getByLabelText(/grain variant/i), { target: { name: 'variantId', value: 'var-1' } })
    fireEvent.change(screen.getByLabelText(/buyer/i), { target: { name: 'customerId', value: 'cust-1' } })
    fireEvent.change(screen.getByLabelText(/delivery date/i), { target: { name: 'deliveryDate', value: '2025-10-15' } })
    fireEvent.change(screen.getByLabelText(/net weight/i), { target: { name: 'netWeightLbs', value: '56000' } })
    fireEvent.change(screen.getByLabelText(/net bushels/i), { target: { name: 'netBushels', value: '1000' } })
  }

  it('first submit with a match shows the warning and does not fetch; "Log Anyway" submits', async () => {
    render(<DeliveryForm {...baseProps} existingDeliveries={[existingDelivery]} />)
    fillMatchingForm()

    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)

    expect(await screen.findByText(/possible duplicate/i)).toBeTruthy()
    expect(screen.getByText(/from grain ticket/i)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()

    fireEvent.submit(screen.getByRole('button', { name: /log anyway/i }).closest('form')!)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })

  it('changing a matched field resets the acknowledgment', async () => {
    render(<DeliveryForm {...baseProps} existingDeliveries={[existingDelivery]} />)
    fillMatchingForm()

    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)
    expect(await screen.findByText(/possible duplicate/i)).toBeTruthy()

    // Editing a matched field clears the warning and re-arms the guard
    fireEvent.change(screen.getByLabelText(/net bushels/i), { target: { name: 'netBushels', value: '1001' } })
    expect(screen.queryByText(/possible duplicate/i)).toBeNull()

    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)
    expect(await screen.findByText(/possible duplicate/i)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('clean form submits on first click with no warning', async () => {
    render(<DeliveryForm {...baseProps} existingDeliveries={[existingDelivery]} />)
    fillMatchingForm()
    fireEvent.change(screen.getByLabelText(/delivery date/i), { target: { name: 'deliveryDate', value: '2025-11-01' } })

    fireEvent.submit(screen.getByRole('button', { name: /log delivery/i }).closest('form')!)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByText(/possible duplicate/i)).toBeNull()
  })
})

// ─── Ticket-sourced read-only mode ─────────────────────────────────────────

const ticketSourcedDelivery: DeliveryRow = {
  id: 'del-ticket',
  farmId: 'farm-1',
  customerId: 'cust-1',
  variantId: 'var-1',
  deliveryDate: '2026-07-08T12:00:00.000Z',
  netWeightLbs: 54296,
  netBushels: 969.57,
  moisturePercent: 13.1,
  testWeightLbs: null,
  foreignMatterPct: null,
  scaleTicketNum: '4521',
  loadoutEventId: null,
  settlementLineId: null,
  notes: '[grain-ticket:529]',
  appliedBushels: 0,
  unappliedBushels: 969.57,
  source: 'grain-ticket',
  sourceTicketId: '529',
  customer: { id: 'cust-1', name: 'Test Elevator', shortCode: 'TE' },
  variant: { id: 'var-1', name: 'Yellow Corn' },
}

describe('DeliveryForm ticket-sourced read-only mode', () => {
  it('shows the sync banner, disables inputs, and hides the submit button', () => {
    render(<DeliveryForm {...baseProps} delivery={ticketSourcedDelivery} />)

    expect(screen.getByText(/synced from grain ticket #529/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /edit the ticket in grain tickets/i })).toBeTruthy()
    expect((document.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
  })

  it('manual delivery still renders an enabled form with submit', () => {
    render(
      <DeliveryForm
        {...baseProps}
        delivery={{ ...ticketSourcedDelivery, notes: null, source: 'manual', sourceTicketId: null }}
      />
    )

    expect(screen.queryByText(/synced from grain ticket/i)).toBeNull()
    expect((document.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
  })
})
