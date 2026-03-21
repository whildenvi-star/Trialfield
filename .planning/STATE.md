# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v2.0 Milestone — Projected vs Actual Farm Budget

## Current Position

Phase: 5 — Privacy Foundation
Plan: 1 of TBD
Status: In progress
Last activity: 2026-03-21 — Plan 05-01 complete: auth ADMIN fallback removed, RBAC budget permissions added, budget-summary API gated

Progress: [█░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Privacy Foundation | TBD | - | - |
| 6. Actuals Entry and Enterprise Budget View | TBD | - | - |
| 7. All-Enterprise Sync | TBD | - | - |
| 8. Farm-Wide Budget Summary | TBD | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*
| Phase 05-privacy-foundation P01 | 2 | 2 tasks | 3 files |

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

### Pending Todos

- Confirm iframe auth token mechanism before Phase 5 planning — preferred fix for `getAuthContext()` ADMIN fallback is X-Auth-Token header from portal iframe; confirm portal can emit per-user signed token
- Verify farm-budget service `category` field values for conventional enterprises before Phase 7 planning — sync filter currently checks `"organic"` and `"ORG"`; conventional values not confirmed from source

### Blockers/Concerns

- [Phase 5 RESOLVED]: `getAuthContext()` ADMIN fallback removed in 05-01 — unauthenticated requests now return 401 at API level
- [Phase 6]: Budget-summary computation mixes PLANNED and CONFIRMED operations — must split projected/actual computation paths before actuals entry goes live, or confirmed passes inflate projected totals
- [Phase 6]: `BudgetTab.tsx` extraction from `[id]/page.tsx` is a structural prerequisite before dual-view UI work — detail page already exceeds safe file size
- [Phase 7]: Sync upsert match key collision — current key `{fieldId, cropYear, crop, label}` does not include `organicStatus`; conventional and organic crops of same type on same field will create duplicates. Update match key and run dry-run before going live.

## Session Continuity

Last session: 2026-03-21
Stopped at: Completed 05-01-PLAN.md — auth ADMIN fallback removed, budget RBAC permissions added, budget-summary API gated with field stripping
Resume file: None
