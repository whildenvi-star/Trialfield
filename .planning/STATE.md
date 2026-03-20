# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v2.0 Milestone — Projected vs Actual Farm Budget

## Current Position

Phase: 5 — Privacy Foundation
Plan: —
Status: Not started
Last activity: 2026-03-20 — v2.0 roadmap created; phases 5–8 defined

Progress: [░░░░░░░░░░] 0%

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Init]: Actuals as separate parallel layer — projected records never overwritten; farm manager's crop plan is source of truth
- [v2.0 Init]: Financial data hidden at API + UI level — response stripping required, UI-only hiding is insufficient
- [v2.0 Init]: No approval gate for actuals entry — Sandy's entries record immediately; admin trusts team
- [v2.0 Init]: All enterprises (not just organic) in scope for sync expansion

### Pending Todos

- Confirm iframe auth token mechanism before Phase 5 planning — preferred fix for `getAuthContext()` ADMIN fallback is X-Auth-Token header from portal iframe; confirm portal can emit per-user signed token
- Verify farm-budget service `category` field values for conventional enterprises before Phase 7 planning — sync filter currently checks `"organic"` and `"ORG"`; conventional values not confirmed from source

### Blockers/Concerns

- [Phase 5]: `getAuthContext()` ADMIN fallback is the highest-priority fix — all role filtering is meaningless until unauthenticated requests return 401 instead of ADMIN-level data. Verify with curl before any other budget work.
- [Phase 6]: Budget-summary computation mixes PLANNED and CONFIRMED operations — must split projected/actual computation paths before actuals entry goes live, or confirmed passes inflate projected totals
- [Phase 6]: `BudgetTab.tsx` extraction from `[id]/page.tsx` is a structural prerequisite before dual-view UI work — detail page already exceeds safe file size
- [Phase 7]: Sync upsert match key collision — current key `{fieldId, cropYear, crop, label}` does not include `organicStatus`; conventional and organic crops of same type on same field will create duplicates. Update match key and run dry-run before going live.

## Session Continuity

Last session: 2026-03-20
Stopped at: v2.0 roadmap created — ROADMAP.md updated with phases 5–8, STATE.md updated to Phase 5, REQUIREMENTS.md traceability updated
Resume file: None
