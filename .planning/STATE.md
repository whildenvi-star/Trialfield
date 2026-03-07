# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v8.0 ASCII Banner Strip & Design System (parallel with v7.0 deployment)

## Current Position

Phase: 40 of 43 (ASCIIBannerStrip Component) -- COMPLETE
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-03-07 — Completed 40-02 (visual refinement: tendril growth, node lifecycle, white highlights)

Progress: [██░░░░░░░░] 25% (v8.0 -- Phase 40 complete, Phases 41-43 remaining)

**v7.0 status:** Phases 35-36 complete, phases 37-39 pending (deployment — independent track)

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| v5.0 | 24-26 | 9 | 2026-03-05 |
| v6.0 | 27-34 | 15 | 2026-03-06 |
| **Total** | **34** | **75** | |
| Phase 40 P01 | 2min | 1 tasks | 3 files |
| Phase 40 P02 | 3min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- [v7.0]: Infrastructure-only milestone — no new features, deployment + onboarding only
- [v7.0]: PM2 on bare metal VPS (not Docker) — simpler for 6-15 users
- [v8.0]: Navy/cyan palette replaces soil palette — no earth tones in final design system
- [v8.0]: Canvas-only rendering with pure TypeScript noise functions — no external animation deps
- [v8.0]: Scene toggle is easter egg (hidden), not visible UI control
- [v8.0]: v7.0 and v8.0 run as parallel tracks — no cross-dependencies
- [Phase 40]: Noise utilities extracted to standalone ascii-noise.ts for Phase 43 scene reuse
- [Phase 40]: ASCIIBannerStrip props simplified to {height, className, paused} — nodeCount/bgColor hardcoded internally
- [Phase 40]: Clock-based animation time (Date.now) for tab-resume continuity instead of RAF delta accumulation
- [Phase 40]: Node lifecycle: 2s grow-in, variable active, 2s fade-out with position respawn
- [Phase 40]: Background fbm opacity 0.03-0.05 for dark negative space aesthetic

### Pending Todos

None active.

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal production runtime
- DNS configuration needed for v7.0 subdomain routing
- Token migration (Phase 42) will touch many existing components — risk of visual regressions

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 40-02-PLAN.md (Phase 40 complete)
Resume file: —
Next action: Plan Phase 41 (App Shell Integration)
