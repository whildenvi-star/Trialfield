/**
 * Unit tests for pure-TypeScript exports of organic-cert/src/lib/marketing-auth.ts
 *
 * Covers: stripFinancialFields, requireOwnerForDelete, hasMarketingPermission, isMarketingAuthError
 * Does NOT test: getMarketingAuthContext (requires live Supabase — integration-level)
 *
 * vi.hoisted() sets env vars before the imported module's top-level createClient()
 * runs, preventing an error when NEXT_PUBLIC_SUPABASE_URL is absent in test env.
 *
 * NextResponse is imported from organic-cert's next/server to ensure instanceof
 * checks use the same class as the implementation under test.
 */

import { describe, it, expect, vi } from 'vitest'

// vi.hoisted runs before any import statements are processed by vitest.
// This ensures process.env vars are set before marketing-auth.ts module-level
// createClient() executes.
const { restoreEnv } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  return { restoreEnv: true }
})

void restoreEnv // suppress unused warning

import {
  stripFinancialFields,
  requireOwnerForDelete,
  hasMarketingPermission,
  isMarketingAuthError,
} from '../../../../organic-cert/src/lib/marketing-auth'

// Import NextResponse from organic-cert's next to match the class used in the
// implementation. Using glomalin-portal's next/server would produce a different
// class reference, causing instanceof checks to fail.
import { NextResponse } from '../../../../organic-cert/node_modules/next/server'

// ─── stripFinancialFields ─────────────────────────────────────────────────────

describe('stripFinancialFields', () => {
  const fullContract = {
    id: '1',
    futuresPrice: 4.5,
    basis: -0.2,
    finalCashPrice: 4.3,
    notes: 'test',
  }

  it('removes financial keys for office role', () => {
    const result = stripFinancialFields(fullContract, 'office')
    expect('futuresPrice' in result).toBe(false)
    expect('basis' in result).toBe(false)
    expect('finalCashPrice' in result).toBe(false)
  })

  it('preserves non-financial keys for office role', () => {
    const result = stripFinancialFields(fullContract, 'office')
    expect(result).toHaveProperty('id', '1')
    expect(result).toHaveProperty('notes', 'test')
  })

  it('preserves all financial keys for owner role', () => {
    const result = stripFinancialFields(fullContract, 'owner')
    expect(result).toHaveProperty('futuresPrice', 4.5)
    expect(result).toHaveProperty('basis', -0.2)
    expect(result).toHaveProperty('finalCashPrice', 4.3)
    expect(result).toHaveProperty('id', '1')
    expect(result).toHaveProperty('notes', 'test')
  })

  it('does not crash when financial fields absent (office role)', () => {
    const minimalContract = { id: '1', notes: 'no financial fields' }
    const result = stripFinancialFields(minimalContract, 'office')
    expect(result).toHaveProperty('id', '1')
    expect(result).toHaveProperty('notes', 'no financial fields')
  })

  it('stripped keys are absent — not null, not undefined, not present at all', () => {
    const result = stripFinancialFields(fullContract, 'office')
    expect(Object.keys(result)).not.toContain('futuresPrice')
    expect(Object.keys(result)).not.toContain('basis')
    expect(Object.keys(result)).not.toContain('finalCashPrice')
  })
})

// ─── requireOwnerForDelete ────────────────────────────────────────────────────

describe('requireOwnerForDelete', () => {
  it('returns null for owner role', () => {
    const result = requireOwnerForDelete('owner')
    expect(result).toBeNull()
  })

  it('returns NextResponse with status 403 for office role', () => {
    const result = requireOwnerForDelete('office')
    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(403)
  })

  it('403 body contains expected error message', async () => {
    const response = requireOwnerForDelete('office') as NextResponse
    const body = await response.json()
    expect(body.error).toBe('Delete requires owner role')
  })
})

// ─── hasMarketingPermission ───────────────────────────────────────────────────

describe('hasMarketingPermission', () => {
  it('owner has hedging_strategy.read', () => {
    expect(hasMarketingPermission('owner', 'hedging_strategy.read')).toBe(true)
  })

  it('office lacks hedging_strategy.read', () => {
    expect(hasMarketingPermission('office', 'hedging_strategy.read')).toBe(false)
  })

  it('owner has contracts.delete', () => {
    expect(hasMarketingPermission('owner', 'contracts.delete')).toBe(true)
  })

  it('office lacks contracts.delete', () => {
    expect(hasMarketingPermission('office', 'contracts.delete')).toBe(false)
  })

  it('office has contracts.read', () => {
    expect(hasMarketingPermission('office', 'contracts.read')).toBe(true)
  })

  it('office has mass_balance.read', () => {
    expect(hasMarketingPermission('office', 'mass_balance.read')).toBe(true)
  })

  it('office lacks financial_summary.read', () => {
    expect(hasMarketingPermission('office', 'financial_summary.read')).toBe(false)
  })

  it('owner has financial_summary.export', () => {
    expect(hasMarketingPermission('owner', 'financial_summary.export')).toBe(true)
  })

  it('office lacks basis_quotes.delete', () => {
    expect(hasMarketingPermission('office', 'basis_quotes.delete')).toBe(false)
  })

  it('owner has basis_quotes.delete', () => {
    expect(hasMarketingPermission('owner', 'basis_quotes.delete')).toBe(true)
  })
})

// ─── isMarketingAuthError ─────────────────────────────────────────────────────

describe('isMarketingAuthError', () => {
  it('returns true for a NextResponse (error path)', () => {
    // Create NextResponse using the same class as the implementation under test
    const errorResponse = NextResponse.json({ error: 'x' }, { status: 401 })
    expect(isMarketingAuthError(errorResponse)).toBe(true)
  })

  it('returns false for a MarketingAuthContext (success path)', () => {
    const ctx = { userId: 'abc', role: 'owner' as const }
    expect(isMarketingAuthError(ctx)).toBe(false)
  })
})
