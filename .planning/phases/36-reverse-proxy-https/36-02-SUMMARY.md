---
phase: 36-reverse-proxy-https
plan: 02
subsystem: infra
tags: [deployment, documentation, vps, caddy, pm2, postgresql, https]

# Dependency graph
requires:
  - phase: 35-01
    provides: PM2 ecosystem config with port assignments
  - phase: 35-02
    provides: CORS config and .env.example templates
  - phase: 36-01
    provides: Caddyfile with subdomain routing
provides:
  - Complete VPS deployment guide (DEPLOY.md) covering DNS to running apps
affects: [37-onboarding, future-deployments]

# Tech tracking
tech-stack:
  added: []
  patterns: [DEPLOY.md at repo root as single deployment reference]

key-files:
  created:
    - DEPLOY.md
  modified: []

key-decisions:
  - "DEPLOY.md placed at repo root for discoverability"
  - "Used /srv/farm-ops as canonical deploy path"
  - "Documented systemd override approach for Caddy DOMAIN env var"

patterns-established:
  - "Deploy workflow: git pull, npm install, build Next.js, pm2 restart"
  - "PostgreSQL user 'farmops' as convention for app database access"

requirements-completed: [INFRA-04]

# Metrics
duration: 1min
completed: 2026-03-07
---

# Phase 36 Plan 02: VPS Deployment Guide Summary

**Complete DEPLOY.md with 12-section step-by-step guide from fresh Ubuntu VPS to 8 apps running behind Caddy with auto-HTTPS**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T06:34:33Z
- **Completed:** 2026-03-07T06:35:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created 368-line DEPLOY.md covering the full deployment lifecycle
- 12 numbered sections in dependency order: prerequisites, DNS, system setup, Caddy install, clone/install, env config, PostgreSQL, PM2 start, Caddy config, update workflow, port map, troubleshooting
- References actual repo files: ecosystem.config.js, Caddyfile, .env.example templates
- Port map table matches ecosystem.config.js (ports 3000-3007)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write DEPLOY.md -- full VPS setup guide** - `bbce9ab` (docs)

## Files Created/Modified
- `DEPLOY.md` - Complete VPS deployment guide, 12 sections, 368 lines

## Decisions Made
- Used `/srv/farm-ops` as the canonical deployment path on the VPS
- Documented wildcard DNS as alternative to 9 individual A records
- Suggested `farmops` as the PostgreSQL application user name
- Used systemd override (`systemctl edit caddy`) for DOMAIN env var rather than editing Caddyfile directly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DEPLOY.md ready for use once VPS is provisioned and DNS configured
- Depends on 36-01 (Caddyfile creation) being completed for the Caddy configuration section to reference an actual file

---
*Phase: 36-reverse-proxy-https*
*Completed: 2026-03-07*
