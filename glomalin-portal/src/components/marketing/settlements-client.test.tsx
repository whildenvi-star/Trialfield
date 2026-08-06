// GREEN phase — SettlementsClient + unitsSanityWarning.
// Run: npx vitest run src/components/marketing/settlements-client.test.tsx

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { SettlementsClient, unitsSanityWarning } from '@/components/marketing/settlements-client'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// KWS Aviator acceptance fixture (PO 5400000312) — verbatim from 16-CONTEXT.md <specifics>
const AVIATOR_SETTLEMENT = {
  id: 'lot-1',
  lotNumber: 'AV07A-B5Q-01B',
  grossLbs: 835780,
  finishedLbs: 743660,
  germPct: 98,
  purityPct: 99.99,
  seedsPerLb: 17532,
  lbsPerUnit: 59,
  units: 12604,
  settlementDate: null,
  notes: null,
}

const BASE_CONTRACT = {
  id: 'con-1',
  cropYear: 2025,
  paymentBasis: 'PER_UNIT',
  customer: { id: 'cust-1', name: 'KWS', shortCode: 'KWS' },
  variant: { id: 'var-1', name: 'Aviator Hybrid Rye' },
  contractedUnits: 12604,
}

// Owner-role reconciliation — settledRevenue present
const OWNER_RECONCILIATION = {
  physicalDeliveredLbs: 743660,
  sumGrossLbs: 835780,
  sumFinishedLbs: 743660,
  shrinkPct: 0.110221,
  sumUnits: 12604,
  contractedUnits: 12604,
  settledRevenue: 154399,
}

// Office-role reconciliation — settledRevenue KEY OMITTED entirely (Pitfall 7), not null
const OFFICE_RECONCILIATION = {
  physicalDeliveredLbs: 743660,
  sumGrossLbs: 835780,
  sumFinishedLbs: 743660,
  shrinkPct: 0.110221,
  sumUnits: 12604,
  contractedUnits: 12604,
}

describe('unitsSanityWarning', () => {
  // D-02: 743660 / 59 = 12604.4067 vs entered 12604 -> 0.003% divergence -> no warning
  it('returns null for the Aviator fixture (743660 / 59 vs entered 12604 — 0.003% divergence)', () => {
    expect(unitsSanityWarning(743660, 59, 12604)).toBeNull()
  })

  // D-02: dropped digit — entered 1260 instead of 12604 -> ~90% divergence -> warning
  it("returns a warning containing 'check for a typo' when a digit is dropped (entered 1260)", () => {
    const result = unitsSanityWarning(743660, 59, 1260)
    expect(typeof result).toBe('string')
    expect(result).toContain('check for a typo')
  })

  it('returns null when lbsPerUnit is 0 or non-finite instead of dividing by zero', () => {
    expect(unitsSanityWarning(743660, 0, 12604)).toBeNull()
    expect(unitsSanityWarning(743660, NaN, 12604)).toBeNull()
  })
})

