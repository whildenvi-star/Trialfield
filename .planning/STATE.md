# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v6.0 FSA Acres, Insurance & Claims

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-04 — Milestone v6.0 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| v5.0 | 24-26 | 9 | 2026-03-05 |
| **Total** | **26** | **60** | |

## Accumulated Context

### Decisions

- [v5.0]: Glomalin Portal is a NEW Next.js 14 App Router project (glomalin-portal/) — not modifying existing modules
- [v5.0]: Supabase replaces NextAuth/Prisma for auth+DB in this project — existing modules keep their stack
- [v5.0]: QBO Integration deferred to v7.0+ — FSA/Insurance/Claims takes priority
- [v5.0]: No self-registration — admin creates users; signup flow is out of scope
- [v5.0]: Dark soil aesthetic — #080604 bg, #C8860A accent, JetBrains Mono, 7 Tailwind tokens
- [v6.0]: FSA Acres, Insurance & Claims built inside glomalin-portal/ (Next.js 14 + Supabase)
- [v6.0]: Existing fsa-acres/ Express app becomes legacy data source; new UI in portal
- [v6.0]: Insurance calculator is decision-support, not precision — discuss with agent, not replace agent

### Pending Todos

- .planning/todos/pending/2026-03-04-v4-scoping-questions-for-user.md (stale — v4.0 shipped)

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal to function at runtime
- SUPABASE_SERVICE_ROLE_KEY required for admin panel user management
- Migration 001-admin-write-policies.sql must be run in Supabase SQL Editor
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert
- Admin panel has no in-app navigation link (reachable via direct /admin URL only)
- Existing fsa-acres/ data needs migration strategy to Supabase

## Session Continuity

Last session: 2026-03-04
Stopped at: v6.0 milestone started — defining requirements
Resume file: None
Next action: Define requirements → create roadmap
