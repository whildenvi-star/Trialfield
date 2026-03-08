# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v7.0 Public Deployment & Team Onboarding (phase 39 remaining)

## Current Position

Phase: 39 of 43
Plan: 0 of ? in phase 39
Status: Phase 38 complete (email invite onboarding verified end-to-end)
Last activity: 2026-03-08 — Completed 38-02 (onboarding flows verified by user)

Progress: v8.0 [██████████] SHIPPED | v7.0: [█████████░] 90% (phases 35-38 complete, 39 pending)

**v8.0:** Archived — 4 phases, 9 plans, 22/22 requirements (shipped 2026-03-08)
**v7.0 status:** Phases 35-38 complete, phase 39 pending

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
| v7.0 | 35-38 | 7 | in progress |
| v8.0 | 40-43 | 9 | 2026-03-08 |
| **Total** | **39** | **84** | |
| Phase 40 P01 | 2min | 1 tasks | 3 files |
| Phase 40 P02 | 3min | 2 tasks | 2 files |
| Phase 41 P01 | 1min | 2 tasks | 2 files |
| Phase 41 P02 | 4min | 2 tasks | 3 files |
| Phase 43 P01 | 3min | 2 tasks | 4 files |
| Phase 42 P01 | 2min | 2 tasks | 4 files |
| Phase 43 P02 | 12min | 3 tasks | 3 files |
| Phase 42 P02 | 2min | 2 tasks | 38 files |
| Phase 42 P03 | 3min | 2 tasks | 6 files |
| Phase 37 P01 | 2min | 2 tasks | 3 files |
| Phase 38 P01 | 2min | 2 tasks | 4 files |
| Phase 38 P02 | 1min | 1 tasks | 0 files |

## Accumulated Context

### Decisions

- [v7.0]: Infrastructure-only milestone — no new features, deployment + onboarding only
- [v7.0]: PM2 on bare metal VPS (not Docker) — simpler for 6-15 users
- [Phase 37]: pg_dump --format=custom for compressed dumps with selective restore support
- [Phase 37]: Error counting pattern (not set -e) so partial failures complete remaining backups
- [Phase 38]: NEXT_PUBLIC_SITE_URL with origin fallback for all email redirect URLs
- [Phase 38]: Admin client for module_access inserts at invite time to bypass RLS

### Pending Todos

None active.

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal production runtime
- DNS configuration needed for v7.0 subdomain routing

## Session Continuity

Last session: 2026-03-08
Stopped at: Completed v8.0 milestone archival
Resume file: —
Next action: Plan and execute phase 39 (health check endpoints) to complete v7.0.
