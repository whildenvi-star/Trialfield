---
phase: 53-seed-inventory-meristem-malt-pipelines
plan: 04
subsystem: database
tags: [prisma, pdf, organic-cert, seed-inventory, omri, nop]

# Dependency graph
requires:
  - phase: 53-03
    provides: SeedCompliance PDF component and SeedLotRecord interface with omriListed field
provides:
  - omriListed Boolean field on Prisma SeedLot model with @default(false)
  - Compile commit stores omriListed from SeedPreviewRow into SeedLot (create + seed-inventory update)
  - Report assembler reads sl.omriListed from Prisma instead of hardcoding false
  - 10-column C9.0 seed compliance PDF table with OMRI? column showing Yes/No per lot
affects: [organic-cert inspection reports, NOP C9.0 PDF output, PIPE-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "omriListed threaded through full pipeline: schema -> compile commit -> report assembler -> PDF"
    - "Prisma client regenerated after schema change to expose new field to TypeScript"
    - "uniqueSeeds Map type extended to carry new field alongside existing seed-inventory-only fields"

key-files:
  created: []
  modified:
    - organic-cert/prisma/schema.prisma
    - "organic-cert/src/app/api/compile/[year]/seeds/route.ts"
    - organic-cert/src/lib/report-assembler.ts
    - organic-cert/src/lib/pdf/sections/seed-compliance.tsx

key-decisions:
  - "omriListed included in SeedLot upsert create block for all sources, update block only for seed-inventory — same guard as certNumber/lotNumber to preserve user edits"
  - "uniqueSeeds Map type explicitly extended with omriListed field (required by TypeScript — Prisma client type checks create/update shapes strictly)"

patterns-established:
  - "Prisma field additions require prisma generate before TypeScript will accept them in typed upsert blocks"

requirements-completed:
  - PIPE-06

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 53 Plan 04: OMRI Gap Closure Summary

**omriListed threaded end-to-end: Prisma SeedLot schema field, compile commit upsert (create + seed-inventory update), report assembler DB read, and 10-column C9.0 PDF OMRI? column — closing the PIPE-06 gap**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T21:13:24Z
- **Completed:** 2026-03-25T21:16:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `omriListed Boolean @default(false)` to SeedLot model in schema.prisma and regenerated Prisma client
- Updated compile commit upsert to store omriListed on create (all sources) and update (seed-inventory only)
- Replaced hardcoded `omriListed: false` in report assembler with `sl.omriListed ?? false`
- Added OMRI? column to seed-compliance.tsx — 10-column table with adjusted widths for landscape layout

## Task Commits

Each task was committed atomically (inside organic-cert nested git repo):

1. **Task 1: Add omriListed to Prisma schema and populate during compile commit** - `e1f4ce0` (feat)
2. **Task 2: Read omriListed from DB in report assembler and add OMRI column to PDF** - `df933d3` (feat)

## Files Created/Modified

- `organic-cert/prisma/schema.prisma` - Added `omriListed Boolean @default(false)` to SeedLot model
- `organic-cert/src/app/api/compile/[year]/seeds/route.ts` - Extended uniqueSeeds Map type; added omriListed to upsert create and seed-inventory update blocks
- `organic-cert/src/lib/report-assembler.ts` - Reads `sl.omriListed ?? false` from Prisma instead of hardcoding false
- `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` - Added OMRI? column (10-column layout, adjusted widths)

## Decisions Made

- omriListed included in SeedLot upsert create block for all sources; update block only for seed-inventory — same guard as certNumber/lotNumber to preserve user edits
- uniqueSeeds Map type explicitly extended with omriListed field (TypeScript requires it — Prisma client type checks create/update shapes strictly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended uniqueSeeds Map type to include omriListed**
- **Found during:** Task 1 (schema + compile commit)
- **Issue:** Plan's create/update code snippets referenced `seedData.omriListed` but the local `uniqueSeeds` Map type didn't include the field — TypeScript errors TS2339 on both create and update blocks
- **Fix:** Added `omriListed: boolean` to the Map's value type definition and `omriListed: row.omriListed ?? false` when populating from preview rows
- **Files modified:** `organic-cert/src/app/api/compile/[year]/seeds/route.ts`
- **Verification:** TypeScript check shows no errors in seeds/route.ts after fix
- **Committed in:** `e1f4ce0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type definition gap)
**Impact on plan:** Fix necessary for TypeScript correctness. No scope creep.

## Issues Encountered

- Database not running locally — `prisma db push` returned P1001 (can't reach localhost:5432). This is normal for dev environment; `prisma validate` confirmed schema syntax is correct and `prisma generate` regenerated the client successfully. The migration will apply automatically when db push is run against the live database.

## Next Phase Readiness

- PIPE-06 gap is fully closed: OMRI status now flows from seed-inventory through compile preview -> compile commit -> SeedLot DB -> report assembler -> PDF
- Existing seed lots without OMRI data default to false (no breaking change)
- Phase 54 (UXN-04..09 — unified UX/navigation improvements) is ready to proceed

## Self-Check

- [x] `organic-cert/prisma/schema.prisma` — contains `omriListed`
- [x] `organic-cert/src/app/api/compile/[year]/seeds/route.ts` — contains `omriListed`
- [x] `organic-cert/src/lib/report-assembler.ts` — contains `sl.omriListed`
- [x] `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` — contains `OMRI?`
- [x] Commits `e1f4ce0` and `df933d3` verified in organic-cert git log

## Self-Check: PASSED

---
*Phase: 53-seed-inventory-meristem-malt-pipelines*
*Completed: 2026-03-25*
