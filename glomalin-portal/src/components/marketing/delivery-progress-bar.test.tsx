// GREEN after Plan 02 Task 2.
// Run: npx vitest run src/components/marketing/delivery-progress-bar.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DeliveryProgressBar } from './delivery-progress-bar'

afterEach(cleanup)

describe('DeliveryProgressBar', () => {
  it('RED: module exists and exports DeliveryProgressBar component', () => {
    expect(typeof DeliveryProgressBar).toBe('function')
  })

  it('fill color is bg-glomalin-info when pct < 80', () => {
    const { container } = render(<DeliveryProgressBar applied={500} contracted={10000} />)
    const fill = container.querySelector('.bg-glomalin-info')
    expect(fill).toBeTruthy()
  })

  it('fill color is bg-glomalin-success when pct is between 80 and 99', () => {
    const { container } = render(<DeliveryProgressBar applied={8500} contracted={10000} />)
    const fill = container.querySelector('.bg-glomalin-success')
    expect(fill).toBeTruthy()
  })

  it('fill color is bg-glomalin-warning when pct is 100 or more', () => {
    const { container } = render(<DeliveryProgressBar applied={10000} contracted={10000} />)
    const fill = container.querySelector('.bg-glomalin-warning')
    expect(fill).toBeTruthy()
  })

  it('clamps pct at 100 when applied exceeds contracted', () => {
    const { container } = render(<DeliveryProgressBar applied={12000} contracted={10000} />)
    const fill = container.querySelector('.bg-glomalin-warning') as HTMLElement | null
    expect(fill).toBeTruthy()
    expect(fill?.style.width).toBe('100%')
  })

  it('renders 0% when contracted is 0 (no division by zero)', () => {
    const { container } = render(<DeliveryProgressBar applied={0} contracted={0} />)
    const fill = container.querySelector('.bg-glomalin-info') as HTMLElement | null
    expect(fill).toBeTruthy()
    expect(fill?.style.width).toBe('0%')
  })

  it('renders formatted bu text below bar', () => {
    const { container } = render(<DeliveryProgressBar applied={5000} contracted={10000} />)
    const text = container.textContent ?? ''
    expect(text).toContain('/')
  })
})
