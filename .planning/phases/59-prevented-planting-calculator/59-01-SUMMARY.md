---
phase: 59-prevented-planting-calculator
plan: 01
subsystem: ui
tags: [insurance, calc, prevented-planting, rma, policy-drawer, react]

requires:
  - phase: 56-aph-records
    provides: AphPanel wired into insurance workspace; APH compute pattern in calc.ts
  - phase: 29-insurance-data
    provides: InsurancePolicy and PricingEntry types; insurance_pricing table with spring_price

provides:
  - computePpIndemnity pure function in insurance calc engine (PP_COVERAGE_FACTOR = 0.60)
  - PP toggle checkbox in policy drawer (preserved via PATCH API)
  - PP acres number input (conditional on PP toggle)
  - Inline PP indemnity estimate display with formula breakdown

affects: [insurance-pdf, payout-simulator, coverage-matrix, 60-settlement-summary]

tech-stack:
  added: []
  patterns:
    - "PP indemnity = guarantee × 0.60 × spring_price × prevented_planting_acres (RMA standard)"
    - "computePpIndemnity uses same pricing lookup pattern as computeInsurancePolicy (case-insensitive crop match)"
    - "PolicyDrawer accepts pricing prop for live client-side PP estimate — no API call needed"

key-files:
  created: []
  modified:
    - glomalin-portal/src/lib/insurance/calc.ts
    - glomalin-portal/src/components/insurance/policy-drawer.tsx
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx

key-decisions:
  - "PP_COVERAGE_FACTOR = 0.60 exported as named constant — RMA standard for corn/soybeans/wheat/barley/oats/rye; single source for UI and future PDF"
  - "PricingEntryForPp is a module-private interface in insurance/calc.ts — avoids cross-lib import while still type-safe; shape matches PricingEntry from fsa/calc"
  - "PP indemnity estimate computed client-side via inline IIFE in JSX — no state needed, recalculates on every render when inputs change"
  - "pricing prop added to PolicyDrawer (not fetched inside drawer) — consistent with existing pattern where workspace owns data fetching"

patterns-established:
  - "Inline estimate display pattern: rounded border box with accent label, dollar amount, and muted formula breakdown — matches APH from CLU Records display style"

requirements-completed: [PP-01]

duration: 2min
completed: 2026-03-29
---

# Phase 59 Plan 01: Prevented Planting Calculator Summary

**computePpIndemnity pure function (guarantee × 60% × spring_price × pp_acres) wired into policy drawer with live PP toggle, PP acres input, and inline indemnity estimate**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T18:33:53Z
- **Completed:** 2026-03-29T18:36:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Exported `computePpIndemnity` and `PP_COVERAGE_FACTOR = 0.60` from `insurance/calc.ts`
- Added "Prevented Planting" section to policy drawer: checkbox, conditional PP acres input, and inline indemnity estimate display
- Updated `handleCreate` and `handleUpdate` in workspace to include PP fields in API body
- TypeScript compiles without errors

## Task Commits

1. **Task 1: Add computePpIndemnity function to insurance calc engine** - `9f8347a` (feat)
2. **Task 2: Add PP toggle, PP acres, and PP indemnity display to policy drawer and workspace** - `d5fad65` (feat)

## Files Created/Modified
- `glomalin-portal/src/lib/insurance/calc.ts` - Added PP_COVERAGE_FACTOR constant and computePpIndemnity pure function
- `glomalin-portal/src/components/insurance/policy-drawer.tsx` - Added PP toggle checkbox, PP acres input (conditional), inline indemnity estimate; added pricing prop
- `glomalin-portal/src/components/insurance/insurance-workspace.tsx` - Added PP fields to PolicyFormData, passes pricing to PolicyDrawer, includes PP fields in create/update bodies

## Decisions Made
- `PricingEntryForPp` is a module-private interface in `insurance/calc.ts` rather than importing from `fsa/calc` — avoids cross-lib dependency while keeping the type-safe; shape matches `PricingEntry` exactly
- PP indemnity estimated client-side via inline IIFE in JSX — no additional state variable needed, recalculates reactively on every form change
- `pricing` prop added to `PolicyDrawer` (not fetched inside) — consistent with workspace-owns-data-fetching pattern established in earlier phases

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PP-01 complete. computePpIndemnity available for insurance PDF (Phase 30 PDF or future PDF update).
- The PP estimate displays live in the drawer when the user toggles PP on and enters acres.
- Saving a policy with PP toggled on persists both fields via the existing PATCH/POST APIs.

---
*Phase: 59-prevented-planting-calculator*
*Completed: 2026-03-29*
