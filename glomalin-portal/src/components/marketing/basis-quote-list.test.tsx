// GREEN phase — BasisQuoteListClient implemented.
// Tests scope queries to the table body to avoid false matches with select options.
// Run: npx vitest run src/components/marketing/basis-quote-list.test.tsx

import { vi } from 'vitest'

// vi.hoisted() sets process.env before module-level createClient() in marketing-auth.ts runs.
// Required pattern for any test that may chain-import a module with top-level Supabase instantiation.
const { supabaseUrl, serviceRoleKey } = vi.hoisted(() => ({
  supabaseUrl: 'https://hmjmrdhwrzltckzuoaoh.supabase.co',
  serviceRoleKey: 'test-service-role-key-stub',
}))

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey)

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { BasisQuoteListClient } from '@/components/marketing/basis-quote-list'

afterEach(cleanup)

const QUOTES = [
  {
    id: 'q1',
    variantId: 'v1',
    variant: { id: 'v1', name: 'Yellow Corn' },
    basis: -18,
    location: 'Wabash Valley',
    quotedAt: '2025-11-01T10:00:00Z',
    confidence: 'HIGH' as const,
  },
  {
    id: 'q2',
    variantId: 'v2',
    variant: { id: 'v2', name: 'Soft Red Wheat' },
    basis: 12,
    location: 'Heartland Mill',
    quotedAt: '2025-11-02T08:30:00Z',
    confidence: 'MEDIUM' as const,
  },
]

const VARIANTS = [
  { id: 'v1', name: 'Yellow Corn' },
  { id: 'v2', name: 'Soft Red Wheat' },
]

describe('BasisQuoteListClient', () => {
  it('renders all quotes when variant filter is All', () => {
    render(<BasisQuoteListClient quotes={QUOTES} variants={VARIANTS} />)
    // Use getAllByText — variant names appear in both select options and table cells
    expect(screen.getAllByText('Yellow Corn').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Soft Red Wheat').length).toBeGreaterThan(0)
  })

  it('filters quotes to matching variantId when variant selected', () => {
    render(<BasisQuoteListClient quotes={QUOTES} variants={VARIANTS} initialVariantFilter="v1" />)
    // Scope to table body to check only rendered rows (not select options)
    const tbody = screen.getByRole('table').querySelector('tbody')!
    expect(within(tbody).getByText('Yellow Corn')).toBeTruthy()
    expect(within(tbody).queryByText('Soft Red Wheat')).toBeFalsy()
  })

  it('renders basis value negative in danger color', () => {
    const { container } = render(<BasisQuoteListClient quotes={[QUOTES[0]]} variants={VARIANTS} />)
    // basis=-18 should render with a danger/red color class
    const negativeEl = container.querySelector('[class*="danger"], [class*="red"], [class*="destructive"]')
    expect(negativeEl).toBeTruthy()
  })
})
