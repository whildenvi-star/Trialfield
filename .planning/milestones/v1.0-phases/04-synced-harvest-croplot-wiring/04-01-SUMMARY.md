---
phase: 04-synced-harvest-croplot-wiring
plan: 01
subsystem: api
tags: [prisma, nextjs, typescript, harvest, croplot, transaction]

# Dependency graph
requires:
  - phase: 01-case-ih-api-integration
    provides: SyncedOperation model and staged-ops approve flow
  - phase: 02-field-records-history
    provides: CropLot model, HarvestEvent model, lot-generator.ts
provides:
  - yield-converter.ts with USDA test weight lookup and bu-to-lbs conversion
  - atomic HarvestEvent + CropLot creation in staged harvest approve flow
  - year-matched FieldEnterprise lookup on approve (operationDate year preferred)
  - cropLot metadata in approve API response (id, lotNumber, isNew)
affects: 03-inspection-report-generation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - prisma.$transaction for atomic multi-table writes (HarvestEvent + CropLot + SyncedOperation)
    - yield unit normalization at domain boundary (not at ingest time)
    - null-safe conversion with explicit null return for unknowns

key-files:
  created:
    - organic-cert/src/lib/yield-converter.ts
  modified:
    - organic-cert/src/app/api/admin/staged-ops/[id]/route.ts

key-decisions:
  - "Year-matched FieldEnterprise lookup: prefer operationDate.getFullYear() === cropYear before falling back to latest-by-desc to prevent wrong-year lot numbers"
  - "One CropLot per FieldEnterprise for synced harvests: findFirst by fieldEnterpriseId, increment quantityLbs if exists rather than creating second lot"
  - "convertYieldToLbs returns null for unknown crops/units — fail safely rather than guess test weight for undocumented Case IH schema"
  - "Audit log stays outside $transaction — non-critical logging does not need atomicity guarantee"
  - "SyncedOperation.update(APPROVED) moved inside $transaction — fully atomic: no approved harvest without a CropLot"

patterns-established:
  - "yield-converter pattern: normalize unit string to lowercase, return null for unrecognized inputs"
  - "$transaction pattern: all DB reads and writes inside callback use tx.* exclusively"

requirements-completed: [FIELD-06]

# Metrics
duration: 6min
completed: 2026-02-26
---

# Phase 4 Plan 1: Synced Harvest CropLot Wiring Summary

**Atomic HarvestEvent + CropLot creation in staged harvest approve flow, with USDA test-weight bu-to-lbs conversion at the approval boundary**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T16:51:38Z
- **Completed:** 2026-02-26T16:57:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `yield-converter.ts` with `getTestWeight` (USDA test weights) and `convertYieldToLbs` (handles all known Case IH unit variants, null-safe)
- Refactored harvest branch of staged-ops approve handler to use `prisma.$transaction` — HarvestEvent, CropLot create/update, and SyncedOperation APPROVED status all written atomically
- Added year-matched FieldEnterprise lookup so the approve handler prefers the cropYear matching the operationDate instead of defaulting to latest
- API response for harvest approvals now includes `cropLot: { id, lotNumber, isNew }` for UI consumption

## Task Commits

Each task was committed atomically in the `organic-cert` repo:

1. **Task 1: Create bu-to-lbs yield converter utility** - `eaafd41` (feat)
2. **Task 2: Refactor approve handler with atomic CropLot creation in $transaction** - `9e76370` (feat)

## Files Created/Modified
- `organic-cert/src/lib/yield-converter.ts` - USDA standard test weight lookup and Case IH yield conversion utility
- `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts` - Harvest approve branch refactored with $transaction, year-matched enterprise lookup, and cropLot response

## Decisions Made
- Year-matched FieldEnterprise lookup: when `operationDate` is present, first try `cropYear === operationDate.getFullYear()` before falling back to latest-by-desc. Prevents wrong-year lot numbers when a field has enterprises for multiple crop years.
- One CropLot per FieldEnterprise for synced harvests: `findFirst({ where: { fieldEnterpriseId } })` then branch on exists. Increment `quantityLbs` if exists, create new lot if not. No -2/-3 suffix pattern for synced harvests.
- `convertYieldToLbs` returns null for unknown crops (rather than guessing a test weight) — Case IH API schema is undocumented, defensive null is safer than wrong conversion.
- Audit log stays outside `$transaction` — it's non-critical and doesn't need atomicity.
- `syncedOperation.update(APPROVED)` moved inside the transaction — ensures no approved harvest exists without a corresponding CropLot.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `organic-cert/` is its own separate git repo (not tracked by the `.planning/` repo). Discovered during first commit attempt — redirected task commits to the `organic-cert` repo's git. No impact on deliverables.
- Pre-existing TypeScript error in `src/app/api/fields/sync-registry/route.ts` (unrelated file, argument count mismatch). Out of scope per scope boundary rule — logged here but not fixed.

## Next Phase Readiness
- Synced harvests now create CropLots atomically — they will appear in the Harvest Log and Mass Balance sections of PDF reports generated by Phase 3 without any report-assembler changes
- `cropLot.isNew` flag in response is available for future batch-approve UI to show toast/summary counts
- No schema changes needed — all existing CropLot fields used as-is

---
*Phase: 04-synced-harvest-croplot-wiring*
*Completed: 2026-02-26*

## Self-Check: PASSED

- organic-cert/src/lib/yield-converter.ts — FOUND
- organic-cert/src/app/api/admin/staged-ops/[id]/route.ts — FOUND
- .planning/phases/04-synced-harvest-croplot-wiring/04-01-SUMMARY.md — FOUND
- Commit eaafd41 (organic-cert repo) — FOUND
- Commit 9e76370 (organic-cert repo) — FOUND
