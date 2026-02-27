---
phase: 05-split-field-schema-acre-reconciliation
plan: 02
subsystem: api
tags: [prisma, nextjs, lot-number, acre-reconciliation, field-enterprise, split-field]

# Dependency graph
requires:
  - phase: 05-01
    provides: "label and isFallow fields on FieldEnterprise schema, partial unique index"
provides:
  - "generateLotNumber with optional label suffix for split-field disambiguation"
  - "POST /api/field-enterprises returns acreWarning and acreReconciliation in response"
  - "PUT /api/field-enterprises/[id] returns acreWarning and acreReconciliation; regenerates lotNumber on label/crop change"
  - "GET /api/fields returns acreUtilization for multi-enterprise fields, null for single-enterprise"
affects:
  - 06-split-field-ui
  - any UI component displaying field enterprises or field lists

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Acre reconciliation computed on read, never stored — fallow = field.totalAcres - sum(plantedAcres)"
    - "Label suffix appended to lot number: replace non-alphanumeric, take 4 chars uppercase"
    - "Parallel Promise.all for sibling enterprise query + field query after write"
    - "Warning-only over-allocation: acreWarning string or null, saves never blocked"

key-files:
  created: []
  modified:
    - organic-cert/src/lib/lot-generator.ts
    - organic-cert/src/app/api/field-enterprises/route.ts
    - organic-cert/src/app/api/field-enterprises/[id]/route.ts
    - organic-cert/src/app/api/fields/route.ts

key-decisions:
  - "Over-allocation: yellow warning (acreWarning string), saves allowed — not blocked"
  - "acreUtilization only on fields with 2+ enterprises in current crop year; single-enterprise gets null"
  - "generateLotNumber label suffix: strip non-alphanumeric, 4-char uppercase — North 40 -> NORT"
  - "PUT route regenerates lotNumber whenever label, crop, or cropYear changes"

patterns-established:
  - "Acre reconciliation response shape: {acreWarning, acreReconciliation: {totalPlanted, fieldTotal, fallowAcres, isOverAllocated}}"
  - "acreUtilization shape: {planted, total, fallow, isOverAllocated} or null"

requirements-completed: [ACRE-01, ACRE-02, ACRE-03]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 5 Plan 02: Acre Reconciliation & Lot Number Label Suffix Summary

**Lot number label suffix (e.g., NORT for "North 40") plus warning-only acre reconciliation across POST/PUT enterprise routes and multi-enterprise acreUtilization on GET fields**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T17:05:56Z
- **Completed:** 2026-02-27T17:07:56Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments
- `generateLotNumber` accepts optional `label` parameter; null/undefined produces backward-compatible base lot number; non-null appends 4-char uppercase suffix (e.g., "2026-CORN-KOPP-NORT")
- POST and PUT enterprise routes now return `acreWarning` (string or null) and `acreReconciliation` object computed post-save using parallel field+sibling queries
- PUT route regenerates lot number whenever `label`, `crop`, or `cropYear` changes in the update body
- GET fields route returns `acreUtilization` for fields with 2+ enterprises in current crop year; single-enterprise fields return `null`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add label parameter to lot number generator** - `3fdefe1` (feat)
2. **Task 2: Add acre reconciliation to enterprise POST/PUT and field GET routes** - `8aecbc0` (feat)

## Files Created/Modified
- `organic-cert/src/lib/lot-generator.ts` - Added optional `label` parameter with 4-char alphanumeric suffix logic
- `organic-cert/src/app/api/field-enterprises/route.ts` - POST now uses `generateLotNumber` with label, returns `acreWarning` + `acreReconciliation`
- `organic-cert/src/app/api/field-enterprises/[id]/route.ts` - PUT includes `field` in existing lookup, regenerates lot number, returns reconciliation data
- `organic-cert/src/app/api/fields/route.ts` - GET computes `acreUtilization` for multi-enterprise fields using current year filter

## Decisions Made
- Over-allocation is warning-only per locked user decision: `acreWarning` is a descriptive string when `totalPlanted > field.totalAcres`, but the save proceeds normally
- `acreUtilization` on GET /api/fields uses `new Date().getFullYear()` to filter current-year enterprises — aligns with what a user would see when managing their active crop year
- PUT route pulls `include: { field: true }` on the existing lookup so field name is available for lot number regeneration without an extra query
- Pre-existing TypeScript error in `sync-registry/route.ts` (wrong `logAudit` call signature) is out of scope — deferred to `deferred-items.md`

## Deviations from Plan

### Auto-fixed Issues

None strictly, but one adaptation:

**[Implicit fix] POST route refactored import from `abbreviateCrop/abbreviateField` to `generateLotNumber`**
- **Found during:** Task 2 (POST route)
- **Issue:** Original POST route imported `abbreviateCrop` and `abbreviateField` directly and built the lot number inline. Task 1 added `generateLotNumber` as the canonical function to call. The import needed updating.
- **Fix:** Replaced `import { abbreviateCrop, abbreviateField }` with `import { generateLotNumber }` and called `generateLotNumber(body.cropYear, body.crop, fieldForLot.name, body.label)` instead of the inline template literal.
- **Files modified:** `src/app/api/field-enterprises/route.ts`
- **Committed in:** `8aecbc0` (Task 2 commit)

---

**Total deviations:** 1 minor adaptation (rule-aligned refactor of import to use canonical function)
**Impact on plan:** No scope creep. The change was required to wire Task 1 into Task 2 correctly.

## Issues Encountered

- `sync-registry/route.ts` has a pre-existing TypeScript error (calls `logAudit("SYNC_REGISTRY", "system", {...})` with 3 positional args, but `logAudit` takes a single object). This is unrelated to Plan 02 changes. Deferred to `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Acre reconciliation API layer is complete and type-safe
- UI can consume `acreWarning` for yellow-warning display on enterprise create/update forms
- UI can consume `acreUtilization` from GET /api/fields to show field-level allocation summaries
- Phase 06 (split-field UI) can proceed immediately

---
*Phase: 05-split-field-schema-acre-reconciliation*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: organic-cert/src/lib/lot-generator.ts
- FOUND: organic-cert/src/app/api/field-enterprises/route.ts
- FOUND: organic-cert/src/app/api/field-enterprises/[id]/route.ts
- FOUND: organic-cert/src/app/api/fields/route.ts
- FOUND: .planning/phases/05-split-field-schema-acre-reconciliation/05-02-SUMMARY.md
- FOUND commit: 3fdefe1 (Task 1)
- FOUND commit: 8aecbc0 (Task 2)
