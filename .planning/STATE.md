# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v4.0 — Phase 23: Settlement Closure (grain-tickets)

## Current Position

Phase: 23 of 23 (Settlement Closure)
Plan: 1 of N in current phase
Status: Phase 23 Plan 01 complete (tolerance config); phases 20-22 complete
Last activity: 2026-03-04 — Phase 23 Plan 01 complete (per-crop tolerance config, tolerance CRUD API, tolerance UI, 2 tasks, 4 files)

Progress: [██████████] 75%+ (v4.0 — phase 23 in progress, plan 01/N complete)

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| **Total** | **19** | **44** | |

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 23 | 01 | 190s (3m 10s) | 2 | 4 |

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
- [21-02]: Orders and Deliveries tabs placed after Sales per user-specified tab order (Dashboard, Enterprises, Forecasts, Seeds, Reference, Programs, Sales, Orders, Deliveries, Map)
- [21-02]: Inline create-order form added to Orders tab so users can create POs directly without visiting Forecasts tab
- [21-02]: Empty state messages updated to reference new + New Order / + New Delivery toolbar buttons
- [Phase 23]: tolerancePct takes precedence over toleranceLbs when both set; withinTolerance computed at read-time in summary endpoint (no new DB column); UI falls back to 1% threshold when server withinTolerance absent

### Pending Todos

5 todos scoped into v4.0 — all mapped to phases 20-23. No remaining unscoped todos.

### Blockers/Concerns

- CNH FieldOps staging API no audience registered — mock mode active in organic-cert

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 23-01-PLAN.md (per-crop tolerance config, tolerance CRUD API, tolerance settings UI, 2 tasks, 4 files)
Resume file: None
Next action: Execute phase 23 plan 02 (fuzzy matching)
