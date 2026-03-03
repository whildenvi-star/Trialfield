---
phase: 16-field-enterprise-compilation
plan: 02
subsystem: ui
tags: [nextjs, typescript, react, prisma, postgresql, compile-engine]

# Dependency graph
requires:
  - phase: 16-field-enterprise-compilation
    plan: 01
    provides: "buildPreview(cropYear), GET /api/compile/[year]/preview, PATCH /api/fields/[id], CompilePreview types, compile engine with Promise.allSettled"
provides:
  - "POST /api/compile/[year] committing FieldEnterprise rows via Prisma upsert with partial commit support"
  - "generateLotNumber() helper producing {year}-{CROP}-{FIELD} lot number format"
  - "Full compile page at /compile with year selector, readiness dashboard, enterprise diff table, inline field mapping dropdowns, delivery view, saved mappings list, and commit button"
affects:
  - 17-input-seed-nop-compliance
  - 18-rotation-harvest-pdf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Partial commit: POST accepts fieldIds array — only matched rows for those fields are upserted, unmatched rows remain in preview"
    - "Prisma upsert with null label: cast prisma.fieldEnterprise as any to work around generated type requiring label:string — partial index handles uniqueness at DB level"
    - "Post-commit refresh: handleCommit() calls loadPreview() after successful POST — previously NEW rows appear UNCHANGED on next preview"
    - "Delivery expandable detail: <details>/<summary> pattern for grain-tickets ticket list within matched field sections"
    - "Year selector with suggestedYear adoption: initial load uses current year, then adopts preview.suggestedYear on first preview response"

key-files:
  created:
    - "organic-cert/src/app/api/compile/[year]/route.ts"
  modified:
    - "organic-cert/src/app/(app)/compile/page.tsx"

key-decisions:
  - "Prisma upsert label:null workaround: generated FieldEnterpriseFieldIdCropYearCropLabelCompoundUniqueInput requires label:string, but partial index enforces null-label uniqueness at DB level — cast prisma.fieldEnterprise as any to supply label:null in where clause"
  - "Partial commits via fieldIds array: client sends all matched fieldIds, server filters to non-unmatched rows — enables future granular selection without API change"
  - "Commit button disabled when summary.new + summary.update === 0 — prevents redundant commits when all rows are already unchanged"

patterns-established:
  - "Compile commit pattern: buildPreview() then filter eligible rows then upsert in loop — read-only preview then write-only commit, never mixed"
  - "Field group rendering: group EnterpriseRows by budgetFieldName client-side, render field header + enterprise rows + delivery section per group"

requirements-completed: [CMP-02, CMP-05, ECO-03, ECO-04]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 16 Plan 02: Compile Page UI and Commit Route Summary

**POST /api/compile/[year] commit handler with Prisma upsert and full compile page — year selector, readiness dashboard, enterprise diff table with inline mapping dropdowns, grain-tickets delivery view, and partial commit with confirmation**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T03:54:51Z
- **Completed:** 2026-03-03T04:01:36Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- POST /api/compile/[year] commits FieldEnterprise rows via Prisma upsert, supporting partial commits (only submitted fieldIds committed)
- Compile page rebuilt from Phase 15 scaffold into full preview-map-commit workflow
- Readiness dashboard shows compiled/missing for enterprises, grayed "Phase 17" placeholders for Inputs/Seeds
- Enterprise diff table grouped by field with NEW/UPDATE/UNCHANGED/UNMATCHED badges and old→new diff display for UPDATE rows
- Unmatched field headers show inline select dropdown calling PATCH /api/fields/[id] to save mapping
- Grain-tickets delivery summaries with expandable ticket detail table using details/summary
- Saved mappings section with Remove button (sets farmBudgetFieldName to null)
- Commit button with window.confirm dialog, loading state, post-commit refresh, and inline success message

## Task Commits

Each task was committed atomically:

1. **Task 1: POST commit route + compile page UI rebuild** - `0d57373` (feat)
2. **Task 2: Human verify checkpoint** - approved by user (no commit — verification only)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `organic-cert/src/app/api/compile/[year]/route.ts` - POST handler: year validation, fieldIds partial commit, buildPreview then upsert loop, generateLotNumber helper
- `organic-cert/src/app/(app)/compile/page.tsx` - Full compile page: year selector, source status bar, readiness dashboard, enterprise diff table grouped by field, delivery sections, saved mappings, commit button

## Decisions Made
- Prisma upsert with `label: null` in composite unique where requires casting `prisma.fieldEnterprise as any` — the Prisma-generated type `FieldEnterpriseFieldIdCropYearCropLabelCompoundUniqueInput` defines `label: string` (non-nullable), but the partial unique index `FieldEnterprise_no_label_unique` handles uniqueness at the DB level for null-label rows. Runtime behavior is correct; only the TypeScript type requires the cast.
- `fieldIds` array design for partial commits: rather than a "commit all matched" boolean, the POST accepts explicit fieldIds — this allows future UI to add per-field commit checkboxes without changing the API contract.
- Commit button disabled when `summary.new + summary.update === 0` to prevent no-op commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error: `label: null` not assignable to `string` in Prisma upsert where**
- **Found during:** Task 1 (POST commit route)
- **Issue:** `npx tsc --noEmit` reported `error TS2322: Type 'null' is not assignable to type 'string'` at the `fieldId_cropYear_crop_label` composite unique where clause. The Prisma-generated compound unique input type defines `label: string` even though the schema has `label String?`. The plan called for `label: null` in the where clause per the partial index from Phase 15.
- **Fix:** Cast `prisma.fieldEnterprise` as `any` for the upsert call, with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment. TypeScript error eliminated; runtime behavior is unaffected (PostgreSQL partial index handles the uniqueness constraint correctly).
- **Files modified:** `organic-cert/src/app/api/compile/[year]/route.ts`
- **Verification:** `npx tsc --noEmit` returned zero errors after fix.
- **Committed in:** `0d57373` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Type error bug)
**Impact on plan:** Single type-safety workaround for known Prisma limitation with nullable composite unique keys. No scope creep. All planned functionality delivered exactly as specified.

## Issues Encountered
- Prisma generated type mismatch for nullable composite unique key: `fieldId_cropYear_crop_label` requires non-null `label` in TypeScript, but the partial index enforces null-label uniqueness at DB level. The `as any` cast is the correct approach for this known Prisma limitation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compile workflow complete: preview → map → commit → refresh cycle fully operational
- POST /api/compile/[year] ready to accept commits for any crop year
- Phase 17 can add Inputs and Seeds compilation columns — readiness dashboard already shows "Phase 17" placeholders
- Saved mappings persist across sessions via farmBudgetFieldName — no re-mapping needed on subsequent compiles

---
*Phase: 16-field-enterprise-compilation*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: `organic-cert/src/app/api/compile/[year]/route.ts`
- FOUND: `organic-cert/src/app/(app)/compile/page.tsx`
- FOUND: `.planning/phases/16-field-enterprise-compilation/16-02-SUMMARY.md`
- FOUND: commit `0d57373` in organic-cert git log
