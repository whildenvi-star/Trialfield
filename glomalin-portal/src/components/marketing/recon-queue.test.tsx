// GREEN after Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/recon-queue.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReconQueue } from './recon-queue'

afterEach(cleanup)

// Mock useRouter — recon-queue uses router.push
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const UNMATCHED_DELIVERY = {
  id: 'd1',
  deliveryDate: '2025-11-15',
  netBushels: 5000,
  unappliedBushels: 2000,
  customer: { id: 'cu1', name: 'Acme Grain', shortCode: 'ACM' },
  variant: { id: 'v1', name: 'Yellow Corn' },
}

const FULLY_MATCHED = {
  ...UNMATCHED_DELIVERY, id: 'd2', unappliedBushels: 0,
}

describe('ReconQueue', () => {
  it('RED: module exists and exports ReconQueue component', () => {
    expect(typeof ReconQueue).toBe('function')
  })

  it('renders empty state when deliveries array is empty', () => {
    render(<ReconQueue deliveries={[]} />)
    expect(screen.getByText('Queue is clear')).toBeTruthy()
  })

  it('renders delivery row for delivery with unappliedBushels > 0', () => {
    render(<ReconQueue deliveries={[UNMATCHED_DELIVERY]} />)
    // deliveryDate formatted as 'Nov 15, 2025' — check customer shortCode
    expect(screen.getByText('2,000 unmatched')).toBeTruthy()
  })

  it('filters out deliveries with unappliedBushels === 0', () => {
    render(<ReconQueue deliveries={[FULLY_MATCHED]} />)
    expect(screen.getByText('Queue is clear')).toBeTruthy()
  })

  it('renders Apply button for each unmatched delivery', () => {
    render(<ReconQueue deliveries={[UNMATCHED_DELIVERY]} />)
    expect(screen.getByText('Apply')).toBeTruthy()
  })

  it('shows count of unmatched deliveries in CardDescription', () => {
    render(<ReconQueue deliveries={[UNMATCHED_DELIVERY]} />)
    expect(screen.getByText('1 unmatched delivery')).toBeTruthy()
  })
})
