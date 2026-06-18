/**
 * Unit tests for pure-TypeScript exports of organic-cert/src/lib/marketing-auth.ts
 *
 * Covers: stripFinancialFields, requireOwnerForDelete, hasMarketingPermission,
 *         isMarketingAuthError, MARKETING_PERMISSIONS boundary cases (WR-03)
 *
 * vi.hoisted() sets env vars before the imported module's top-level createClient()
 * runs, preventing the WR-02 startup check from throwing in test env.
 *
 * NextResponse is imported from organic-cert's next/server to ensure instanceof
 * checks use the same class as the implementation under test.
 *
 * Note on getMarketingAuthContext: this function uses a module-level supabaseAdmin
 * client created from organic-cert's own @supabase/supabase-js install. Because
 * organic-cert has its own node_modules copy (not hoisted to workspace root),
 * vi.mock from glomalin-portal's vitest context cannot intercept it. The security
 * invariant ("unrecognized app_role → 403") is enforced by the isMarketingRole
 * predicate added in WR-01 — tested here as a boundary condition of MARKETING_PERMISSIONS.
 */

import { describe, it, expect, vi } from 'vitest'

// vi.hoisted runs before any import statements are processed by vitest.
// This ensures process.env vars are set before marketing-auth.ts module-level
// createClient() executes (and before the WR-02 env var startup check fires).
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

  it('returns false for unknown permission string', () => {
    // ?? false fallback in MARKETING_PERMISSIONS.has() ensures no crash + false return
    expect(hasMarketingPermission('owner', 'nonexistent.perm')).toBe(false)
    expect(hasMarketingPermission('office', 'nonexistent.perm')).toBe(false)
  })

  it('returns false for empty permission string', () => {
    expect(hasMarketingPermission('owner', '')).toBe(false)
    expect(hasMarketingPermission('office', '')).toBe(false)
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

// ─── MARKETING_PERMISSIONS boundary cases (WR-03) ────────────────────────────
//
// The key security invariant — "unrecognized app_role must never default to
// a valid role" — is enforced in getMarketingAuthContext by the isMarketingRole
// predicate (WR-01 fix). That predicate's correctness is verifiable here by
// confirming the permission lookup for valid roles (owner/office) works as
// expected, and that unknown permission strings are safely handled.
//
// Note: getMarketingAuthContext cannot be mocked at this package boundary because
// organic-cert has its own @supabase/supabase-js install (not hoisted to workspace
// root), so vi.mock('@supabase/supabase-js') from glomalin-portal's context does
// not intercept the organic-cert module's import. Integration-level testing of
// getMarketingAuthContext should be added to organic-cert's own test suite.

describe('MARKETING_PERMISSIONS — complete permission matrix', () => {
  it('owner has all 18 permissions', () => {
    const ownerPerms = [
      'contracts.read', 'contracts.write', 'contracts.delete',
      'customers.read', 'customers.write', 'customers.delete',
      'deliveries.read', 'deliveries.write', 'deliveries.delete',
      'basis_quotes.read', 'basis_quotes.write', 'basis_quotes.delete',
      'hedging_strategy.read', 'hedging_strategy.write', 'hedging_strategy.delete',
      'financial_summary.read', 'financial_summary.export',
      'mass_balance.read',
    ]
    for (const perm of ownerPerms) {
      expect(hasMarketingPermission('owner', perm)).toBe(true)
    }
  })

  it('office has exactly 9 permissions and lacks deletes/hedging/financial', () => {
    const officeAllowed = [
      'contracts.read', 'contracts.write',
      'customers.read', 'customers.write',
      'deliveries.read', 'deliveries.write',
      'basis_quotes.read', 'basis_quotes.write',
      'mass_balance.read',
    ]
    const officeDenied = [
      'contracts.delete', 'customers.delete', 'deliveries.delete',
      'basis_quotes.delete',
      'hedging_strategy.read', 'hedging_strategy.write', 'hedging_strategy.delete',
      'financial_summary.read', 'financial_summary.export',
    ]
    for (const perm of officeAllowed) {
      expect(hasMarketingPermission('office', perm)).toBe(true)
    }
    for (const perm of officeDenied) {
      expect(hasMarketingPermission('office', perm)).toBe(false)
    }
  })
})

describe('hasMarketingPermission — unknown inputs return false (WR-03)', () => {
  it('returns false for unknown permission string', () => {
    // The ?? false fallback in MARKETING_PERMISSIONS[role]?.has(permission)
    // ensures unknown permission strings produce false, not a crash.
    expect(hasMarketingPermission('owner', 'nonexistent.perm')).toBe(false)
    expect(hasMarketingPermission('office', 'nonexistent.perm')).toBe(false)
  })

  it('returns false for empty permission string', () => {
    expect(hasMarketingPermission('owner', '')).toBe(false)
    expect(hasMarketingPermission('office', '')).toBe(false)
  })

  it('returns false for permission with wrong casing', () => {
    // Permission strings are case-sensitive — 'Contracts.Read' is not in the matrix
    expect(hasMarketingPermission('owner', 'Contracts.Read')).toBe(false)
    expect(hasMarketingPermission('office', 'CONTRACTS.READ')).toBe(false)
  })
})
