---
phase: 47-offline-sync-engine
plan: "01"
subsystem: glomalin-portal/offline
tags: [offline, sync, background-sync, indexeddb, pwa, service-worker]
dependency_graph:
  requires: [46-field-pass-logger]
  provides: [offline-sync-engine]
  affects: [glomalin-portal/src/lib/offline, glomalin-portal/src/sw.ts]
tech_stack:
  added: []
  patterns: [Background Sync API, IndexedDB raw API in SW context, queue-on-fail pattern, FIFO replay with exponential backoff]
key_files:
  created:
    - glomalin-portal/src/lib/offline/sync-engine.ts
  modified:
    - glomalin-portal/src/lib/offline/types.ts
    - glomalin-portal/src/lib/offline/db.ts
    - glomalin-portal/src/lib/offline/crop-plan-sync.ts
    - glomalin-portal/src/sw.ts
decisions:
  - SW uses raw IndexedDB API for Background Sync replay — idb library not available in SW bundle context
  - Network errors (TypeError, AbortError) are queued; HTTP errors (4xx/5xx) are re-thrown
  - Conflict detection: 409 responses and "already confirmed" body text treated as skip-not-error
  - Auth token persisted to sync-config IndexedDB store before Background Sync registration
  - Exponential backoff: 1s, 4s, 16s (1000 * 4^retryCount) with max 3 retries before marking failed
metrics:
  duration: "4 minutes"
  completed: "2026-03-25"
  tasks_completed: 2
  files_changed: 5
---

# Phase 47 Plan 01: Offline Sync Engine — Queue Interception and Background Sync Replay Summary

**One-liner:** Background Sync replay engine with IndexedDB queue-on-fail wrappers for rural offline pass confirmations using FIFO processing, exponential backoff, and conflict detection.

## What Was Built

Pass confirmations and additions made without connectivity are now stored in IndexedDB and automatically replayed when the device reconnects. Operators in rural dead zones never lose work — the system silently queues and syncs without user intervention.

### sync-engine.ts (new)

Core replay engine with four exports:

- `requestBackgroundSync(tag?)` — registers a Background Sync event with the service worker, silently no-ops if unsupported
- `setSyncToken(token)` — persists the auth token to IndexedDB `sync-config` store so the service worker can use it during replay
- `replayOperation(op, token)` — fires a single queued operation against `/api/mobile/passes/confirm` or `/api/mobile/passes/add` with 10s timeout; returns `synced | conflict | error`
- `processQueue(getToken)` — replays all pending operations FIFO with exponential backoff (1s, 4s, 16s), conflict detection (409 / "already confirmed" body text), auth refresh on 401, and per-item failure tracking

### sw.ts (extended)

Added a `sync` event listener for the `'pass-sync'` tag. The handler:
- Opens `glomalin-offline` IndexedDB directly using raw IDB API (idb library not importable in SW context)
- Reads the stored auth token from `sync-config` store
- Replays all pending operations FIFO
- Deletes successful and conflict ops; increments retryCount on transient errors; marks failed after 3 retries

### types.ts (extended)

Added three fields to `QueuedOperation`:
- `fieldId: string` — farm-registry field ID required for replay routing
- `passId?: string` — budget implement ID for confirm-pass replay
- `passType?: string` — operation type string for confirm-pass replay

Added `sync-config` store to `OfflineDB` interface.

### db.ts (updated)

Bumped `DB_VERSION` from 2 to 3. Added `sync-config` object store in `upgrade` handler with `keyPath: 'key'` for storing `{ key: 'auth-token', value: string }`.

### crop-plan-sync.ts (updated)

Wrapped `confirmPass` and `addPass` fetch calls in try/catch:
- Catches only `TypeError` (network error) and `DOMException(AbortError)` — HTTP errors are re-thrown
- On catch: calls `offlineQueue.add(...)`, `setSyncToken(token)`, `requestBackgroundSync()`
- `confirmPass` returns `{ fieldOperationId: 'pending-{uuid}', queued: true }` when offline
- `addPass` returns `{ fieldOperationId: 'pending-{uuid}', pass: {...optimistic}, queued: true }` when offline

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes for all 5 modified/created files (pre-existing errors in scripts/ and clu-card.tsx are unrelated to this plan)
- `sync-engine.ts` exports: `processQueue`, `replayOperation`, `requestBackgroundSync`, `setSyncToken`
- `sw.ts` contains Background Sync event listener with `'pass-sync'` tag
- `crop-plan-sync.ts` `confirmPass` and `addPass` both call `offlineQueue.add` in catch blocks
- `QueuedOperation` type has `fieldId`, `passId`, `passType` fields
- `DB_VERSION` is 3 with `sync-config` store

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9a912fd | feat(47-01): sync engine module and service worker Background Sync handler |
| Task 2 | 6cb6e6d | feat(47-01): queue-on-fail wrappers in crop-plan-sync.ts |

## Self-Check: PASSED
