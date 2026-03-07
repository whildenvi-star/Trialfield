# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v8.0 ASCII Banner Strip & Design System (parallel with v7.0 deployment)

## Current Position

Phase: 43 of 43 (all phases complete)
Plan: 3 of 3 in phase 42
Status: Phase 42 complete (plan 03 gap closure shipped)
Last activity: 2026-03-07 — Completed 42-03 (hardcoded hex elimination)

Progress: [██████████] 100% (v8.0 -- All phases complete, all plans shipped)

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
| Phase 41 P01 | 1min | 2 tasks | 2 files |
| Phase 41 P02 | 4min | 2 tasks | 3 files |
| Phase 43 P01 | 3min | 2 tasks | 4 files |
| Phase 42 P01 | 2min | 2 tasks | 4 files |
| Phase 43 P02 | 12min | 3 tasks | 3 files |
| Phase 42 P02 | 2min | 2 tasks | 38 files |
| Phase 42 P03 | 3min | 2 tasks | 6 files |

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
- [Phase 41]: nodeCount re-exposed as prop (default 10) for mobile density control (6 nodes at 48px)
- [Phase 41]: Decorative canvas components use role=img + aria-hidden=true
- [Phase 40]: Clock-based animation time (Date.now) for tab-resume continuity instead of RAF delta accumulation
- [Phase 40]: Node lifecycle: 2s grow-in, variable active, 2s fade-out with position respawn
- [Phase 40]: Background fbm opacity 0.03-0.05 for dark negative space aesthetic
- [Phase 41]: localStorage (not Supabase) for banner preference — no schema changes, instant toggle
- [Phase 41]: BannerSection client wrapper bridges server layout with client-only localStorage
- [Phase 43]: SceneRenderer interface uses Float32Array brightness grid for drop-in scene swapping
- [Phase 43]: Crossfade blends brightness grids per-cell (not CSS opacity) for character-level transitions
- [Phase 43]: onNodeClick detects bright cells (>0.65) in stored grid for easter egg hook
- [Phase 43]: Seasonal renderer is stateless (no refs) unlike mycelium — simpler architecture
- [Phase 43]: Scene preference in localStorage alongside banner-disabled — orthogonal controls
- [Phase 43]: handleNodeClick uses React state updater to avoid stale closures in cycling
- [Phase 42]: Dropped gold (#C8860A) from tokens -- soil remnant incompatible with cyan palette
- [Phase 42]: Dual export pattern: colors (camelCase for JS/canvas) + tailwindColors (kebab-case for Tailwind)
- [Phase 42]: Token scope limited to colors and fonts -- spacing/radius/shadows use Tailwind defaults
- [Phase 42]: soil-gold mapped to glomalin-accent in all 4 occurrences (login, landing, header, embed-frame)
- [Phase 42]: DESIGN.md kept in glomalin-portal/ (portal-specific, not project root)
- [Phase 42]: Added borderLight (#334155) to tokens -- slate-700 for module borders/edge strokes
- [Phase 42]: Added bannerGradient object to tokens -- cyan brightness ramp for canvas rendering

### Pending Todos

None active.

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal production runtime
- DNS configuration needed for v7.0 subdomain routing
- Token migration (Phase 42) complete — 37 files migrated successfully

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 42-03-PLAN.md
Resume file: —
Next action: Phase 42 fully complete (all 3 plans shipped). All v8.0 phases shipped.
