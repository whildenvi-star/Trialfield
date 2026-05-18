---
phase: 02-offline-sync
plan: "02"
subsystem: ui
tags: [react, tailwind, indexeddb, supabase, pwa, offline-sync]

# Dependency graph
requires:
  - phase: 02-offline-sync/02-01
    provides: useSyncStatus hook, SyncState/SyncStatus types, ConflictRecord type, IDB v4 schema
  - phase: 01-mobile-shell
    provides: protected layout with md:hidden mobile section, MobileHeader mount point
provides:
  - SyncStatusBanner: three-state slim banner (Offline/Syncing/Error), stateless, driven by props
  - QueueDetailSheet: native bottom sheet listing pending IDB queue items read-only
  - SyncStatusProvider: client wrapper with Supabase token getter, mounts banner + auto-dismiss toast
  - protected layout updated: SyncStatusProvider visible from every protected page on mobile
affects:
  - 02-03 (conflict drawer — receives same sync:conflicts CustomEvent from useSyncStatus)
  - any future phase touching layout.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - mounted guard in client component prevents SSR hydration mismatch on navigator.onLine
    - CustomEvent listener pattern (sync:completed) decouples toast from sync hook
    - useRef for Supabase client singleton (stable reference across renders)
    - getToken validates with getUser() before getSession() to prevent stale token return

key-files:
  created:
    - src/components/pwa/sync-status-banner.tsx
    - src/components/pwa/queue-detail-sheet.tsx
    - src/components/pwa/sync-status-provider.tsx
  modified:
    - src/app/(protected)/layout.tsx

key-decisions:
  - "QueueDetailSheet implemented as native fixed bottom sheet — @radix-ui/react-dialog not in project dependencies"
  - "SyncStatusProvider uses useRef(createClient()) for stable Supabase browser client across renders"
  - "getToken uses getUser() + getSession() pattern (validate session, then read token) — consistent with crop-plans page"
  - "Banner placed after MobileHeader inside md:hidden div — banner below header, above content on mobile"

patterns-established:
  - "mounted guard (useEffect sets true): prevents SSR hydration mismatch when reading navigator.onLine"
  - "CustomEvent bus (sync:completed/sync:conflicts): decouples sync hook from UI components"

requirements-completed: [MSYNC-01]

# Metrics
duration: 9min
completed: 2026-05-18
---

# Phase 02 Plan 02: Sync Status Banner Summary

**Three-component sync status UI — SyncStatusBanner/QueueDetailSheet/SyncStatusProvider — wired into protected layout so mobile users see offline/syncing/error state from every page**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-18T16:44:17Z
- **Completed:** 2026-05-18T16:53:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SyncStatusBanner renders null when online+idle+empty; shows correct state-labeled strip for Offline/Syncing/Error with glomalin-danger/info tokens
- QueueDetailSheet opens from banner tap; reads both IDB queues at open time; lists item type + formatted timestamp; read-only with Escape + backdrop close
- SyncStatusProvider supplies Supabase browser token getter to useSyncStatus; mounted guard prevents SSR mismatch; auto-dismiss 3s toast on sync:completed CustomEvent
- SyncStatusProvider mounted in layout.tsx md:hidden section — banner visible from every protected page without needing it in each individual form

## Task Commits

Each task was committed atomically:

1. **Task 1: SyncStatusBanner and QueueDetailSheet** - `a881cb5` (feat)
2. **Task 2: SyncStatusProvider and layout mount** - `732cb74` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/components/pwa/sync-status-banner.tsx` - Three-state stateless banner; returns null when online+idle+empty; sheetOpen internal state only
- `src/components/pwa/queue-detail-sheet.tsx` - Native fixed bottom sheet; reads both IDB queues on open; formatTimestamp handles both ISO string and epoch number
- `src/components/pwa/sync-status-provider.tsx` - Client wrapper; useRef Supabase client; useSyncStatus integration; sync:completed toast; mounted guard
- `src/app/(protected)/layout.tsx` - Added SyncStatusProvider import + JSX mount after MobileHeader in md:hidden section

## Decisions Made
- **QueueDetailSheet as native sheet:** @radix-ui/react-dialog is not in project dependencies (not in node_modules). Implemented a thin fixed-overlay + bottom-slide native sheet with CSS; avoids installing new dependencies mid-phase.
- **useRef(createClient()) for Supabase client:** Prevents creating a new client on every render while keeping initialization in the component (not at module scope — avoids SSR issues).
- **getToken pattern:** Replicates the `getUser() then getSession()` pattern from crop-plans page — validates session is active before using the access token.
- **Banner placement:** After MobileHeader inside existing md:hidden div (not a separate div) — keeps DOM structure minimal and ensures banner appears below header, above main content on mobile.

## Deviations from Plan

None - plan executed exactly as written. The only discretionary decision was the QueueDetailSheet implementation style (native sheet vs Radix Dialog) which was pre-anticipated in the plan with "Claude's discretion on direction."

## Issues Encountered
None — @radix-ui/react-dialog confirmed absent before starting, native sheet approach chosen proactively per plan's direction guidance.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02-03 (Conflict Resolution Drawer) can now import SyncStatusProvider and listen for the sync:conflicts CustomEvent already dispatched by useSyncStatus
- All four files TypeScript-clean (0 errors)
- Banner visible from every protected page on mobile — Phase 2 primary user-facing output delivered

---
*Phase: 02-offline-sync*
*Completed: 2026-05-18*
