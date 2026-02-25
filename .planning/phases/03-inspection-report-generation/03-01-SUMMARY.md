---
phase: 03-inspection-report-generation
plan: 01
subsystem: organic-cert/pdf-reporting
tags: [pdf, prisma, react-pdf, report-assembly, infrastructure]
dependency_graph:
  requires: []
  provides:
    - assembleReportData(farmId, cropYear, fieldIds?) -> ReportData
    - ReportPage component with fixed header/footer
    - TableHeader and TableRow reusable table components
    - Shared PDF styles and color palette
    - GeneratedReport Prisma model
  affects:
    - organic-cert/prisma/schema.prisma
    - organic-cert/next.config.ts
tech_stack:
  added:
    - "@ag-media/react-pdf-table@^2.0.3"
  patterns:
    - Nested Prisma includes for multi-level report data assembly
    - react-pdf fixed Views for persistent header/footer
    - StyleSheet.create() shared across all PDF section components
key_files:
  created:
    - organic-cert/src/lib/report-assembler.ts
    - organic-cert/src/lib/pdf/styles.ts
    - organic-cert/src/lib/pdf/components/page-wrapper.tsx
    - organic-cert/src/lib/pdf/components/table-row.tsx
    - organic-cert/uploads/reports/.gitkeep
  modified:
    - organic-cert/prisma/schema.prisma
    - organic-cert/next.config.ts
    - organic-cert/.gitignore
    - organic-cert/package.json
decisions:
  - "@ag-media/react-pdf-table installed but not directly used in this plan — available for Plan 02 PDF section tables"
  - "col()/headerCol() return explicit typed objects (not StyleSheet.create entries) so they compose with per-component StyleSheet without conflicts"
  - "ReportPage orientation prop defaults to portrait; caller passes landscape for wide-table sections"
  - "assembleReportData uses a single farm query plus one CropLot query for mass balance — minimizes round trips"
metrics:
  duration: 7 minutes
  completed: 2026-02-25
  tasks_completed: 3
  files_created: 5
  files_modified: 4
---

# Phase 3 Plan 1: PDF Report Infrastructure Summary

**One-liner:** GeneratedReport Prisma model, react-pdf server config, typed report data assembler, and shared PDF layout components (styles, page wrapper, table row).

## What Was Built

### Task 1: Schema, Config, and Uploads Directory (56505fb)

Added `GeneratedReport` model to Prisma schema to track report metadata (farmId, cropYear, filename, filePath, fieldCount). Added `logoPath String?` field to `Farm` model for cover page logo. Configured `next.config.ts` with `serverExternalPackages: ["@react-pdf/renderer"]` — required for `renderToBuffer` to work in Next.js App Router. Added `uploads/` to `.gitignore` and created `uploads/reports/.gitkeep` placeholder. Installed `@ag-media/react-pdf-table@^2.0.3`.

**Verification:** `prisma db push` synced schema in 63ms. `generatedReport.count()` returns 0 (model exists). `@ag-media/react-pdf-table` confirmed in package.json.

### Task 2: Report Data Assembler (654e034)

Created `organic-cert/src/lib/report-assembler.ts` with:
- Full TypeScript interface hierarchy: `ReportData`, `FarmInfo`, `FieldWithHistory`, `ApplicationRecord`, `HarvestRecord`, `MassBalanceByCrop`, `MassBalanceLot`
- `assembleReportData(farmId, cropYear, fieldIds?)` — queries farm with 3-year nested enterprises (materialUsages with material, fieldOperations with equipment, harvestEvents with cropLots with loadoutEvents with saleDelivery)
- Flattens materialUsages → `allApplications[]` sorted by date
- Flattens harvestEvents → `allHarvests[]` with lot number pulled from first associated CropLot
- Second query: CropLots for current year only, grouped by crop into `massBalance[]` with per-lot sold lbs summed from saleDelivery.quantityLbs

### Task 3: Shared PDF Components (7e39145)

**`styles.ts`:** Farm-green color palette (primary #2d5a27), `StyleSheet.create()` with page, landscapePage, header, footer, sectionTitle, subsectionTitle, tableHeader, tableRow, altTableRow styles. Helper functions `col(width)` and `headerCol(width)` for per-column styling.

**`page-wrapper.tsx`:** `ReportPage` component wrapping react-pdf `<Page size="LETTER">` with `fixed` header View (farm name left, report title right, green border-bottom) and `fixed` footer View (generated date left, "Page X of Y" right using `render` prop).

**`table-row.tsx`:** `TableHeader` accepts `columns: { label, width }[]` and renders primary-bg header row. `TableRow` accepts `cells: { value, width }[]` and `isAlt` boolean for zebra striping. Both use `wrap={false}` to prevent row splitting across pages.

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Verification

- [x] GeneratedReport model in database, Farm.logoPath field added
- [x] report-assembler.ts exports typed ReportData and assembleReportData function
- [x] Shared PDF styles, page wrapper, and table row components exist and type-check
- [x] Next.js configured for server-side @react-pdf/renderer
- [x] All foundations ready for Plan 02 (PDF sections) and Plan 03 (API + UI)

## Commits

| Hash | Message |
|------|---------|
| 56505fb | feat(03-01): schema, config, and uploads directory setup |
| 654e034 | feat(03-01): add report data assembler |
| 7e39145 | feat(03-01): add shared PDF components (styles, page wrapper, table row) |

## Self-Check

All 7 files confirmed present. All 3 commits confirmed in git log.

## Self-Check: PASSED
