# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v2.0 Milestone — Projected vs Actual Farm Budget

## Current Position

Phase: 5 — Privacy Foundation
Plan: 2 of TBD (phase complete — 2 plans shipped)
Status: Phase 05 complete — ready for Phase 6 planning
Last activity: 2026-03-21 — Plan 05-02 complete: role-conditional UI filtering verified end-to-end across all four PRIV requirements

Progress: [██░░░░░░░░] 20%

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
Stopped at: Phase 05 complete — 05-02-SUMMARY.md created, ready for Phase 6 planning
Resume file: None
