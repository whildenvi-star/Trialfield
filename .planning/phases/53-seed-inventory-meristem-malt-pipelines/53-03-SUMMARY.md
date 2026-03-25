---
phase: 53-seed-inventory-meristem-malt-pipelines
plan: 03
subsystem: pdf
tags: [organic-cert, pdf, nop-compliance, seed-compliance, inspection-report]

# Dependency graph
requires:
  - phase: 53-01
    provides: SeedLotRecord type and seedLots in ReportData (seed lot query + checkSeedCompliance)
provides:
  - SeedCompliance PDF section rendering NOP C9.0 Seed Sources table
  - SeedLotRecord interface and seedLots field in ReportData/report-assembler.ts
  - Inspection report PDF includes C9.0 section between Application Log and Harvest Log
  - ToC updated with C9.0 — Seed Sources entry
affects: [organic-cert inspection report PDF, NOP audit workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@react-pdf/renderer landscape table with fixed-width columns and alternating row shading"
    - "Color-coded verdict column in PDF: pass=green, review=amber, needs-doc=red"
    - "Compliance summary block with conditional warnings based on verdict counts"

key-files:
  created:
    - organic-cert/src/lib/pdf/sections/seed-compliance.tsx
  modified:
    - organic-cert/src/lib/report-assembler.ts (SeedLotRecord interface + seedLots query)
    - organic-cert/src/lib/pdf/inspection-report.tsx (SeedCompliance import + render)
    - organic-cert/src/lib/pdf/sections/toc-page.tsx (C9.0 entry added)

key-decisions:
  - "SeedCompliance rendered in landscape orientation — 9-column table fits comfortably at 8pt font"
  - "omriListed defaults false in report assembler — field not on Prisma SeedLot model; populated via compile pipeline from seed-inventory (Plan 01)"
  - "ToC updated from 6 to 7 entries — C9.0 inserted between Application Log and Harvest Log"

requirements-completed:
  - PIPE-06

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 53 Plan 03: Seed Compliance PDF Section Summary

**NOP C9.0 Seed Sources section added to organic-cert inspection report PDF — auto-populated from seed-inventory delivery data with lot numbers, cert numbers, supplier names, and compliance verdicts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T20:38:00Z
- **Completed:** 2026-03-25T20:46:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `SeedLotRecord` interface to report-assembler.ts with all NOP compliance fields (lot/cert numbers, isOrganic, isUntreated, omriListed, commercialAvailDoc, fieldNames, totalAcres, verdict, reasons)
- Added `seedLots: SeedLotRecord[]` to `ReportData` interface
- Report assembler queries `prisma.seedLot` with `seedUsages` for the target cropYear, filters to lots with actual usage, applies `checkSeedCompliance` for verdicts, sorts by crop then variety
- Created `seed-compliance.tsx` — landscape PDF section with 9-column table: Crop/Variety, Lot #, Cert #, Supplier, Organic?, Untreated?, Status, Fields, Acres
- Color-coded Status column: pass=green, review=amber, needs-doc=red
- Compliance summary block below table shows: X of Y lots compliant, warnings for needs-doc (NOP 205.204 reference), warnings for review lots
- Empty state gracefully renders instruction to run compile when no seed data exists
- Wired `SeedCompliance` into `inspection-report.tsx` between ApplicationLog and HarvestLog
- Updated ToC to include "C9.0 — Seed Sources" as entry 5 (before Harvest Log)

## Task Commits

Each task was committed atomically (organic-cert nested git repo):

1. **Task 1: Add seed lot data to report assembler**
   - Commit: `2f219db` — feat(53-03): add SeedLotRecord interface and seed lot query to report assembler

2. **Task 2: Create SeedCompliance PDF section and wire into inspection report**
   - Commit: `70cb473` — feat(53-03): add SeedCompliance PDF section and wire into inspection report

## Files Created/Modified

- `organic-cert/src/lib/report-assembler.ts` — SeedLotRecord interface, seedLots field on ReportData, prisma.seedLot query with seedUsages, checkSeedCompliance per lot
- `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` — New: NOP C9.0 Seed Sources PDF section component
- `organic-cert/src/lib/pdf/inspection-report.tsx` — Added SeedCompliance import and render between ApplicationLog and HarvestLog
- `organic-cert/src/lib/pdf/sections/toc-page.tsx` — Added "C9.0 — Seed Sources" entry

## Decisions Made

- SeedCompliance rendered in landscape orientation — 9-column table fits comfortably at 8pt font, matching the ApplicationLog pattern
- omriListed defaults false in report assembler — field is not on the Prisma SeedLot model; populated via compile pipeline from seed-inventory (Plan 01) when available
- ToC updated from 6 to 7 entries with C9.0 inserted between Application Log and Harvest Log (NOP section order)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `enterprise-grid.tsx` appear in `tsc --noEmit` output — these are documented as out-of-scope (noted in STATE.md from Phase 46-03). No errors in files modified by this plan.

## Self-Check

**Files exist:**
- `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` — FOUND
- `organic-cert/src/lib/report-assembler.ts` (modified) — FOUND
- `organic-cert/src/lib/pdf/inspection-report.tsx` (modified) — FOUND

**Commits exist:**
- `2f219db` — FOUND
- `70cb473` — FOUND

## Self-Check: PASSED

## Next Phase Readiness

- PIPE-06 complete. NOP C9.0 Seed Sources section now appears in inspection report PDF.
- Phase 53 complete (all 3 plans done: PIPE-05, PIPE-07/08, PIPE-06).
- Seed data flow: seed-inventory → compile pipeline (Plan 01) → organic-cert SeedLot table → report assembler → PDF section.

---
*Phase: 53-seed-inventory-meristem-malt-pipelines*
*Completed: 2026-03-25*
