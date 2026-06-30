// GREEN phase — ContractForm implemented; tests exercise real component behavior.
// Run: npx vitest run src/components/marketing/contract-form.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContractForm } from '@/components/marketing/contract-form'

const customers = [{ id: 'cust-1', name: 'Test Elevator', shortCode: 'TE', type: 'ELEVATOR' }]
const variants = [{ id: 'var-1', name: 'Yellow Corn', cropYear: 2025, commodity: { name: 'Corn' } }]
const onSuccess = vi.fn()

const baseProps = {
  customers,
  variants,
  onSuccess,
  open: true,
}

// Minimal contract for edit mode tests
const existingContract = {
  id: 'contract-1',
  instrument: 'PRICED' as const,
  contractedBushels: 5000,
  appliedBushels: 0,
  futuresPrice: 4.85,
  basis: -0.35,
  cropYear: 2025,
  customerId: 'cust-1',
  variantId: 'var-1',
  paymentBasis: 'PER_BUSHEL',
  status: 'OPEN' as const,
}

describe('ContractForm', () => {
  // CONTRACT-01: Create mode renders with empty fields and no customer selected
  it('renders create mode with empty contracted bushels and no customer selected when contract prop is null', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    // Customer select starts empty
    const customerSelect = screen.getByRole('combobox', { name: /customer/i })
    expect(customerSelect).toBeDefined()
    expect((customerSelect as HTMLSelectElement).value).toBe('')

    // Contracted Bushels input starts empty
    const bushelsInput = screen.getByRole('spinbutton', { name: /contracted bushels/i })
    expect(bushelsInput).toBeDefined()
    expect((bushelsInput as HTMLInputElement).value).toBe('')

    // Current year is pre-populated in cropYear
    const currentYear = String(new Date().getFullYear())
    const cropYearInput = screen.getByDisplayValue(currentYear)
    expect(cropYearInput).toBeDefined()
  })

  // CONTRACT-02: Instrument-driven field visibility (futuresPrice + basis)
  it('shows futuresPrice field when instrument is PRICED', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'PRICED' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).not.toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /basis/i })).not.toBeNull()
  })

  it('shows futuresPrice field when instrument is FUTURES_FIXED', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'FUTURES_FIXED' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).not.toBeNull()
    // basis is NOT shown for FUTURES_FIXED
    expect(screen.queryByRole('spinbutton', { name: /^basis/i })).toBeNull()
  })

  it('hides futuresPrice field when instrument is PRICED_LATER', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'PRICED_LATER' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /^basis/i })).toBeNull()
  })

  it('shows basis field when instrument is BASIS_FIXED', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'BASIS_FIXED' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /^basis/i })).not.toBeNull()
  })

  it('shows basis field when instrument is FOB', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'FOB' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /^basis/i })).not.toBeNull()
  })

  it('hides basis field when instrument is SPOT', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const instrumentSelect = screen.getByRole('combobox', { name: /instrument type/i })
    fireEvent.change(instrumentSelect, { target: { value: 'SPOT' } })

    expect(screen.queryByRole('spinbutton', { name: /futures price/i })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /^basis/i })).toBeNull()
  })

  // CONTRACT-03: Edit mode pre-fills fields
  it('renders edit mode with contract fields pre-filled when contract prop is provided', () => {
    render(<ContractForm {...baseProps} contract={existingContract} />)

    const bushelsInput = screen.getByRole('spinbutton', { name: /contracted bushels/i })
    expect((bushelsInput as HTMLInputElement).value).toBe('5000')
  })

  it('renders futuresPrice input as disabled in edit mode', () => {
    render(<ContractForm {...baseProps} contract={existingContract} />)

    // existingContract instrument is PRICED, which shows futuresPrice
    const futuresPriceInput = screen.getByRole('spinbutton', { name: /futures price/i })
    expect((futuresPriceInput as HTMLInputElement).disabled).toBe(true)
  })

  // SPECIALTY-01: PER_ACRE triggers Seed Corn Details
  it('shows Seed Corn Details section when paymentBasis is PER_ACRE', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const paymentBasisSelect = screen.getByRole('combobox', { name: /payment basis/i })
    fireEvent.change(paymentBasisSelect, { target: { value: 'PER_ACRE' } })

    expect(screen.queryByText('— Seed Corn Details —')).not.toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /acres irrigated/i })).not.toBeNull()
  })

  it('hides Seed Corn Details section when paymentBasis is PER_BUSHEL', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    // Default is PER_BUSHEL
    expect(screen.queryByText('— Seed Corn Details —')).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /acres irrigated/i })).toBeNull()
  })

  // SPECIALTY-02: PER_UNIT triggers Seed Unit Details
  it('shows Seed Unit Details section when paymentBasis is PER_UNIT', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const paymentBasisSelect = screen.getByRole('combobox', { name: /payment basis/i })
    fireEvent.change(paymentBasisSelect, { target: { value: 'PER_UNIT' } })

    expect(screen.queryByText('— Seed Unit Details —')).not.toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /contracted units/i })).not.toBeNull()
    // Seed Corn Details must NOT be shown
    expect(screen.queryByText('— Seed Corn Details —')).toBeNull()
  })

  // SPECIALTY-03: PER_TON triggers Canning Crop Details
  it('shows Canning Crop Details section when paymentBasis is PER_TON', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const paymentBasisSelect = screen.getByRole('combobox', { name: /payment basis/i })
    fireEvent.change(paymentBasisSelect, { target: { value: 'PER_TON' } })

    expect(screen.queryByText('— Canning Crop Details —')).not.toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /base rate per ton/i })).not.toBeNull()
  })

  // SPECIALTY-04: IP / Seed Premium checkbox controls ContractPremium section
  it('shows Contract Premium section when Add IP / Seed Premium checkbox is checked', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    const checkbox = screen.getByRole('checkbox', { name: /add ip \/ seed premium/i })
    fireEvent.click(checkbox)

    expect(screen.queryByText('— Contract Premium —')).not.toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /base premium/i })).not.toBeNull()
  })

  it('hides Contract Premium section by default', () => {
    render(<ContractForm {...baseProps} contract={null} />)

    expect(screen.queryByText('— Contract Premium —')).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: /base premium/i })).toBeNull()
  })
})
