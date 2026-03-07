# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v7.0 Public Deployment & Team Onboarding — Phase 35 ready to plan

## Current Position

Phase: 35 of 39 (VPS Provisioning + Process Management)
Plan: —
Status: Ready to plan
Last activity: 2026-03-06 — Roadmap created for v7.0

Progress: [░░░░░░░░░░] 0% (v7.0)

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

## Accumulated Context

### Decisions

- [v7.0]: Infrastructure-only milestone — no new features, deployment + onboarding only
- [v7.0]: PM2 on bare metal VPS (not Docker) — simpler for 6-15 users, JSON apps cannot multi-instance
- [v7.0]: Caddy for reverse proxy (auto-HTTPS via Let's Encrypt, zero config TLS)
- [v7.0]: Supabase default mailer for invites (not custom SMTP) — sufficient for invite volume
- [v7.0]: No self-registration — admin creates/invites all users

### Pending Todos

None active.

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal production runtime
- CNH FieldOps staging API — mock mode active in organic-cert (not blocking v7.0)
- DNS configuration needed — subdomain records must point to VPS IP before Caddy can issue certs
- Supabase email templates may need production URL updates for invite/reset links

## Session Continuity

Last session: 2026-03-06
Stopped at: Roadmap created for v7.0 — 5 phases (35-39), 13 requirements mapped
Resume file: —
Next action: Plan Phase 35 (VPS Provisioning + Process Management)
