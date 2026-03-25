# Phase 48: Grain Tickets PWA + Dashboard Caching - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend offline PWA capability to grain ticket entry and read-only dashboard caching. Office staff can enter grain tickets while offline (queued and synced on reconnect). Budget, FSA, and insurance summary dashboards cache for offline reading via the portal. Builds on Phase 47's offline sync engine and IndexedDB patterns.

</domain>

<decisions>
## Implementation Decisions

### Offline Ticket Entry Flow
- Full form available offline — same fields as online (ticket #, weight, crop, destination, HBT bin, truck, notes)
- Client-side validation against cached field/crop lists from farm-registry
- Required fields enforced offline (ticket #, weight, crop) — can't save without them
- Offline-entered tickets appear immediately in the ticket list with a "pending sync" indicator
- Pending tickets are editable and deletable until synced — once synced, normal edit rules apply

### Dashboard Cache Scope
- Cache all three summary dashboards: budget summary, FSA acreage summary, insurance summary
- Dashboards accessed through glomalin-portal iframe embeds — caching at the portal level via portal service worker
- 24-hour staleness threshold — show "Last updated X hours ago" timestamp; after 24h, show subtle warning that data may be outdated
- Auto-refresh dashboards silently in background when connectivity returns

### Sync Conflict Handling
- Duplicate ticket entry happens occasionally (multiple people entering from field notes)
- Duplicate ticket number detected on sync → flag for manual review with side-by-side comparison
- Both conflicting versions saved; user picks which to keep or merges manually
- Non-conflicting tickets in the queue sync normally — only the conflicting ticket stays queued until resolved
- Conflict resolution UI is inline: conflicting ticket shows in list with a warning badge, tapping opens side-by-side comparison

### Offline Status Indicators
- Persistent thin banner at top when offline: "You're offline — changes will sync when connected"
- Per-ticket sync icon on each pending (unsynced) ticket in the list — disappears once synced
- Brief auto-dismissing toast notification on sync completion: "Synced 3 tickets"
- Failed sync: red error badge on the ticket in the list — tapping shows error details with retry/edit options

### Claude's Discretion
- Exact banner/toast styling and animation
- IndexedDB schema design for ticket queue and dashboard cache
- Service worker caching strategy details (cache-first vs network-first per resource type)
- How to handle partial connectivity (slow/intermittent connections)

</decisions>

<specifics>
## Specific Ideas

- Grain-tickets already has a basic service worker (sw.js) and manifest.json — extend rather than replace
- Sync icon pattern similar to messaging apps showing "sending" status per message
- Phase 47's offline sync engine provides the IndexedDB and Background Sync patterns to reuse

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-grain-tickets-pwa-dashboard-caching*
*Context gathered: 2026-03-25*
