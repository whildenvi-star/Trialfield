---
phase: 48-grain-tickets-pwa-dashboard-caching
plan: "01"
subsystem: pwa
tags: [indexeddb, service-worker, background-sync, offline, pwa, grain-tickets]

requires:
  - phase: 47-offline-sync-engine
    provides: IndexedDB and Background Sync patterns established in portal sw.ts

provides:
  - grain-tickets offline ticket entry with IndexedDB queue and Background Sync replay
  - window.ticketQueue API for IDB CRUD (add, getAll, getPending, getConflicts, delete, update, requestSync)
  - Offline banner shown when navigator.onLine is false, hides on reconnect
  - Pending/conflict ticket rows rendered above API tickets in Ticket Log
  - Conflict resolution UI with side-by-side comparison and three resolution paths
  - Stale-while-revalidate caching for reference data APIs (/api/crops, /api/farm-names, etc.)
  - SW bumped to grain-tickets-v7

affects:
  - 48-02 (dashboard caching — builds on same v7 SW)
  - grain-tickets service worker upgrade path

tech-stack:
  added: []
  patterns:
    - IndexedDB raw API in service worker (no library — same SW context constraint as phase 47)
    - window.ticketQueue façade in app.js exposes IDB operations to all tab scripts
    - Background Sync with _manualSync() fallback for browsers without SyncManager
    - Pending rows rendered inline above API rows in same <tbody> without separate UI surface
    - edit modal reused for pending tickets by flagging data-pending=true on hidden ID input

key-files:
  created: []
  modified:
    - grain-tickets/public/sw.js
    - grain-tickets/public/app.js
    - grain-tickets/public/tickets.js
    - grain-tickets/public/style.css

key-decisions:
  - "grain-tickets-v7 — cache name bumped so old SW clears immediately on install"
  - "window.ticketQueue defined in app.js (not tickets.js) so all tab scripts can access it"
  - "Background Sync fallback (_manualSync) triggered when SyncManager unavailable — same logic as SW replay, runs in page context"
  - "Pending rows render at top of page 1 only — conflict rows use display:none <tr> for inline expansion"
  - "Edit modal reused for pending tickets via data-pending attribute — no second modal needed"
  - "fetchRegistryCrops caches to IDB ref-cache on success; reads from cache on network error — pure client-side fallback"
  - "Conflict resolution does not auto-retry after keep-mine rename — user triggers via normal sync flow"

requirements-completed: [GTP-01]

duration: 5min
completed: 2026-03-25
---

# Phase 48 Plan 01: Grain Tickets Offline Entry Summary

**IndexedDB ticket queue with Background Sync replay, offline banner, pending/conflict rows in Ticket Log, and side-by-side conflict resolution UI**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T21:36:10Z
- **Completed:** 2026-03-25T21:41:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Service worker extended to v7 with raw IDB helpers, Background Sync `ticket-sync` replay (FIFO, 3-retry limit, 409 conflict detection), and stale-while-revalidate for 5 reference data API paths
- `window.ticketQueue` API in app.js exposes add/getAll/getPending/getConflicts/delete/update/requestSync with `_manualSync` fallback for browsers without Background Sync
- Offline banner (amber fixed top bar) toggled by online/offline events; body.has-offline-banner shifts header down; createOfflineBanner() inserts it before any other DOM
- Ticket form submit wraps network failure (TypeError) to queue offline, show "queued" toast, and reset form; online 409 response keeps existing duplicate-error behavior
- Ticket Log prepends pending/conflict rows at top of page 1 with amber (pending) or red (conflict) left borders, status badges, and action buttons; conflict rows expand inline comparison panel
- Conflict resolution: Keep mine (prompts new ticket #, re-queues), Keep existing (discards IDB entry), Edit & retry (opens edit modal, saves back to IDB, triggers sync)
- `tickets-synced` custom event triggers list reload; `app-online` event triggers `requestSync()` if pending entries exist

## Task Commits

1. **Task 1: IndexedDB ticket queue, service worker Background Sync, offline banner** - `f44773e` (feat)
2. **Task 2: Offline-aware ticket form submission, pending list rendering, conflict resolution UI** - `564cbac` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `grain-tickets/public/sw.js` — bumped to v7, added openTicketDB/getAllPending/deletePending/updatePending, sync event with replayTicketQueue, stale-while-revalidate for ref API paths
- `grain-tickets/public/app.js` — added offline banner DOM + show/hide, SW message listener + showSyncToast, window.ticketQueue API with IDB CRUD + requestSync + _manualSync + cacheRef + getRef
- `grain-tickets/public/tickets.js` — offline form submit with network-error catch → queue path, loadPendingTickets() parallel with API load, renderTable() with pending/conflict rows + escapeHtml + resolveDestName, conflict panel HTML, window.openPendingEditModal / deletePendingTicket / retryPendingTicket / resolveConflictKeepMine / resolveConflictDiscard, edit modal pending detection, tickets-synced / app-online event listeners
- `grain-tickets/public/style.css` — .offline-banner, .pending-sync-badge, .conflict-badge, pending-row/conflict-row, .conflict-panel, .conflict-panel-inner, .conflict-actions, .btn-conflict-resolve, .btn-conflict-discard, .sync-toast, .pending-modal-notice

## Decisions Made
- `window.ticketQueue` defined in app.js so all tab scripts (tickets.js, farms.js, etc.) share the same IDB handle without reimporting
- `_manualSync` duplicates SW replay logic in page context — acceptable duplication for browser compatibility (same pattern as Phase 47 portal decisions)
- Pending rows use existing `<tbody>` rather than a separate UI surface — less DOM manipulation, consistent with existing table patterns
- Edit modal reused for pending tickets via `data-pending="true"` flag — avoids second modal with identical fields

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plan 01 complete — sw.js at v7 with ticket-sync Background Sync fully operational
- Plan 02 (dashboard caching) can extend the same v7 SW with additional cache strategies for budget/FSA/insurance dashboards
- All offline UI patterns established for Plan 02 to build on

---
*Phase: 48-grain-tickets-pwa-dashboard-caching*
*Completed: 2026-03-25*
