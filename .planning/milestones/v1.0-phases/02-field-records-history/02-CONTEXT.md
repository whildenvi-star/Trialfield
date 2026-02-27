# Phase 2: Field Records & History - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Farm manager can review all field operation records (synced from Case IH and manually entered) with complete 3-year history per parcel. Includes viewing applications, harvests, and tillage operations, plus manual entry forms for pre-API historical data or non-synced operations. Compliance analysis and inspection report generation belong in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Field History View Layout
- Vertical timeline grouped by growing season, operations in chronological order within each season
- Summary card per operation (date, type badge, field, key metric), click to expand for full details
- Color-coded badges by operation type: green for applications, amber for harvest, blue for tillage
- Season summary stats at top of each season header: crop planted, total applications count, total acres treated, harvest yield
- Empty seasons displayed with "No operations recorded" message and "Add records" button (important for audit continuity)
- Default 3-year window (current year and 2 prior), with year selector to shift the window for longer history
- Subtle source indicator: sync icon for API-synced records, pencil icon for manual entries
- Expanded card shows approval info: "Approved by [name] on [date]" or "Pending review" for synced records
- Notes/annotations supported on individual records (freeform text for context like "Applied due to pest outbreak")
- Print-friendly view available via "Print" button (basic, feeds into Phase 3 for full reports)
- Responsive design — timeline adapts to mobile with stacked cards, touch-friendly expand/collapse
- View-only timeline; "Edit" button on expanded card opens the manual entry form pre-filled with record data

### Manual Entry Forms
- Claude's discretion: separate forms per operation type OR unified form with type selector (pick based on field count differences)
- Searchable dropdown for field selection (type-ahead search, supports 50+ fields, shows field name + acres + current crop)
- Smart defaults: pre-fill date to today, default field to last-used, suggest products from recent applications
- Post-save: show success toast, clear form (keep field + date), show "Add Another" button for batch entry
- Same data model as synced records — manual entries use the same underlying FieldOperation/HarvestEvent models

### Record Detail — Applications
- Product name + application rate + rate unit (lbs/acre, gal/acre, etc.)
- Multiple products per application supported

### Record Detail — Harvests
- Yield, date, field, auto-generated lot number, equipment used
- Lot number format: cropYear-crop-fieldName (e.g., "2025-Corn-HomePlaceSouth"), auto-generated with manual override option
- Equipment selection: searchable list from Case IH FieldOps fleet (getEquipment API), plus ability to add non-Case IH equipment from other manufacturers. List handles multiple units of same type (multiple combines, multiple articulated tractors, etc.)

### Record Detail — Tillage
- Operation type only (chisel plow, disk, field cultivator, etc.) plus date and field
- No depth or additional details required

### Compliance
- No compliance indicators on the history view — compliance analysis deferred to Phase 3 reports

### Navigation & Filtering
- Primary entry point: field-centric (select a field, then see its history timeline)
- Field index page: cards or rows showing field name, acres, current crop, last operation date, record count
- Field index supports text search + sort by name, acres, last activity date, record count
- History timeline filtering: full filter bar — type, date range, product name, approval status, data source (synced vs manual)
- Season selector already handles the year dimension

### Claude's Discretion
- Form design approach (separate per type vs unified with type selector)
- Exact spacing, typography, card shadow styling
- Loading skeleton design
- Error state handling
- Exact filter bar component layout

</decisions>

<specifics>
## Specific Ideas

- Timeline should tell the "story" of what happened to a field over a growing season — chronological within each season
- Batch entry workflow is important: farmer often enters a week's worth of records at once, so "Add Another" with smart defaults matters
- Equipment list needs to handle the reality of a large farm fleet — multiple combines, multiple articulated tractors, plus non-Case IH equipment from other manufacturers
- Empty season gaps must be visible (not hidden) because the organic inspector will ask about them
- Approval provenance on expanded cards matters for audit — "who reviewed this and when"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-field-records-history*
*Context gathered: 2026-02-24*
