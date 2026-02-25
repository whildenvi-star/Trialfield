---
phase: 02-field-records-history
plan: 02
subsystem: ui
tags: [nextjs, react, tailwind, shadcn, field-history, timeline, filter-bar, date-fns, lucide-react]

# Dependency graph
requires:
  - phase: 02-field-records-history
    plan: 01
    provides: GET /api/fields/[id]/history endpoint and lastActivityDate/totalRecords on GET /api/fields
provides:
  - Field index upgrade with activity stats, search, and sort (card grid layout)
  - Field history timeline page with 3-year season grouping, operation cards, expand/collapse, filter bar
affects: [03-inspection-report-generation, field-history-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TimelineItem unification pattern — merge heterogeneous record types into unified sorted array
    - Client-side filter composition — independent filter predicates applied in sequence to unified item array
    - Hover-reveal action buttons on Link cards — prevent accidental navigation via stopPropagation
    - syncRunId provenance parsing — extract UUID from notes field to determine approval status without DB query

key-files:
  created:
    - organic-cert/src/app/(app)/fields/[id]/history/page.tsx
  modified:
    - organic-cert/src/app/(app)/fields/page.tsx

key-decisions:
  - "Card grid layout over table for field index — cards scale better to history links and show more stats per field without horizontal scrolling"
  - "TimelineItem interface unifies 4 record types into single chronological stream — avoids per-type rendering logic in season sections"
  - "syncRunId parsed from notes field (not SyncedOperation table join) — Phase 2 scope; full approval provenance deferred to Phase 3 per plan spec"
  - "MaterialUsage and FertilityEvent default to MANUAL dataSource — neither model has a dataSource column in the current schema"
  - "Year selector uses 3 preset windows (current 3-year, prior 3-year, oldest 3-year) — simpler UX than arbitrary offset input"
  - "Edit buttons rendered as disabled placeholders on expanded cards — Plan 03 will wire to manual entry Sheet form"

patterns-established:
  - "TimelineItem unification: map all enterprise sub-relations into typed TimelineItem[], sort by date, filter and render as single stream"
  - "Hover-reveal CRUD on Link cards: wrap card in Link, intercept edit/delete button clicks with e.stopPropagation() + e.preventDefault()"
  - "Client-side filter bar: Filters state object, applyFilters() pure function, DEFAULT_FILTERS constant for clear action"

requirements-completed: [FIELD-01, FIELD-02, FIELD-03, FIELD-04]

# Metrics
duration: 4min
completed: 2026-02-25
---

# Phase 2 Plan 02: Field Records & History — UI Layer Summary

**Card-grid field index with activity stats and sort plus a full 3-year field history timeline with unified operation cards, color-coded badges, expand/collapse detail, and a 5-filter filter bar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T03:21:07Z
- **Completed:** 2026-02-25T03:24:56Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 1

## Accomplishments

- Upgraded `fields/page.tsx` from table layout to responsive card grid — each card shows field name, acres, current crop, last activity date, organic status badge, and record count badge; cards link to `/fields/[id]/history`
- Added search (client-side name filter) and sort by name / acres / last-activity / record-count to field index
- Edit/delete buttons now use `stopPropagation` so they don't trigger navigation when the entire card is a `Link`
- Created `fields/[id]/history/page.tsx` — fetches from `GET /api/fields/[id]/history?offset={n}` and renders a vertical timeline
- Implemented `TimelineItem` unification: merges `fieldOperations`, `materialUsages`, `harvestEvents`, and `fertilityEvents` into one chronological stream per enterprise/season
- Season cards show summary stats (acres planted, application count, total yield) plus all operations sorted chronologically
- Empty season cards (no enterprise for year) display "No operations recorded" and a disabled "Add records" placeholder button
- Type badges color-coded: green=application, amber=harvest, blue=tillage, purple=planting, lime=fertility, stone=other
- Collapsed cards show date, badge, key metric, source icon; click to expand shows full detail fields, lot numbers, equipment, operator, notes
- Approval provenance for SYNCED records: parses `syncRunId: {uuid}` from notes field; shows sync source label + run ID prefix (no DB join per Phase 2 scope)
- Filter bar: operation type select, start/end date inputs, product name text input, data source select, approval status select; "Clear filters" button when any filter active
- Year selector: 3 preset 3-year window buttons; re-fetches API on change
- Print button: `window.print()` with `@media print` CSS hiding sidebar, nav, filter bar via Tailwind `print:hidden` utilities
- TypeScript clean throughout; no errors on `npx tsc --noEmit`

## Task Commits

Each task was committed atomically (commits in organic-cert repo):

1. **Task 1: Upgrade field index page with activity stats, search, and sort** - `bcf00fe` (feat)
2. **Task 2: Build field history timeline page with season grouping, operation cards, and filter bar** - `f303dc4` (feat)

## Files Created/Modified

- `organic-cert/src/app/(app)/fields/page.tsx` — Upgraded from table to responsive card grid with search, sort, activity stats, and navigation links to history page
- `organic-cert/src/app/(app)/fields/[id]/history/page.tsx` — New: full field history timeline page (811 lines) with season grouping, unified timeline items, color-coded operation cards, expand/collapse, filter bar, year selector, and print button

## Decisions Made

- **Card grid over table for field index:** Cards show more visual information (last activity, record count, organic status badge) without column overflow; chevron right icon clearly signals navigability to history page.
- **TimelineItem unification:** Rather than rendering 4 separate lists per season, all operation sub-types are mapped to a common `TimelineItem` interface and sorted by date. This simplifies the filter bar (single pass) and the rendering loop (single map).
- **syncRunId from notes, not DB join:** The plan explicitly scoped Phase 2 to show "Synced from Case IH FieldOps" label only. Full `SyncedOperation` join and "Approved by [name] on [date]" display is deferred to Phase 3. Notes field regex extraction is sufficient for approval status distinction.
- **MaterialUsage/FertilityEvent default MANUAL:** Neither model has a `dataSource` column in the Prisma schema (only `FieldOperation` and `HarvestEvent` have `DataSource`). These records default to MANUAL display in the UI, which is correct — these are always entered manually in Phase 2.
- **Three preset year windows:** Instead of an arbitrary offset stepper, three labeled preset buttons cover the practical audit range (current year, 3-6 years prior, 6-9 years prior) with less cognitive overhead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lucide-react icon `title` prop not supported**

- **Found during:** Task 2, TypeScript check
- **Issue:** Attempted to pass `title` attribute directly on `RefreshCw`/`Pencil` lucide icons — lucide-react `LucideProps` does not include `title` in its type definition
- **Fix:** Wrapped icons in a `<span title="...">` element — semantically equivalent, tooltip behavior identical
- **Files modified:** `organic-cert/src/app/(app)/fields/[id]/history/page.tsx`
- **Commit:** Included in `f303dc4`

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Field index fully upgraded — farm manager can browse all fields with activity stats
- History timeline ready for real data — all operation types render correctly
- Edit buttons are placeholder (disabled) — Plan 03 wires the manual entry Sheet form
- Filter bar and year selector fully functional — no blocking dependencies for Phase 2 Plan 03

---
*Phase: 02-field-records-history*
*Completed: 2026-02-25*
