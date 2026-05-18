---
phase: 02-offline-sync
plan: "01"
subsystem: offline-sync
tags: [idb, hooks, sync-state, typescript]
dependency_graph:
  requires: []
  provides: [ConflictRecord type, DB_VERSION 4 with conflicts store, useSyncStatus hook]
  affects: [src/lib/offline/types.ts, src/lib/offline/db.ts, src/hooks/useSyncStatus.ts, src/lib/offline/sync-engine.ts]
tech_stack:
  added: []
  patterns: [IDB version-gated upgrade, SSR-safe navigator.onLine hook, CustomEvent pub/sub for decoupled notifications]
key_files:
  created:
    - src/hooks/useSyncStatus.ts
  modified:
    - src/lib/offline/types.ts
    - src/lib/offline/db.ts
    - src/lib/offline/sync-engine.ts
decisions:
  - "Import observationQueue from @/lib/offline/observation-queue (not db.ts) — it is not re-exported from db.ts"
  - "Extend SyncResult in sync-engine.ts with conflicts: ConflictRecord[] inline (required for hook to compile)"
  - "pendingCount sums both offlineQueue and observationQueue so banner reflects full outstanding work"
  - "Dispatch sync:completed and sync:conflicts as CustomEvents — keeps hook decoupled from drawer/banner components built in later plans"
metrics:
  duration: "2 minutes"
  completed: "2026-05-18"
requirements_completed: [MSYNC-01, MSYNC-02]
---

# Phase 2 Plan 01: IDB Schema v4 and useSyncStatus Hook Summary

**One-liner:** IDB glomalin-offline DB extended to version 4 with conflicts store and blocked() reload guard; useSyncStatus hook merges dual-queue pending counts with online state and drainQueue control.

## What Was Built

### Task 1: IDB Schema v4 with ConflictRecord
- `src/lib/offline/types.ts` — added `ConflictRecord` interface with `resolved: 0 | 1` (number for reliable IDB indexing); extended `OfflineDB` with `conflicts` store definition
- `src/lib/offline/db.ts` — bumped `DB_VERSION` from 3 to 4; added `if (oldVersion < 4)` upgrade block creating `conflicts` object store with `by-resolved` index; added `blocked() { window.location.reload() }` to `openDB` call to prevent multi-tab upgrade deadlock

### Task 2: useSyncStatus Hook
- `src/hooks/useSyncStatus.ts` — new file; exports `useSyncStatus`, `SyncState` type, `SyncStatus` interface
- Hook merges `isOnline` (SSR-safe, initialized true), `pendingCount` (sum of both queues), `syncState`, `errorMessage`, `drainQueue`
- `refreshCount` calls `offlineQueue.getPending()` + `observationQueue.getPending()` in parallel and sums lengths
- `drainQueue` calls `processQueue(getToken)`, sets syncing/error state, dispatches `sync:completed` and `sync:conflicts` CustomEvents
- Auto-drains on `window 'online'` event reconnect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended SyncResult in sync-engine.ts with conflicts field**
- **Found during:** Task 2
- **Issue:** The plan specified `result.conflicts.length > 0` in the hook, but `SyncResult` interface in `sync-engine.ts` had no `conflicts` field — would cause TypeScript error preventing compilation
- **Fix:** Added `conflicts: ConflictRecord[]` to `SyncResult` interface and `conflicts: []` to `processQueue` initial result object in `sync-engine.ts`
- **Files modified:** `src/lib/offline/sync-engine.ts`
- **Commit:** 6818739

**2. [Rule 1 - Bug] Import observationQueue from observation-queue.ts not db.ts**
- **Found during:** Task 2
- **Issue:** Plan specified `import observationQueue from '@/lib/offline/db'` but `observationQueue` is not exported from `db.ts` — it lives in `observation-queue.ts` (confirmed by reading existing `useObservationQueue.ts` hook)
- **Fix:** Import from `@/lib/offline/observation-queue` matching the pattern established in `useObservationQueue.ts`
- **Files modified:** `src/hooks/useSyncStatus.ts`
- **Commit:** 6818739

## Commits

| Hash | Message |
|------|---------|
| 0ca68fa | feat(02-01): extend IDB schema to v4 with conflicts store and ConflictRecord type |
| 6818739 | feat(02-01): create useSyncStatus hook with dual-queue counts and drain control |

## Self-Check: PASSED

- FOUND: src/lib/offline/types.ts
- FOUND: src/lib/offline/db.ts
- FOUND: src/hooks/useSyncStatus.ts
- FOUND: src/lib/offline/sync-engine.ts
- FOUND: 0ca68fa (feat(02-01): extend IDB schema to v4...)
- FOUND: 6818739 (feat(02-01): create useSyncStatus hook...)
