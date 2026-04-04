---
phase: 68-compliance-hub-redesign
plan: 01
subsystem: ui
tags: [next.js, tailwind, supabase, compliance, tab-routing, url-params]

# Dependency graph
requires: []
provides:
  - StatCard metric display component with variant colors
  - ComplianceBadge status indicator with 6 status variants
  - SectionTable shell with header/rows/empty-state
  - ActionButton primary/secondary/danger variants
  - Drawer slide-in panel with body scroll lock
  - /app/compliance route with 5-tab nav and URL-param routing
  - ComplianceShell client component with filter bar (debounced URL params)
affects:
  - 68-02 (Acreage tab mounts inside ComplianceShell)
  - 68-03 (Insurance and Claims tabs mount inside ComplianceShell)
  - 68-04 (Overview tab mounts inside ComplianceShell)
  - 68-05 (Calendar tab mounts inside ComplianceShell, nav consolidation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL param-driven tab routing with router.replace (no hard navigation)
    - Debounced filter inputs (300ms) writing to URL params for shareable state
    - Server component fetches counts then passes to client shell via props
    - Suspense boundary wraps ComplianceShell (required for useSearchParams in Next.js 14)
    - Barrel export pattern for component library (index.ts)

key-files:
  created:
    - glomalin-portal/src/components/compliance/ui/stat-card.tsx
    - glomalin-portal/src/components/compliance/ui/compliance-badge.tsx
    - glomalin-portal/src/components/compliance/ui/section-table.tsx
    - glomalin-portal/src/components/compliance/ui/action-button.tsx
    - glomalin-portal/src/components/compliance/ui/drawer.tsx
    - glomalin-portal/src/components/compliance/ui/index.ts
    - glomalin-portal/src/app/(protected)/app/compliance/page.tsx
    - glomalin-portal/src/components/compliance/compliance-shell.tsx
  modified: []

key-decisions:
  - "Compliance shell uses router.replace with full param reconstruction to preserve tab+farm+crop across all navigation actions"
  - "Filter inputs use local controlled state debounced 300ms to URL — avoids router.replace on every keystroke"
  - "page.tsx uses Suspense wrapping ComplianceShell — required by Next.js 14 App Router for useSearchParams() in client components"
  - "Supabase count queries use head:true to avoid fetching row data — pure count for Overview stats"
  - "void expressions suppress TypeScript unused variable warnings for count props (used in future Overview tab)"

patterns-established:
  - "URL param-driven tab state: useSearchParams + router.replace, no useState for active tab"
  - "Debounced filter pattern: local useState input + useRef timeout + router.replace on settle"
  - "Server page fetches minimal data (counts only), passes to client shell as props"

requirements-completed: [COMP-01, COMP-02, COMP-03]

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 68 Plan 01: Compliance Hub Shell and UI Library Summary

**Five reusable compliance UI primitives plus /app/compliance route with 5-tab URL-param navigation and debounced farm/crop filter bar**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T03:59:25Z
- **Completed:** 2026-04-04T04:01:25Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built StatCard, ComplianceBadge, SectionTable, ActionButton, Drawer as reusable Tailwind-only primitives with glomalin design tokens
- Created /app/compliance route: server component fetches 3 Supabase counts (unreported CLUs, active policies, open claims) via Promise.all
- ComplianceShell client component with 5-tab nav (Overview/Acreage/Insurance/Claims/Calendar) driven by ?tab= URL param
- Unified filter bar with Farm/Crop text inputs debounced 300ms to URL params for shareable/bookmarkable filter state

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared compliance UI component library** - `91ba76a` (feat)
2. **Task 2: Compliance shell page with tab routing and filter bar** - `3508464` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `glomalin-portal/src/components/compliance/ui/stat-card.tsx` - Metric display card with variant colors (default/warning/critical/ok)
- `glomalin-portal/src/components/compliance/ui/compliance-badge.tsx` - Status badge for 6 compliance states
- `glomalin-portal/src/components/compliance/ui/section-table.tsx` - Table shell with header, rows, empty state
- `glomalin-portal/src/components/compliance/ui/action-button.tsx` - Button with primary/secondary/danger variants and sm/md sizes
- `glomalin-portal/src/components/compliance/ui/drawer.tsx` - Slide-in panel from right with body scroll lock
- `glomalin-portal/src/components/compliance/ui/index.ts` - Barrel export for all 5 primitives
- `glomalin-portal/src/app/(protected)/app/compliance/page.tsx` - Server component with count queries and Suspense boundary
- `glomalin-portal/src/components/compliance/compliance-shell.tsx` - Client shell with tab nav, filter bar, placeholder content

## Decisions Made
- Compliance shell uses full URL param reconstruction on all navigation to preserve tab+farm+crop state coherently
- Filter inputs maintain local controlled state with 300ms debounce to avoid router.replace on every keystroke
- Supabase count queries use `{ count: 'exact', head: true }` to avoid fetching row data — pure counts only
- `void` expressions used to suppress TypeScript unused variable warnings on count props (reserved for future Overview tab)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 primitive components available via `@/components/compliance/ui` barrel import
- ComplianceShell ready to mount real tab content — Plans 02, 03, 04, 05 replace placeholder `<p>` tags
- URL param pattern established: ?tab=, ?farm=, ?crop= — all workspace components should read these
- TypeScript compiles clean across entire glomalin-portal project

---
*Phase: 68-compliance-hub-redesign*
*Completed: 2026-04-04*
