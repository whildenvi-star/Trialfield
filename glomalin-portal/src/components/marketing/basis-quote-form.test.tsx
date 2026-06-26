// RED phase — component does not exist yet.
// Wave 2B implements BasisQuoteForm against these stubs.
// Run: npx vitest run src/components/marketing/basis-quote-form.test.tsx

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
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BasisQuoteForm } from '@/components/marketing/basis-quote-form'

afterEach(cleanup)

const VARIANTS = [
  { id: 'v1', name: 'Yellow Corn' },
  { id: 'v2', name: 'Soft Red Wheat' },
]

describe('BasisQuoteForm', () => {
  it('renders all required fields', () => {
    render(<BasisQuoteForm variants={VARIANTS} onSuccess={() => {}} />)
    // Should render grain variant select, basis value input, location/date fields
    expect(screen.getByText(/grain variant|variety|crop/i)).toBeTruthy()
    expect(screen.getByLabelText(/basis/i)).toBeTruthy()
  })

  it('shows error when grain variant not selected on submit', () => {
    render(<BasisQuoteForm variants={VARIANTS} onSuccess={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save|submit|add/i }))
    expect(screen.getByText(/variant.*required|required.*variant|select.*grain/i)).toBeTruthy()
  })

  it('shows error when basis value is missing on submit', () => {
    render(<BasisQuoteForm variants={VARIANTS} onSuccess={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save|submit|add/i }))
    expect(screen.getByText(/basis.*required|required.*basis/i)).toBeTruthy()
  })

  it('populates grain variant select from variants prop', () => {
    render(<BasisQuoteForm variants={VARIANTS} onSuccess={() => {}} />)
    expect(screen.getByText('Yellow Corn')).toBeTruthy()
    expect(screen.getByText('Soft Red Wheat')).toBeTruthy()
  })
})
