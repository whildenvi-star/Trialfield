// Run: npx vitest run src/components/marketing/variant-contract-rows.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariantContractRows, contractNumber } from './variant-contract-rows'
import type { PoolCardContract } from './crop-pool-cards'

afterEach(cleanup)

const HTA: PoolCardContract = {
  id: 'ck1abcdef123456',
  instrument: 'FUTURES_FIXED',
  contractedBushels: 50000,
  futuresPrice: 4.59,
  basis: -0.1425,
  finalCashPrice: null,
  deliveryStart: '2026-10-01T00:00:00.000Z',
  deliveryEnd: '2026-11-30T00:00:00.000Z',
  notes: 'DeLong #F302915 (Active Contracts Report 04/27/26)',
  customer: { id: 'cu1', name: 'The DeLong Co. Inc.', shortCode: 'DELONG' },
  variant: { name: 'Shell Corn' },
  status: 'OPEN',
}

// Basis leg not yet set — the open-basis case the card badges at the top.
const HTA_OPEN_BASIS: PoolCardContract = {
  ...HTA,
  id: 'ck2zzzzzz999999',
  contractedBushels: 20000,
  futuresPrice: 4.79,
  basis: null,
  notes: 'DeLong #F303044',
}

const VARIANTS = [{ variantName: 'Shell Corn', projectedBu: 90000, soldBu: 70000 }]
const BY_VARIANT = { 'shell corn': [HTA, HTA_OPEN_BASIS] }

function renderRows(isOwner = true) {
  return render(
    <table>
      <VariantContractRows
        variants={VARIANTS}
        contractsByVariant={BY_VARIANT}
        isOwner={isOwner}
      />
    </table>
  )
}

describe('contractNumber', () => {
  it('parses the buyer number out of the notes tag', () => {
    expect(contractNumber(HTA)).toBe('F302915')
  })

  it('falls back to a short id when no number was tagged', () => {
    expect(contractNumber({ ...HTA, notes: 'hand entered' })).toBe('123456')
  })
})

describe('VariantContractRows', () => {
  it('collapses contracts until the variety is selected', () => {
    renderRows()
    expect(screen.queryByText('F302915')).toBeNull()
    // count badge tells you there is something to open
    expect(
      screen.getByRole('button', { name: /Shell Corn/ }).getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('reveals contract number, bushels, price legs, and basis on expand', async () => {
    const user = userEvent.setup()
    renderRows()
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))

    expect(screen.getByText('F302915')).toBeDefined()
    expect(screen.getByText('50,000')).toBeDefined()
    expect(screen.getByText('$4.59/bu')).toBeDefined()
    expect(screen.getByText('-14.25¢')).toBeDefined()
    // cash = futures + basis
    expect(screen.getByText('$4.45/bu')).toBeDefined()
  })

  it('flags a contract whose basis leg is still open', async () => {
    const user = userEvent.setup()
    renderRows()
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))
    expect(screen.getByText('open')).toBeDefined()
  })

  it('hides price and basis columns from the office role', async () => {
    const user = userEvent.setup()
    renderRows(false)
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))

    expect(screen.getByText('F302915')).toBeDefined()
    expect(screen.getByText('50,000')).toBeDefined()
    expect(screen.queryByText('Basis')).toBeNull()
    expect(screen.queryByText('$4.59/bu')).toBeNull()
  })

  it('renders a variety with no contracts as plain text', () => {
    render(
      <table>
        <VariantContractRows
          variants={[{ variantName: 'Blue Corn', soldBu: 0, projectedBu: 4000 }]}
          contractsByVariant={{}}
          isOwner
        />
      </table>
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Blue Corn')).toBeDefined()
  })

  it('opens one variety at a time', async () => {
    const user = userEvent.setup()
    render(
      <table>
        <VariantContractRows
          variants={[
            { variantName: 'Shell Corn', soldBu: 70000 },
            { variantName: 'Non-GMO Yellow Corn', soldBu: 548 },
          ]}
          contractsByVariant={{
            'shell corn': [HTA],
            'non-gmo yellow corn': [
              { ...HTA, id: 'ck3', notes: 'DeLong #0034400', variant: { name: 'Non-GMO Yellow Corn' } },
            ],
          }}
          isOwner
        />
      </table>
    )
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))
    expect(screen.getByText('F302915')).toBeDefined()

    await user.click(screen.getByRole('button', { name: /Non-GMO Yellow Corn/ }))
    expect(screen.getByText('0034400')).toBeDefined()
    expect(screen.queryByText('F302915')).toBeNull()
  })
})

describe('edit deep-link', () => {
  it('links the contract number at the edit drawer, not a bare id param', async () => {
    const user = userEvent.setup()
    renderRows()
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))
    expect(screen.getByText('F302915').getAttribute('href')).toBe(
      '/app/marketing/contracts?edit=ck1abcdef123456'
    )
  })

  it('navigates on a click anywhere in the contract row', async () => {
    const user = userEvent.setup()
    const assigned: string[] = []
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() { return '' },
        set href(v: string) { assigned.push(v) },
      },
    })

    renderRows()
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))
    // the bushels cell — not the contract-number link
    await user.click(screen.getByText('50,000'))

    if (original) Object.defineProperty(window, 'location', original)
    expect(assigned).toEqual(['/app/marketing/contracts?edit=ck1abcdef123456'])
  })
})

describe('delivery window', () => {
  it('shows the contract delivery window', async () => {
    const user = userEvent.setup()
    renderRows()
    await user.click(screen.getByRole('button', { name: /Shell Corn/ }))
    const cells = within(screen.getByText('F302915').closest('tr') as HTMLElement)
    expect(cells.getByText('10/01–11/30')).toBeDefined()
  })
})
