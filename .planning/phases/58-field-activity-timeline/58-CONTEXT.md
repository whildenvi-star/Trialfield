# Phase 58: Field Activity Timeline - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Unified chronological timeline per field showing every activity from all 4 data sources (farm-budget planned passes, organic-cert confirmed operations, FieldOps machine data, grain-ticket deliveries). Users select a field and see its complete history in one place. This phase does NOT add new activity types or cross-field comparison views.

</domain>

<decisions>
## Implementation Decisions

### Timeline Presentation
- Vertical timeline layout with left-edge date markers and activity cards flowing down
- Colored left border stripe on each entry card per source (Budget / Organic-Cert / FieldOps / Grain)
- Planned (budget) and confirmed (organic-cert) passes are visually paired/grouped when they represent the same operation
- Quiet periods show a collapsed gap marker (e.g., "... 3 weeks ...") between entries

### Field Selection UX
- Search/autocomplete dropdown matching field names and aliases from farm-registry
- Landing page (no field selected) shows a browsable all-fields list
- Each field in the list shows summary stats: last activity date + activity count for the season
- Field names across other portal views become clickable deep links to the timeline

### Activity Detail & Expansion
- Collapsed entry shows: source + activity type + key metric (e.g., "[Budget] Spring N - Urea 120 lb/ac")
- Source-specific expanded detail templates: budget shows products/rates, FieldOps shows machine/acres/speed, grain shows ticket#/bushels/buyer, organic-cert shows operator/confirmation
- Paired planned+confirmed entries show side-by-side comparison when expanded (planned vs actual values)
- Expanded entries include a "View in [source app]" link to jump to the original record

### Filtering & Date Scope
- Default scope: current crop year
- Year selector dropdown to switch between available crop years
- Source filter toggle chips (Budget / Organic-Cert / FieldOps / Grain) to show/hide sources
- Summary stats bar at top: total activities, pending planned passes, last activity date

### Missing Data Handling
- Sources with no data for a field are silently omitted (no empty placeholders)
- If a source API is down or times out: show partial timeline from successful sources + warning banner naming the unavailable source

### Export
- PDF export: full expanded details for all entries, not screen state
- CSV export: flat spreadsheet of all timeline entries
- Both exports respect current filters (date scope, source toggles)

### Loading & Performance
- Progressive render: show entries as each source loads, don't wait for all 4
- Per-source loading indicator on filter chips (spinner until that source's data arrives)

### Claude's Discretion
- Exact source colors for the 4 border stripes (within dark soil palette)
- Gap marker threshold (how long a quiet period before showing marker)
- Field list sort order on landing page
- Skeleton/shimmer details during initial load
- PDF layout and formatting
- CSV column structure

</decisions>

<specifics>
## Specific Ideas

- Paired entry comparison should make it easy to spot variance between planned and actual (e.g., planned 120 lb/ac, actual 115 lb/ac)
- The timeline should feel like a "hub" — you land here and can navigate out to source records, and other portal views link into it
- Progressive loading means the user is never staring at a blank screen waiting for the slowest source

</specifics>

<deferred>
## Deferred Ideas

- Cross-field comparison view (side-by-side timelines for two fields) — future phase
- Multi-year overlay (same field, compare seasons visually) — future phase

</deferred>

---

*Phase: 58-field-activity-timeline*
*Context gathered: 2026-03-29*
