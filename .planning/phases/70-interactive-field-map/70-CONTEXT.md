# Phase 70: Interactive Field Map - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A `/app/maps` page in the glomalin portal that renders all 56 farm fields as interactive polygon overlays on a satellite imagery basemap, color-coded by crop and organic certification status. Field boundaries imported from SMS shapefile export (stored as GeoJSON in Supabase). Clicking a field opens a slide-in detail panel. Includes an admin-only shapefile import flow in settings.

This is a read-only visualization phase. Editing field data, crop plans, and deeper drill-downs are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Field detail panel
- Slide-in from the right — panel overlays the map, map stays visible and interactive
- Content: crop name, organic certification status, reporting acres — nothing else (keep it tight)
- One action link at the bottom: "View Field Activity Timeline" (links to field's timeline page)
- When no field is selected: empty — full map takes the entire viewport, no sidebar

### Color coding & legend
- Primary color axis: crop type — each crop gets a distinct color (corn, soybeans, rye, oats, wheat, etc.)
- Organic certification indicator: dashed green border on organic fields, layered on top of crop color
- Fallow/uncropped fields: light gray fill, no border
- Legend: bottom-left corner of the map, compact, always visible

### Shapefile import flow
- Format: Shapefile zip (.shp + .dbf + .prj bundled as .zip) — converted server-side to GeoJSON on upload
- Location: Admin-only settings page (not on the map page itself)
- Frequency: One-time setup, rarely repeated
- On re-import: full replace — new upload replaces all boundaries entirely (SMS is source of truth)
- Field matching: match by field name text attribute from SMS → fuzzy match to canonical field names/aliases in farm-registry

### Map basemap & chrome
- Basemap: satellite imagery only — no toggle for this phase
- Initial load: auto-zoom to fit all 56 farm fields (no manual navigation needed on first open)
- Layout: full-height map filling the entire portal content area — nav sidebar on left, map takes everything else edge to edge

### Workflow & roles
- Primary use case: office user showing field status to agronomists and landowners, in-person on laptop or tablet — needs to be visually impressive and gesture-friendly
- All roles (operator, office, admin, viewer) can view the map — read-only for everyone
- Only admin can access the shapefile import settings page
- Maps appears as a top-level entry in the portal navigation sidebar (same level as Dashboard, Macro Rollup, Compliance)

### Claude's Discretion
- Specific map library (Leaflet vs MapLibre GL — researcher to evaluate based on portal tech stack and Supabase GeoJSON storage)
- Exact crop color palette (should align with Glomalin dark soil design tokens: bg #080604, accent #C8860A, green #7A9E7E)
- GeoJSON storage schema in Supabase (column type, indexing)
- Shapefile-to-GeoJSON conversion library (server-side, Node.js)
- Fuzzy field name matching implementation

</decisions>

<specifics>
## Specific Ideas

- "I want it to feel like a real farm map" — satellite imagery is the baseline expectation for growers, not abstract diagrams
- The map is primarily used in face-to-face conversations: showing an agronomist what's planted where, or showing a landowner what's happening on their ground. Visual impressiveness matters.
- Phase 70 is the foundation layer for the long-term panopticon vision (see `.planning/FIELD-MAP-VISION.md`) — decisions here should not close off the path to 3D and deeper visualization

</specifics>

<deferred>
## Deferred Ideas

- Basemap style toggle (satellite ↔ street map) — future phase if needed
- Full-screen mode — future phase
- Budget snapshot or rotation history in the detail panel — future phase (deeper field drill-down)
- 3D field visualization / Rock County panopticon — long-term vision, separate milestone
- Platform-first migration (portal absorbing farm-budget UI) — post-v12.0 milestone (see PARKING_LOT.md)

</deferred>

---

*Phase: 70-interactive-field-map*
*Context gathered: 2026-04-17*
