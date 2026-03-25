# Phase 47: Offline Sync Engine - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Reliably queue field pass confirmations made without cellular signal and replay them when connectivity returns. Operators never lose work due to rural coverage gaps. This covers IndexedDB queuing, Background Sync API replay, conflict detection, and a sync status UI. Crop plan caching and grain ticket offline entry are separate phases (45, 48).

</domain>

<decisions>
## Implementation Decisions

### Optimistic UI behavior
- Confirmed passes show with a subtle "pending sync" badge/icon — looks confirmed, just flagged as unsynced
- Operators can undo/cancel a pending confirmation before it syncs, but cannot edit fields (date, operator, notes)
- When sync completes, the badge removes silently — no toast or interruption
- Crop plan view shows "Last updated: X ago" timestamp at top — informational, no warning banner

### Conflict resolution
- Match conflicts by FieldOperation record ID — if status is already CONFIRMED server-side, skip
- Skipped duplicates logged quietly in sync panel history as "Already confirmed — skipped" (no toast or alert)
- Server rejections (pass deleted, field reassigned, etc.) move the item to an error list in the sync panel with the server's reason — operator can dismiss or retry
- Queue processes FIFO sequential — one operation at a time in confirmation order

### Sync status panel
- Lives in a slide-up bottom sheet, triggered by tapping the sync icon/badge in the nav
- Contains: queue count with item list (field name + pass type), last sync timestamp, error list with reasons, and "Sync Now" manual button
- All sync-related info in one panel — no split between nav and sheet
- Queue badge in nav: numeric amber/red circle showing pending count (e.g., "3")

### Failure & retry
- 3 automatic retries with exponential backoff on transient errors (500, timeout), then move to error list
- Auth token refresh attempted silently before replay; if refresh fails, all queued items go to error state with "Session expired — sign in to sync" message
- Error list has per-item Retry button AND a "Retry All" button at the top
- IndexedDB-only persistence — no localStorage backup. Acceptable risk for field operators

### Claude's Discretion
- Exponential backoff timing/intervals
- Bottom sheet animation and gesture handling
- IndexedDB schema design (store names, indexes)
- Background Sync API tag naming and registration
- Exact badge positioning and styling within existing nav

</decisions>

<specifics>
## Specific Ideas

- Operators are often in rural dead zones — the system should feel like it "just works" with no cognitive load about connectivity
- Silence is preferred over notifications for successful syncs — operators are mid-task in the field
- Error handling should be clear but not alarming — move to error list, don't block the queue

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-offline-sync-engine*
*Context gathered: 2026-03-25*
