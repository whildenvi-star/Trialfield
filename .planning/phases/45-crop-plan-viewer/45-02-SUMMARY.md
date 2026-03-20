---
phase: 45-crop-plan-viewer
plan: 02
subsystem: ui
tags: [mobile, pwa, crop-plans, indexeddb, offline, next.js, tailwind]

# Dependency graph
requires:
  - phase: 45-crop-plan-viewer
    plan: 01
    provides: GET /api/mobile/crop-plans and /api/mobile/crop-plans/[fieldId] BFF endpoints
  - phase: 44-pwa-infrastructure
    plan: 02
    provides: cropPlanCache IndexedDB API and CachedCropPlan/OfflineDB types

provides:
  - Mobile-first field list page at /crop-plans with enterprise grouping, real-time search, Last Synced badge, pull-to-refresh
  - Field detail page at /crop-plans/[fieldId] with crop info, inputs with totals, pass checklist with CONFIRMED/PLANNED badges
  - crop-plan-sync.ts utility — sync from API, write to IndexedDB, read from cache when offline
  - OfflineBanner reusable component — thin amber banner when navigator.onLine is false

affects:
  - 46-pass-confirmation
  - 47-offline-sync
  - 48-pwa-shell

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline SVG icons (lucide-react not installed — SVGs inlined per install-prompt.tsx pattern)
    - formatRelativeTime inline helper (date-fns not installed)
    - SSR guard at function level in sync utility (typeof window === 'undefined')
    - touchstart/touchmove pull-to-refresh without library
    - sessionStorage scroll position restore on list page

key-files:
  created:
    - glomalin-portal/src/lib/offline/crop-plan-sync.ts
    - glomalin-portal/src/components/pwa/offline-banner.tsx
    - glomalin-portal/src/app/(protected)/crop-plans/page.tsx
    - glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx

key-decisions:
  - "Inline SVGs instead of lucide-react — consistent with existing install-prompt.tsx pattern, no new dependency"
  - "formatRelativeTime inline helper instead of date-fns — not installed, simple enough to inline"
  - "db.ts and types.ts restored from git history — files were committed but absent from working tree (blocking issue auto-fixed per Rule 3)"
  - "List page caches minimal CropPlanListItem shape to IndexedDB on sync; detail page overwrites with full shape"

patterns-established:
  - "Offline fallback pattern: try API sync → on failure, fall back to getCachedCropPlans()/getCachedCropPlan()"
  - "SSR guard: typeof window === 'undefined' guard at function entry in all crop-plan-sync exports"

requirements-completed: [CPV-02, CPV-03, CPV-04]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 45 Plan 02: Crop Plan Viewer UI Summary

**Mobile-first crop plan viewer with enterprise-grouped field list (search, pull-to-refresh, Last Synced badge), single-page field detail (crop info, inputs with totals, pass checklist), and IndexedDB offline cache via crop-plan-sync utility**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T02:58:59Z
- **Completed:** 2026-03-20T03:07:00Z
- **Tasks:** 2 (Task 3 is human-verify checkpoint — paused)
- **Files modified:** 4

## Accomplishments

- Created crop-plan-sync.ts with syncCropPlans, syncCropPlanDetail, getCachedCropPlans, getCachedCropPlan, getLastSyncTime — all SSR-safe
- Created OfflineBanner client component — amber banner when offline, renders null when online, no hydration mismatch
- Created /crop-plans list page with enterprise grouping, real-time search, aging Last Synced badge (amber >24h, red >48h), pull-to-refresh, scroll restore
- Created /crop-plans/[fieldId] detail page with crop info section, inputs with rate + total calculation, pass checklist with CONFIRMED/PLANNED status badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Create offline sync utility and offline banner component** - `3584425` (feat)
2. **Task 2: Create field list page and field detail page** - `7870514` (feat)

## Files Created/Modified

- `glomalin-portal/src/lib/offline/crop-plan-sync.ts` - Sync API → IndexedDB, read from cache, SSR guards, CropPlanListItem interface
- `glomalin-portal/src/components/pwa/offline-banner.tsx` - Reusable offline status banner
- `glomalin-portal/src/app/(protected)/crop-plans/page.tsx` - Mobile field list with enterprise grouping, search, sync badge, pull-to-refresh
- `glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx` - Field detail page with crop info, inputs, pass checklist
- `glomalin-portal/src/lib/offline/db.ts` - Restored from git history (was missing from working tree)
- `glomalin-portal/src/lib/offline/types.ts` - Restored from git history (was missing from working tree)

## Decisions Made

- Inline SVGs used for icons — lucide-react is not installed, and the existing install-prompt.tsx component already uses inline SVGs, making this consistent with established project pattern
- formatRelativeTime is a simple inline helper — date-fns is not installed and the relative time logic is straightforward (< 1min, X min ago, Xh ago, Xd ago)
- List page caches a minimal CachedCropPlan (no inputs/passes) on sync so the cache is at least partially warm for offline; detail page caches the full shape on visit
- db.ts and types.ts were committed in Phase 44 (commit 6983565) but absent from the working tree — restored via git checkout to unblock the build (Rule 3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored lib/offline/db.ts and lib/offline/types.ts from git history**
- **Found during:** Task 1 (crop-plan-sync imports from ./db and ./types)
- **Issue:** Files committed in Phase 44-02 (commit 6983565) but not present on disk — imports would fail to compile
- **Fix:** `git checkout 6983565 -- glomalin-portal/src/lib/offline/db.ts glomalin-portal/src/lib/offline/types.ts`
- **Files modified:** glomalin-portal/src/lib/offline/db.ts, glomalin-portal/src/lib/offline/types.ts
- **Verification:** TypeScript compiles without errors after restore
- **Committed in:** 3584425 (Task 1 commit)

**2. [Rule 1 - Missing dependency] Used inline SVGs instead of lucide-react**
- **Found during:** Task 2 (field list and detail pages reference RefreshCw, ArrowLeft, Check, Circle icons)
- **Issue:** lucide-react not installed in glomalin-portal; existing pwa/install-prompt.tsx already uses inline SVGs
- **Fix:** Implemented all icons as inline SVG components within the page files
- **Files modified:** crop-plans/page.tsx, crop-plans/[fieldId]/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 7870514 (Task 2 commit)

**3. [Rule 1 - Missing dependency] Used inline formatRelativeTime instead of date-fns**
- **Found during:** Task 2 (Last Synced badge formatting)
- **Issue:** date-fns not installed in glomalin-portal
- **Fix:** Inline formatRelativeTime function covering: just now, X min ago, Xh ago, Xd ago
- **Files modified:** crop-plans/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 7870514 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing dependencies)
**Impact on plan:** All fixes necessary for compilation and correct operation. No scope creep. Feature behavior unchanged.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both pages are live and TypeScript-clean — awaiting human verification (Task 3 checkpoint)
- After verification: Phase 46 (pass confirmation) can read planned passes from /crop-plans/[fieldId] and POST confirmations to organic-cert
- OfflineBanner is reusable — Phase 46+ pages can import it from @/components/pwa/offline-banner
- crop-plan-sync.ts is available as a shared utility for any phase that needs to read/write the crop plan cache

---
*Phase: 45-crop-plan-viewer*
*Completed: 2026-03-20*

## Self-Check: PASSED

- crop-plan-sync.ts: FOUND
- offline-banner.tsx: FOUND
- crop-plans/page.tsx: FOUND
- crop-plans/[fieldId]/page.tsx: FOUND
- db.ts: FOUND
- types.ts: FOUND
- Commit 3584425: FOUND
- Commit 7870514: FOUND
