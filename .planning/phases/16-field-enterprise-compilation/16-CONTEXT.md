# Phase 16: Field & Enterprise Compilation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can preview and commit a full pull of organic enterprise data from farm-budget and authoritative field identities from farm-registry into organic-cert — with an explicit resolution step for any fields that don't match by name. Grain-tickets delivery records are shown read-only per field. Input and seed compilation belong to Phase 17.

</domain>

<decisions>
## Implementation Decisions

### Preview Diff Display
- Table grouped by field — one section per field, enterprise rows underneath
- Detailed rows: enterprise name/crop, acres (from farm-registry), source app attribution, and exactly what changed if updating
- Updated records show field-level diffs with old value → new value and color highlighting
- Grain-tickets deliveries: inline summary row per field showing total loads and total lbs delivered, with a link/toggle to expand full ticket list

### Field Mapping Resolution
- Inline dropdown per unmatched field directly in the preview table — stays in context, no separate panel
- Dropdown only shows existing organic-cert fields (no create-new option; user must create field separately first)
- Mappings auto-persist silently — next compile, previously mapped fields resolve automatically
- A simple list somewhere on the compile page shows saved mappings with ability to delete/edit them

### Compile Page Workflow
- Single page layout: year selector at top, readiness dashboard below, then preview table, commit button at bottom
- No multi-step wizard — everything scrollable on one page
- Confirmation dialog before commit: "This will create X records and update Y records. Proceed?"
- Allow partial commits — user can commit matched fields and skip unmatched ones; unmatched fields remain for next compile
- After successful commit: refresh preview to show current state (previously "New" records now show as "Unchanged", unmatched fields still visible)

### Readiness Dashboard
- Section at top of compile page, above the preview table
- Color-coded table: fields as rows, NOP sections as columns (Enterprises, Inputs, Seeds)
- Green/yellow/red cells for completeness status
- Only organic fields shown (conventional fields filtered out — not relevant to NOP)
- Inputs and Seeds columns shown as grayed-out placeholders now (those are Phase 17), giving user a preview of what's coming

### Claude's Discretion
- Exact color palette for status cells (green/yellow/red shades)
- How the expandable grain-tickets detail renders (accordion, popover, etc.)
- Loading states and error handling for ecosystem HTTP calls
- Exact confirmation dialog styling

</decisions>

<specifics>
## Specific Ideas

- Preview refresh after commit gives a feedback loop — user sees their action reflected immediately
- Partial commits let the user make progress even when some fields are unmapped, rather than blocking on 100% resolution
- Saved mappings list provides transparency — user can see and manage what's been auto-mapped

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-field-enterprise-compilation*
*Context gathered: 2026-03-02*
