---
phase: 04-field-data-entry
plan: 02
subsystem: field-observations
tags: [indexeddb, idb, pwa, offline, sync, react-hook, toast, sonner]

# Dependency graph
requires:
  - phase: 04-01
    provides: ObservationForm component, POST /api/observations, FieldObservation model
provides:
  - IndexedDB offline queue for field observations (observation-db.ts)
  - useObservationQueue hook with queue-first submit, online-event sync, pending count
  - SyncStatus component showing pending count and syncing state
  - ObservationForm updated to queue-first pattern
affects: [src/components/observations, src/lib, src/hooks]

# Tech tracking
tech-stack:
  added: [idb ^8]
  patterns:
    - queue-first submit (write to IDB before attempting upload)
    - online-event sync drain (window.addEventListener('online', syncPending))
    - Safari Private Mode fallback (null IDB handle, direct-upload fallback path)
    - purge after 7 days (purgeOldSynced to prevent IDB bloat)

key-files:
  created:
    - src/lib/observation-db.ts
    - src/hooks/useObservationQueue.ts
    - src/components/observations/SyncStatus.tsx
  modified:
    - src/components/observations/ObservationForm.tsx

key-decisions:
  - "Always write to IndexedDB first before attempting upload — guarantees no data loss on network failure"
  - "Safari Private Mode fallback: openObservationDB returns null, callers fall back to direct upload — no crash"
  - "JSON submission preserved for text-only; FormData used when photoBlob present (from Plan 01 pattern)"
  - "syncPending called on mount (if navigator.onLine) and on window online event — catches both cold-start and reconnect cases"

patterns-established:
  - "Queue-first pattern: IDB write → upload attempt → mark synced on success; never lose data"
  - "Sync hook pattern: useObservationQueue encapsulates all IDB/upload/toast logic, form stays presentational"

requirements-completed: [FIELD-03]

# Metrics
duration: ~15 min
completed: 2026-03-22
---

# Phase 4 Plan 2: Field Observations — Offline Queue and Auto-Sync Summary

**IndexedDB queue-first observation submission using idb ^8, with automatic sync on reconnect, pending count via SyncStatus, and sonner toast confirmation — full offline flow verified by human on mobile.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments

- Farm crew can submit observations while offline — writes to IndexedDB first, shows "Saved offline — will sync when connected" toast
- When connectivity returns, pending observations drain automatically via window online event — no user action required
- SyncStatus component shows pending count as amber badge; clears to zero after sync completes
- Safari Private Mode handled gracefully — IDB unavailable path falls back to direct upload, no crash

## Task Commits

Each task was committed atomically:

1. **Task 1: IndexedDB queue helpers and useObservationQueue hook** - `52653fe` (feat)
2. **Task 2: Wire ObservationForm to queue and add SyncStatus component** - `ba8a48a` (feat)
3. **Task 3: Verify complete offline observation flow** - human-verified (checkpoint approved)

## Files Created/Modified

- `src/lib/observation-db.ts` - IndexedDB helpers: openObservationDB, queueObservation, getPendingObservations, markSynced, purgeOldSynced. Wraps idb ^8 openDB with try/catch for Safari Private fallback.
- `src/hooks/useObservationQueue.ts` - React hook: queue-first submitObservation, syncPending (drain on online event + mount), pendingCount state, isSyncing state, cleanup on unmount
- `src/components/observations/SyncStatus.tsx` - Displays pending count as amber badge when > 0; spinner + "Syncing..." during sync; nothing when queue empty
- `src/components/observations/ObservationForm.tsx` - Updated to use useObservationQueue hook; removed direct fetch; passes pendingCount/isSyncing to SyncStatus; resets form on submit regardless of online state

## Decisions Made

- Queue-first: Always write to IndexedDB before attempting upload. This guarantees no data loss even if upload fails silently or network drops mid-request.
- Safari Private Mode: openObservationDB wrapped in try/catch returning null. Hook callers check for null and fall back to direct upload. Avoids crashing in a common mobile browsing mode.
- syncPending on mount: Called immediately if navigator.onLine is true on mount — catches the case where the user had queued items from a previous session and reopens the app while online.
- Kept JSON/FormData split from Plan 01: text-only submission uses JSON body, photo-attached submission uses FormData — matches existing API contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 complete: all three FIELD requirements satisfied (FIELD-01 in Plan 01, FIELD-02 in Plan 01, FIELD-03 in Plan 02)
- Offline queue pattern established (queue-first + online-event sync) — reusable for future mobile data entry features
- No blockers

---

## Self-Check: PASSED

- src/lib/observation-db.ts: committed in 52653fe
- src/hooks/useObservationQueue.ts: committed in 52653fe
- src/components/observations/SyncStatus.tsx: committed in ba8a48a
- src/components/observations/ObservationForm.tsx: committed in ba8a48a
- Task 3: human-verified and approved 2026-03-22
- FIELD-03 requirement satisfied

---

*Phase: 04-field-data-entry*
*Completed: 2026-03-22*
