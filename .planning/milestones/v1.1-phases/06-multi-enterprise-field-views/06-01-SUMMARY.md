---
phase: 06-multi-enterprise-field-views
plan: 01
subsystem: ui
tags: [react, next.js, field-views, multi-enterprise, badges, drill-down]

# Dependency graph
requires:
  - phase: 05-split-field-schema-acre-reconciliation
    provides: "Enterprise schema with label, isFallow, acreUtilization API response"
provides:
  - "Enterprise count badge and acre utilization display on field index cards"
  - "Multi-enterprise season cards with enterprise rows and drill-down links on field history page"
  - "EnterpriseRow inline component for consolidated season card display"
  - "New Enterprise link on field history page with fieldId pre-population"
affects: [06-02, pdf-reports, field-enterprises]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-enterprise season card branching, EnterpriseRow drill-down pattern]

key-files:
  created: []
  modified:
    - "organic-cert/src/app/(app)/fields/page.tsx"
    - "organic-cert/src/app/(app)/fields/[id]/history/page.tsx"

key-decisions:
  - "Enterprise count computed client-side from enterprises array filtered by current crop year"
  - "Multi-enterprise season cards show consolidated header with enterprise rows instead of timeline"
  - "Single-enterprise seasons render exactly as before for backward compatibility"
  - "EnterpriseRow uses window.location.href for drill-down navigation to /field-enterprises/{id}"
  - "Fallow enterprises shown with muted/italic styling in enterprise rows"

patterns-established:
  - "Multi-enterprise branching: 0 enterprises = empty card, 1 = full timeline, 2+ = consolidated with EnterpriseRow"
  - "EnterpriseRow pattern: inline component for enterprise summary with drill-down ChevronRight"

requirements-completed: [VIEW-01, VIEW-02, VIEW-04]

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 6 Plan 01: Multi-Enterprise Field Views Summary

**Enterprise count badges and acre utilization on field cards, multi-enterprise season cards with drill-down enterprise rows on history page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T17:28:00Z
- **Completed:** 2026-02-28T17:34:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Field index cards now show enterprise count badge (e.g., "3 enterprises") and acre utilization ("120.0 of 160.0 ac") for multi-enterprise fields
- Over-allocated warning badge appears on field cards when planted acres exceed field totalAcres
- Field history page renders multi-enterprise seasons as consolidated cards with EnterpriseRow components showing crop, label, acres, operation count, organic status, and drill-down navigation
- Single-enterprise fields and seasons render unchanged (full backward compatibility)
- "New Enterprise" link added to field history page header and multi-enterprise season cards with fieldId pre-populated

## Task Commits

Each task was committed atomically:

1. **Task 1: Add enterprise count badge and acre utilization to field index cards** - `6531538` (feat)
2. **Task 2: Refactor history page for multi-enterprise season cards with enterprise rows** - `ae93391` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `organic-cert/src/app/(app)/fields/page.tsx` - Added FieldEnterpriseSummary interface, acreUtilization to Field interface, enterprise count badge with Sprout icon, acre utilization display, over-allocated warning badge
- `organic-cert/src/app/(app)/fields/[id]/history/page.tsx` - Added Phase 5 fields to Enterprise interface, refactored enterpriseByYear to enterprisesByYear (Map of arrays), added EnterpriseRow inline component, implemented 3-way season card branching (empty/single/multi), added New Enterprise link

## Decisions Made
- Enterprise count is computed client-side from the enterprises array (already returned by API) filtered to current crop year, rather than adding a separate API field
- Multi-enterprise season cards show consolidated header with enterprise count and total planted acres, then iterate EnterpriseRow components -- no inline timeline for multi-enterprise seasons (drill down to individual enterprise for timeline)
- Single-enterprise seasons render the full timeline exactly as before, preserving backward compatibility
- EnterpriseRow drill-down uses window.location.href to navigate to /field-enterprises/{id} since the page exists in the app
- Fallow enterprises display with italic text and muted stone-400 color to visually distinguish from active crop enterprises

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- organic-cert/ has its own git repository (separate from the parent project repo), so commits were made within the organic-cert repo rather than the parent. This is consistent with the existing project structure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Field index cards and history page now support multi-enterprise views
- Ready for Plan 02 (enterprise detail page, PDF report updates, or additional multi-enterprise UI)
- The /field-enterprises/{id} detail page referenced by drill-down links needs to exist (may be in Plan 02 scope)

## Self-Check: PASSED

- FOUND: organic-cert/src/app/(app)/fields/page.tsx
- FOUND: organic-cert/src/app/(app)/fields/[id]/history/page.tsx
- FOUND: .planning/phases/06-multi-enterprise-field-views/06-01-SUMMARY.md
- FOUND: commit 6531538 (Task 1)
- FOUND: commit ae93391 (Task 2)
- TypeScript compiles without errors

---
*Phase: 06-multi-enterprise-field-views*
*Completed: 2026-02-28*
