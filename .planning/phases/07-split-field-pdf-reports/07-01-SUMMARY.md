---
phase: 07-split-field-pdf-reports
plan: 01
subsystem: pdf
tags: [react-pdf, report-assembler, split-field, enterprises, field-list, typescript]

# Dependency graph
requires:
  - phase: 05-split-field-enterprises
    provides: "FieldEnterprise model with label, isFallow, plantedAcres; CropLot.fieldEnterpriseId"
  - phase: 06-multi-enterprise-field-views
    provides: "Multi-enterprise UI; confirmed label/isFallow fields in use"
provides:
  - "ApplicationRecord with enterpriseId, enterpriseLabel, isSplitField"
  - "HarvestRecord with enterpriseId, enterpriseLabel, isSplitField"
  - "MassBalanceLot with enterpriseLabel"
  - "formatFieldLabel() utility exported from report-assembler.ts"
  - "splitFieldStyles (subRow, subRowText, parentRow, enterpriseLabelHeader) in styles.ts"
  - "FieldList PDF section with parent+sub-row layout for split fields"
affects:
  - 07-02-field-history
  - 07-03-application-harvest-mass-balance

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "splitFieldYears set computed before flattening loops — isSplitField is per cropYear, not per field"
    - "Assembler carries enterprise identity on flat records; PDF sections are dumb renderers"
    - "React.Fragment wrapping parent+sub-rows for split fields in @react-pdf/renderer"
    - "Sub-row 24pt paddingLeft indent via splitFieldStyles.subRow"

key-files:
  created: []
  modified:
    - organic-cert/src/lib/report-assembler.ts
    - organic-cert/src/lib/pdf/styles.ts
    - organic-cert/src/lib/pdf/sections/field-list.tsx

key-decisions:
  - "formatFieldLabel utility placed in report-assembler.ts (not a pdf helper) — shared by Plans 02 and 03"
  - "splitFieldYears computed from farm.fields (raw Prisma data) before the mapped fields array is built"
  - "Single-enterprise field-list path unchanged — exact backward compatibility preserved"
  - "Parent row alternating color follows field index (same isAlt logic); sub-rows always use splitFieldStyles.subRow (altRowBg)"
  - "Sub-row column alignment mirrors parent row columns: label(25%), acres(15%), empty(15%), crop(20%), variety(25%)"

patterns-established:
  - "Pattern: isSplitField via splitFieldYears Set — never compute at field level, always per cropYear"
  - "Pattern: assembler populates enterprise identity, PDF sections branch on count"
  - "Pattern: React.Fragment for parent+sub-row pairs in react-pdf (no wrapper View needed)"

requirements-completed: [RPT-01]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 7 Plan 01: Assembler Enterprise Identity + Field List Split-Field Rendering Summary

**Enterprise identity fields (enterpriseId, enterpriseLabel, isSplitField) added to all flat assembler records; Field List PDF section renders split fields as parent row + indented enterprise sub-rows while preserving exact backward compatibility for single-enterprise fields.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T19:52:37Z
- **Completed:** 2026-02-28T19:55:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Updated ApplicationRecord, HarvestRecord, and MassBalanceLot interfaces with enterprise identity fields — all downstream PDF sections (Plans 02, 03) can now format "Field (Label)" without re-joining data
- Exported `formatFieldLabel()` utility from report-assembler.ts for shared use across harvest log, application log, and mass balance sections
- Field List section correctly renders split fields with parent row (field name + total acres + organic status + enterprise count) and indented sub-rows (label, planted acres, crop, variety) including fallow enterprises
- Added `splitFieldStyles` to styles.ts (subRow, subRowText, parentRow, enterpriseLabelHeader) for reuse in Plan 02 (field history)

## Task Commits

No individual git commits — organic-cert/ directory is not tracked in this planning-docs-only repository. Application code changes verified on disk and confirmed by TypeScript compile (zero errors).

**Plan metadata:** committed in final docs commit.

## Files Created/Modified
- `organic-cert/src/lib/report-assembler.ts` — Added enterpriseId/enterpriseLabel/isSplitField to ApplicationRecord and HarvestRecord; added enterpriseLabel to MassBalanceLot; added formatFieldLabel() utility; added splitFieldYears Set computation before flattening loops; updated allApplications, allHarvests flattening; added fieldEnterprise include to CropLot query; updated mass balance lot creation
- `organic-cert/src/lib/pdf/styles.ts` — Added splitFieldStyles export (parentRow, subRow, subRowText, enterpriseLabelHeader)
- `organic-cert/src/lib/pdf/sections/field-list.tsx` — Updated to filter enterprises by cropYear, branch on isSplit, render parent+sub-rows for split fields, fallow enterprises in sub-rows, summary row unchanged

## Decisions Made
- `formatFieldLabel` placed in report-assembler.ts (not pdf/styles or a pdf helper file) because it is data logic, not rendering logic — Plans 02 and 03 import it from the assembler
- `splitFieldYears` computed from `farm.fields` (raw Prisma data) rather than from the already-mapped `fields` array — the raw data has the same enterprise information and avoids an extra pass
- Sub-row column widths mirror parent row columns exactly: label at 25%, planted acres at 15% (under Total Acres), empty at 15% (organic status not repeated), crop at 20%, variety at 25% — provides clear visual alignment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt. The `fieldEnterprise` relation was already accessible on CropLot (confirmed from schema; the where clause already used it as a filter path), so the include addition required no schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 02 and 03 can now consume `enterpriseId`, `enterpriseLabel`, and `isSplitField` from flat ApplicationRecord and HarvestRecord — the assembler data foundation is complete
- `splitFieldStyles.enterpriseLabelHeader` is ready for Plan 02 (field history enterprise label headers)
- `formatFieldLabel()` is exported and ready for Plans 02 and 03 (harvest log, application log, mass balance)
- TypeScript is clean — no type errors introduced

---
*Phase: 07-split-field-pdf-reports*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: `.planning/phases/07-split-field-pdf-reports/07-01-SUMMARY.md`
- FOUND: `organic-cert/src/lib/report-assembler.ts` (enterpriseId, enterpriseLabel, isSplitField, formatFieldLabel, splitFieldYears all verified)
- FOUND: `organic-cert/src/lib/pdf/styles.ts` (splitFieldStyles with subRow, subRowText, parentRow, enterpriseLabelHeader exported)
- FOUND: `organic-cert/src/lib/pdf/sections/field-list.tsx` (isSplit branch, parent+sub-row rendering, single-enterprise path unchanged)
- TypeScript: zero errors (`npx tsc --noEmit` clean)
- Final commit: `c8eb38a`
