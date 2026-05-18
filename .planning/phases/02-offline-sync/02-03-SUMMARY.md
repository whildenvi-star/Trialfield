---
phase: 02-offline-sync
plan: "03"
subsystem: ui
tags: [indexeddb, idb, conflict-resolution, sync, offline, pwa, react, next.js]

# Dependency graph
requires:
  - phase: 02-01
    provides: IDB schema v4 with conflicts store (by-resolved index), ConflictRecord type, useSyncStatus hook dispatching sync:conflicts event
  - phase: 02-02
    provides: SyncStatusProvider, SyncStatusBanner, QueueDetailSheet — sheet pattern to follow for ConflictDrawer

provides:
  - True data conflict detection in processQueue: 409 with serverPayload in body written as ConflictRecord to IDB
  - ConflictDrawer component: opens on sync:conflicts event, displays local+server payloads, two-button resolution, marks resolved:1 in IDB
  - ConflictDrawer mounted in protected layout md:hidden section alongside SyncStatusProvider

affects: [02-04, conflict-resolution, sync-engine, offline-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "409 body parsing: presence of serverPayload key distinguishes true conflict from already-confirmed skip"
    - "ConflictDrawer listens for CustomEvent sync:conflicts and reads IDB by-resolved index"
    - "Resolution marks resolved:1 in IDB only — no server reconciliation call in Phase 2"

key-files:
  created:
    - src/components/offline/conflict-drawer.tsx
  modified:
    - src/lib/offline/sync-engine.ts
    - src/app/(protected)/layout.tsx

key-decisions:
  - "409 body parsed in replayOperation: serverPayload/serverVersion key presence distinguishes true conflict from already-confirmed 409 skip — existing skip behavior unchanged"
  - "serverPayload returned in ReplayResult so processQueue can write ConflictRecord without re-reading consumed response body"
  - "Resolution marks resolved:1 locally only — no server reconciliation call in Phase 2 (field observations rarely conflict; safety net not merge engine)"
  - "ConflictDrawer does not open on page load — only on sync:conflicts event; unresolved conflicts sit quietly across sessions"

patterns-established:
  - "True data conflict pattern: 409 + serverPayload key in body → ConflictRecord in IDB; no serverPayload → silent skip"
  - "Conflict drawer lifecycle: always mounted (listens for event), only renders UI when conflicts present, auto-closes when all resolved"

requirements-completed: [MSYNC-02]

# Metrics
duration: 2min
completed: 2026-05-18
---

# Phase 2 Plan 03: Conflict Detection and Resolution Drawer Summary

**409 conflict detection with serverPayload body parsing writes ConflictRecord to IDB; ConflictDrawer shows both versions with two-button local-only resolution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-18T16:48:12Z
- **Completed:** 2026-05-18T16:50:32Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Extended `replayOperation` to parse 409 response body and return `serverPayload` when a competing server write is detected, distinguishing true conflicts from "already confirmed" skips
- Extended `processQueue` to write `ConflictRecord` to IDB conflicts store when `serverPayload` is present, and handle the same case in the 401 token-refresh retry path
- Created `ConflictDrawer` component following the sheet pattern from `queue-detail-sheet.tsx`: opens on `sync:conflicts` CustomEvent, reads unresolved conflicts from IDB by-resolved index, shows local + server payloads, two-button resolution, marks `resolved:1` in IDB
- Mounted `ConflictDrawer` in protected layout `md:hidden` section after `SyncStatusProvider`; both components co-exist correctly
- Full TypeScript pass with 0 errors across all three modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend sync-engine.ts to detect conflicts and persist ConflictRecord to IDB** - `0c1c45a` (feat)
2. **Task 2: Create conflict-drawer.tsx and mount in protected layout** - `dc3ed97` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/lib/offline/sync-engine.ts` - Extended ReplayResult with serverPayload field; 409 body parsing in replayOperation; ConflictRecord IDB write in processQueue
- `src/components/offline/conflict-drawer.tsx` - New conflict resolution drawer (created)
- `src/app/(protected)/layout.tsx` - Imported and mounted ConflictDrawer in md:hidden section

## Decisions Made
- `serverPayload` returned in `ReplayResult` rather than re-reading the response body in `processQueue` (body already consumed by `res.json()` call)
- 409 body check: presence of `serverPayload` or `serverVersion` key indicates a true data conflict; absence means "already confirmed" — existing skip behavior untouched
- Resolution marks `resolved:1` in IDB locally only — no server reconciliation call in Phase 2; field observations rarely conflict, this is a safety net not a merge engine
- `ConflictDrawer` does not open on page load — only on `sync:conflicts` event — so unresolved conflicts sit quietly across sessions without blocking UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended ReplayResult to carry serverPayload for conflict detection**
- **Found during:** Task 1 (Extend sync-engine.ts)
- **Issue:** Plan code snippet showed processQueue re-reading the 409 body, but `replayOperation` already consumes the response body with `res.json()`. The body cannot be read twice.
- **Fix:** Added `serverPayload?: Record<string, unknown>` to `ReplayResult` interface; parse body in `replayOperation` and return `serverPayload` when present; `processQueue` reads `replay.serverPayload` to write the ConflictRecord.
- **Files modified:** src/lib/offline/sync-engine.ts
- **Verification:** TypeScript passes, no double-body-read, existing behavior unchanged
- **Committed in:** 0c1c45a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - consumed response body pattern fix)
**Impact on plan:** Necessary correctness fix — HTTP response body can only be read once. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MSYNC-02 complete: conflicts surface visibly rather than failing silently
- ConflictDrawer mounted and listening for sync:conflicts events
- Ready for Phase 2 Plan 04 (remaining offline-sync tasks)
- No blockers

---
*Phase: 02-offline-sync*
*Completed: 2026-05-18*

## Self-Check: PASSED

- conflict-drawer.tsx: FOUND
- sync-engine.ts: FOUND
- layout.tsx: FOUND
- 02-03-SUMMARY.md: FOUND
- Commit 0c1c45a (Task 1): FOUND
- Commit dc3ed97 (Task 2): FOUND
