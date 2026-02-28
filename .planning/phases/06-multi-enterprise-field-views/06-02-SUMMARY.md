---
phase: 06-multi-enterprise-field-views
plan: 02
subsystem: ui
tags: [react, next.js, form, breadcrumb, fallow, split-field, sonner, toast]

# Dependency graph
requires:
  - phase: 05-split-field-schema-acre-reconciliation
    provides: label, isFallow, fallowCostAmount, fallowCostCategory schema fields and acreWarning API response
  - phase: 06-multi-enterprise-field-views (plan 01)
    provides: field history page with "New Enterprise" link adding fieldId query param
provides:
  - Enterprise creation form with label, fallow toggle, and fallow cost fields
  - acreWarning toast display on over-allocated acre submissions
  - "Save & Add Another" workflow for bulk enterprise creation
  - Label column in enterprise table with fallow-specific styling
  - fieldId query parameter pre-selection for cross-page navigation
  - Breadcrumb navigation on enterprise detail (Fields > Field Name > Enterprise)
  - Label display in enterprise detail hero header
  - Fallow badge and cost display on enterprise detail page
affects: [06-multi-enterprise-field-views, pdf-reports, organic-cert-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [switch-toggle-conditional-fields, breadcrumb-navigation, save-and-add-another, query-param-pre-selection]

key-files:
  created: []
  modified:
    - organic-cert/src/app/(app)/field-enterprises/page.tsx
    - organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx

key-decisions:
  - "Use Switch component for fallow toggle (cleaner UX than checkbox for boolean toggle)"
  - "Fallow enterprises send crop='Fallow' to API (required field in schema)"
  - "Save & Add Another preserves fieldId and cropYear while clearing other fields"
  - "Breadcrumb links to /fields/{id}/history not /fields/{id} for direct access to enterprise list"

patterns-established:
  - "Switch-toggle conditional fields: isFallow toggle hides crop/variety, shows cost fields"
  - "Save & Add Another: reset form fields while preserving context (field, year)"
  - "Query param pre-selection: useSearchParams + useEffect for cross-page field pre-selection"
  - "Breadcrumb pattern: Fields > Field Name > Enterprise with ChevronRight separators"

requirements-completed: [VIEW-03, VIEW-05]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 06, Plan 02: Enterprise Form & Detail UI Summary

**Enterprise creation form with label/fallow fields, acreWarning toast, Save & Add Another workflow, and breadcrumb drill-down navigation on detail page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T17:28:28Z
- **Completed:** 2026-02-28T17:33:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Enterprise creation form extended with label input, fallow toggle, and conditional fallow cost fields
- acreWarning toast fires via sonner when API detects over-allocated acres
- "Save & Add Another" button enables rapid bulk enterprise creation preserving field/year context
- Label column added to enterprise table with fallow enterprises rendered in muted italic styling
- fieldId query parameter pre-selects field and auto-opens creation dialog for cross-page navigation
- Breadcrumb navigation on detail page: Fields > Field Name > Crop (Label) Year
- Hero header shows label in parentheses and fallow cost subtitle when applicable
- Fallow badge displayed alongside organic status badge

## Task Commits

Each task was committed atomically:

1. **Task 1: Add label, fallow fields to enterprise creation form and label column to table** - `fb88e05` (feat)
2. **Task 2: Add breadcrumb navigation and label display to enterprise detail page** - `ba5cabb` (feat)

## Files Created/Modified
- `organic-cert/src/app/(app)/field-enterprises/page.tsx` - Enterprise list page: added label/fallow form fields, acreWarning toast, Save & Add Another, Label column, fieldId query param handling
- `organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` - Enterprise detail page: breadcrumb navigation, label in hero header, fallow badge, fallow cost display

## Decisions Made
- Used Switch component (not Checkbox) for fallow toggle -- cleaner UX for binary on/off toggle
- Fallow enterprises send `crop: "Fallow"` to API since crop is a required schema field
- Save & Add Another preserves fieldId and cropYear, clears everything else (label, crop, variety, acres, fallow state)
- Breadcrumb links to `/fields/{id}/history` not `/fields/{id}` -- takes user directly to field enterprise history rather than basic field detail
- Search filter extended to include label text for discoverability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- organic-cert is a separate nested git repo (has its own .git directory), so commits are made within organic-cert/ not the parent project repo. This is consistent with prior phase execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Enterprise creation form and detail page now support split-field enterprises with labels and fallow designations
- Cross-page navigation complete: field history "New Enterprise" link -> pre-selected creation dialog -> created enterprise detail breadcrumb back to field
- Ready for PDF report updates to reflect split-field data in field list, history, and mass balance sections

## Self-Check: PASSED

All files exist, all commits verified, all key patterns present in modified files.

---
*Phase: 06-multi-enterprise-field-views*
*Completed: 2026-02-28*
