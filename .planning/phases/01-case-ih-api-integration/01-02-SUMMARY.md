---
phase: 01-case-ih-api-integration
plan: 02
subsystem: api
tags: [nextjs, prisma, postgresql, typescript, case-ih, fieldops, sync, admin]

requires:
  - phase: 01-01
    provides: "Prisma schema (SyncedOperation, CaseIHFieldMapping, OperationTypeMapping, FieldOpsSyncState), fieldops-client.ts, fieldops-normalizer.ts"

provides:
  - "runFieldOpsSync(farmId): full pipeline — fetch Case IH API → normalize → write staging rows → update sync state"
  - "POST /api/admin/sync: ADMIN-gated sync trigger endpoint"
  - "GET /api/admin/fieldops/fields: Case IH fields + existing mappings for matching UI"
  - "GET/POST/PUT /api/admin/fieldops/mappings: CaseIHFieldMapping CRUD with upsert dedup"
  - "GET/POST /api/admin/fieldops/op-types: OperationTypeMapping CRUD + unmapped rawOpTypes from staging"
  - "GET /api/admin/fieldops/sync-state: FieldOpsSyncState for UI mount, { connected: false } if never synced"
  - "DELETE /api/admin/fieldops/connection: atomic disconnect (clears sync state + mappings, preserves synced ops)"
  - "GET /api/admin/staged-ops: paginated list with status/syncRunId filter + mapped field name enrichment"
  - "POST /api/admin/staged-ops/[id]: approve (creates FieldOperation or HarvestEvent) or reject with reason"

affects:
  - "01-03 (admin UI pages call all 9 endpoints built here)"
  - "02 (field records/history phase will query FieldOperation and HarvestEvent records created by approve flow)"

tech-stack:
  added: []
  patterns:
    - "ADMIN-gate pattern: every admin route calls auth(), checks user.role === 'ADMIN', uses user.farmId for all queries"
    - "Approve flow: load SyncedOperation → check conflict (409 on manual record → takes priority) → find FieldEnterprise → create domain record → mark APPROVED → logAudit"
    - "Sync dedup pattern: check existing row status before upsert — skip APPROVED/REJECTED, update PENDING only"
    - "Sync state: always upsert FieldOpsSyncState after sync completes (even on error path)"
    - "{ connected: false } response on GET /sync-state when no sync state exists — UI uses this to determine flow"

key-files:
  created:
    - "organic-cert/src/lib/fieldops-sync.ts (runFieldOpsSync orchestrator)"
    - "organic-cert/src/app/api/admin/sync/route.ts (POST sync trigger)"
    - "organic-cert/src/app/api/admin/fieldops/fields/route.ts (GET Case IH fields)"
    - "organic-cert/src/app/api/admin/fieldops/mappings/route.ts (GET/POST/PUT field mappings)"
    - "organic-cert/src/app/api/admin/fieldops/op-types/route.ts (GET/POST op type mappings)"
    - "organic-cert/src/app/api/admin/fieldops/sync-state/route.ts (GET sync state)"
    - "organic-cert/src/app/api/admin/fieldops/connection/route.ts (DELETE disconnect)"
    - "organic-cert/src/app/api/admin/staged-ops/route.ts (GET staged ops list)"
    - "organic-cert/src/app/api/admin/staged-ops/[id]/route.ts (POST approve/reject)"
  modified: []

key-decisions:
  - "Manual data always wins: approve flow returns 409 if a manual FieldOperation or HarvestEvent already exists for same date/type (per locked user decision)"
  - "Linked account early return: runFieldOpsSync checks validateConnection() first; empty field list triggers no_data status + early return (API-05)"
  - "Preserve synced ops on disconnect: DELETE /connection clears sync state + mappings but NOT SyncedOperation rows — historical audit trail required for compliance"
  - "FieldOpType enum used directly (not string cast) in approve flow for type-safe domain record creation"
  - "toFieldOpType() helper maps rawOpType/nopCategory strings to FieldOpType enum — YIELD/HARVEST go to HarvestEvent, all others to FieldOperation"
  - "{ connected: false } on missing FieldOpsSyncState: 200 not 404 — the UI uses this to determine whether to show connect vs sync flow"

patterns-established:
  - "Admin route boilerplate: auth() → role check → farmId extraction — consistent across all 8 routes"
  - "Paginated list pattern: count + findMany with skip/take, return { data, pagination } envelope"
  - "Sync dedup: findUnique by farmId_fieldopsExternalId, branch on status (APPROVED/REJECTED skip, PENDING update, null create)"

requirements-completed:
  - API-02
  - API-03
  - API-04
  - API-05

duration: 5min
completed: 2026-02-24
---

# Phase 1 Plan 2: Sync Service & Admin API Routes Summary

**Sync orchestration service + 8 ADMIN-gated API routes covering the full Case IH data pipeline: fetch → normalize → stage → review → approve into FieldOperation/HarvestEvent domain records**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T19:39:10Z
- **Completed:** 2026-02-24T19:44:26Z
- **Tasks:** 2
- **Files modified:** 9 created, 0 modified

## Accomplishments

