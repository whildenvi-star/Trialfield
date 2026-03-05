---
phase: 28-fsa-planting-workflow-ui
plan: 01
subsystem: ui
tags: [nextjs, supabase, react, fsa, clu-records, accordion, inline-edit, bulk-actions]

# Dependency graph
requires:
  - phase: 27-fsa-data-foundation-migration
    provides: clu_records Supabase table, PATCH/bulk-update API routes, CluRecord TypeScript type, ValidationWarning type, calc.ts
provides:
  - PATCH /api/fsa/clu-records/[id] — auth-gated single CLU field update (crop/irrigated/organic/grain_plant_date/use)
  - POST /api/fsa/clu-records/bulk-update — bulk mark-reported/unreported/assign-crop for arrays of IDs
  - CluWorkspace client container managing all FSA acreage reporting state
  - FarmAccordion/TractAccordion — grouped CLU display with smart default expansion for unreported records
  - CluCard — collapsed badge view + expanded inline edit with save/cancel flow
  - BulkActionBar — sticky z-50 bottom bar with ConfirmDialog for mark actions and inline CropTypeahead for assign
  - CropTypeahead — merges FSA_CROP_LIST with farm-budget proposals, filtered dropdown (top 10 startsWith)
  - ConfirmDialog — backdrop z-[60] centered card for bulk action confirmation
  - fsa-crop-list.ts — 39-item static FSA crop name list
