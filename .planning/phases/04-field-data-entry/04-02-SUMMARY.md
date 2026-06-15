---
phase: 04-field-data-entry
plan: 02
subsystem: offline
tags: [indexeddb, idb, offline-first, react-hooks, queue, sync]

# Dependency graph
requires:
  - phase: 04-01
    provides: "ObservationForm component and /api/observations POST endpoint"
provides:
  - "observationQueue IDB helpers: add, getPending, markSynced, pendingCount, purgeOld"
  - "useObservationQueue hook: queue-first submit, online-event auto-sync, pendingCount, isSyncing, lastSyncMessage"
  - "SyncStatus component: pending count badge and syncing spinner"
  - "ObservationForm updated to queue-first pattern — no direct fetch, all via hook"
affects: [future-mobile-features, offline-improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Queue-first IDB write before upload — every submission persisted locally before network attempt"
    - "window 'online' event drives auto-sync drain — no polling, pure event-driven reconnect"
    - "synced field stored as 0|1 number (not boolean) for reliable IDB index queries"
    - "Safari Private Mode guard via indexedDB.open test on mount, fallback to direct upload"
    - "Version-gated DB upgrade: oldVersion < 2 adds observation-queue store to existing glomalin-offline DB"

key-files:
  created:
    - src/lib/offline/observation-queue.ts
    - src/hooks/useObservationQueue.ts
    - src/components/observations/SyncStatus.tsx
  modified:
    - src/lib/offline/types.ts
    - src/lib/offline/db.ts
    - src/components/observations/ObservationForm.tsx

key-decisions:
  - "synced stored as 0|1 number not boolean — IDB indexes on boolean false are browser-inconsistent, number 0 is reliable"
  - "DB_VERSION bumped from 1 to 2 with version-gated upgrade — preserves existing operation-queue and crop-plan-cache stores"
  - "Queue-first: IDB write happens before upload attempt — guarantees no data loss even if network dies mid-submission"
  - "Direct upload fallback when IDB unavailable — Safari Private Mode won't crash the form"
  - "purgeOld(7) fires on mount fire-and-forget — keeps IDB from growing unbounded without blocking UI"

patterns-established:
  - "Queue-first offline pattern: always write to IDB first, attempt upload second, leave failures in queue"
  - "Online event auto-sync: addEventListener('online', syncPending) + immediate sync on mount if navigator.onLine"
  - "IDB boolean indexes: store as 0|1 number not boolean for cross-browser reliability"

requirements-completed: [FIELD-03]

# Metrics
duration: 25min
completed: 2026-03-22
---

# Phase 04 Plan 02: Offline Queue Summary

**Queue-first IndexedDB observation queue with auto-sync on reconnect — farm crew observations survive spotty connectivity without user intervention**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-22T00:00:00Z
- **Completed:** 2026-03-22T00:25:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended glomalin-offline IndexedDB to version 2 with observation-queue store and by-synced index
- Queue-first submit pattern: every observation written to IDB before upload attempt, guaranteed offline persistence
- Auto-sync on reconnect via window 'online' event listener drains pending queue without user action
- SyncStatus component shows pending count badge and spinning sync indicator during drain
- Graceful Safari Private Mode fallback: IDB availability tested on mount, falls back to direct upload so form never crashes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add observation queue store to IndexedDB and create queue helpers** - `30d6f20` (feat)
2. **Task 2: Create useObservationQueue hook, SyncStatus component, and wire into ObservationForm** - `acc7c76` (feat)

**Plan metadata:** _(added in final docs commit)_

## Files Created/Modified

- `src/lib/offline/types.ts` - Added PendingObservation interface and observation-queue entry to OfflineDB schema
- `src/lib/offline/db.ts` - Bumped DB_VERSION to 2, added version-gated upgrade for observation-queue store
- `src/lib/offline/observation-queue.ts` - Queue helpers: add, getPending, markSynced, pendingCount, purgeOld
- `src/hooks/useObservationQueue.ts` - React hook with queue-first submit, online-event sync, pendingCount, isSyncing, lastSyncMessage
- `src/components/observations/SyncStatus.tsx` - Pending count badge and CSS spinner, returns null when idle
- `src/components/observations/ObservationForm.tsx` - Updated to use useObservationQueue hook instead of direct fetch

## Decisions Made

- `synced` stored as `0 | 1` number (not `boolean`) — IDB index on boolean `false` is unreliable across browsers; numeric `0` works consistently with `IDBKeyRange.only(0)`
- DB_VERSION bumped from 1 to 2 with `if (oldVersion < 2)` guard — preserves existing stores on upgrade, correct pattern for incremental IDB schema evolution
- IDB write happens before upload attempt — this is the queue-first guarantee: even if the network call throws immediately, the observation is already persisted locally
- Safari Private Mode detected via `indexedDB.open('idb-test')` on mount — if it errors, `idbAvailable` ref is set false and all submissions fall through to direct upload

## Deviations from Plan

None — plan executed exactly as written. The plan's note about `synced` boolean indexing reliability was heeded and `0|1` number storage was chosen from the start.

## Issues Encountered

None — TypeScript passed cleanly on new files. Pre-existing `.next/types` errors are stale build artifacts unrelated to this plan.

## User Setup Required

None — no external service configuration required. The observation-queue store is created automatically on next browser open via the DB_VERSION upgrade path.

## Next Phase Readiness

- Phase 04 complete: field observations API (plan 01) + offline queue with auto-sync (plan 02)
- FIELD-01, FIELD-02, FIELD-03 all satisfied
- Ready for phase 05 when planned

## Self-Check: PASSED

- FOUND: src/lib/offline/observation-queue.ts
- FOUND: src/hooks/useObservationQueue.ts
- FOUND: src/components/observations/SyncStatus.tsx
- FOUND: src/components/observations/ObservationForm.tsx
- FOUND: 04-02-SUMMARY.md
- FOUND: commit 30d6f20 (Task 1)
- FOUND: commit acc7c76 (Task 2)
- FOUND: commit 00ef8ad (docs)

---
*Phase: 04-field-data-entry*
*Completed: 2026-03-22*
