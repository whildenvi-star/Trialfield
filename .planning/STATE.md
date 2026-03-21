# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v2.0 Milestone — Projected vs Actual Farm Budget

## Current Position

Phase: 6 — Actuals Entry and Enterprise Budget View
Plan: 3 of 3 (plan 03 complete — phase done)
Status: Phase 06 complete — all three plans shipped; VIEW-01/02/03 requirements satisfied and human-verified
Last activity: 2026-03-21 — Plan 06-03 complete: dual-column Budget tab UI with inline editing, keyboard navigation, operation confirmation, and data source badges

Progress: [███████░░░] 70%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~5 min/plan
- Total execution time: ~10 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Privacy Foundation | 2 | ~10 min | ~5 min |
| 6. Actuals Entry and Enterprise Budget View | TBD | - | - |
| 7. All-Enterprise Sync | TBD | - | - |
| 8. Farm-Wide Budget Summary | TBD | - | - |

**Recent Trend:**
- Last 5 plans: 05-01 (~2 min), 05-02 (~8 min checkpoint)
- Trend: Fast execution, checkpoint-gated verification

*Updated after each plan completion*
| Phase 05-privacy-foundation P01 | 2 | 2 tasks | 3 files |
| Phase 05-privacy-foundation P02 | 2 | 2 tasks | 2 files |
| Phase 06-actuals-entry-and-enterprise-budget-view P01 | 4 | 2 tasks | 4 files |
| Phase 06-actuals-entry-and-enterprise-budget-view P02 | ~8 min | 2 tasks | 5 files |
| Phase 06 P03 | 10 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Init]: Actuals as separate parallel layer — projected records never overwritten; farm manager's crop plan is source of truth
- [v2.0 Init]: Financial data hidden at API + UI level — response stripping required, UI-only hiding is insufficient
- [v2.0 Init]: No approval gate for actuals entry — Sandy's entries record immediately; admin trusts team
- [v2.0 Init]: All enterprises (not just organic) in scope for sync expansion
- [05-01]: ADMIN fallback removed unconditionally — unauthenticated requests return null, callers return 401
- [05-01]: sale:read removed from OFFICE role — office staff cannot read sale records (write-only for sale data)
- [05-01]: budget:financial is ADMIN-only — revenue, margin, sale price, and overhead category never visible to OFFICE
- [05-01]: Spread-conditional field stripping — financial fields absent from JSON keys, not set to null (no trace in DevTools)
- [05-02]: Silent omission pattern — no lock icons or "admin only" labels; OFFICE sees cost data as if financial data doesn't exist
- [05-02]: Defense-in-depth confirmed — API field stripping (Plan 01) + UI conditional rendering (Plan 02) enforce same RBAC rules independently
- [Phase 06-actuals-entry-and-enterprise-budget-view]: refreshBudget targeted fetch avoids full page reload scroll-jump on budget save
- [Phase 06-actuals-entry-and-enterprise-budget-view]: ACTUAL added to DataSource enum as additive change — no existing records modified
- [06-02]: Projected totals include ALL operations (PLANNED + CONFIRMED); actual operation cost uses CONFIRMED ops only
- [06-02]: null = not-entered for all actual fields — distinction between no data and zero spend; allActualsNull guard applied
- [06-02]: Variance computed server-side only — no client-side variance math permitted
- [06-02]: unplanned-cost uses material upsert (farmId_name key) for idempotent Unplanned category creation
- [Phase 06]: Enter-to-advance uses ordered ref array in BudgetTab — ActualCell fires onAdvance callback, BudgetTab focuses next registered ref
- [Phase 06]: PUT /operations/[recordId] added to revert CONFIRMED to PLANNED — clears operationDate, sets passStatus=PLANNED
- [Phase 06]: BudgetSummary type exported from BudgetTab.tsx — enterprise detail page imports it to prevent drift
- [06-03]: Material costs grouped by category keyword matching (fertilizer, chemical, custom) with otherMaterialRows fallback
- [06-03]: Per-acre display: all line items divide by acres before rendering; save converts back with v*acres before PATCH
- [06-03]: Unplanned ActualCell saves total cost (per-acre * acres) to match API expectation

### Pending Todos

- Confirm iframe auth token mechanism before Phase 5 planning — preferred fix for `getAuthContext()` ADMIN fallback is X-Auth-Token header from portal iframe; confirm portal can emit per-user signed token
- Verify farm-budget service `category` field values for conventional enterprises before Phase 7 planning — sync filter currently checks `"organic"` and `"ORG"`; conventional values not confirmed from source

### Blockers/Concerns

- [Phase 5 RESOLVED]: `getAuthContext()` ADMIN fallback removed in 05-01 — unauthenticated requests now return 401 at API level
- [Phase 6 RESOLVED]: Budget-summary computation mixes PLANNED and CONFIRMED — resolved in 06-02; projected uses ALL ops, actual uses CONFIRMED only
- [Phase 6 RESOLVED]: `BudgetTab.tsx` extraction complete — detail page slimmed, dual-view UI work can proceed
- [Phase 7]: Sync upsert match key collision — current key `{fieldId, cropYear, crop, label}` does not include `organicStatus`; conventional and organic crops of same type on same field will create duplicates. Update match key and run dry-run before going live.

## Session Continuity

Last session: 2026-03-21
Stopped at: Completed 06-03-PLAN.md: Budget Tab UI — dual-column Projected/Actual/Variance with inline editing, human-verified
Resume file: None
