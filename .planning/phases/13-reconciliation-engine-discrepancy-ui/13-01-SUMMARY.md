---
phase: 13-reconciliation-engine-discrepancy-ui
plan: 01
subsystem: api
tags: [prisma, postgresql, express, reconciliation, grain-tickets]

# Dependency graph
requires:
  - phase: 12-settlement-import-manual-entry
    provides: Settlement and SettlementLine tables with matchStatus field, commit endpoint, line CRUD routes
provides:
  - normalizeTicketNo() pure function for ticket number canonicalization
  - runMatch(settlementId) engine scoped to buyerId+cropYear
  - Auto-match hook in POST /api/settlements/:id/commit
  - POST /api/settlements/:id/rematch route
  - _reconciliation.{status,lineCount} field on all ticket API responses
  - GET /api/reconciliation/summary (per-crop farmLbs vs buyerLbs with variance)
  - GET /api/reconciliation/unmatched (farmOnly with hints + settlementOnly arrays)
  - POST /api/reconciliation/manual-link route
  - PATCH /api/settlement-lines/:lineId/dispute route
affects:
  - 13-02 (discrepancy UI will consume all 5 new reconciliation routes)
  - organic-cert Phase 18 harvest compilation (ticket status field now available)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalizeTicketNo: strip H/h prefix + leading zeros, null for empty/zero-only"
    - "runMatch scoped to buyerId+cropYear — never global matching"
    - "matchStatus priority for _reconciliation: disputed > manual > matched > unreconciled"
    - "Auto-match on commit: runMatch called synchronously after createMany, counts returned in response"

key-files:
  created: []
  modified:
    - grain-tickets/server.js

key-decisions:
  - "normalizeTicketNo returns null for all-zero inputs (H000 → null) — prevents spurious matches on blank/placeholder ticket numbers"
  - "runMatch skips manual/disputed lines — user flags are never overwritten by auto-matching"
  - "runMatch called synchronously in commit endpoint — keeps response latency acceptable for 100-500 lines per settlement"
  - "_reconciliation always present on ticket responses (status=unreconciled when no lines) — client never needs null check"
  - "varianceLbs = farmLbs - buyerLbs (positive = farm weighed more = potential underpayment) — convention matches plan spec"
  - "dispute endpoint restricted to matched/manual/disputed lines — unmatched lines cannot be disputed (nothing to dispute)"

patterns-established:
  - "Ticket number normalization: always use normalizeTicketNo() for any comparison involving ticketNo"
  - "Reconciliation scope: always filter by buyerId + cropYear, never global"

requirements-completed: [REC-01, REC-02, REC-03, REC-04, REC-05]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 13 Plan 01: Reconciliation Matching Engine and API Summary

**Normalized ticket matching engine with 5 reconciliation API routes and _reconciliation status enrichment on all ticket responses**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T20:10:45Z
- **Completed:** 2026-03-02T20:13:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `normalizeTicketNo()` pure function handles all H-prefix and leading-zero variants, returns null for blank/zero-only inputs (all 8 test cases pass)
- `runMatch(settlementId)` engine auto-matches settlement lines to farm tickets scoped to buyerId+cropYear, preserving manual/disputed user flags
- Auto-match fires immediately on `POST /api/settlements/:id/commit`, response includes `matched` and `unmatched` counts alongside `linesCreated`
- All 5 new reconciliation API routes respond correctly (rematch, summary, unmatched, manual-link, dispute)
- Every ticket response (list + single) carries `_reconciliation: { status, lineCount }` with priority derivation: disputed > manual > matched > unreconciled

## Task Commits

Each task was committed atomically:

1. **Task 1: Reconciliation matching engine and API** - `6c41175` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified
- `grain-tickets/server.js` - Added normalizeTicketNo(), runMatch(), auto-match hook in commit endpoint, 5 new API routes, _reconciliation enrichment in dbTicketToJson() and both ticket GET endpoints

## Decisions Made
- `normalizeTicketNo` returns null for all-zero inputs (H000 → null) — prevents spurious matches on blank/placeholder ticket numbers
- `runMatch` called synchronously in commit endpoint — latency acceptable for 100-500 lines; async would complicate response
- `_reconciliation` always present on ticket responses (status=unreconciled when no lines) — client never needs null check
- `dispute` endpoint restricted to matched/manual/disputed lines — unmatched lines have nothing to dispute
- `varianceLbs = farmLbs - buyerLbs` (positive = farm weighed more = potential underpayment) — matches plan spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Port 3000 was occupied by previously running server instance. Killed old process before starting new server for verification. No code impact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All server-side reconciliation logic is complete and verified
- Phase 13 Plan 02 (discrepancy UI) can build directly on these 5 routes
- `_reconciliation.status` available on ticket list for badge display in the existing ticket table

---
*Phase: 13-reconciliation-engine-discrepancy-ui*
*Completed: 2026-03-02*
