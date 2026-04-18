# Phase 70: Interactive Field Map - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A `/app/maps` page in the Glomalin Portal that renders all 56 farm fields as interactive polygon overlays on a 2D basemap, color-coded by crop and organic certification status. Field boundaries stored as GeoJSON in Supabase and loaded via portal API. Clicking a field opens a slide-in detail panel. Admin-only GeoJSON/KML import flow for loading/updating boundaries. Foundation phase for the field panopticon vision — editing, yield history, and advanced analytics are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Map Library & Basemap
- **Library:** Mapbox GL JS (WebGL-powered, standard for ag/precision farming UIs)
- **Default basemap:** Satellite imagery
- **Layer switcher:** Satellite ↔ Hybrid (satellite + road labels) toggle control visible on map
- **Initial position:** Fixed center derived from GeoJSON boundary centroids at import time — stored and reused as the default view center. Not auto-fit on every load.

### Field Visual Language
- **Crop color scheme:** Fixed palette — planner creates a semantic default palette (e.g., corn = yellow, soybeans = green, winter wheat = amber, rye = purple, oats = tan) stored as an editable config file. User tunes colors after seeing the initial implementation.
- **Organic field indicator:** Dashed/dotted polygon border — overlaid on top of crop fill color, visible at all zoom levels
- **Unassigned fields (no crop):** Neutral gray fill — clearly in-progress without visual noise
- **Hover state:** Polygon brightens/lightens on hover + small tooltip showing field name only. Tooltip signals the field is clickable.

### Detail Panel
- **Position:** Slides in from the right side — keeps clicked field visible on left
- **Behavior:** Read-only display only — no editing in this phase
- **Content:**
  - Field name
  - Current crop
  - Organic status (certified / conventional)
  - Reporting acres
  - 7-day GDD accumulation (Growing Degree Days) fetched from Open-Meteo API using that field's polygon centroid coordinates — fetched on panel open, not pre-loaded
- **Dismiss:** Click outside panel or X button (Claude's discretion on exact behavior)

### GeoJSON Import Flow
- **Interface:** Admin-only page with drag-and-drop zone + fallback "Browse" button. Accepts GeoJSON and KML file formats.
- **Field matching:** Match incoming GeoJSON features to farm-registry fields by field name string comparison. SMS exports typically include field names as feature properties.
- **Re-import behavior:** Overwrites existing boundary for matched fields. Simple and predictable — corrections are applied by re-running the import.
- **Results screen:** Summary report after processing: count of fields matched and updated, list of unmatched GeoJSON features (by name), count of registry fields with no incoming boundary. Actionable without being verbose.

### Claude's Discretion
- Exact polygon opacity/fill alpha values
- Panel width on desktop vs mobile breakpoints
- Detail panel dismiss behavior (click-outside, X button, or both)
- Loading skeleton for panel while weather fetch is in-flight
- Error state if Open-Meteo returns no data for a field centroid
- Exact Mapbox style token / tile source selection

</decisions>

<specifics>
## Specific Ideas

- Open-Meteo API selected for weather (free, no API key, GDD data available) — fetch per-field using polygon centroid lat/lng when panel opens. One call per click.
- Crop color palette should be a config file (not hardcoded) so colors can be tuned without a redeploy
- The "derived center" approach: compute centroid of all field boundaries at import time, store as farm center config, use as fixed map starting position

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 70-interactive-field-map*
*Context gathered: 2026-04-17*
