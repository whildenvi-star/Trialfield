# Phase 18: Rotation Snapshot & Harvest Compilation & PDF - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Three capabilities closing the v3.0 compilation loop: (1) yearly rotation snapshots that preserve field-crop-acre assignments from farm-budget into FieldHistory records — surviving farm-budget seasonal rebuilds, (2) harvest event compilation pulling organic delivery data from grain-tickets into HarvestEvent records with crop name normalization, and (3) null-safe 8-section NOP inspection PDF refreshed to render from compiled ecosystem data. Requirements: ROT-01, ROT-02, ROT-03, HRV-01, HRV-02, PDF-01, PDF-02.

</domain>

<decisions>
## Implementation Decisions

### Snapshot UX
- "Take Snapshot" button lives on the compile page alongside other compilation actions (fields, enterprises, inputs, seeds)
- If a snapshot already exists for the crop year, show a confirmation dialog: "A snapshot already exists for [year]. Replace it?" — overwrite allowed
- Yellow warning banner at the top of the compile page when no snapshot exists for the current crop year: "No rotation snapshot for [year] — Take snapshot before generating PDF"
- After successful snapshot, show a green "Snapshot taken" status badge with field count (e.g., "42 fields snapshotted for 2025")

### Rotation History View
- Table layout on the existing Fields page (tab or expandable section)
- Fields as rows, years as columns — easy to scan rotation across years for any field
- Each cell shows crop + acres (e.g., "Org SRWW — 120 ac")
- Years with no snapshot data show a dash "—" with a tooltip: "No snapshot for [year]"

### Harvest Compilation
- Only compile deliveries for fields with organic enterprises in organic-cert (not all grain-ticket deliveries)
- Use the same normalizeCropName() pattern established in Phase 17 seed-mapper for crop name auto-matching
- Unmatched crops go to a review list in the preview
- Same preview/commit flow as Phase 16/17 compile operations — preview shows harvest events to be created with match status, user commits to write HarvestEvent records

### PDF Report
- All 8 sections always render — sections with no compiled data show "No records for [section name]" placeholder text
- PDF generates even if some compilation steps haven't been run yet — allows incremental previewing
- Cover page shows: farm name, crop year, date generated, and a compile checklist showing which data sources were compiled (fields check, inputs check, seeds X, etc.)
- Refresh all 8 sections to pull from compiled ecosystem data (FieldEnterprise, MaterialUsage, SeedUsage, HarvestEvent) instead of old data paths — AND add null-safety throughout

### Claude's Discretion
- Exact table styling and column widths for rotation history
- How to handle split-field enterprises in rotation table cells (multiple crops per field-year)
- Harvest mapper internal implementation (batch size, transaction strategy)
- PDF section ordering and internal table formatting
- How normalizeCropName() handles edge cases in harvest matching beyond the Phase 17 patterns

</decisions>

<specifics>
## Specific Ideas

- Compile page is the hub for all compilation actions — snapshot joins fields/enterprises/inputs/seeds as the fifth compilation step
- Rotation history view goes on the existing Fields page to leverage field context already present there
- Preview/commit pattern is the established UX contract across all compile operations (Phase 16, 17, 18) — harvest compilation follows the same flow
- Cover page compile checklist gives the inspector immediate visibility into data completeness

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-rotation-snapshot-harvest-compilation-pdf*
*Context gathered: 2026-03-03*
