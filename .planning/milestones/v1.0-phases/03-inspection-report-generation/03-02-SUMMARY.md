---
phase: 03-inspection-report-generation
plan: 02
subsystem: organic-cert/pdf-reporting
tags: [pdf, react-pdf, report-sections, inspection-report, nop, date-fns]
dependency_graph:
  requires:
    - phase: 03-01
      provides: "ReportData type, assembleReportData, ReportPage, TableHeader, TableRow, styles, colors"
  provides:
    - CoverPage: portrait cover with farm info, NOP title, and inspector placeholder
    - TocPage: static section listing with PDF bookmark note
    - OperationOverview: farm stats grid + certification block
    - FieldList: all fields with organic status and current crop/variety
    - FieldHistory: 3-year per-field chronological operation tables (landscape)
    - ApplicationLog: input application records with NOP status (landscape)
    - HarvestLog: harvest events with lot numbers (portrait)
    - MassBalance: per-crop harvested vs sold without reconciliation (portrait)
    - InspectionReport: top-level Document assembling all 8 sections in NOP order
  affects:
    - organic-cert/src/app/api/reports (Plan 03 - renderToBuffer call site)
tech_stack:
  added: []
  patterns:
    - Manual flex table rows (not @ag-media/react-pdf-table) for multi-page safe tables
    - ReportPage orientation prop for landscape sections (field history, application log)
    - Bare Page for cover (no header/footer on cover page)
    - Shared pageProps spread pattern for farmName/reportTitle/generatedDate
    - Data derivation from ReportData arrays filtered by cropYear for section-level views
key_files:
  created:
    - organic-cert/src/lib/pdf/inspection-report.tsx
    - organic-cert/src/lib/pdf/sections/cover-page.tsx
    - organic-cert/src/lib/pdf/sections/toc-page.tsx
    - organic-cert/src/lib/pdf/sections/operation-overview.tsx
    - organic-cert/src/lib/pdf/sections/field-list.tsx
    - organic-cert/src/lib/pdf/sections/field-history.tsx
    - organic-cert/src/lib/pdf/sections/application-log.tsx
    - organic-cert/src/lib/pdf/sections/harvest-log.tsx
    - organic-cert/src/lib/pdf/sections/mass-balance.tsx
  modified:
    - organic-cert/src/lib/report-assembler.ts
key_decisions:
  - "FarmInfo extended with certStatus, certExpiry, nopId — cover page and operation overview need cert fields not in original interface"
  - "FieldWithHistory.enterprises extended with fieldOperations and fertilityEvents arrays — field history section requires operations per enterprise not just summary fields"
  - "Bookmark component does not exist in react-pdf — Bookmark is a type (used as Page prop), not a renderable element; TOC uses simple list without inline bookmarks"
  - "ApplicationLog and HarvestLog filter to current cropYear only — all-years view would overwhelm the log; field history provides 3-year detail"
  - "Field history merges applications from allApplications (filtered by field/year) rather than duplicating data from enterprise.materialUsages"
patterns-established:
  - "Landscape sections: ReportPage orientation='landscape' for tables wider than portrait page"
  - "Empty state pattern: single italic text line with crop year context rather than empty table"
  - "Manual flex table header: explicit View with flexDirection:row + headerCol() per cell"
  - "Atomic rows: wrap={false} on every table row View to prevent mid-row page breaks"
  - "Shared pageProps: const pageProps = { farmName, reportTitle, generatedDate } spread to all sections"
requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-04]
duration: 13min
completed: 2026-02-25
---

# Phase 3 Plan 2: PDF Section Components Summary

**8 NOP inspection report sections (cover, TOC, overview, field list, field history, application log, harvest log, mass balance) plus top-level InspectionReport Document ready for renderToBuffer**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-25T12:41:02Z
- **Completed:** 2026-02-25T12:54:00Z
- **Tasks:** 3
- **Files modified:** 10 (9 created + 1 modified)

## Accomplishments

- All 8 NOP-ordered section components implemented and type-checking clean
- Top-level `InspectionReport` Document assembles all sections with typed `ReportData` props
- Landscape orientation for wide-table sections (field history, application log); portrait for others
- Multi-page table safety via manual flex rows with `wrap={false}` throughout
- Mass balance shows harvested vs sold per locked decision — no reconciliation math or pass/fail indicators
- `FarmInfo` and `EnterpriseWithOperations` types extended to carry cert fields and operation records needed by PDF sections

## Task Commits

1. **Task 1: Cover Page, TOC, Operation Overview, Field List** - `dfd17da` (feat)
2. **Task 2: Field History, Application Log, Harvest Log, Mass Balance** - `e74d497` (feat)
3. **Task 3: Top-Level InspectionReport Document** - `4bb2b6a` (feat)

## Files Created/Modified