- `runFieldOpsSync` orchestrates the complete pipeline: validates connection (linked account detection), loads field + op-type mappings, fetches 3-year lookback from Case IH API, normalizes via Zod normalizer, upserts staging rows with APPROVED/REJECTED skip logic, updates FieldOpsSyncState
- 8 ADMIN-gated API routes provide all endpoints the Plan 03 UI pages will call: sync trigger, field matching, field mapping CRUD, op-type mapping CRUD, sync state retrieval, disconnect, staged ops list, and approve/reject review
- Approve flow: resolves FieldEnterprise for the mapped field, checks for manual record conflicts (409 — manual always wins), creates typed FieldOperation or HarvestEvent, logs audit trail

## Task Commits

Each task was committed atomically to the organic-cert git repository:

1. **Task 1: Create sync orchestration service** - `0b80e2a` (feat)
2. **Task 2: Create all Phase 1 API routes** - `5714144` (feat)

## Files Created/Modified

- `organic-cert/src/lib/fieldops-sync.ts` - runFieldOpsSync: full pipeline from Case IH API to SyncedOperation staging rows with FieldOpsSyncState updates
- `organic-cert/src/app/api/admin/sync/route.ts` - POST /api/admin/sync: ADMIN-gated sync trigger
- `organic-cert/src/app/api/admin/fieldops/fields/route.ts` - GET Case IH fields + existing mappings
- `organic-cert/src/app/api/admin/fieldops/mappings/route.ts` - GET/POST/PUT CaseIHFieldMapping CRUD with upsert dedup and field name enrichment
- `organic-cert/src/app/api/admin/fieldops/op-types/route.ts` - GET/POST OperationTypeMapping CRUD, GET returns unmapped rawOpTypes found in staging
- `organic-cert/src/app/api/admin/fieldops/sync-state/route.ts` - GET FieldOpsSyncState for UI mount, returns { connected: false } if never synced
- `organic-cert/src/app/api/admin/fieldops/connection/route.ts` - DELETE disconnect: atomic removal of sync state + field mappings + op-type mappings
- `organic-cert/src/app/api/admin/staged-ops/route.ts` - GET paginated staged ops with status/syncRunId filter and mapped field name enrichment
- `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts` - POST approve/reject: conflict check, FieldEnterprise lookup, domain record creation, audit logging

## Decisions Made

- Manual data always wins: approve returns 409 Conflict when a manual FieldOperation or HarvestEvent already exists for the same fieldEnterpriseId + operationDate + type (per locked user decision)
- Linked account early return in runFieldOpsSync: validateConnection() returning empty fields triggers immediate no_data status + descriptive message rather than proceeding with a 3-year fetch that would return nothing
- DELETE /connection preserves SyncedOperation rows for audit trail compliance — only sync state and mapping configuration are cleared
- Used FieldOpType enum directly (imported from @prisma/client) instead of string casts for type-safe approve flow

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Simplified FieldOpType type cast in approve route**
- **Found during:** Task 2 (staged-ops/[id]/route.ts)
- **Issue:** Initial implementation used complex `Parameters<typeof prisma.fieldOperation.findFirst>[0] extends ...` conditional type cast — compiles but is unreadable and fragile
- **Fix:** Imported `FieldOpType` enum from `@prisma/client`, changed `toFieldOpType()` return type to `FieldOpType`, removed all type casts
- **Files modified:** `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts`
- **Verification:** `npx tsc --noEmit` produces zero errors
- **Committed in:** `5714144` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - Bug)
**Impact on plan:** Cleanup only — improves type safety. No scope creep.

## Issues Encountered

- None. Plan executed cleanly.

## User Setup Required

None - no external service configuration required for this plan. All routes use the FieldOps client which auto-uses mock data in development without any env vars.

## Next Phase Readiness

- All 9 API endpoints are in place for Plan 03 (admin UI pages to call)
- The sync pipeline can be exercised by starting the dev server and calling `POST /api/admin/sync` (mock data will be used without credentials)
- Field mapping UI needs: GET /api/admin/fieldops/fields, POST /api/admin/fieldops/mappings
- Staged ops review UI needs: GET /api/admin/staged-ops, POST /api/admin/staged-ops/[id]
- Sync state display needs: GET /api/admin/fieldops/sync-state on page mount

## Self-Check: PASSED

All files verified present, all commits verified in organic-cert git history:
- FOUND: `organic-cert/src/lib/fieldops-sync.ts`
- FOUND: `organic-cert/src/app/api/admin/sync/route.ts`
- FOUND: `organic-cert/src/app/api/admin/fieldops/fields/route.ts`
- FOUND: `organic-cert/src/app/api/admin/fieldops/mappings/route.ts`
- FOUND: `organic-cert/src/app/api/admin/fieldops/op-types/route.ts`
- FOUND: `organic-cert/src/app/api/admin/fieldops/sync-state/route.ts`
- FOUND: `organic-cert/src/app/api/admin/fieldops/connection/route.ts`
- FOUND: `organic-cert/src/app/api/admin/staged-ops/route.ts`
- FOUND: `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts`
- FOUND commit: `0b80e2a` (Task 1)
- FOUND commit: `5714144` (Task 2)

---
*Phase: 01-case-ih-api-integration*
*Completed: 2026-02-24*
