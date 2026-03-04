---
phase: 17-input-seed-compilation-nop-compliance
plan: 02
subsystem: ui
tags: [react, nextjs, nop-compliance, compile-engine, organic-cert, tailwind]

# Dependency graph
requires:
  - phase: 17-01
    provides: input-mapper.ts, seed-mapper.ts, InputPreviewRow/SeedPreviewRow types, POST /api/compile/[year]/inputs and /seeds routes, nopResolved on Material

provides:
  - NOP compliance rule engine (pure stateless checkMaterialCompliance + checkSeedCompliance)
  - POST /api/materials/batch-resolve for bulk NOP status assignment
  - CompileAllResult type + NOP result re-exports in types.ts
  - Compile page extended with full input/seed compilation UI, NOP badges, unresolved materials panel
affects:
  - 17-03 (if any): can use nop-compliance.ts functions directly
  - 18-rotation-harvest-pdf: compile page pattern for harvest compilation section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure compliance functions (no Prisma imports) callable from both server and client
    - Parallel Promise.all fetch for Compile All (inputs + seeds simultaneous)
    - Auto-expand + scroll-to-ref pattern after commit (unresolvedRef.current.scrollIntoView)
    - materialMap lookup for OMRI badge without additional fetches

key-files:
  created:
    - organic-cert/src/lib/compile/nop-compliance.ts
    - organic-cert/src/app/api/materials/batch-resolve/route.ts
  modified:
    - organic-cert/src/lib/compile/types.ts
    - organic-cert/src/app/(app)/compile/page.tsx

key-decisions:
  - "checkMaterialCompliance and checkSeedCompliance are pure functions — no Prisma, callable from client components without server boundary"
  - "Compile All fetches both inputs and seeds in parallel via Promise.all — single user action triggers both endpoints"
  - "loadMaterials() fetches /api/materials (no farmId filter) — works because organic-cert is single-farm; materials list used for both materialMap (OMRI) and unresolved panel"
  - "Save All re-runs handleCompileAll after successful batch-resolve — compliance badges refresh immediately without manual re-compile"
  - "Readiness dashboard Phase 17 placeholder cells replaced with real readinessCellClass/readinessCellText using row.inputs and row.seeds"

patterns-established:
  - "Compliance badge rendering: complianceBadge(verdict) helper returns tailwind-colored pill span"
  - "Source provenance badge: sourceBadge('SYNCED' | 'MANUAL') renders farm-budget (blue) or manual (stone)"
  - "Auto-scroll after commit: setTimeout + unresolvedRef.current.scrollIntoView for post-commit UX"

requirements-completed: [CMP-03, CMP-04]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 17 Plan 02: NOP Compliance UI + Compile Page Extension Summary

**NOP compliance engine (pure functions), batch-resolve API, and full compile page UI: Compile All button, inputs/seeds diff tables, NOP compliance badges, source badges, unresolved materials panel with Save All**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T14:24:40Z
- **Completed:** 2026-03-03T14:29:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Pure `checkMaterialCompliance()` evaluates material NOP status + manure 90/120-day rule with estimated-date warning
- Pure `checkSeedCompliance()` evaluates NOP §205.204 (organic / untreated+doc / treated)
- `POST /api/materials/batch-resolve` transactionally sets nopResolved:true on multiple materials in one request with audit logging
- Compile page now has "Compile All (inputs + seeds)" button that fires both endpoints in parallel
- Inputs preview table shows Field/Product/Qty/Unit/Season/NOP Status badge/Source badge per row
- Compliance summary bar aggregates pass/restricted/needs-review counts from all input rows
- OMRI badge (emerald) appears when `materialMap[row.materialId].omriListed` is true
- Manure date-estimated warning `(date est.)` appears on FERTILIZER RESTRICTED rows with season-derived dates
- Seeds preview table shows Field/Crop/Variety/Brand/Population/Source badge per row
- Unresolved materials panel (collapsible) lists all materials with nopResolved:false
- Each unresolved row has NOP status dropdown (Approved/Restricted/Prohibited/Exempt) + notes input
- Save All posts selections to batch-resolve, then re-fetches materials + re-runs compile preview
- After successful Commit All, unresolved panel auto-expands and scrolls into view
- Readiness dashboard inputs/seeds columns now show real "compiled"/"missing"/"pending" status

## Task Commits

Each task was committed atomically:

1. **Task 1: NOP compliance engine + batch resolve route + types extension** - `cbf3f47` (feat)
2. **Task 2: Compile page UI** - `5924db8` (feat)

## Files Created/Modified

- `organic-cert/src/lib/compile/nop-compliance.ts` - Pure checkMaterialCompliance() and checkSeedCompliance() functions (no Prisma imports)
- `organic-cert/src/app/api/materials/batch-resolve/route.ts` - POST handler for bulk NOP status assignment in a transaction
- `organic-cert/src/lib/compile/types.ts` - Added CompileAllResult interface and NopCheckResult/SeedCheckResult re-exports
- `organic-cert/src/app/(app)/compile/page.tsx` - Extended with all new UI sections (Compile All, inputs table, seeds table, unresolved panel)

## Decisions Made

- `checkMaterialCompliance` and `checkSeedCompliance` are pure functions — no Prisma, callable from client components without server boundary
- `loadMaterials()` fetches `/api/materials` without farmId filter — works because organic-cert is single-farm; materials list builds both `materialMap` (OMRI badge) and unresolved panel
- Save All triggers full `handleCompileAll` re-run after batch-resolve success — NOP badges refresh immediately without manual user action
- Readiness dashboard `isNopPlaceholder` parameter removed from `readinessCellText()` — was only used to return hardcoded "Phase 17"; now replaced with real status from `row.inputs`/`row.seeds`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CMP-03 and CMP-04 fully complete end-to-end
- Phase 17 complete — both plans shipped
- Phase 18 (Rotation + Harvest + PDF) ready to begin
- compile page pattern established for harvest compilation section in Phase 18

---
*Phase: 17-input-seed-compilation-nop-compliance*
*Completed: 2026-03-03*
