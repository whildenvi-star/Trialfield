# Phase 2: Offline Sync - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the offline layer and make sync state visible to users. Users can see whether they are online or offline, see what's queued, and trust that offline actions will sync automatically when connectivity returns. Conflicts surface visibly rather than silently overwriting data.

Creating new data types to sync is out of scope — that belongs in the relevant feature phases (e.g., Phase 4 already handles field observations).

</domain>

<decisions>
## Implementation Decisions

### Status indicator
- Lives in the header/banner area (top of screen)
- Only appears when offline or syncing — silent when the user is online, no persistent "Online" label
- Three states: **Offline** (red), **Syncing** (blue), **Error** (red + error icon)
- Queue count displayed inline in the banner: e.g., "Offline • 3 items queued"

### Queue display
- Count lives inside the status indicator banner — no separate nav badge
- Banner is tappable — opens a detail drawer/sheet listing queued items
- Queue is read-only: auto-drains on reconnect, no user cancel/delete
- Queue list clears automatically after successful sync — no history retention

### Conflict handling
- Notification: non-blocking toast + item added to a persistent conflicts list
- Resolution UI: show both versions (local vs server), user taps "Keep mine" or "Keep server version" — two-button choice per conflict
- Unresolved conflicts sit quietly in the list — no blocking, no persistent badge pressure
- Field observations rarely conflict; keep it simple and surface both versions rather than auto-resolving

### Sync completion feedback
- Successful drain: brief toast "Synced X items" then auto-dismiss
- During active drain: banner shows "Syncing… X items" with a progress indicator (same banner location as Offline state)
- Sync failure (server error, not connectivity): banner stays in Error state (red) with a retry tap target — items remain queued

### Claude's Discretion
- Exact queued item display format (type + timestamp is likely sufficient, but Claude can use whatever is available in the queue record)
- Progress indicator style inside the Syncing banner (spinner, dots, etc.)
- Toast auto-dismiss timing

</decisions>

<specifics>
## Specific Ideas

- The banner should feel like a system status bar — not a modal, not a card — a slim, persistent strip that appears at the top and disappears cleanly when not needed
- The queue detail sheet is for reassurance ("yes, your field entry is in there") not for management — keep it read-only and simple

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-offline-sync*
*Context gathered: 2026-05-18*
