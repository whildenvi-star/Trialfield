---
phase: 68-compliance-hub-redesign
plan: 05
subsystem: ui
tags: [next.js, react, tailwind, compliance, calendar, modules, nav]

# Dependency graph
requires:
  - phase: 68-04
    provides: OverviewTab with StatCards, risk flags, deadline list — shell already had claimsData and cluRecords props
  - phase: 68-02
    provides: AcreageTab and compliance-shell structure
  - phase: 68-03
    provides: InsuranceTab and ClaimsTab, page.tsx data fetch
provides:
  - CalendarTab component with 90-day deadline list (FSA + Claims, color-coded urgency)
  - MODULES array consolidated to single compliance entry (fsa-578/insurance/claims replaced)
  - Nav bar now shows single "Compliance" entry pointing to /app/compliance
  - Dashboard action-item links updated to /app/compliance?tab=...
  - MODULE_SOURCES extended with compliance key
  - Full compliance hub (all 5 tabs) live on VPS
affects: [nav-bar, dashboard, action-items-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ClaimDeadline local interface for props that need partial claim shape (avoids importing full Claim type)
    - CluRecordExtended interface pattern for Supabase columns not yet in base TS type
    - Record<string, unknown> bracket access pattern for flexible claim shapes in overview rendering

key-files:
  created:
    - glomalin-portal/src/components/compliance/calendar-tab.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts
    - glomalin-portal/src/lib/action-items.ts
    - glomalin-portal/src/app/(protected)/dashboard/page.tsx
    - glomalin-portal/src/app/api/dashboard/action-items/route.ts
    - glomalin-portal/src/components/compliance/compliance-shell.tsx
    - glomalin-portal/src/components/compliance/claims-tab.tsx
    - glomalin-portal/src/components/compliance/overview-tab.tsx

key-decisions:
  - "CalendarTab uses ClaimDeadline interface (not Claim) — minimal shape needed for calendar rendering, avoids tight coupling"
  - "CluRecordExtended extends CluRecord with reporting_deadline/reported_date optional fields — safe fallback if columns don't exist at runtime"
  - "MODULE_SOURCES retains fsa-578/insurance/claims keys — route.ts uses them for label/badge lookups on group data"
  - "ESLint no-explicit-any fixed in compliance-shell-adjacent files using bracket notation on Claim index signature and typed interfaces"

patterns-established:
  - "CalendarTab: local interface for minimal claim shape needed by component — avoids coupling to full Claim import"
  - "Bracket access on Claim index signature: c['field'] instead of (c as any).field for ESLint compliance"

requirements-completed:
  - COMP-01
  - COMP-02
  - COMP-03
  - COMP-08

# Metrics
duration: 7min
completed: 2026-04-04
---

# Phase 68 Plan 05: Calendar Tab, Nav Consolidation, Dashboard Links Summary

**Unified compliance hub completed: CalendarTab with 90-day color-coded deadline list, single Compliance nav entry replacing three legacy entries, dashboard action-item links updated to /app/compliance?tab=..., deployed to VPS.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-04T04:14:17Z
- **Completed:** 2026-04-04T04:21:29Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- CalendarTab renders a chronological 90-day deadline timeline: claim deadlines via `deadline_at`, FSA deadlines via `reporting_deadline` (gracefully skipped if absent), with green/amber/red color coding by urgency
- MODULES array now has a single `compliance` entry (`/app/compliance`) replacing the three separate `fsa-578`, `insurance`, `claims` entries — nav bar shows one "Compliance" link
- All dashboard action-item links (both SSR page.tsx and API route.ts) updated from `/app/fsa-578`, `/app/insurance`, `/app/claims` to `/app/compliance?tab=acreage|insurance|claims`
- CalendarTab wired into compliance-shell replacing the placeholder; full compliance hub (all 5 tabs) live on VPS

## Task Commits

Each task was committed atomically:

1. **Task 1: Calendar tab, MODULES update, and dashboard link migration** - `717fdb3` (feat)
2. **Task 2: Wire CalendarTab into shell and deploy** - `7fa720d` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified
- `glomalin-portal/src/components/compliance/calendar-tab.tsx` — CalendarTab component, 90-day deadline list with FSA + Claim sources
- `glomalin-portal/src/lib/modules.ts` — Replaced fsa-578/insurance/claims entries with single compliance entry
- `glomalin-portal/src/lib/action-items.ts` — Added compliance key to MODULE_SOURCES; kept legacy keys for route.ts
- `glomalin-portal/src/app/(protected)/dashboard/page.tsx` — Updated 4 action-item link targets to /app/compliance?tab=...
- `glomalin-portal/src/app/api/dashboard/action-items/route.ts` — Updated 4 link targets to /app/compliance?tab=...
- `glomalin-portal/src/components/compliance/compliance-shell.tsx` — Imported CalendarTab, wired to calendar case, removed placeholder
- `glomalin-portal/src/components/compliance/claims-tab.tsx` — Fixed ESLint: (c as any) casts → bracket notation on Claim index signature (auto-fix)
- `glomalin-portal/src/components/compliance/overview-tab.tsx` — Fixed ESLint: (claims as any[]) → bracket access, added eslint-disable for _cluRecords (auto-fix)

## Decisions Made
- CalendarTab uses a local `ClaimDeadline` interface instead of importing the full `Claim` type — only needs `deadline_at`, `stage`, `crop`, `commodity`, `farm_name` for rendering
- `CluRecordExtended` interface extends `CluRecord` with optional `reporting_deadline` and `reported_date` — allows safe field access without casting to `any`
- MODULE_SOURCES retains `fsa-578`, `insurance`, `claims` keys even after nav consolidation — route.ts group data uses those module identifiers for label/badge lookup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESLint `no-explicit-any` errors blocking VPS build in claims-tab.tsx and overview-tab.tsx**
- **Found during:** Task 2 (deploy to VPS)
- **Issue:** VPS build failed with ESLint errors in `claims-tab.tsx` (4 `any` casts) and `overview-tab.tsx` (2 `any` casts + unused `_cluRecords`). These are pre-existing files from Plans 02 and 04 that had not been deployed to VPS yet — the errors only surfaced when the full build ran on the server.
- **Fix:** Replaced `(c as any).field` with `c['field']` bracket notation (valid since `Claim` has `[key: string]: unknown` index signature). Fixed `overview-tab.tsx` to use `Record<string, unknown>` bracket access throughout. Added `// eslint-disable-line` for intentionally unused `_cluRecords` param.
- **Files modified:** `claims-tab.tsx`, `overview-tab.tsx`
- **Verification:** Local `npx tsc --noEmit` clean; VPS build succeeded, BUILD_ID present at `/srv/farm-ops/glomalin-portal/.next/BUILD_ID`
- **Committed in:** `7fa720d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking build failure)
**Impact on plan:** Essential fix — VPS build was blocked by pre-existing ESLint errors in files that hadn't been deployed yet. No scope creep; only correctness fixes to enable deployment.

## Issues Encountered
- First rsync+build attempt failed: VPS runs strict ESLint (errors-as-failures) which local `tsc --noEmit` doesn't catch. Resolved by fixing `any` casts in `claims-tab.tsx` and `overview-tab.tsx` before second deploy attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 68 complete: all 5 compliance hub tabs (Overview, Acreage, Insurance, Claims, Calendar) are live on portal.whughesfarms.com
- Nav shows single "Compliance" entry; old routes (/app/fsa-578, /app/insurance, /app/claims) redirect via existing redirects from Plans 01-03
- Dashboard action-item links point to /app/compliance?tab=... tabs
- No blockers for subsequent work

## Self-Check: PASSED

- calendar-tab.tsx: FOUND
- modules.ts: FOUND (compliance entry present, fsa-578 removed)
- 68-05-SUMMARY.md: FOUND
- Commit 717fdb3: FOUND
- Commit 7fa720d: FOUND
- dashboard link updated: FOUND (/app/compliance?tab=acreage)

---
*Phase: 68-compliance-hub-redesign*
*Completed: 2026-04-04*
