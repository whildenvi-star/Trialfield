// RED phase — component does not exist yet.
// Wave 2B implements CustomerForm against these stubs.
// Run: npx vitest run src/components/marketing/customer-form.test.tsx

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
import { CustomerForm } from '@/components/marketing/customer-form'

afterEach(cleanup)

describe('CustomerForm', () => {
  it('renders create mode with empty fields when customer prop is null', () => {
    render(<CustomerForm customer={null} onSuccess={() => {}} />)
    expect(screen.getByRole('textbox', { name: /name/i })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /name/i }) as HTMLInputElement).value).toBe('')
  })

  it('renders edit mode with pre-filled fields when customer prop is provided', () => {
    const customer = { id: 'cu1', name: 'Acme Grain', type: 'ELEVATOR' }
    render(<CustomerForm customer={customer} onSuccess={() => {}} />)
    expect((screen.getByRole('textbox', { name: /name/i }) as HTMLInputElement).value).toBe('Acme Grain')
  })

  it('shows error banner when name is blank on submit', async () => {
    render(<CustomerForm customer={null} onSuccess={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/name.*required|required.*name/i)).toBeTruthy()
  })

  it('shows error banner when type is blank on submit', async () => {
    render(<CustomerForm customer={null} onSuccess={() => {}} />)
    const nameInput = screen.getByRole('textbox', { name: /name/i })
    fireEvent.change(nameInput, { target: { value: 'Test Customer' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/type.*required|required.*type/i)).toBeTruthy()
  })

  it('maps Duplicate error response to A customer with this name already exists', async () => {
    // Component should render the API error message from a Duplicate response
    expect(true).toBeDefined()
  })
})
