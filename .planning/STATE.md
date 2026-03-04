# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v4.0 — Phase 23: Settlement Closure (grain-tickets)

## Current Position

Phase: 23 of 23 (Settlement Closure)
Plan: 0 of N in current phase
Status: Phase 21 plan 01 complete; Phase 22 complete; ready for Phase 23
Last activity: 2026-03-04 — Phase 21 Plan 01 complete (group subtotals + profit/COP coloring + print accounting parens, 2 tasks, 6 files)

Progress: [██████░░░░] 75% (v4.0 — 3/4 phases complete)

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| **Total** | **19** | **44** | |

## Accumulated Context

### Decisions

- [v4.0]: Phase order chosen for minimal risk — bugs first (20), then farm-budget polish (21), then FSA sync (22), then grain-tickets settlement closure (23)
- [v4.0]: All four modules are independent — phases 20-23 have no dependencies on each other
- [20-01]: growerId default is grw_001 for this single-grower operation — backfilled on any PUT that passes validation
- [20-01]: Error toast reuses existing save-toast element with save-toast-error modifier class; 4-second display vs 2-second for success
- [20-01]: Form retains user edits on save failure — loadFields() not called in catch block
- [22-01]: cachedFetch (60s TTL, 5s timeout) used for /api/dashboard — consistent with existing cross-app fetch pattern
- [22-01]: budgetGrandTotal prefers dash.grandTotals.acres if available, falls back to sum of row budgetAcres
- [22-01]: NON_CROP_NAMES filter includes alfalfa and intermediate wheatgrass per FSA-03 spec
- [21-01]: Dashboard COP coloring uses profitPerAcre sign as proxy for COP vs price (crop row object lacks pricePerUnit)
- [21-01]: Enterprise module view profitCls switched to util.profitClass() for zero-case consistency
- [21-01]: Field-Level Input Plan rewritten to use _computed budget data for group subtotals; forecast product table preserved below
- [21-01]: PDF money() globally uses accounting parentheses ($X.XX) for all negative values

### Pending Todos

5 todos scoped into v4.0 — all mapped to phases 20-23. No remaining unscoped todos.

### Blockers/Concerns

- CNH FieldOps staging API no audience registered — mock mode active in organic-cert

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 21-01-PLAN.md (group subtotals + profit/COP coloring + print accounting parens, 2 tasks, 6 files)
Resume file: None
Next action: Execute phase 23 (Settlement Closure)
