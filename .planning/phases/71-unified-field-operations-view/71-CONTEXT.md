# Phase 71: Unified Field Operations View - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the farm-budget field editor (port 3001, vanilla JS SPA) to replace the separate "Inputs" and "Machinery" nav sections with a single unified "Field Operations" panel. All cost items — product inputs, custom coop application charges, and machinery passes — are organized by agronomic operation type in a structured, report-style layout. Scope is one enterprise at a time within the existing field editor panel.

</domain>

<decisions>
## Implementation Decisions

### Operation Grouping Logic
- Groups follow agronomic sequence: Tillage → Planting → Pre-emerge → Post-emerge → Fungicide → Harvest (in that order)
- Group assignment comes from operation name pattern-matching against existing naming conventions (e.g., "application-post" → Post-emerge, "liquid PPI" → Pre-emerge, "anhydrous" → Fertility/Pre-emerge)
- Empty groups are hidden — only operations that have items appear (e.g., no-till field shows no Tillage section)
- Ungrouped/unmatched items: Claude's Discretion (catch-all or warning approach)

### Layout & Reading Format
- Each operation group is a collapsible section with a chevron — expanded by default, collapse available
- Group header row shows: operation name + subtotal ($/ac)
- Line items within each group: compact table-row density, same as existing Inputs/Machinery tables
- Columns per row: item name, type badge, rate (qts/ac or lbs/ac or pass count), $/ac, field total $
- Grand total row at the bottom (sticky footer or bottom of the list — Claude's Discretion on implementation)

### Inputs vs Passes Relationship
- Items are co-located by group — no parent/child nesting. A coop application charge and the product it applied both appear under the same operation group as separate rows
- Each row has a type badge (small label): `input`, `pass`, `custom`, `seed` — distinguishes cost type at a glance without relying on group name alone
- Scope: one enterprise at a time (whichever enterprise is active in the editor — same as current behavior)

### Edit Behavior
- The unified Field Ops view IS the editing surface — edit from within it, no need to switch back to old tabs
- Click a row to edit inline; click + under a group to add a new item to that operation
- Add form approach: Claude's Discretion (match whatever existing add-input/add-machinery pattern is least disruptive)
- Drag-and-drop: full drag within AND across groups (items can be moved between operation sections)
- Target: desktop primary — this is a farm management/office tool, not mobile-first

### Nav Restructuring
- Claude's Discretion — determine the cleanest way to restructure the sidebar nav (currently: Inputs | Machinery | Seed | Yield). Goal is a single "Field Ops" entry replacing the two separate tabs, but exact implementation left to planner.

### Claude's Discretion
- Ungrouped item handling (catch-all "Other" group vs warning badge vs auto-assign heuristic)
- Grand total placement (sticky footer vs bottom row)
- Add-item form UX within the unified view
- Nav restructuring approach
- Exact pattern-matching rules for group assignment (derive from real item names in data.json)

</decisions>

<specifics>
## Specific Ideas

- The user's mental model is "modules of work" — how work is actually sequenced across the season: you prep, you plant, you spray pre, you spray post, you harvest. The layout should reflect that sequence, not accounting categories.
- Custom coop charges (e.g., "application-post", "liquid PPI") are currently in the Inputs table but ARE machine passes — this is a legacy from Excel days. The new view should treat them as first-class field operations, just with a `custom` type badge.
- "Semi-report type format" — the view should feel like a structured field activity summary, not a raw data table. Operations as named sections, costs visible per operation.
- Drag-and-drop requested specifically to allow reassigning items to the correct operation group when auto-assignment gets it wrong.

</specifics>

<deferred>
## Deferred Ideas

- None surfaced during discussion — scope stayed within Phase 71 boundaries.

</deferred>

---

*Phase: 71-unified-field-operations-view*
*Context gathered: 2026-04-20*
