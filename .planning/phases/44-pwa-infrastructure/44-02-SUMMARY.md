---
phase: 44-pwa-infrastructure
plan: 02
subsystem: database
tags: [indexeddb, idb, offline, pwa, typescript, vitest, testing]

# Dependency graph
requires:
  - phase: 44-01
    provides: "@serwist/next service worker and PWA manifest installed in glomalin-portal"
provides:
  - Typed IndexedDB wrapper at lib/offline/db.ts with operation queue and crop plan cache stores
  - QueuedOperation, CachedCropPlan, OfflineDB TypeScript interfaces in lib/offline/types.ts
  - 18 passing tests covering all CRUD operations, edge cases, and persistence
  - vitest test infrastructure for glomalin-portal
affects:
  - 44-03 (background-sync — reads/writes offlineQueue)
  - 45-crop-plan-viewer (writes to cropPlanCache)
  - 46-field-pass-logger (reads/writes offlineQueue)
  - 47-offline-sync (consumes full offline data layer)

# Tech tracking
tech-stack:
  added:
    - idb@8.0.3 (typed IndexedDB wrapper)
    - vitest@4.1.0 (test runner)
    - happy-dom@20.8.4 (DOM environment for vitest)
    - fake-indexeddb@6.2.5 (IndexedDB polyfill for Node.js testing)
  patterns:
    - Singleton db promise pattern for reusing IndexedDB connection across calls
    - SSR guard pattern — typeof indexedDB check before all operations
    - Object API pattern — grouped methods on offlineQueue and cropPlanCache objects
    - beforeEach clear pattern for test isolation with fake-indexeddb

key-files:
  created:
    - glomalin-portal/src/lib/offline/types.ts
    - glomalin-portal/src/lib/offline/db.ts
    - glomalin-portal/src/lib/offline/__tests__/setup.ts
    - glomalin-portal/src/lib/offline/__tests__/db.test.ts
    - glomalin-portal/vitest.config.ts
  modified:
    - glomalin-portal/package.json (added idb, vitest, happy-dom, fake-indexeddb; added test scripts)

key-decisions:
  - "Singleton db promise (not per-call openDB) to prevent multiple connections on concurrent calls"
  - "SSR guard as function-level check (not module-level) so module imports work on server"
  - "cropPlanCache.put() always overwrites cachedAt with current time — consumers cannot set stale timestamps"
  - "offlineQueue.update() is get+merge+put (not partial put) to preserve all fields"

patterns-established:
  - "offline module pattern: all methods async, SSR guard at function entry, return empty/undefined on unavailable"
  - "test isolation: beforeEach clear() on both stores instead of deleteDatabase (avoids singleton reset complexity)"

requirements-completed:
  - PWA-03

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 44 Plan 02: IndexedDB Offline Data Layer Summary

**Typed IndexedDB wrapper using idb library with operation-queue (indexed by status) and crop-plan-cache stores, plus 18-test vitest suite with fake-indexeddb polyfill**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T16:53:27Z
- **Completed:** 2026-03-17T16:56:43Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created `lib/offline/types.ts` with QueuedOperation, CachedCropPlan, and OfflineDB interfaces covering full field pass workflow
- Created `lib/offline/db.ts` with singleton getDb(), offlineQueue (add/getAll/getPending/update/delete/clear), and cropPlanCache (put/get/getAll/clear/getLastSyncTime) — all SSR-safe
- Installed vitest test infrastructure with fake-indexeddb polyfill and 18 passing tests covering all CRUD operations, index queries, upsert behavior, edge cases, and cross-call persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Install idb, create types, and implement IndexedDB wrapper** - `6983565` (feat)
2. **Task 2: Create IndexedDB wrapper tests** - `f9e7fc8` (test)

## Files Created/Modified
- `glomalin-portal/src/lib/offline/types.ts` - QueuedOperation, CachedCropPlan, OfflineDB TypeScript interfaces
- `glomalin-portal/src/lib/offline/db.ts` - IndexedDB wrapper with getDb() singleton, offlineQueue API, cropPlanCache API
- `glomalin-portal/src/lib/offline/__tests__/setup.ts` - fake-indexeddb global polyfill for tests
- `glomalin-portal/src/lib/offline/__tests__/db.test.ts` - 18 test cases covering both stores
- `glomalin-portal/vitest.config.ts` - vitest config with happy-dom environment and setup file
- `glomalin-portal/package.json` - added idb, vitest, happy-dom, fake-indexeddb; added test/test:watch scripts

## Decisions Made
- Singleton db promise — multiple calls to getDb() reuse the same connection, preventing race conditions on concurrent offline writes
- SSR guard as function-level check (not module-level) so the module can be imported on the server without throwing at import time
- cropPlanCache.put() always overwrites cachedAt with current time — consumers cannot accidentally cache a stale timestamp
- Test isolation via beforeEach clear() rather than deleteDatabase to avoid resetting the singleton dbPromise across tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IndexedDB data layer is complete and tested — phases 45, 46, and 47 can import offlineQueue and cropPlanCache directly
- vitest infrastructure is in place for future test files in glomalin-portal
- Both APIs are SSR-safe and will not crash during Next.js server-side rendering

---
*Phase: 44-pwa-infrastructure*
*Completed: 2026-03-17*
