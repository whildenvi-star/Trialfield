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
})
