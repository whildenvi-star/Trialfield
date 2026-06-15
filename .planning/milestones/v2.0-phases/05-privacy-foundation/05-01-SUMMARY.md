---
phase: 05-privacy-foundation
plan: 01
subsystem: auth
tags: [nextauth, rbac, next.js, prisma, api-security]

# Dependency graph
requires: []
provides:
  - getAuthContext() returns null for unauthenticated requests (no ADMIN DB fallback)
  - budget:read and budget:financial RBAC permissions
  - sale:read removed from OFFICE role
  - budget-summary API enforces auth + role-based financial field stripping
affects:
  - 05-02 (UI field stripping — depends on API enforcement established here)
  - any route using getAuthContext() for auth gating
  - any UI consuming budget-summary API

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth gate pattern: getAuthContext() → 401, hasPermission() → 403 at route entry"
    - "Spread-conditional field stripping: ...(condition ? { key: value } : {}) — no null traces in JSON"

key-files:
  created: []
  modified:
    - src/lib/auth.ts
    - src/lib/rbac.ts
    - src/app/api/field-enterprises/[id]/budget-summary/route.ts

key-decisions:
  - "ADMIN fallback removed unconditionally — unauthenticated requests return null, callers return 401"
  - "sale:read removed from OFFICE role — office staff cannot read sale records (write-only for sale data)"
  - "budget:financial is ADMIN-only — revenue, margin, sale price, and overhead category never visible to OFFICE"
  - "Spread-conditional pattern for field stripping — financial fields absent from JSON keys, not set to null"
  - "fallowCost amount remains visible to OFFICE but category field (overhead/rent/insurance) is stripped"

patterns-established:
  - "Auth gate pattern: always call getAuthContext() first, return 401 if null, check permission, return 403 if missing"
  - "Financial field stripping: use ...(canSeeFinancial && field ? { field } : {}) — never field: null"

requirements-completed: [PRIV-01, PRIV-02, PRIV-03, PRIV-04]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 5 Plan 01: Privacy Foundation — Auth & RBAC Summary

**Removed ADMIN DB fallback from getAuthContext(), added budget RBAC permissions, and gated the budget-summary API with auth + financial field stripping via spread-conditional**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T02:15:01Z
- **Completed:** 2026-03-21T02:16:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed `prisma.user.findFirst` ADMIN fallback from `getAuthContext()` — unauthenticated requests now return null instead of ADMIN-level data (root-cause security fix for PRIV-02)
- Added `budget:read` (ADMIN + OFFICE) and `budget:financial` (ADMIN only) permissions to rbac.ts; removed `sale:read` from OFFICE role (PRIV-03, PRIV-04)
- Budget-summary route now returns 401 for unauthenticated, 403 for CREW/no-permission, strips all financial fields from OFFICE responses using spread-conditional pattern with no null traces (PRIV-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove ADMIN fallback and update RBAC permissions** - `3aa4037` (feat)
2. **Task 2: Add auth check and field stripping to budget-summary route** - `aa13285` (feat)

## Files Created/Modified

- `src/lib/auth.ts` - Removed ADMIN DB fallback; getAuthContext() returns null when no session
- `src/lib/rbac.ts` - Added budget:read/budget:financial to ADMIN, budget:read to OFFICE, removed sale:read from OFFICE
- `src/app/api/field-enterprises/[id]/budget-summary/route.ts` - Auth gate (401/403) and spread-conditional financial field stripping

## Decisions Made

- ADMIN fallback removed unconditionally: the comment previously explained it existed because the app runs in an iframe where session cookies don't work. That workaround bypassed all RBAC. Removed per plan spec — proper session auth is the correct fix.
- `sale:read` removed from OFFICE (not just budget read): OFFICE retains `sale:write` to record sales, but cannot read the sale records list (which reveals prices/revenue). Keeps write ability, removes read visibility.
- `budget:financial` is ADMIN-only: revenue, margin, sale price, and overhead categories are hidden from OFFICE per user's locked decision.
- `fallowCost.category` stripped for OFFICE but `fallowCost.amount` remains: the category field reveals cost classification (overhead/rent/insurance) while the amount contributes to visible cost-of-production total. Amount needed for OFFICE budget view; category is financial detail.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- API enforcement is now complete for all four PRIV requirements
- Plan 02 (UI field stripping) is unblocked — the API will never leak financial data, so UI work is defense-in-depth only
- Any new API routes consuming getAuthContext() should follow the established auth gate pattern: getAuthContext() → 401, hasPermission() → 403

---
*Phase: 05-privacy-foundation*
*Completed: 2026-03-21*

## Self-Check: PASSED

- src/lib/auth.ts: FOUND
- src/lib/rbac.ts: FOUND
- src/app/api/field-enterprises/[id]/budget-summary/route.ts: FOUND
- 05-01-SUMMARY.md: FOUND
- Commit 3aa4037: FOUND
- Commit aa13285: FOUND
