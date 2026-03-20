# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v2.0 Milestone — Projected vs Actual Farm Budget

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-20 — Milestone v2.0 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Enhance PWA over native app — cheaper, reuses existing code, no app store overhead
- [Init]: Build on existing offline layer — IndexedDB + sync already working for crop plans

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Server-side conflict handler behavior in `src/app/api/mobile/` needs direct audit before offline sync hardening — inferred, not confirmed
- [Phase 2]: TanStack Query version in portal (v4 vs v5 is a breaking change) — check before adding persistQueryClient
- [Phase 2]: Existing service worker caching strategies (sw.ts + layout.tsx) need audit before Serwist migration — specifically whether RSC routes are under stale-while-revalidate
- [Phase 3]: CLU workspace virtualization scope — if 1000+ CLU records, mobile performance needs decision before Phase 3 planning
- [Phase 4]: Supabase push_subscriptions table design needed before any push notification work (v2 scope)

## Session Continuity

Last session: 2026-03-20
Stopped at: Roadmap created — ROADMAP.md and STATE.md written, REQUIREMENTS.md traceability updated
Resume file: None
