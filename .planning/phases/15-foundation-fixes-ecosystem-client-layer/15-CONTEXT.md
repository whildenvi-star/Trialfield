# Phase 15: Foundation Fixes & Ecosystem Client Layer - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve 3 blocking bugs in organic-cert (sync-registry crash, enterprise take:3 truncation, missing partial unique index) and build typed HTTP clients for farm-budget, farm-registry, and grain-tickets with timeout, graceful degradation, and a source availability UI on the compile page. This phase does NOT compile any data — it establishes the foundation that phases 16-18 build on.

</domain>

<decisions>
## Implementation Decisions

### Availability Display
- Horizontal status bar at top of compile page — always visible, never collapses
- Each source shown as colored dot + app name + port: `● farm-budget (:3001)  ● farm-registry (:3005)  ○ grain-tickets (:3000)`
- Green dot = available, red dot = unavailable
- Status bar stays the same size whether all green or some red — consistent layout

### Degradation Behavior
- Allow partial compiles when sources are down — missing sections show "source unavailable" with description of what data is missing
- When a source recovers, status bar auto-detects on next check (no notification)
- If a source goes down during a preview, keep stale preview data visible with a "stale" indicator — block commit for that section only
- No cross-reload caching — each page load fetches fresh from sources

### Connection Feedback
- Health check on page load + single manual "Refresh" button for all 3 sources
- No background polling — user clicks refresh to recheck
- 3-second timeout before a source is considered down (local-network apps)
- Refresh button shows spinner while checking; dots stay in previous state until new results arrive

### Error Detail Level
- Friendly message inline below status bar when source is down: "farm-budget (:3001) is not responding"
- Expandable to show technical detail (ECONNREFUSED, timeout, etc.) on click
- Error messages suggest fix action: "start it with `node server.js` in farm-budget/"
- Compile section "source unavailable" messages name the specific data missing: "enterprise data and input records cannot be pulled"

### Compile Page Foundation
- New top-level navigation item: "Compile" — alongside Fields, Enterprises, etc.
- Page organized by NOP inspection sections (Fields & Acres, Enterprises, Inputs, Seeds, Rotation, Harvest)
- Phase 15 builds: status bar + a simple table preview of fields and acres pulled from farm-budget and farm-registry (ECO-01, ECO-02 proof-of-concept)
- Remaining NOP sections show placeholder headers ("Coming in Phase 16/17/18") — later phases fill them in

### Claude's Discretion
- Bug fix implementation approach for FIX-01, FIX-02, FIX-03 (well-defined bugs)
- HTTP client internal architecture (class design, error types, retry logic)
- Health endpoint design on source apps (if needed)
- Status bar CSS/styling details
- Exact expandable error UI pattern (accordion, details element, etc.)
- Loading skeleton or spinner design during source checks
- Table column order and formatting for the field/acre preview

</decisions>

<specifics>
## Specific Ideas

- Status bar format: `● farm-budget (:3001)  ● farm-registry (:3005)  ○ grain-tickets (:3000)` — dot + name + port
- Error inline format: friendly by default, click-to-expand for tech detail
- Fix suggestions like: "start it with `node server.js` in farm-budget/" — actionable because user is both farm manager and developer
- Section-level messages name impact: "farm-budget is not available — enterprise data and input records cannot be pulled"
- The compile page is NOP-inspector-oriented, not source-app-oriented — user thinks in "what does the inspector need" not "which app has it"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-foundation-fixes-ecosystem-client-layer*
*Context gathered: 2026-03-02*
