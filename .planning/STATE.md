# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v8.0 ASCII Banner Strip & Design System (parallel with v7.0 deployment)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v8.0
Last activity: 2026-03-07 — Milestone v8.0 started

Progress: [░░░░░░░░░░] 0% (v8.0)

**v7.0 status:** Phase 36 plan 2 of 2 complete, phases 37-39 pending (deployment — independent track)

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
- [35-01]: grain-tickets port moved from 3000 to 3007 to avoid portal conflict
- [35-01]: 512M memory limit for Next.js apps, 256M for Express apps in PM2
- [35-01]: organic-cert has nested .git — committed separately from parent repo
- [35-02]: CORS fallback defaults to http://localhost:3000 for dev convenience
- [36-01]: DOMAIN env var placeholder in Caddyfile for deploy-time domain config
- [36-01]: X-Forwarded-Proto header only on Next.js apps (portal, cert) for secure cookies
- [36-02]: DEPLOY.md at repo root as single deployment reference (368 lines, 12 sections)
- [36-02]: /srv/farm-ops as canonical deploy path on VPS

### Pending Todos

None active.

### Blockers/Concerns

- Supabase project credentials required for glomalin-portal production runtime
- CNH FieldOps staging API — mock mode active in organic-cert (not blocking v7.0)
- DNS configuration needed — subdomain records must point to VPS IP before Caddy can issue certs
- Supabase email templates may need production URL updates for invite/reset links

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 36-02-PLAN.md (VPS Deployment Guide)
Resume file: —
Next action: Phase 37 or continue v8.0 requirements