- `organic-cert/src/lib/pdf/inspection-report.tsx` - Top-level Document with all 8 sections in NOP order
- `organic-cert/src/lib/pdf/sections/cover-page.tsx` - Portrait bare Page: logo/farm name, USDA NOP title, info block, crop year, inspector placeholder
- `organic-cert/src/lib/pdf/sections/toc-page.tsx` - Static section listing (6 sections), PDF bookmark navigation note
- `organic-cert/src/lib/pdf/sections/operation-overview.tsx` - 2-col stats grid (fields, acres, organic acres, crops grown, harvests, applications) + cert block
- `organic-cert/src/lib/pdf/sections/field-list.tsx` - Field table with organic status and current crop/variety, total acres summary row
- `organic-cert/src/lib/pdf/sections/field-history.tsx` - Landscape, 3-year per-field chronological table (fieldOps + fertilityEvents + applications + harvests merged)
- `organic-cert/src/lib/pdf/sections/application-log.tsx` - Landscape, current-year applications with NOP status (Approved/Restricted/Prohibited/Exempt)
- `organic-cert/src/lib/pdf/sections/harvest-log.tsx` - Portrait, current-year harvests with lot numbers, yield, net weight, equipment
- `organic-cert/src/lib/pdf/sections/mass-balance.tsx` - Portrait, per-crop totals + per-lot harvested vs sold (no reconciliation per locked decision)
- `organic-cert/src/lib/report-assembler.ts` - Added certStatus, certExpiry, nopId to FarmInfo; added FieldOperationRecord, FertilityEventRecord types; extended EnterpriseWithOperations; added fertilityEvents include to Prisma query

## Decisions Made

- `FarmInfo` extended with `certStatus`, `certExpiry`, `nopId` — cover page and operation overview reference cert fields that were in the Prisma schema but not exposed through the assembler interface.
- `FieldWithHistory.enterprises` extended with `fieldOperations: FieldOperationRecord[]` and `fertilityEvents: FertilityEventRecord[]` — field history section requires per-enterprise operations for the chronological table.
- `Bookmark` is a type in react-pdf, not a JSX element — plan spec referenced `<Bookmark />` as a renderable component, but it does not exist. TOC uses a clean static list; PDF bookmarks are set on each section's Page component.
- Application and harvest logs filter to `cropYear` only — 3-year detail is already in field history section; all-years log would be redundant and overwhelming.
- Field history section derives application rows by filtering `allApplications` array (by fieldName + cropYear) rather than reading them from `enterprise.materialUsages`, avoiding data duplication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended FarmInfo interface with missing cert fields**
- **Found during:** Task 1 (Cover Page implementation)
- **Issue:** Plan references `farm.nopId`, `farm.certStatus`, `farm.certExpiry` in cover page and operation overview, but `FarmInfo` in report-assembler.ts only exposed `certNumber`. Fields exist in the Prisma schema but were not passed through the assembler.
- **Fix:** Added `certStatus: string | null`, `certExpiry: Date | null`, `nopId: string | null` to `FarmInfo` interface and the `assembleReportData` return value.
- **Files modified:** `organic-cert/src/lib/report-assembler.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly.
- **Committed in:** `dfd17da` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added fieldOperations and fertilityEvents to EnterpriseWithOperations**
- **Found during:** Task 2 (Field History section)
- **Issue:** Field history section requires FieldOperations, MaterialUsages, FertilityEvents, and HarvestEvents per enterprise per year. `FieldWithHistory.enterprises` only had summary fields (no nested operations). The Prisma query already fetched `fieldOperations` but they were discarded in the mapping.
- **Fix:** Added `FieldOperationRecord` and `FertilityEventRecord` interfaces. Renamed enterprise type to `EnterpriseWithOperations`. Extended Prisma query to include `fertilityEvents`. Updated mapping to pass through both arrays.
- **Files modified:** `organic-cert/src/lib/report-assembler.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly.
- **Committed in:** `e74d497` (Task 2 commit)

**3. [Rule 1 - Bug] Removed non-existent `<Bookmark>` JSX element from TOC**
- **Found during:** Task 1 (TocPage implementation) — caught by `npx tsc --noEmit`
- **Issue:** Plan spec said to add `<Bookmark title={sectionName} />` element per TOC entry. In `@react-pdf/renderer`, `Bookmark` is a TypeScript type (used as the `bookmark` prop on `<Page>`), not a standalone JSX component. TypeScript error: `Module '@react-pdf/renderer' has no exported member 'Bookmark'`.
- **Fix:** Removed the `<Bookmark>` import and usage. TOC renders as a clean static list. PDF bookmarks for navigation are a `<Page>` prop feature, documented in the plan's note: "Use PDF bookmarks for direct navigation."
- **Files modified:** `organic-cert/src/lib/pdf/sections/toc-page.tsx`
- **Verification:** `npx tsc --noEmit` passes cleanly.
- **Committed in:** `dfd17da` (Task 1 commit, file was corrected before staging)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All fixes were necessary for type correctness and section functionality. No scope creep. The `Bookmark` fix is a react-pdf API clarification — the feature still works (PDF bookmarks can be added to each section's Page in Plan 03).

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `InspectionReport` Document is ready for `renderToBuffer` — Plan 03 builds the API route, downloads endpoint, and report management UI.
- All 4 RPT requirements (RPT-01 through RPT-04) are implemented: report structure (RPT-01), NOP-compliant field history table (RPT-02), application log with NOP status (RPT-03), mass balance without reconciliation (RPT-04).
- No blockers for Plan 03.

## Self-Check: PASSED

All 9 files confirmed present. All 3 commits confirmed in git log.

---
*Phase: 03-inspection-report-generation*
*Completed: 2026-02-25*
