---
phase: 55-actionable-dashboard
plan: 02
subsystem: ui
tags: [nextjs, dashboard, action-items, client-component, offline-degradation, ssr]

# Dependency graph
requires:
  - phase: 55-actionable-dashboard
    plan: 01
    provides: GET /api/dashboard/action-items, ActionItemsResponse types, MODULE_SOURCES
  - phase: 48-grain-tickets-pwa-dashboard-caching
    provides: OfflineSummaryCards pattern for SSR initial prop + client re-fetch
affects: [56-aph-tracking, 57-grain-marketing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSR partial pre-fetch (Supabase only) passed as initial prop; client re-fetches full data on mount"
    - "Module groups keyed by MODULES array route lookup for group header deep-links"
    - "Severity icons as inline SVG (no emoji except checkmark empty state exception)"
    - "Source badge border per module: FSA=amber-700/40, INS=yellow-700/40, CLM=red-700/40, GT=glomalin-green/40, BUDG=blue-700/40"

key-files:
  created:
    - glomalin-portal/src/components/dashboard/action-items-list.tsx
  modified:
    - glomalin-portal/src/app/(protected)/dashboard/page.tsx

key-decisions:
  - "SSR pre-fetch is Supabase-only (fast) — Express data loads client-side on mount, avoiding slow SSR for Express apps"
  - "Module group header route resolved via MODULES.find(m => m.id === group.module).route — handles both native and embed modules"
  - "Dashboard subtitle changed to Action Items (from Farm Modules) to reflect new triage-first purpose"

requirements-completed: [DASH-02]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 55 Plan 02: Actionable Dashboard UI Summary

**ActionItemsList client component with SSR pre-fetch replacing static module card grid — dashboard is now a triage view showing severity-grouped action items with deep-links**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T12:44:49Z
- **Completed:** 2026-03-28T12:46:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created ActionItemsList client component (234 lines) rendering grouped action items with severity icons (warning=amber triangle, info=blue dot SVG), source badges with per-module border colors, age column, and deep-link rows via Next.js Link
- Component handles loading skeleton (3 pulse rows), empty state (checkmark SVG + "Nothing needs attention"), offline group degradation (dimmed opacity-50 + "(service offline)" + Unavailable tag)
- Rewrote dashboard/page.tsx to remove module card grid, OfflineSummaryCards, grantedModules/module_access query, and MODULES import; replaced with ActionItemsList and SSR partial pre-fetch of Supabase groups
- SSR builds partial ActionItemsResponse from CLU unreported count, insurance claim alerts, and open/overdue claims; client component re-fetches full data (including Express apps) on mount

## Task Commits

Each task was committed atomically:

1. **Task 1: Action items list client component** - `08fcb7d` (feat)
2. **Task 2: Rewire dashboard page to action items** - `2bf54a1` (feat)

## Files Created/Modified
- `glomalin-portal/src/components/dashboard/action-items-list.tsx` - Client component with groups, item rows, severity icons, source badges, deep-links, loading skeleton, empty state, offline degradation
- `glomalin-portal/src/app/(protected)/dashboard/page.tsx` - SSR pre-fetch of Supabase groups only, ActionItemsList wired in place of module card grid

## Decisions Made
- SSR pre-fetch is Supabase-only — Express apps (grain-tickets, farm-budget) can be slow or offline during development; fetching them server-side would slow every page load. Client component handles Express data on mount.
- Module group header navigates via `MODULES.find(m => m.id === group.module).route` — same source of truth as the rest of the portal for routing
- Subtitle changed from "Farm Modules" to "Action Items" — communicates the new triage-first dashboard purpose

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard UI complete; Phase 55 fully shipped (API + UI)
- TypeScript compiles clean, no blockers for next phases (56-aph-tracking, 57-grain-marketing)

---
*Phase: 55-actionable-dashboard*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: glomalin-portal/src/components/dashboard/action-items-list.tsx
- FOUND: glomalin-portal/src/app/(protected)/dashboard/page.tsx
- FOUND: .planning/phases/55-actionable-dashboard/55-02-SUMMARY.md
- FOUND commit: 08fcb7d (Task 1)
- FOUND commit: 2bf54a1 (Task 2)
