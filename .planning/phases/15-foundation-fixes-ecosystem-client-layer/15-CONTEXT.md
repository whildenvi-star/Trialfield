# Phase 15: Foundation Fixes & Ecosystem Client Layer - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three blocking bugs in organic-cert (sync-registry crash, enterprise truncation at 3, partial unique index not in schema) and build a typed, fault-tolerant HTTP client layer connecting organic-cert to farm-budget, farm-registry, and grain-tickets. This is the stable foundation every subsequent phase (16-18) builds on. No new compilation logic, no rotation snapshots, no harvest pulls — just the plumbing and proof it works.

</domain>

<decisions>
## Implementation Decisions

### Source Status Display
- Horizontal status bar at the top of the compile page, always visible
- Each source shows: name + colored dot (green/red) + short detail text (e.g., "connected", "unavailable — timeout")
- Check all sources on page load; user can re-check with a single "Refresh" button
- No auto-polling — check on load and on manual refresh only

### Degraded State Behavior
- Sections from working sources display normally; sections from unavailable sources show a gray placeholder with "Source unavailable" message
- Compile button is disabled until all 3 sources are green — prevents incomplete records from entering the database
- When user clicks refresh and a previously-down source is now available, its sections auto-populate without extra action
- Error messages in plain language ("farm-budget is not responding") with a small expandable "Details" toggle showing technical error (timeout, connection refused, etc.)

### Data Freshness
- Per-source "last checked" timestamp in the status bar (e.g., "last checked: 2 min ago")
- 5-minute TTL cache on the server side — avoids hammering source apps on rapid page navigation
- Refresh button bypasses cache and fetches live from all sources
- Timestamp alone signals freshness — no extra "cached" badge needed

### Compile Page Foundation
- New top-level navigation item: "Compile" — alongside Fields, Enterprises, etc.
- Page organized by NOP inspection sections (Fields & Acres, Enterprises, Inputs, Seeds, Rotation, Harvest)
- Phase 15 builds: status bar + a simple table preview of fields and acres pulled from farm-budget and farm-registry (ECO-01, ECO-02 proof-of-concept)
- Remaining NOP sections show placeholder headers ("Coming in Phase 16/17/18") — later phases fill them in
- Field/acre preview as a basic table: field name, acres, organic status, source origin

### Claude's Discretion
- State change notification approach when a source flips available/unavailable on re-check
- Exact status bar styling and spacing
- Loading skeleton or spinner design during source checks
- Table column order and formatting for the field/acre preview

</decisions>

<specifics>
## Specific Ideas

- Status bar pattern similar to how monitoring dashboards show service health — simple dots with expandable detail
- The compile page is NOP-inspector-oriented, not source-app-oriented — user thinks in "what does the inspector need" not "which app has it"
- Keep the field/acre preview table simple — this is proof the pipeline works, not the final compilation UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-foundation-fixes-ecosystem-client-layer*
*Context gathered: 2026-03-02*
