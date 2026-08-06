// GREEN after Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/contract-table.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ContractTable } from './contract-table'

afterEach(cleanup)

const OWNER_CONTRACT = {
  id: 'c1',
  instrument: 'PRICED' as const,
  contractedBushels: 10000,
  appliedBushels: 5000,
  futuresPrice: 500,
  basis: -18,
  finalCashPrice: 482,
  cropYear: 2025,
  deliveryStart: '2025-11-01',
  deliveryEnd: '2025-12-31',
  customer: { id: 'cu1', name: 'Acme Grain', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
  status: 'OPEN' as const,
}

// Office contract: price keys absent (stripFinancialFields behavior)
const OFFICE_CONTRACT = {
  id: 'c2',
  instrument: 'PRICED' as const,
  contractedBushels: 8000,
  appliedBushels: 0,
  cropYear: 2025,
  customer: { id: 'cu2', name: 'Beta Mill', shortCode: 'BTM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
  status: 'OPEN' as const,
}

const HTA_CONTRACT = {
  id: 'c3',
  instrument: 'FUTURES_FIXED' as const,
  contractedBushels: 5000,
  appliedBushels: 0,
  futuresPrice: 490,
  basis: null,
  finalCashPrice: null,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme Grain', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
  status: 'OPEN' as const,
}

// HTA with both legs set but no stored cash — table derives futures + basis
const HTA_BOTH_LEGS_CONTRACT = {
  id: 'c5',
  instrument: 'FUTURES_FIXED' as const,
  contractedBushels: 50000,
  appliedBushels: 0,
  futuresPrice: 4.59,
  basis: -0.1425,
  finalCashPrice: null,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme Grain', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
  status: 'OPEN' as const,
}

const PTF_CONTRACT = {
  id: 'c4',
  instrument: 'PRICED_LATER' as const,
  contractedBushels: 3000,
  appliedBushels: 0,
  cropYear: 2025,
  customer: { id: 'cu1', name: 'Acme Grain', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
  status: 'OPEN' as const,
}

describe('ContractTable', () => {
  it('RED: module exists and exports ContractTable component', () => {
    expect(typeof ContractTable).toBe('function')
  })

  it('renders customer and variant name in table rows', () => {
    render(<ContractTable contracts={[OWNER_CONTRACT]} role="owner" cropYear={2025} />)
    expect(screen.getByText('Acme Grain')).toBeTruthy()
    expect(screen.getAllByText('Yellow Corn').length).toBeGreaterThan(0)
  })

  it('owner role: renders futuresPrice — no dash for known price', () => {
    const { container } = render(<ContractTable contracts={[OWNER_CONTRACT]} role="owner" cropYear={2025} />)
    // futuresPrice=500 is present — Money renders a $ value, not a dash
    expect(container.textContent).toMatch(/\$/)
  })

  it('office role: renders "—" for futuresPrice when key is absent', () => {
    render(<ContractTable contracts={[OFFICE_CONTRACT as any]} role="office" cropYear={2025} />)
    // futuresPrice, basis, finalCashPrice all absent from OFFICE_CONTRACT
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('office role: renders "—" for basis when key is absent', () => {
    render(<ContractTable contracts={[OFFICE_CONTRACT as any]} role="office" cropYear={2025} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('office role: renders "—" for finalCashPrice when key is absent', () => {
    render(<ContractTable contracts={[OFFICE_CONTRACT as any]} role="office" cropYear={2025} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('derives cash (futures + basis) for HTA with both legs and no stored cash', () => {
    render(<ContractTable contracts={[HTA_BOTH_LEGS_CONTRACT as any]} role="owner" cropYear={2025} />)
    // 4.59 + (-0.1425) = 4.4475 → $4.45
    expect(screen.getByText('$4.45')).toBeTruthy()
    expect(screen.getByTitle('Derived: futures + basis')).toBeTruthy()
  })

  it('does NOT derive cash for HTA with futures only (basis unset)', () => {
    render(<ContractTable contracts={[HTA_CONTRACT as any]} role="owner" cropYear={2025} />)
    // basis and cash cells both show the dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByTitle('Derived: futures + basis')).toBeNull()
  })

  it('stored finalCashPrice is not marked as derived', () => {
    render(<ContractTable contracts={[OWNER_CONTRACT as any]} role="owner" cropYear={2025} />)
    expect(screen.queryByTitle('Derived: futures + basis')).toBeNull()
  })

  it('renders fractional-cent basis without rounding to whole cents', () => {
    render(<ContractTable contracts={[HTA_BOTH_LEGS_CONTRACT as any]} role="owner" cropYear={2025} />)
    expect(screen.getByText('-14.25¢')).toBeTruthy()
  })

  it('renders empty state when contracts array is empty', () => {
    render(<ContractTable contracts={[]} role="owner" cropYear={2025} />)
    expect(screen.getByText('No contracts for 2025')).toBeTruthy()
  })

  it('renders PRICED badge for PRICED instrument', () => {
    render(<ContractTable contracts={[OWNER_CONTRACT]} role="owner" cropYear={2025} />)
    const pricedMatches = screen.getAllByText('PRICED')
    expect(pricedMatches.length).toBeGreaterThan(0)
  })

  it('renders PTF badge for PRICED_LATER instrument', () => {
    render(<ContractTable contracts={[PTF_CONTRACT as any]} role="owner" cropYear={2025} />)
    expect(screen.getByText('PTF')).toBeTruthy()
  })

  it('renders HTA badge for FUTURES_FIXED instrument', () => {
    render(<ContractTable contracts={[HTA_CONTRACT]} role="owner" cropYear={2025} />)
    expect(screen.getByText('HTA')).toBeTruthy()
  })

  it('edit pencil links to the contracts page ?edit= deep-link (not a /edit route)', () => {
    const { container } = render(<ContractTable contracts={[OWNER_CONTRACT]} role="owner" cropYear={2025} />)
    const editLink = container.querySelector('a[aria-label="Edit contract"]')
    expect(editLink?.getAttribute('href')).toBe('/app/marketing/contracts?edit=c1')
  })
})

// Buyer-takes-all rows on the dashboard table: "All production" + delivered lbs.
describe('ContractTable — buyer takes all production', () => {
  const TAKE_ALL_CONTRACT = {
    id: 'c-ta',
    instrument: 'SPOT' as const,
    contractedBushels: 0,
    buyerTakesAll: true,
    appliedBushels: 13279,
    deliveredLbs: 743660.4,
    cropYear: 2025,
    customer: { id: 'cu3', name: 'KWS Cereals', shortCode: 'KWS' },
    variant: { id: 'v2', name: 'KWS Aviator Rye' },
    status: 'OPEN' as const,
  }

  it('shows "All production" instead of a bushel quantity', () => {
    render(<ContractTable contracts={[TAKE_ALL_CONTRACT]} role="owner" cropYear={2025} />)
    expect(screen.getByText('All production')).toBeTruthy()
  })

  it('shows delivered lbs instead of the delivery progress bar', () => {
    render(<ContractTable contracts={[TAKE_ALL_CONTRACT]} role="owner" cropYear={2025} />)
    expect(screen.getByText('743,660 lbs delivered')).toBeTruthy()
  })
})
