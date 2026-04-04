---
phase: 68-compliance-hub-redesign
plan: 02
subsystem: ui
tags: [next.js, tailwind, supabase, compliance, acreage-tab, clu-workspace, redirect]

# Dependency graph
requires:
  - 68-01 (ComplianceShell, ActionButton UI primitive)
provides:
  - AcreageTab wrapper with farm/crop array-level filtering and cross-tab navigation buttons
  - /app/compliance?tab=acreage renders full CLU workspace filtered by URL params
  - /app/fsa-578 redirects to /app/compliance?tab=acreage
affects:
  - 68-03 (Insurance and Claims tabs use same wrapper pattern)
  - 68-04 (Overview tab uses same cluRecords data from page.tsx)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Thin wrapper pattern: AcreageTab filters records array before passing to CluWorkspace (no workspace modification)
    - Wrapper-level cross-tab nav buttons calling navigateTab() — CluCard internal router.push cannot be intercepted without modifying workspace
    - Server-side redirect via next/navigation redirect() — replaces old page component entirely
    - Promise.all extended with fourth CLU records query — server fetches all data before hydration

key-files:
  created:
    - glomalin-portal/src/components/compliance/acreage-tab.tsx
  modified:
    - glomalin-portal/src/components/compliance/compliance-shell.tsx
    - glomalin-portal/src/app/(protected)/app/compliance/page.tsx
    - glomalin-portal/src/app/(protected)/app/fsa-578/page.tsx

key-decisions:
  - "AcreageTab uses wrapper-level View Insurance and File PP Claim buttons calling navigateTab() — CluCard has no callback props for these navigations and must not be modified"
  - "Farm filter matches against both farm_number and farm_name (case-insensitive substring) — handles numeric and named farm identifiers"
  - "CLU records fetched in page.tsx Promise.all (server component) and passed as props — avoids client-side fetch, records ready on first render"
  - "navigateTab signature widened from TabId to string in compliance-shell.tsx — AcreageTab passes tab names as strings without importing TabId"

requirements-completed: [COMP-04, COMP-05]

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 68 Plan 02: Acreage Tab Workspace Integration Summary

**AcreageTab thin wrapper mounts full CLU workspace inside compliance hub with farm/crop array-level filtering and wrapper-level cross-tab navigation; /app/fsa-578 redirects to /app/compliance?tab=acreage**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T04:03:45Z
- **Completed:** 2026-04-04T04:05:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `acreage-tab.tsx`: thin wrapper that filters CLU records by farm/crop URL params using `useMemo`, renders CluWorkspace with filtered records, adds View Insurance and File PP Claim wrapper buttons above the workspace that call `navigateTab()` to stay within the compliance hub
- Updated `compliance-shell.tsx`: added `cluRecords` and `cluLoadError` props, imported AcreageTab, replaced acreage tab placeholder with real tab rendering via `renderTabContent()` helper, widened `navigateTab` signature to accept `string` so AcreageTab can pass tab names without circular type import
- Updated `compliance/page.tsx`: extended `Promise.all` with a fourth CLU records query ordered by farm/tract/clu, passes `cluRecords` and `cluLoadError` to ComplianceShell
- Updated `fsa-578/page.tsx`: replaced full CluWorkspace page component with single-line server-side `redirect()` to `/app/compliance?tab=acreage`

## Task Commits

Each task was committed atomically:

1. **Task 1: AcreageTab wrapper with farm filter, cross-tab nav, and shell wiring** - `8003338` (feat)
2. **Task 2: Redirect /app/fsa-578 to compliance** - `d2ac417` (feat)

## Files Created/Modified
- `glomalin-portal/src/components/compliance/acreage-tab.tsx` (created) — Thin wrapper: farm/crop filter logic, CluWorkspace render, View Insurance + File PP Claim wrapper buttons
- `glomalin-portal/src/components/compliance/compliance-shell.tsx` (modified) — Added cluRecords/cluLoadError props, AcreageTab import, renderTabContent() with acreage branch
- `glomalin-portal/src/app/(protected)/app/compliance/page.tsx` (modified) — Extended Promise.all with CLU records query, passes cluRecords and cluLoadError as props
- `glomalin-portal/src/app/(protected)/app/fsa-578/page.tsx` (modified) — Replaced with redirect() to /app/compliance?tab=acreage

## Decisions Made
- Wrapper-level View Insurance and File PP Claim buttons call `navigateTab()` — CluCard has no callback props for these actions and modifying CluWorkspace is out of scope. Wrapper buttons provide the direct compliance-hub path; CluCard buttons still navigate to old routes which now redirect, so net behavior is equivalent
- Farm filter matches `farm_number` and `farm_name` (case-insensitive substring) — handles both numeric farm IDs and named farm references
- CLU records fetched server-side in `page.tsx` Promise.all — avoids client-side fetch, workspace data available on first render with no loading state
- `navigateTab` signature widened from `TabId` to `string` in `compliance-shell.tsx` — AcreageTab passes tab names without needing to import the TabId union type across component boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wrapper pattern proven: AcreageTab → Plan 03 can follow same pattern for InsuranceTab and ClaimsTab
- navigateTab callback available in shell — Plans 03/04 can use the same mechanism for cross-tab navigation from Insurance/Claims
- cluRecords already fetched in page.tsx — Plan 04 Overview tab can use them for unreported count display without additional queries
- TypeScript compiles clean across entire glomalin-portal project

---
*Phase: 68-compliance-hub-redesign*
*Completed: 2026-04-04*
