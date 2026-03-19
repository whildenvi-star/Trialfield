# Phase 45: Crop Plan Viewer - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Mobile-first field list and detail pages aggregating data from farm-budget and farm-registry, with offline caching via IndexedDB. Operators can view crop plans and pass status on their phones, and that data stays readable without network. Creating/confirming passes belongs in Phase 46.

</domain>

<decisions>
## Implementation Decisions

### Field list layout
- Grouped by enterprise (enterprise name as section headers)
- Groups always expanded (not collapsible)
- Each field card shows: field name + acres, crop + variety
- Simple text search by field name (no filter chips)

### Field detail content
- Single scrollable page (no tabs)
- Top section: crop name, variety, population, seed treatment
- Middle section: inputs with full product name, rate per acre, and total
- Bottom section: pass checklist with status badges — green check for confirmed, gray circle for planned

### Offline indicators
- "Last synced" badge displayed at top of field list (below header)
- Thin colored banner appears when offline: "Offline — showing cached data"
- Stale data color thresholds: amber after 24 hours, red after 48 hours

### Mobile interaction
- Pull-to-refresh gesture on field list triggers data sync
- Auto-sync on page load when online, plus manual sync button in header
- Tap field card → full detail page with back button (standard page navigation)
- 48px minimum tap target size for cards and buttons (glove-friendly)
- Restore scroll position when navigating back from detail to list

### Claude's Discretion
- Exact card styling, spacing, and typography
- Loading skeleton design
- Error state handling
- Search implementation details
- Animation/transition between list and detail

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-crop-plan-viewer*
*Context gathered: 2026-03-18*
