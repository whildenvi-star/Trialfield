// RED phase — delivery-progress-bar.tsx does not exist until Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/delivery-progress-bar.test.tsx
// Expected now: FAIL (module not found). Expected after Plan 02: PASS.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DeliveryProgressBar } from './delivery-progress-bar'

describe('DeliveryProgressBar', () => {
  it('RED: module exists and exports DeliveryProgressBar component', () => {
    // This test exists solely to confirm the module resolves correctly.
    // It FAILS in RED phase because delivery-progress-bar.tsx does not exist yet.
    // Plan 02 Task 2 creates delivery-progress-bar.tsx → this test turns GREEN.
    expect(typeof DeliveryProgressBar).toBe('function')
  })

  it.todo('fill color is bg-glomalin-info when pct < 80')
  // render(<DeliveryProgressBar applied={500} contracted={10000} />)  → 5% → info
  // expect: fill div has class "bg-glomalin-info"

  it.todo('fill color is bg-glomalin-success when pct is between 80 and 99')
  // render(<DeliveryProgressBar applied={8500} contracted={10000} />)  → 85% → success
  // expect: fill div has class "bg-glomalin-success"

  it.todo('fill color is bg-glomalin-warning when pct is 100 or more')
  // render(<DeliveryProgressBar applied={10000} contracted={10000} />)  → 100% → warning
  // expect: fill div has class "bg-glomalin-warning"

  it.todo('clamps pct at 100 when applied exceeds contracted')
  // render(<DeliveryProgressBar applied={12000} contracted={10000} />)
  // expect: style.width is "100%", class is "bg-glomalin-warning"

  it.todo('renders 0% when contracted is 0 (no division by zero)')
  // render(<DeliveryProgressBar applied={0} contracted={0} />)
  // expect: style.width is "0%"

  it.todo('renders formatted bu text below bar')
  // expect text content includes "/" separator between applied and contracted bu
})
