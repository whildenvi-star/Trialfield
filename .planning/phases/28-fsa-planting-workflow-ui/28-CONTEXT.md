# Phase 28: FSA Planting Workflow UI - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Card-based CLU management workflow within the portal fsa-578 module. Users can view, edit, bulk-report, and export CLU records. Depends on Phase 27 data layer (Supabase CLU records, validation API, auto-populate). Does not include: cross-module navigation (Phase 33), insurance linkage (Phase 29+), or year-over-year comparison (FSA-09, deferred v7+).

</domain>

<decisions>
## Implementation Decisions

### Card Layout & Grouping
- Farm → Tract accordion structure with collapsible sections
- Standard card density: field name, crop, practice, planting date, acres, organic flag, status badge (2-3 lines per card)
- Stacked badges: status badge (Reported/Unreported) + separate warning badge if validation issues exist — both visible simultaneously
- Smart default expand: sections with warnings or unreported CLUs start expanded, clean sections start collapsed

### Editing Experience
- Inline card expand: click a card → it expands in-place to show editable fields, no drawer or modal
- Save button per card: user reviews changes on the expanded card, then clicks Save to commit
- Inline field validation: red text below the specific field with the issue (standard form validation pattern)
- Crop field uses type-ahead search populated from farm-budget macro rollup crops + a predefined FSA crop list (handles crops not yet in farm-budget)

### Bulk Actions & Selection
- Checkbox per card (corner checkbox), with Select All at tract level and farm level
- Sticky bottom action bar when cards are selected: shows "N selected" + action buttons (Gmail/Notion pattern)
- Confirmation dialog with count before bulk actions: "Mark 12 CLUs as reported to FSA?" with Cancel/Confirm
- Two bulk actions supported: Mark as Reported/Unreported + Bulk Crop Assign (set same crop on multiple CLUs)

### Export & PDF Design
- PDF: table-based report grouped by Farm/Tract with columns for CLU, crop, practice, acres, planting date, organic, status
- PDF totals: full breakdown — per-farm subtotals, per-crop subtotals, organic/conventional split, grand total at bottom
- Export buttons: top-right of page header, always visible ("Export PDF" and "Export CSV" as separate buttons)
- CSV: full data dump — all CLU record fields including IDs, timestamps, validation flags, share %. Power-user export for spreadsheet analysis

### Claude's Discretion
- Exact card spacing, border radius, shadow depth
- Accordion animation/transition behavior
- Loading states and skeleton design
- Error state handling for failed saves
- CSV filename format and encoding
- PDF header/footer design and page break logic

</decisions>

<specifics>
## Specific Ideas

- Smart expand behavior draws attention to CLUs needing work — mirrors workflow priority (fix warnings first, then mark as reported)
- Inline expand for editing keeps user in context — no drawer breaking the card grid mental model
- Bulk crop assign is practical for operations where many fields grow the same crop in a rotation
- PDF labeled "Acreage Reporting Summary" (not FSA-578 replica) — existing requirement from REQUIREMENTS.md out-of-scope table
- CSV full dump gives power users spreadsheet flexibility the PDF intentionally doesn't

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-fsa-planting-workflow-ui*
*Context gathered: 2026-03-05*
