// Run: npx vitest run src/components/macro/add-contract-modal.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { AddContractModal } from '@/components/macro/add-contract-modal'

const baseProps = {
  crops: ['Corn', 'Soybeans'],
  cropYear: 2026,
  onClose: () => {},
}

const BUYERS = [
  { id: 'b1', name: 'Cashton Farm Supply' },
  { id: 'b2', name: 'Heartland Coop' },
]

describe('AddContractModal buyer field', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(cleanup)

  it('renders buyer dropdown populated from the marketing customers list', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => BUYERS,
    } as Response)

    render(<AddContractModal {...baseProps} />)

    expect(global.fetch).toHaveBeenCalledWith('/api/cert-proxy/marketing/customers?dropdown=true')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cashton Farm Supply' })).toBeDefined()
      expect(screen.getByRole('option', { name: 'Heartland Coop' })).toBeDefined()
    })
    // Dropdown, not free text
    expect(screen.queryByPlaceholderText(/heartland coop/i)).toBeNull()
  })

  it('falls back to free-text buyer input when the buyer list fails to load', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))

    render(<AddContractModal {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/heartland coop/i)).toBeDefined()
    })
  })

  it('falls back to free-text buyer input when the buyer list is empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    render(<AddContractModal {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/heartland coop/i)).toBeDefined()
    })
  })
})
