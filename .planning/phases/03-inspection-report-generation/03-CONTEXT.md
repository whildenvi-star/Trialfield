# Phase 3: Inspection Report Generation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Farm manager can generate and download a complete, print-ready USDA NOP inspection report as PDF with zero manual data assembly. Report pulls from all Phase 1 and Phase 2 data (synced + manual operations, field history, harvest lots). Compliance analysis (flagging non-NOP materials) and settlement sheet import are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Report Structure & Sections
- Standard NOP section order: 1. Cover Page, 2. Table of Contents, 3. Operation Overview, 4. Field List with organic status, 5. 3-Year Field History per parcel, 6. Input Application Log, 7. Harvest Log with lot numbers, 8. Mass Balance Summary
- Auto-generated table of contents with page numbers (reports can be 20+ pages)
- Full detail per operation in the 3-year field history section: date, type, products/rates, acres, source (synced/manual), approval status — tabular format
- Cover page: farm name, address, certification number, report date, crop year, farm logo (if uploaded), placeholder line for certifier/inspector name

### PDF Layout & Branding
- US Letter size (8.5x11), portrait for text sections, landscape for wide tables (field history, application log) — automatic rotation
- Modern sans-serif font throughout (Helvetica/Arial style) — matches the app's UI
- Header on every page: farm name and report title
- Footer on every page: "Page X of Y" and generation date
- Farm logo on cover page if available, placeholder area if not

### Mass Balance Presentation
- Per-crop, then per-lot breakdown: group by crop (Corn, Soybeans, etc.), show total harvested and total sold side-by-side under each crop, then per-lot detail
- Current crop year only — not all 3 years
- Single unit per crop (show in the unit data was recorded, typically bushels for grain) — no automatic conversions
- Harvested vs sold won't perfectly reconcile — this is expected and normal. Show both numbers side-by-side cleanly. Inspector compares and verifies quantities are within reason. No strict reconciliation logic, no red/green pass/fail indicators. Keep it simple and straightforward.
- If a lot has no sales records, show "No sales recorded" — no warnings needed, just factual

### Generation Workflow
- Dedicated reports page (Admin > Reports) with "Generate Inspection Report" button
- Select crop year, optionally select specific fields (default: all fields)
- Direct download — click generate, see progress indicator, PDF downloads when ready. No in-browser preview step.
- Save generated reports with history — reports page shows previously generated reports with timestamps and download links
- PDF files stored on local filesystem (e.g., /uploads/reports/), database tracks metadata (date, crop year, filename)

### Claude's Discretion
- Progress indicator design during generation
- Exact table column widths and formatting
- How to handle very long field names in table columns
- Error handling if PDF generation fails
- File naming convention for saved reports

</decisions>

<specifics>
## Specific Ideas

- The inspector just needs to compare harvested vs sold and verify it's within reason — don't over-engineer the mass balance with reconciliation math or pass/fail logic
- Use @react-pdf/renderer (already installed) with @ag-media/react-pdf-table for table rendering
- Report should feel professional and complete — the kind of document you hand to a USDA inspector with confidence

</specifics>

<deferred>
## Deferred Ideas

- Settlement sheet import — import PDFs/images of settlement sheets, scrape/parse sale quantities to auto-populate sales records. Would eliminate manual sales data entry. Significant new capability (OCR/parsing) — its own phase or milestone.
- Compliance analysis — flagging non-NOP-approved materials in the report. Belongs in a future phase.

</deferred>

---

*Phase: 03-inspection-report-generation*
*Context gathered: 2026-02-25*
