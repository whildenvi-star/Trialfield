// RED phase — recon-queue.tsx does not exist until Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/recon-queue.test.tsx
// Expected now: FAIL (module not found). Expected after Plan 02: PASS.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReconQueue } from './recon-queue'

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
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because recon-queue.tsx does not exist yet.
    // Plan 02 Task 2 creates recon-queue.tsx → this test turns GREEN.
    expect(typeof ReconQueue).toBe('function')
  })

  it.todo('renders empty state when deliveries array is empty')
  // render(<ReconQueue deliveries={[]} />)
  // expect: "Queue is clear" text

  it.todo('renders delivery row for delivery with unappliedBushels > 0')
  // render(<ReconQueue deliveries={[UNMATCHED_DELIVERY]} />)
  // expect: delivery date, customer shortCode, "2,000 bu unmatched" visible

  it.todo('filters out deliveries with unappliedBushels === 0')
  // render(<ReconQueue deliveries={[FULLY_MATCHED]} />)
  // expect: "Queue is clear" empty state (defensively filtered even if API passes 0)

  it.todo('renders Apply button for each unmatched delivery')
  // expect: button with text "Apply" present

  it.todo('shows count of unmatched deliveries in CardDescription')
  // render(<ReconQueue deliveries={[UNMATCHED_DELIVERY]} />)
  // expect: "1 unmatched delivery" or similar
})