describe('SettlementsClient', () => {
  it('renders one table row per settlement with lot number, finished lbs, lbs/unit and units', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[AVIATOR_SETTLEMENT]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    const tbody = document.querySelector('tbody')!
    const row = within(tbody).getByText('AV07A-B5Q-01B').closest('tr')!
    expect(within(row).getByText('743,660')).toBeTruthy()
    expect(within(row).getByText('59')).toBeTruthy()
    expect(within(row).getByText('12,604')).toBeTruthy()
  })

  it('renders the empty state "No lots settled yet." when settlements is an empty array', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    expect(screen.getByText('No lots settled yet.')).toBeTruthy()
  })

  it('renders the reconciliation panel rows: Physical Delivered Lbs, Sum Finished Lbs, Shrink %, Sum Units', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[AVIATOR_SETTLEMENT]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    expect(screen.getByText(/physical delivered lbs/i)).toBeTruthy()
    expect(screen.getByText(/sum finished lbs/i)).toBeTruthy()
    expect(screen.getByText(/shrink %/i)).toBeTruthy()
    expect(screen.getByText(/sum units/i)).toBeTruthy()
  })

  // D-03: owner sees settledRevenue
  it('renders the Settled Revenue row when settledRevenue is present in reconciliation (owner)', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[AVIATOR_SETTLEMENT]}
        reconciliation={OWNER_RECONCILIATION}
      />
    )

    expect(screen.getByText(/settled revenue/i)).toBeTruthy()
  })

  // D-03 + Pitfall 7: office does not — key-absent, not null
  it('does NOT render a Settled Revenue row when the settledRevenue key is absent from reconciliation (office)', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[AVIATOR_SETTLEMENT]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    expect(screen.queryByText(/settled revenue/i)).toBeNull()
  })

  // D-02: warning banner below the Units field
  it('shows the non-blocking D-02 warning banner below the Units field when entered units diverge more than 1%', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add Lot' })[0])
    fireEvent.change(screen.getByLabelText(/finished lbs/i), { target: { value: '743660' } })
    fireEvent.change(screen.getByLabelText(/lbs\/unit/i), { target: { value: '59' } })
    fireEvent.change(screen.getByLabelText(/units/i), { target: { value: '1260' } })

    expect(screen.getByText(/check for a typo/i)).toBeTruthy()
  })

  // D-02: warning never blocks save
  it('keeps the Save Lot button ENABLED while the D-02 warning is displayed — the warning never blocks save', () => {
    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add Lot' })[0])
    fireEvent.change(screen.getByLabelText(/finished lbs/i), { target: { value: '743660' } })
    fireEvent.change(screen.getByLabelText(/lbs\/unit/i), { target: { value: '59' } })
    fireEvent.change(screen.getByLabelText(/units/i), { target: { value: '1260' } })

    expect(screen.getByText(/check for a typo/i)).toBeTruthy()
    const submitBtn = screen.getByRole('button', { name: /save lot/i })
    expect(submitBtn).toHaveProperty('disabled', false)
  })

  it('POSTs to /api/cert-proxy/marketing/contracts/{id}/settlements with numeric finishedLbs, lbsPerUnit and units', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    })

    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add Lot' })[0])
    fireEvent.change(screen.getByLabelText(/lot number/i), { target: { value: 'AV07A-B5Q-01B' } })
    fireEvent.change(screen.getByLabelText(/finished lbs/i), { target: { value: '743660' } })
    fireEvent.change(screen.getByLabelText(/lbs\/unit/i), { target: { value: '59' } })
    fireEvent.change(screen.getByLabelText(/units/i), { target: { value: '12604' } })

    fireEvent.submit(screen.getByRole('button', { name: /save lot/i }).closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/cert-proxy/marketing/contracts/con-1/settlements')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(typeof body.finishedLbs).toBe('number')
    expect(typeof body.lbsPerUnit).toBe('number')
    expect(typeof body.units).toBe('number')
  })

  it('sends optional empty fields (grossLbs, germPct, purityPct, seedsPerLb, notes) as null not empty string', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    })

    render(
      <SettlementsClient
        contractId="con-1"
        contract={BASE_CONTRACT}
        settlements={[]}
        reconciliation={OFFICE_RECONCILIATION}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: '+ Add Lot' })[0])
    fireEvent.change(screen.getByLabelText(/lot number/i), { target: { value: 'AV07A-B5Q-01B' } })
    fireEvent.change(screen.getByLabelText(/finished lbs/i), { target: { value: '743660' } })
    fireEvent.change(screen.getByLabelText(/lbs\/unit/i), { target: { value: '59' } })
    fireEvent.change(screen.getByLabelText(/units/i), { target: { value: '12604' } })

    fireEvent.submit(screen.getByRole('button', { name: /save lot/i }).closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    expect(body.grossLbs).toBeNull()
    expect(body.germPct).toBeNull()
    expect(body.purityPct).toBeNull()
    expect(body.seedsPerLb).toBeNull()
    expect(body.notes).toBeNull()
  })
})