affects: [28-02-PLAN.md, fsa-578 page, Plan 02 export buttons placeholder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "groupByFarmTract helper: farm_number → tract_number → CluRecord[] nested Record"
    - "Smart default expansion: lazy useState initializer computes unreported farms/tracts from initialRecords"
    - "Array.from(Set) pattern for all Set/Map iterations (TypeScript target compatibility)"
    - "Field whitelist in PATCH route: Set-based filter strips non-editable fields before update"
    - ".select().single() always chained after .update() — Supabase returns null data without it"
    - "warningsByRecordId: per-record warning derivation from aggregate ValidationWarning array"
    - "Export buttons placeholder div — Plan 02 will insert PDF/CSV buttons"

key-files:
  created:
    - glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts
    - glomalin-portal/src/app/api/fsa/clu-records/bulk-update/route.ts
    - glomalin-portal/src/lib/fsa/fsa-crop-list.ts
    - glomalin-portal/src/components/fsa/clu-workspace.tsx
    - glomalin-portal/src/components/fsa/farm-accordion.tsx
    - glomalin-portal/src/components/fsa/tract-accordion.tsx
    - glomalin-portal/src/components/fsa/clu-card.tsx
    - glomalin-portal/src/components/fsa/bulk-action-bar.tsx
    - glomalin-portal/src/components/fsa/crop-typeahead.tsx
    - glomalin-portal/src/components/fsa/confirm-dialog.tsx
  modified:
    - glomalin-portal/src/app/(protected)/app/fsa-578/page.tsx

key-decisions:
  - "Field whitelist in PATCH route uses Set(['crop','irrigated','organic','grain_plant_date','use']) — strips any extra fields silently, returns 400 on empty update"
  - "warningsByRecordId derived client-side from aggregate warnings array — no per-record API call needed"
  - "CluCard uses select dropdown (not free text) for practice/use field — common values: Non-Irrigated/Irrigated"
  - "BulkActionBar assign-crop is inline flow (CropTypeahead + Confirm/Cancel) not a modal — stays within the sticky bar"
  - "ConfirmDialog z-index is [60] (one above BulkActionBar z-50) — prevents backdrop from covering dialog card"
  - "Export buttons placeholder div in CluWorkspace header — Plan 02 will inject PDF/CSV buttons there"

patterns-established:
  - "FSA component props: always pass warningsByRecordId as Map<string,ValidationWarning[]>, never raw warnings array"
  - "Accordion smart expand: unreported = expanded by default (farm AND tract level)"
  - "CluCard draft state: re-initialized from record on isExpanded=true (prevents stale edits)"
  - "Bulk action confirmation: mark-reported/unreported always require ConfirmDialog; assign-crop uses inline flow"

requirements-completed: [FSA-02, FSA-03, FSA-04]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 28 Plan 01: FSA Planting Workflow UI Summary

**Card-based CLU management workflow: Farm/Tract accordions with inline editing, checkbox multi-select, sticky bulk action bar with confirmation, and crop typeahead merging FSA list with farm-budget proposals**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T15:30:17Z
- **Completed:** 2026-03-05T15:34:13Z
- **Tasks:** 2
- **Files modified:** 11 (1 rewrite + 10 new)

## Accomplishments

- Built complete CLU card-based UI with Farm/Tract accordion grouping — unreported farms/tracts start expanded by default
- Implemented inline CLU card editing (crop/use/planting date/organic) with PATCH save to Supabase and optimistic state update
- Built sticky bulk action bar with confirmation dialogs for mark-reported/unreported and inline crop assignment flow
- Created PATCH and bulk-update API routes with auth gates, field whitelisting, and proper `.select().single()` chains
- Replaced stub fsa-578 page with Server Component shell passing all 444 CLU records as initialRecords to CluWorkspace

## Task Commits

Each task was committed atomically:

1. **Task 1: PATCH/bulk-update routes + FSA crop list + CluWorkspace shell** - `572c0a0` (feat)
2. **Task 2: Farm/Tract accordions + CluCard + BulkActionBar + CropTypeahead + ConfirmDialog** - `13cf3f3` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts` — PATCH endpoint, field whitelist, .select().single()
- `glomalin-portal/src/app/api/fsa/clu-records/bulk-update/route.ts` — POST bulk mark/assign for ID arrays
- `glomalin-portal/src/lib/fsa/fsa-crop-list.ts` — 39-item static FSA crop list sorted alphabetically
- `glomalin-portal/src/app/(protected)/app/fsa-578/page.tsx` — rewritten as Server Component, passes initialRecords to CluWorkspace
- `glomalin-portal/src/components/fsa/clu-workspace.tsx` — client container: state, groupByFarmTract, smart defaults, bulk action handler
- `glomalin-portal/src/components/fsa/farm-accordion.tsx` — farm header with Select All, acres badge, tract iteration
- `glomalin-portal/src/components/fsa/tract-accordion.tsx` — tract header with unreported count, indented ml-4
- `glomalin-portal/src/components/fsa/clu-card.tsx` — collapsed badges (organic/reported/warning) + expanded inline edit
- `glomalin-portal/src/components/fsa/bulk-action-bar.tsx` — fixed bottom-0 z-50, inline assign-crop flow
- `glomalin-portal/src/components/fsa/crop-typeahead.tsx` — FSA list + farm-budget proposals, top-10 startsWith filter
- `glomalin-portal/src/components/fsa/confirm-dialog.tsx` — z-[60] backdrop, centered card, soil design tokens

## Decisions Made

- Field whitelist in PATCH route uses a Set — any fields outside the 5 editable fields are silently stripped; empty update body returns 400
- warningsByRecordId derived client-side from aggregate ValidationWarning types — maps missing-crop to records with no crop, missing-date to records with crop but no date, unreported to unreported records
- CluCard practice/use field is a select dropdown with Non-Irrigated/Irrigated options (not free text input)
- BulkActionBar assign-crop uses an inline CropTypeahead + Assign/Cancel within the sticky bar itself (not a modal)
- ConfirmDialog z-[60] sits one layer above BulkActionBar z-50 so the backdrop covers the bar correctly

## Deviations from Plan

None — plan executed exactly as written. All TypeScript types match calc.ts definitions. Array.from() used for all Set/Map iterations per Phase 27 established pattern.

## Issues Encountered

None — TypeScript compiled cleanly on first pass, Next.js build succeeded without errors.

## User Setup Required

None — no external service configuration required beyond Supabase credentials already in place from Phase 27.

## Next Phase Readiness

- Plan 28-01 complete: all CLU card UI components and API routes built and TypeScript/build verified
- Plan 28-02 (export: PDF/CSV Acreage Reporting Summary) can now inject PDF/CSV buttons into the `#export-buttons-placeholder` div in CluWorkspace header
- warningsByRecordId Map and CluWorkspace state management ready for any Phase 28-02 filter/highlight additions

---
*Phase: 28-fsa-planting-workflow-ui*
*Completed: 2026-03-05*
