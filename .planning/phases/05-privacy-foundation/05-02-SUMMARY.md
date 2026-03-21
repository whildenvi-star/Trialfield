---
phase: 05-privacy-foundation
plan: 02
subsystem: ui
tags: [next.js, next-auth, rbac, react, typescript]

# Dependency graph
requires:
  - phase: 05-01
    provides: budget:read and budget:financial RBAC permissions, API field stripping established
provides:
  - Role-conditional Budget tab hidden from CREW in enterprise detail page DOM
  - Revenue/margin/profit sections hidden from OFFICE — "looks like data doesn't exist"
  - ADMIN experience unchanged — all data visible
  - TypeScript BudgetSummary interface with optional revenueProjection
  - End-to-end human verification of all four PRIV requirements
affects:
  - 06 (Actuals entry — BudgetTab.tsx extraction prerequisite applies to same detail page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI role-gate pattern: useSession() → role variable → canSeeBudget/canSeeFinancial booleans → conditional JSX wrapping"
    - "Silent omission pattern: conditional wrappers with no fallback UI — restricted content simply doesn't render"

key-files:
  created: []
  modified:
    - src/app/(app)/field-enterprises/[id]/page.tsx
    - src/types/next-auth.d.ts

key-decisions:
  - "Silent rendering omission — no lock icons, restricted badges, or 'admin only' labels; OFFICE sees cost data as if financial data doesn't exist"
  - "canSeeBudget = ADMIN | OFFICE; canSeeFinancial = ADMIN only — matches API RBAC established in Plan 01"
  - "useSession() for client-side role access on 'use client' page — role cast via (session?.user as any)?.role"
  - "BudgetSummary revenueProjection marked optional — handles API's conditional omission without TypeScript errors"

patterns-established:
  - "UI role gate: const role = (session?.user as any)?.role; const canSee = role === 'ADMIN'"
  - "Defense-in-depth: API strips fields (Plan 01) + UI hides sections (Plan 02) — both layers enforce the same rules independently"

requirements-completed: [PRIV-01, PRIV-03]

# Metrics
duration: verified via checkpoint
completed: 2026-03-21
---

# Phase 5 Plan 02: Privacy Foundation — UI Role Filtering Summary

**Role-conditional Budget tab (hidden from CREW) and revenue section (hidden from OFFICE) via useSession() booleans, with TypeScript optional revenueProjection and human-verified end-to-end across all four PRIV requirements**

## Performance

- **Duration:** Checkpoint-gated (Task 1 implementation + human verification round)
- **Started:** 2026-03-21T02:16:59Z
- **Completed:** 2026-03-21T02:24:40Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Added `useSession()` to enterprise detail page; derived `canSeeBudget` (ADMIN|OFFICE) and `canSeeFinancial` (ADMIN only) booleans from session role
- Wrapped Budget `TabsTrigger` and `TabsContent` in `canSeeBudget` — CREW users see no Budget tab in the DOM
- Wrapped revenue projection, margin cards, profit/acre, sale prices, land rent, overhead, drying, interest, and insurance sections in `canSeeFinancial` — OFFICE sees cost tables only with no indication data was withheld
- Marked `BudgetSummary.revenueProjection` as optional in TypeScript interface — no type errors when API omits the field
- Human verification confirmed all four PRIV scenarios: unauthenticated 401, CREW 403 + no Budget tab, OFFICE cost-only view, ADMIN full access

## Task Commits

Each task was committed atomically:

1. **Task 1: Add role-conditional rendering to enterprise detail page** - `3797e36` (feat)
2. **Task 2: Verify privacy enforcement end-to-end** — checkpoint, no files modified (human approved)

## Files Created/Modified

- `src/app/(app)/field-enterprises/[id]/page.tsx` - Added useSession import, role booleans, conditional wrappers for Budget tab and revenue/financial sections
- `src/types/next-auth.d.ts` - Verified/updated Session type to include role field; BudgetSummary revenueProjection optional

## Decisions Made

- Silent omission pattern: restricted content simply doesn't render — no fallback UI, no "restricted" indicators. OFFICE users experience the Budget tab as if financial data doesn't exist. This matches the user's locked decision from planning.
- Both API (Plan 01) and UI (Plan 02) enforce the same RBAC rules independently — defense-in-depth. The API is the authoritative layer; the UI prevents unnecessary requests and removes visual exposure.
- `useSession()` role cast via `(session?.user as any)?.role` — avoids TypeScript strictness on the augmented session type while keeping the pattern simple for a client component.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete privacy foundation shipped: unauthenticated 401, CREW 403, OFFICE cost-only, ADMIN full access — all verified end-to-end
- Phase 6 (Actuals Entry) is unblocked — the privacy layer is in place before financial data entry goes live
- Known prerequisite before Phase 6 UI work: `BudgetTab.tsx` extraction from `[id]/page.tsx` (file exceeds safe size; noted in STATE.md blockers)
- Iframe auth concern (X-Auth-Token for cookie-less portal embed) remains a future consideration — not blocking Phase 6 development

---
*Phase: 05-privacy-foundation*
*Completed: 2026-03-21*

## Self-Check: PASSED

- 05-02-SUMMARY.md: FOUND
- Commit 3797e36 (Task 1): FOUND
- src/app/(app)/field-enterprises/[id]/page.tsx: FOUND
- src/types/next-auth.d.ts: FOUND
- Task 2 (human-verify): Approved by user
