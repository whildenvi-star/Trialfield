# Phase 7: Split-Field PDF Reports - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Update all inspection PDF report sections so split-field enterprises render correctly — grouped under parent fields, clearly labeled, no double-counting. Covers: Field List, Field History, Harvest Log, Application Log, and Mass Balance sections. Operation Overview stays field-level. No new data sources or schema changes.

</domain>

<decisions>
## Implementation Decisions

### Field List Layout
- Split fields use **indented sub-rows**: parent field row shows field name + total acres + enterprise count (e.g., "(3 enterprises)"), then each enterprise indented below
- Sub-rows show: enterprise label + crop + variety + planted acres (e.g., "North 40 | Corn | DKC62-89 | 165 ac")
- **Single-enterprise fields render exactly as before** — one row, no sub-row, no indentation. Only split fields get parent + sub-row treatment
- Fallow enterprises appear in field list sub-rows for acre accounting (fallow is basically headlands/remnant acres for reconciliation)

### Field History Grouping
- Split fields use **labeled sub-sections**: each enterprise gets a label header (e.g., "North 40 — Corn, 165 ac") followed by its operations, fertility events, and material applications
- Enterprise sub-section styling: **lighter/indented** — slightly smaller font, indented or italicized, clearly subordinate to field header
- Field header with total acres appears first for multi-enterprise fields (e.g., "Simpson Farm — 200 ac"), then enterprise sub-sections underneath
- **Single-enterprise fields render exactly as before** — no enterprise sub-header
- **Per-year treatment**: if a field was single-enterprise in 2024 but split in 2025, each year renders based on its own enterprise count (no retroactive sub-headers)
- **Fallow enterprises omitted from history** — they have no operations; they're only in field list for acre accounting
- **Skip empty enterprises** — only show enterprise sub-sections that have at least one operation, fertility event, or harvest
- Just list events chronologically — no summary lines per enterprise
- All inputs (fertility events, material applications) listed under the enterprise they were applied to, not in a separate section

### Harvest Log Labeling
- Harvest log rows show: **Field name (Enterprise Label)** in one column — e.g., "Simpson Farm (North 40)"
- For single-enterprise fields, just field name with no parenthetical
- Field name column included — inspectors need to trace harvest back to field
- Lot number shown alongside enterprise label for split-field traceability

### Application Log Labeling
- Application log rows include **field + enterprise label** per row — inspectors need to know WHERE inputs went for organic audit
- Same format as harvest log: "Field Name (Enterprise Label)" for split fields, just "Field Name" for single-enterprise

### Mass Balance
- Group by **crop name as entered** on the enterprise (existing crop field) — no sub-crop field changes in this phase
- Lot rows show **lot number + enterprise label** for split-field lots
- Total bushels per lot on the harvested side (individual loads belong in harvest log, not mass balance)
- "Sold" side uses whatever sale delivery data exists in organic-cert; full reconciliation with grain tickets/settlement sheets is a future phase
- Mass balance groups by crop across all fields (current behavior) — no per-field breakdown within crop groups

### Operation Overview
- Keep field-level aggregates — no enterprise-level breakdown in summary stats

### Claude's Discretion
- Exact indentation amount and styling for sub-rows in field list
- Table column widths and layout adjustments for new columns
- How to handle page breaks around multi-enterprise field sections
- Loading skeleton / error state handling

</decisions>

<specifics>
## Specific Ideas

- Fallow is "basically only going to be the headlands on the seed corn fields" — it's a small reconciliation concern, not a major report feature
- Mass balance end goal: reconcile farm production with buyer settlement sheets. Phase 7 gets the structure right; data integration comes later
- User reports things like "yellow corn and blue corn separately" — sub-crop distinction is important but requires future schema work beyond Phase 7

</specifics>

<deferred>
## Deferred Ideas

- **Field history spreadsheet import**: User dropped a folder of field history spreadsheets into the project. Need to transpose last 3 years of field histories onto the platform. Separate phase.
- **Sub-crop data model**: Need a sub-crop field distinct from variety (e.g., Yellow Corn vs Blue Corn vs High Oil Soybeans). Currently the crop field captures this if entered that way, but a formal sub-crop field is needed for proper mass balance grouping (Crop > Organic Status > Sub-crop). Separate phase.
- **Grain ticket integration for mass balance**: The "sold" side of mass balance comes from grain ticket app data. Need to connect grain-tickets app data to organic-cert mass balance section. Separate phase.
- **Settlement sheet reconciliation**: Mass balance should ultimately match buyer settlement sheets. Requires grain ticket integration first. Future phase.

</deferred>

---

*Phase: 07-split-field-pdf-reports*
*Context gathered: 2026-02-28*
