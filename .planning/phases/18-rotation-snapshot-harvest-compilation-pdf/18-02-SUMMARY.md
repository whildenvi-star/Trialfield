---
phase: 18-rotation-snapshot-harvest-compilation-pdf
plan: 02
subsystem: organic-cert
tags: [harvest-compilation, grain-tickets, ecosystem-client, compile-engine, preview-commit]
dependency_graph:
  requires: [18-01, 17-01, 17-02, 16-01, 16-02, 15-02]
  provides: [HarvestCompileResult, POST /api/compile/[year]/harvest, harvest UI section]
  affects: [organic-cert compile page, HarvestEvent table]
tech_stack:
  added: []
  patterns: [preview/commit, deleteMany-SYNCED+createMany, case-insensitive matching, normalizeCropName reuse]
key_files:
  created:
    - organic-cert/src/lib/compile/harvest-mapper.ts
    - organic-cert/src/app/api/compile/[year]/harvest/route.ts
  modified:
    - organic-cert/src/lib/compile/types.ts
    - organic-cert/src/app/(app)/compile/page.tsx
decisions:
  - Harvest compilation matches tickets to enterprises via case-insensitive field name (field.name or farmBudgetFieldName) and normalizeCropName() crop matching — same normalization function used in seed-mapper
  - Unmatched tickets consolidated by (farm, crop, reason) key — two distinct reason values (no-field-match, no-crop-match) surface actionable information
  - Commit uses deleteMany SYNCED + createMany in single transaction — idempotent re-compile, no duplicate HarvestEvents
  - handleCompileAll extended to include harvest in parallel fetch (best-effort — 503 sets unavailability message, does not fail Compile All)
  - 503 error on grain-tickets unavailability propagated at POST route level from EcosystemError catch
metrics:
  duration: 418
  completed: 2026-03-03
  tasks_completed: 2
  files_modified: 4
---

# Phase 18 Plan 02: Harvest Compilation Pipeline Summary

Harvest compilation pipeline: grain-ticket deliveries compiled into organic-cert HarvestEvent records via case-insensitive field/crop matching with normalizeCropName(), preview/commit API route, and compile page UI with matched table, unmatched review list, and Compile All integration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Harvest mapper library + POST API route | c062eaf | harvest-mapper.ts, route.ts, types.ts |
| 2 | Compile page harvest section UI | bb676cd | compile/page.tsx |

## What Was Built

### harvest-mapper.ts (c062eaf)

Pure async `mapHarvest(cropYear, farmId)` function:

1. Fetches all tickets via `getTicketsForCropYear(cropYear)` — throws EcosystemError if grain-tickets unavailable
2. Loads organic FieldEnterprise records for farm+year with field name and farmBudgetFieldName
3. Builds two-index field lookup map: by `field.name` (matchMethod='name') and by `farmBudgetFieldName` (matchMethod='stored-mapping')
4. Builds enterprise lookup: `fieldId::normalizedCrop` -> enterprise
5. For each ticket: matches farm name case-insensitively, then matches crop using normalizeCropName()
6. Unmatched tickets accumulated in map keyed by `farm::crop::reason`, consolidated into HarvestUnmatchedRow[]
7. Matched tickets grouped by fieldEnterpriseId: sum loads, sum netWeight, track latest date
8. Queries existing SYNCED HarvestEvents to compute action (new/update/unchanged)
9. Returns `{ preview, unmatched, summary }` — no Prisma writes

**Key constraint honored:** Groups by ticket.id (not ticketNo) — ticketNo allows duplicates per schema design decision.

### POST /api/compile/[year]/harvest/route.ts (c062eaf)

- Parses year from params, validates 2020–2100 range
- Finds farm via `prisma.farm.findFirst()` — 400 if missing
- Calls `mapHarvest()` — propagates EcosystemError as 503
- Preview mode: returns HarvestCompileResult with `Cache-Control: no-store`
- Commit mode: `prisma.$transaction` with `deleteMany SYNCED` + `createMany` for rows where action !== 'unchanged'
- Returns `{ committed, unmatched }` count after commit
- Catches EcosystemError and network errors → 503 with "grain-tickets unavailable"

### compile/page.tsx harvest section (bb676cd)

New types imported: `HarvestCompileResult`, `HarvestPreviewRow`, `HarvestUnmatchedRow`

New state: `harvestResult`, `harvestLoading`, `harvestCommitMessage`

New handlers:
- `handleCompileHarvest()`: preview fetch, 503 shows port 3000 message, updates `harvestResult`
- `handleCommitHarvest()`: window.confirm with counts, commit fetch, re-runs preview on success

Updated `handleCompileAll()`: harvest fetch added in parallel (best-effort — 503 doesn't fail Compile All)

Rendered harvest section (after seeds, before unresolved materials):
- Summary bar: new/updated/unchanged/unmatched counts with color coding
- Matched preview table: Field | Crop | Loads | Net Weight (lbs) | Acres | Date | Source columns
- Unmatched review list (amber border): Farm Field | Crop | Tickets | Weight | Reason with human-readable reason text
- Commit Harvest button: disabled when `new + update === 0`
- Message display: green for success, amber for errors/503

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist
- FOUND: organic-cert/src/lib/compile/harvest-mapper.ts
- FOUND: organic-cert/src/app/api/compile/[year]/harvest/route.ts
- FOUND: organic-cert/src/lib/compile/types.ts (modified)
- FOUND: organic-cert/src/app/(app)/compile/page.tsx (modified)

### Commits exist
- c062eaf: feat(18-02): harvest mapper library and POST API route
- bb676cd: feat(18-02): compile page harvest section UI

### TypeScript: PASSED (npx tsc --noEmit returns 0 errors)

## Self-Check: PASSED
