# Phase 26: Portal UI - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the visual layer for the Glomalin Portal: a public landing page with a React Flow farm ecosystem node map, a dashboard with access-aware module cards, and placeholder shell pages for all 5 modules. The admin panel (UI-03) is already fully functional from Phase 25 and needs no further work beyond verifying it meets success criteria.

</domain>

<decisions>
## Implementation Decisions

### Node Map (Landing Page)
- Nodes represent the **full farm ecosystem** — all existing apps/data sources (grain-tickets, farm-budget, fsa-acres, farm-registry, meristem-malt, organic-cert) plus the 5 portal modules
- **Hub-and-spoke layout** — Glomalin portal node in the center, source apps arranged around the outside, edges flowing inward to show data aggregation
- **Hover reveals tooltip** with module/app description — no click navigation, no routing from the landing page
- **Subtle ambient animation** — edges have a slow animated pulse/glow showing data flow direction. Feels alive without being distracting
- Dark soil aesthetic throughout (bg #080604, accent #C8860A, etc.)

### Dashboard Module Cards
- Each card shows: **module name, sublabel, and status indicator** (e.g., "Active", "Coming Soon")
- **Locked/inaccessible modules**: grayed out (lower opacity) with a small lock icon — user sees the full ecosystem but knows what they can't access
- **Click behavior**: accessible cards navigate directly to the module page (`/app/macro-rollup`, etc.) — no intermediate preview
- Locked cards are not clickable

### Claude's Discretion
- Dashboard card grid layout (responsive columns, sizing, spacing)
- Node map visual styling details (node shapes, edge colors, glow intensity)
- Module shell page design (content and visual treatment for "coming soon" placeholders)
- Admin panel — already built in Phase 25, verify it passes UI-03 success criteria as-is
- Hover tooltip styling and positioning
- Card hover effects and transitions

</decisions>

<specifics>
## Specific Ideas

- Hub-and-spoke communicates that Glomalin is the central platform aggregating all farm data
- Animated edge pulses on the dark soil background should create a "living system" feel
- Status indicators on dashboard cards help users understand what's live vs coming soon
- Lock icon on inaccessible cards should be subtle — dimmed opacity does most of the work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-portal-ui*
*Context gathered: 2026-03-04*
