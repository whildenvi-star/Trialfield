---
phase: 16-field-enterprise-compilation
plan: 01
subsystem: api
tags: [prisma, postgresql, nextjs, typescript, compile-engine, ecosystem-client]

# Dependency graph
requires:
  - phase: 15-foundation-fixes-ecosystem-client-layer
    provides: "ecosystem client layer (budget-client, registry-client, tickets-client), EcosystemError, fetchWithTimeout, compile page skeleton"
provides:
  - "farmBudgetFieldName column on Field model for persistent compile mapping"
  - "getTicketsForCropYear() in tickets-client for harvest data pull"
  - "PATCH /api/fields/[id] for targeted mapping saves"
  - "filterOrganicEnterprises() nop-filter function"
  - "resolveField() field-mapper with three-tier resolution"
  - "buildPreview(cropYear) compile-engine joining all four data sources"
  - "GET /api/compile/[year]/preview returning CompilePreview JSON"
  - "getBudgetSettings() in budget-client for suggestedYear resolution"
affects:
  - 16-field-enterprise-compilation
  - 17-input-seed-nop-compliance
  - 18-rotation-harvest-pdf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compile engine: Promise.allSettled for parallel ecosystem fetch — one unavailable source never blocks others"
    - "Three-tier field resolution: name match > registry alias > stored-mapping (farmBudgetFieldName)"
    - "Manual migration + migrate resolve --applied for drift-safe schema changes without full DB reset"
    - "Read-only preview API: zero DB writes in buildPreview(), all writes deferred to commit step"

key-files:
  created:
    - "organic-cert/src/lib/compile/types.ts"
    - "organic-cert/src/lib/compile/nop-filter.ts"
    - "organic-cert/src/lib/compile/field-mapper.ts"
    - "organic-cert/src/lib/compile/compile-engine.ts"
    - "organic-cert/src/app/api/compile/[year]/preview/route.ts"
    - "organic-cert/prisma/migrations/20260303034540_add_farm_budget_field_name/migration.sql"
  modified:
    - "organic-cert/prisma/schema.prisma"
    - "organic-cert/src/lib/ecosystem/tickets-client.ts"
    - "organic-cert/src/lib/ecosystem/budget-client.ts"
    - "organic-cert/src/app/api/fields/[id]/route.ts"

key-decisions:
  - "Manual migration + migrate resolve --applied pattern reused for farmBudgetFieldName (same drift issue as Phase 15 partial index)"
  - "PATCH /api/fields/[id] accepts only farmBudgetFieldName — other fields ignored for safety (not a full update endpoint)"
  - "getBudgetSettings() returns null on failure rather than throwing — suggestedYear falls back to current year gracefully"
  - "deliveries built from ticket.farm case-insensitive match to local field name — unmatched ticket farms silently excluded (not organic-cert fields)"
  - "readiness checks ORGANIC and TRANSITIONAL fields only — CONVENTIONAL and SPLIT fields excluded from NOP readiness tracking"

patterns-established:
  - "Compile engine pattern: fetch all sources with Promise.allSettled, degrade gracefully on partial failure, build preview from whatever is available"
  - "Registry alias map: lowercase alias -> Field.id bridge built from registryId cross-reference, used by field-mapper tier 2"

requirements-completed: [ECO-03, ECO-04, CMP-01]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 16 Plan 01: Compile Engine Foundation Summary

**Read-only compile engine joining farm-budget organic enterprises, farm-registry field identities, grain-tickets deliveries, and organic-cert DB into a CompilePreview diff via GET /api/compile/[year]/preview**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T03:44:55Z
- **Completed:** 2026-03-03T03:51:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- farmBudgetFieldName column added to Field model with drift-safe manual migration approach
- Full compile engine with Promise.allSettled parallel fetch from all three ecosystem sources
- Three-tier field resolution (name > alias > stored-mapping) with explicit match method tracking
- GET /api/compile/[year]/preview returns CompilePreview JSON with rows, deliveries, readiness, savedMappings, and summary counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma migration + tickets-client extension + PATCH route update** - `7ae8853` (feat)
2. **Task 2: Compile library modules + preview API route** - `aa40825` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `organic-cert/prisma/schema.prisma` - Added farmBudgetFieldName String? to Field model
- `organic-cert/prisma/migrations/20260303034540_add_farm_budget_field_name/migration.sql` - ALTER TABLE ADD COLUMN migration SQL
- `organic-cert/src/lib/ecosystem/tickets-client.ts` - Added TicketRecord interface + getTicketsForCropYear() function
- `organic-cert/src/lib/ecosystem/budget-client.ts` - Added getBudgetSettings() returning { year } or null
- `organic-cert/src/app/api/fields/[id]/route.ts` - Added PATCH handler for farmBudgetFieldName mapping saves
- `organic-cert/src/lib/compile/types.ts` - CompilePreview, EnterpriseRow, FieldDiff, TicketSummary, ReadinessRow types
- `organic-cert/src/lib/compile/nop-filter.ts` - filterOrganicEnterprises() keeping only category==="organic"
- `organic-cert/src/lib/compile/field-mapper.ts` - resolveField() with three-tier priority resolution
- `organic-cert/src/lib/compile/compile-engine.ts` - buildPreview(cropYear) orchestrator with zero DB writes
- `organic-cert/src/app/api/compile/[year]/preview/route.ts` - GET handler with year validation and Cache-Control: no-store

## Decisions Made
- Manual migration + migrate resolve --applied reused from Phase 15 pattern — Prisma migrate dev detects drift from init migration modification; safe workaround is manual SQL + resolve
- PATCH /api/fields/[id] only accepts farmBudgetFieldName — no audit log (mapping metadata, not field data)
- getBudgetSettings() catches and returns null on any failure — compile engine degrades gracefully to current year
- Delivery matching uses ticket.farm lowercased vs local field name — unmatched delivery farms are silently excluded (they aren't NOP-relevant organic fields)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration approach for farmBudgetFieldName due to Prisma drift**
- **Found during:** Task 1 (Prisma migration)
- **Issue:** `npx prisma migrate dev` detected drift between init migration history and actual DB (9 indexes removed from DB vs migration SQL). Both `--create-only` and standard migrate dev refused to proceed.
- **Fix:** Created migration directory manually with timestamp, wrote ALTER TABLE SQL directly, applied via `npx prisma db execute --url`, registered via `npx prisma migrate resolve --applied`. Same approach used in Phase 15 for partial index.
- **Files modified:** `prisma/migrations/20260303034540_add_farm_budget_field_name/migration.sql`
- **Verification:** `npx prisma migrate status` shows "Database schema is up to date!" with 3 migrations found
- **Committed in:** `7ae8853` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required deviation to work around known Prisma drift state. No scope creep. All planned functionality delivered exactly as specified.

## Issues Encountered
- Prisma drift state: the init migration was modified after being applied (Phase 15 baseline approach), causing migrate dev to detect drift and refuse to proceed. Resolved by reusing the manual migration + resolve pattern from Phase 15. This pattern is now established for all future organic-cert schema changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compile engine foundation complete — GET /api/compile/[year]/preview is ready to serve the compile page
- Field-mapper resolves budget field names via three-tier priority with explicit matchMethod tracking
- Phase 16 Plan 02 can build the compile page UI that calls this API
- PATCH /api/fields/[id] ready for compile page to persist manual field mapping corrections
- getTicketsForCropYear() ready for harvest delivery integration

---
*Phase: 16-field-enterprise-compilation*
*Completed: 2026-03-03*
