// RED phase — contract-table.tsx does not exist until Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/contract-table.test.tsx
// Expected now: FAIL (module not found). Expected after Plan 02: PASS.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractTable } from './contract-table'

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

describe('ContractTable', () => {
  it('RED: module exists and exports ContractTable component', () => {
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because contract-table.tsx does not exist yet.
    // Plan 02 Task 2 creates contract-table.tsx → this test turns GREEN.
    expect(typeof ContractTable).toBe('function')
  })

  it.todo('renders customer and variant name in table rows')
  // render(<ContractTable contracts={[OWNER_CONTRACT]} role="owner" cropYear={2025} />)
  // expect: "Acme Grain" and "Yellow Corn" visible

  it.todo('owner role: renders futuresPrice as Money component')
  // expect: "$5.00" or similar formatted value visible

  it.todo('office role: renders "—" for futuresPrice when key is absent')
  // render(<ContractTable contracts={[OFFICE_CONTRACT]} role="office" cropYear={2025} />)
  // expect: "—" in futures column (key absent, not null)

  it.todo('office role: renders "—" for basis when key is absent')

  it.todo('office role: renders "—" for finalCashPrice when key is absent')

  it.todo('renders empty state when contracts array is empty')
  // render(<ContractTable contracts={[]} role="owner" cropYear={2025} />)
  // expect: "No contracts for 2025" empty state

  it.todo('renders PRICED badge for PRICED instrument')
  it.todo('renders PTF badge for PRICED_LATER instrument')
  it.todo('renders HTA badge for FUTURES_FIXED instrument')
})
