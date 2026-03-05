# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v5.0 — Phase 25: Auth + Middleware + Route Protection

## Current Position

Phase: 25 of 26 (Auth + Middleware + Route Protection)
Plan: 2 of 3 in current phase
Status: Executing — plans 25-01 and 25-02 complete, 25-03 next
Last activity: 2026-03-05 — Phase 25 plans 25-02 executed (middleware + RBAC)

Progress: [█████████░] 55% (v5.0 — Phase 24 complete, Phase 25 in progress)

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| **Total** | **23** | **51** | |

## Accumulated Context

### Decisions

- [v5.0]: Glomalin Portal is a NEW Next.js 14 App Router project (glomalin-portal/) — not modifying existing modules
- [v5.0]: Supabase replaces NextAuth/Prisma for auth+DB in this project — existing modules keep their stack
- [v5.0]: QBO Integration deferred to v6.0+ — portal provides the unified shell first
- [v5.0]: No self-registration — admin creates users; signup flow is out of scope
- [24-01]: JetBrains Mono loaded via next/font/google with --font-mono CSS variable
- [24-01]: Dark soil palette: 7 Tailwind tokens (bg, surface, border, accent, text, muted, green)
- [24-02]: profiles.id is direct FK to auth.users(id) — Supabase pattern, not serial
- [24-02]: Auto-profile trigger uses security definer to bypass RLS for new users
- [24-03]: async cookies() pattern for Next.js 14 server Supabase client
- [25-02]: Admin route denial is silent (redirect to /dashboard with no query param) — non-admins must not know admin panel exists
- [25-02]: Module access denial uses /dashboard?denied={moduleId} so dashboard can show a named toast
- [25-02]: Expired session detected via sb- prefixed cookies + failed getUser() — redirects to /login?expired=true

### Pending Todos

- .planning/todos/pending/2026-03-04-v4-scoping-questions-for-user.md (may be stale — v4.0 shipped)

### Blockers/Concerns

- Supabase project credentials required for middleware auth checks to function at runtime (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert (carries over, not blocking v5.0)

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 25-02-PLAN.md — middleware + RBAC route protection
Resume file: None
Next action: Execute Phase 25 Plan 03 (admin panel)
