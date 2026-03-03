---
phase: 18-rotation-snapshot-harvest-compilation-pdf
plan: 01
subsystem: api
tags: [nextjs, prisma, typescript, rotation, snapshot, fieldhistory, organic-cert]

# Dependency graph
requires:
  - phase: 17-input-seed-compilation-nop-compliance
    provides: compile page foundation, FieldEnterprise records, NOP compliance engine
  - phase: 16-field-enterprise-compilation
    provides: compile page structure, field mapping, preview/commit API pattern
provides:
  - buildSnapshotPreview() function reading FieldEnterprise and comparing FieldHistory
  - POST /api/rotation-snapshot/[year]/take with preview/commit modes + Prisma upsert
  - GET /api/rotation-snapshot/[year]/status returning snapshot existence + field count
  - GET /api/rotation-snapshot returning multi-year rotation data for all fields
  - Compile page snapshot warning banner (yellow when no snapshot exists)
  - Compile page "Rotation Snapshot" section with Take Snapshot button + success badge
  - Fields page collapsible "Rotation History" table with 3-year lazy-loaded data
affects:
  - phase 18-02 (harvest compilation)
  - phase 18-03 (PDF generation) — snapshot data feeds NOP 3-year history section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Snapshot-taker pure function pattern: reads source data, compares against existing, returns preview+summary with no DB writes
    - Upsert-only commit pattern: only rows with action !== 'unchanged' are written, using fieldId_year compound unique key
    - Lazy-load rotation history: Fields page fetches /api/rotation-snapshot only when section is expanded

key-files:
  created:
    - organic-cert/src/lib/compile/snapshot-taker.ts
    - organic-cert/src/app/api/rotation-snapshot/[year]/take/route.ts
    - organic-cert/src/app/api/rotation-snapshot/[year]/status/route.ts
    - organic-cert/src/app/api/rotation-snapshot/route.ts
  modified:
    - organic-cert/src/lib/compile/types.ts
    - organic-cert/src/app/(app)/compile/page.tsx
    - organic-cert/src/app/(app)/fields/page.tsx

key-decisions:
  - "snapshot-taker.ts groups FieldEnterprise by fieldId using Map — split fields produce concatenated crop string and notes detail"
  - "Only rows where action !== 'unchanged' are upserted in commit mode — avoids unnecessary DB writes on re-snapshot"
  - "Snapshot status check runs on initial load and year change (not on every render) — loadSnapshotStatus(year) called in both useEffects"
  - "Rotation history lazy-loads on expand — avoids API call for users who never expand the section"

patterns-established:
  - "Preview-then-commit: snapshot-taker returns SnapshotResult (preview rows + summary) that drives both GET preview and POST commit modes"
  - "Split-field crop string: multiple enterprises per field use ' / ' separator in crop, detail in notes"

requirements-completed: [ROT-01, ROT-02, ROT-03]

# Metrics
duration: 11min
completed: 2026-03-03
---

# Phase 18 Plan 01: Rotation Snapshot — Library, API Routes, Compile Page + Fields Page

**FieldHistory upsert engine with preview/commit API, compile page snapshot warnings, and lazy-loaded 3-year rotation table on Fields page**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-03T23:00:20Z
- **Completed:** 2026-03-03T23:11:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- snapshot-taker.ts pure function reads FieldEnterprise, groups by field, compares against FieldHistory, returns SnapshotPreviewRow[] with action tags (new/update/unchanged)
- Three API routes handle snapshot lifecycle: take (preview/commit), status (field count), and history (multi-year rotation data)
- Compile page shows yellow warning banner when no snapshot exists for selected year, green badge with field count after snapshot
- Fields page adds collapsible "Rotation History" section that lazy-loads 3-year table — fields as rows, years as columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Snapshot taker library + three API routes** - `bb676cd` (committed in prior 18-02 run, exact match to plan spec)
2. **Task 2: Compile page snapshot integration + Fields page rotation history table** - `5247b04` (feat)

Note: Task 1 files were already committed in the organic-cert repo by a prior session that executed plans out of order. Contents match the plan spec exactly. Task 2 is the new work in this execution.

## Files Created/Modified
- `organic-cert/src/lib/compile/snapshot-taker.ts` - Pure function: reads FieldEnterprise, groups by field, compares FieldHistory, returns SnapshotResult
- `organic-cert/src/app/api/rotation-snapshot/[year]/take/route.ts` - POST route: preview/commit modes with Prisma upsert on fieldId_year unique key
- `organic-cert/src/app/api/rotation-snapshot/[year]/status/route.ts` - GET route: FieldHistory count for year, returns exists + fieldCount
- `organic-cert/src/app/api/rotation-snapshot/route.ts` - GET route: multi-year FieldHistory grouped by field, returns RotationRow[]
- `organic-cert/src/lib/compile/types.ts` - Added SnapshotPreviewRow, SnapshotResult, RotationRow interfaces
- `organic-cert/src/app/(app)/compile/page.tsx` - Added snapshot state, loadSnapshotStatus(), handleTakeSnapshot(), warning banner, snapshot section
- `organic-cert/src/app/(app)/fields/page.tsx` - Added rotation state, loadRotationHistory(), toggleRotation(), collapsible rotation table

## Decisions Made
- Split-field crop concatenation uses " / " separator (plan spec) — notes field preserves per-enterprise crop+acres detail
- Only action !== 'unchanged' rows are upserted in commit mode — idempotent, no unnecessary writes
- Snapshot status loaded on initial page load and on year change — not on every render
- Rotation history lazy-loads on expand — avoids API call overhead for users who never open the section

## Deviations from Plan

None - plan executed exactly as written. Task 1 files were pre-committed by a prior session executing Phase 18 plans out of order, but the implementation matches the plan spec precisely.

## Issues Encountered
- Prior session had already executed the 18-02 plan (harvest compilation) and committed Task 1 artifacts (snapshot-taker.ts, 3 API routes) to organic-cert's git repo. This was discovered during execution. The committed code matched the plan spec exactly, so Task 1 was documented as complete and Task 2 executed fresh.

## Next Phase Readiness
- Phase 18-02 (Harvest Compilation) already completed by prior session — harvest-mapper.ts and compile route exist
- Phase 18-03 (PDF generation) can now read FieldHistory for NOP 3-year rotation history
- FieldHistory records are created via snapshot; prior-year data (2024, 2025) can be back-filled by running Take Snapshot for each year

## Self-Check: PASSED

All files confirmed present on disk. Both commits (bb676cd, 5247b04) verified in organic-cert git log. TypeScript compiles cleanly with 0 errors.

---
*Phase: 18-rotation-snapshot-harvest-compilation-pdf*
*Completed: 2026-03-03*
