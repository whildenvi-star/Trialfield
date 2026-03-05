---
phase: 28-fsa-planting-workflow-ui
plan: 02
subsystem: ui
tags: [nextjs, react, react-pdf, pdf, csv, fsa, clu-records, export]

# Dependency graph
requires:
  - phase: 28-fsa-planting-workflow-ui
    provides: CluWorkspace with export-buttons-placeholder div, CluRecord TypeScript type, calc.ts

provides:
  - AcreagePdfDocument — landscape LETTER react-pdf Document, Farm/Tract grouped table, per-farm subtotals, per-crop breakdown, organic/conventional split, grand total
  - AcreagePdfButton — PDFDownloadLink wrapper with loading state, soil design tokens, fileName="acreage-reporting-summary-2026.pdf"
  - exportCsv() — client-side full data dump with 29 fields, comma/quote escaping, Blob auto-download
  - Export PDF + Export CSV buttons always visible top-right of CluWorkspace page header
affects: [Phase 29, Phase 30 insurance UI — same PDF/CSV export pattern applicable]

# Tech tracking
tech-stack:
  added:
    - "@react-pdf/renderer ^4.3.2"
  patterns:
    - "react-pdf SSR guard: always dynamic({ ssr: false }) — never import @react-pdf/renderer in SSR path"
    - "PDF component isolation: only acreage-pdf.tsx and acreage-pdf-button.tsx import from @react-pdf/renderer"
    - "CSV export: Blob + URL.createObjectURL + temporary anchor element + revokeObjectURL"
    - "dynamic() named export: import(mod).then(m => ({ default: m.NamedExport })) pattern for named exports"

key-files:
  created:
    - glomalin-portal/src/components/fsa/acreage-pdf.tsx
    - glomalin-portal/src/components/fsa/acreage-pdf-button.tsx
  modified:
    - glomalin-portal/src/components/fsa/clu-workspace.tsx
    - glomalin-portal/package.json

key-decisions:
  - "dynamic() named export syntax: import(mod).then(m => ({ default: m.NamedExport })) — required because AcreagePdfButton is a named export, not default export"
  - "PDF disclaimer required in document body: 'This is a reporting summary for producer records. It is not an official FSA-578 government form.'"
  - "Farm groups use <View break={farmIdx > 0}> — forces page break between farms (not within farms)"
  - "CSV headers list 29 fields including all historic/tillage fields — full data dump per FSA-08 requirement"

patterns-established:
  - "react-pdf isolation: zero react-pdf imports outside the two PDF component files — enforced by architecture"
  - "Landscape LETTER with 30pt padding is standard for FSA tabular reports"

requirements-completed: [FSA-07, FSA-08]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 28 Plan 02: FSA Export — PDF + CSV Acreage Reporting Summary

**Landscape LETTER Acreage Reporting Summary PDF with Farm/Tract grouping and subtotals, plus full-field CSV export, wired into CluWorkspace header via dynamic SSR-guarded import**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T15:37:06Z
- **Completed:** 2026-03-05T15:42:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 new + 1 modified + package.json)

## Accomplishments

- Installed @react-pdf/renderer and built AcreagePdfDocument with Farm/Tract grouped table layout, per-farm subtotals, per-crop breakdown, organic/conventional split, and grand total
- PDF explicitly labeled "Acreage Reporting Summary" with disclaimer it is not an official FSA-578 government form
- Built AcreagePdfButton as PDFDownloadLink wrapper with loading state and soil design tokens
- Added exportCsv() with 29-field full data dump, proper comma/quote escaping, and Blob auto-download pattern
- Wired both buttons into CluWorkspace header via dynamic({ ssr: false }) import pattern — prevents react-pdf SSR crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @react-pdf/renderer + AcreagePdfDocument + AcreagePdfButton** - `2195b86` (feat)
2. **Task 2: Wire Export PDF (dynamic import) and Export CSV into CluWorkspace header** - `6cf858a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `glomalin-portal/src/components/fsa/acreage-pdf.tsx` — react-pdf Document: landscape LETTER, Farm/Tract table, subtotals, per-crop/organic split, grand total, disclaimer
- `glomalin-portal/src/components/fsa/acreage-pdf-button.tsx` — PDFDownloadLink wrapper, soil tokens, loading state, fileName="acreage-reporting-summary-2026.pdf"
- `glomalin-portal/src/components/fsa/clu-workspace.tsx` — Added dynamic import of AcreagePdfButton (ssr:false), exportCsv() helper, export buttons in header
- `glomalin-portal/package.json` — Added @react-pdf/renderer ^4.3.2

## Decisions Made

- Named export dynamic import pattern: `import(mod).then(m => ({ default: m.NamedExport }))` — required for named exports with next/dynamic
- `<View break={farmIdx > 0}>` on farm groups forces page breaks between farms for clean pagination across 444 records
- CSV export headers include 29 fields covering all CluRecord columns for maximum data portability
- PDF and CSV button components remain isolated — only these two files ever import from @react-pdf/renderer

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiled cleanly, Next.js build succeeded without errors.

## Issues Encountered

None — react-pdf v4 API is compatible with plan spec. dynamic() named export syntax required one minor adjustment from plan's inline example but is standard Next.js pattern.

## User Setup Required

None — no external service configuration required. Export buttons work client-side with zero backend dependency.

## Next Phase Readiness

- Phase 28 complete: all FSA planting workflow UI components built (Plan 01: card workflow, Plan 02: PDF/CSV export)
- FSA-07 and FSA-08 requirements fulfilled
- react-pdf isolation pattern established — Phase 30 insurance UI can reuse same pattern for insurance reports
- CluWorkspace header export button pattern available as reference for insurance/claims modules

---
*Phase: 28-fsa-planting-workflow-ui*
*Completed: 2026-03-05*
