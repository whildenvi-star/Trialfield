---
phase: 07-split-field-pdf-reports
plan: 03
subsystem: pdf
tags: [react-pdf, harvest-log, application-log, mass-balance, split-field, enterprises, typescript]

# Dependency graph
requires:
  - phase: 07-split-field-pdf-reports
    plan: 01
    provides: "enterpriseLabel/isSplitField on ApplicationRecord and HarvestRecord; enterpriseLabel on MassBalanceLot; formatFieldLabel() utility"
provides:
  - "Harvest Log PDF section with 'Field (Label)' display for split-field harvests"
  - "Application Log PDF section with 'Field (Label)' display for split-field applications"
  - "Mass Balance lot rows showing 'LotNumber (Enterprise Label)' for split-field lots"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PDF sections import formatFieldLabel from report-assembler (not a pdf helper) — assembler owns the formatting logic"
    - "Mass balance lot display uses inline conditional (enterpriseLabel ? lotNumber (label) : lotNumber) — simpler than formatFieldLabel since it shows lot number, not field name"
    - "Single-enterprise backward compatibility: isSplitField=false path returns plain field name from formatFieldLabel"

key-files:
  created: []
  modified:
    - organic-cert/src/lib/pdf/sections/harvest-log.tsx
    - organic-cert/src/lib/pdf/sections/application-log.tsx
    - organic-cert/src/lib/pdf/sections/mass-balance.tsx

key-decisions:
  - "Mass balance lot rows use inline conditional (not formatFieldLabel) — lot rows show lot number context, not field name context"
  - "Column widths adjusted in harvest-log (Field 18->24%, Lot 18->16%, Acres 10->8%, Equipment 10->8%) to fit 'Field (Label)' without overflow"
  - "Column widths adjusted in application-log (Field 15->20%, Notes 8->3%) — Notes column was always placeholder '—', 3% sufficient"

patterns-established:
  - "Pattern: formatFieldLabel() imported by PDF section files that render field-level records (harvest log, application log)"
  - "Pattern: Mass balance lot display uses local ternary — different presentation context than field-level sections"

requirements-completed: [RPT-03, RPT-04]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 7 Plan 03: Harvest Log, Application Log, and Mass Balance Enterprise Label Display Summary

**formatFieldLabel applied to Harvest Log and Application Log Field columns for 'Field (Label)' split-field display; Mass Balance lot rows show 'LotNumber (Enterprise Label)' for split-field lots; all three sections maintain exact backward compatibility for single-enterprise fields.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T19:58:54Z
- **Completed:** 2026-02-28T20:00:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Harvest Log Field column now uses `formatFieldLabel(harvest.fieldName, harvest.enterpriseLabel, harvest.isSplitField)` — inspectors see "Simpson Farm (North 40)" for split-field harvests and plain "Simpson Farm" for single-enterprise harvests
- Application Log Field column now uses `formatFieldLabel(app.fieldName, app.enterpriseLabel, app.isSplitField)` — input applications are traceable to specific enterprises within split fields
- Mass Balance lot rows now show "2025-CORN-KOPP-NORT (North 40)" for split-field lots and plain "2025-CORN-KOPP" for single-enterprise lots — lot number provides enterprise context for inspector traceability
- Column widths adjusted in both logs to accommodate longer field+label strings while maintaining 100% total
- Crop-level totals (totalHarvestedLbs, totalSoldLbs) in Mass Balance unchanged — no double-counting risk

## Task Commits

No individual git commits — organic-cert/ directory is not tracked in this planning-docs-only repository. Application code changes verified on disk and confirmed by TypeScript compile (zero errors).

**Plan metadata:** committed in final docs commit.

## Files Created/Modified
- `organic-cert/src/lib/pdf/sections/harvest-log.tsx` — Added formatFieldLabel import; updated Field column in data rows; adjusted column widths: Field 18%->24%, Lot Number 18%->16%, Acres 10%->8%, Equipment 10%->8% (total=100%)
- `organic-cert/src/lib/pdf/sections/application-log.tsx` — Added formatFieldLabel import; updated Field column in data rows; adjusted column widths: Field 15%->20%, Notes 8%->3% (total=100%)
- `organic-cert/src/lib/pdf/sections/mass-balance.tsx` — Updated lot row to show "LotNumber (Enterprise Label)" when enterpriseLabel exists, plain LotNumber otherwise; no changes to aggregation, grouping, or column layout

## Decisions Made
- Mass balance lot rows use an inline conditional rather than `formatFieldLabel` — the mass balance section shows lot number + enterprise context (not field name + enterprise context), so the dedicated utility is not appropriate here
- Notes column in Application Log reduced from 8% to 3% because the column was never populated (always rendered "—") — the 5% recovered goes entirely to Field column for label display
- Harvest Log column redistribution: Field gains 6%, Lot Number loses 2%, Acres loses 2%, Equipment loses 2% — net result gives adequate space for "Field Name (4-word label)" while preserving readability of numeric columns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt. The `enterpriseLabel` field on `MassBalanceLot` was already populated by the Plan 01 assembler changes, so the mass balance conditional required no type changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 7 (Split-Field PDF Reports) is now complete — all three waves executed:
  - Plan 01: Assembler enterprise identity + Field List split-field rendering
  - Plan 02: Field History enterprise label headers (per STATE.md plan sequence)
  - Plan 03: Harvest Log, Application Log, Mass Balance enterprise label display
- All PDF sections consistently display enterprise labels for split-field data
- TypeScript is clean across all modified files

---
*Phase: 07-split-field-pdf-reports*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: `.planning/phases/07-split-field-pdf-reports/07-03-SUMMARY.md`
- FOUND: `organic-cert/src/lib/pdf/sections/harvest-log.tsx` (formatFieldLabel imported and used in Field column, 2 occurrences)
- FOUND: `organic-cert/src/lib/pdf/sections/application-log.tsx` (formatFieldLabel imported and used in Field column, 2 occurrences)
- FOUND: `organic-cert/src/lib/pdf/sections/mass-balance.tsx` (enterpriseLabel conditional present, 2 occurrences)
- TypeScript: zero errors (`npx tsc --noEmit` clean)
