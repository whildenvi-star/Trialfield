# Phase 32: Claims Lifecycle UI - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Full claims pipeline UI — Kanban board with drag-and-drop stage management, claim detail drawer with timeline/documents/financials, deadline alerts, and timeline notes. Backend APIs exist from Phase 31. This phase builds the interactive UI layer only.

</domain>

<decisions>
## Implementation Decisions

### Kanban board design
- Standard card density: crop, policy reference, deadline badge, claim amount
- 6 insurance-style pipeline stages: Notice of Loss → Filed → Under Review → Adjuster Assigned → Approved/Denied → Settled
- Deadline urgency on cards: color-coded left border (green >30d, amber 7-30d, red <7d, pulsing red overdue) PLUS countdown badge ("14d left")
- Drag-and-drop: instant move on drop, auto-creates timeline entry, then shows skippable note prompt ("Add a note about this change?")
- Overdue claims pinned to top of their stage column with distinct red styling

### Claim detail view
- Slide-over drawer from right (consistent with PolicyDrawer from Phase 30)
- Claim header + stage dropdown always visible at top of drawer (stage change from dropdown works same as drag — auto-timeline + optional note)
- 3 tabbed sections below header: Timeline | Documents | Financials
- Financials tab: read-only summary totals — guarantee amount, estimated loss, claim amount, indemnity payment (if any)

### Deadline alerts
- Page-level banner at top of Claims page: "2 claims have deadlines within 7 days" — click expands to list
- Also surfaces on portal dashboard summary card (Phase 33 integration point)
- Thresholds: green (>30d), amber (7-30d), red (<7d), pulsing red (overdue)
- Banner is persistent — reappears on every page load as long as approaching deadlines exist (not dismissible)

### Timeline & notes UX
- Unified chronological feed mixing system events and user notes (system = gray styling, user notes = accent styling)
- Document uploads auto-create timeline entries ("Document uploaded: filename.ext") with link to Documents tab
- Always-visible inline textarea at bottom of Timeline tab — type + Enter or click "Add Note"
- Append-only notes — no editing or deleting after posting (audit integrity)

### Claude's Discretion
- Exact Kanban card component styling and spacing
- Drawer width and responsive behavior
- Loading states and skeleton patterns
- Empty state design for new claims boards
- Document preview behavior in Documents tab
- Mobile/tablet adaptations for drag-and-drop

</decisions>

<specifics>
## Specific Ideas

- PolicyDrawer pattern from Phase 30 is the reference for the claim detail drawer — same slide-over interaction
- @dnd-kit/core+sortable already in project packages for Kanban drag-and-drop (from v6.0 design context)
- dynamic({ssr:false}) required for Kanban component (hydration safety — from v6.0 design context)
- Note prompt after drag should feel like a toast/inline prompt, not a blocking modal

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-claims-lifecycle-ui*
*Context gathered: 2026-03-05*
