---
phase: 36-reverse-proxy-https
plan: 01
subsystem: infra
tags: [caddy, reverse-proxy, https, tls, lets-encrypt]

# Dependency graph
requires:
  - phase: 35-vps-process-management
    provides: PM2 ecosystem config with port assignments for all 8 apps
provides:
  - Caddyfile with subdomain-to-port routing for 8 apps
  - Auto-HTTPS via Let's Encrypt for all subdomains
  - Root domain redirect to portal
affects: [36-02-PLAN, deployment, dns-setup]

# Tech tracking
tech-stack:
  added: [caddy]
  patterns: [env-var-domain-placeholder, subdomain-per-app]

key-files:
  created:
    - Caddyfile
  modified:
    - glomalin-portal/.env.example

key-decisions:
  - "DOMAIN env var placeholder allows deploy-time domain config without editing Caddyfile"
  - "X-Forwarded-Proto header only on Next.js apps (portal, cert) for secure cookie/auth redirect handling"

patterns-established:
  - "Subdomain naming: portal, budget, fsa, malt, cert, registry, seed, tickets"
  - "Env var domain pattern: {$DOMAIN:farm.example.com} with fallback default"

requirements-completed: [INFRA-02]

# Metrics
duration: 1min
completed: 2026-03-07
---

# Phase 36 Plan 01: Caddyfile Summary

**Caddy reverse proxy config routing 8 subdomains to localhost ports with auto-HTTPS and root domain redirect**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T06:34:19Z
- **Completed:** 2026-03-07T06:35:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Caddyfile with 8 site blocks mapping subdomains to ports 3000-3007
- X-Forwarded-Proto headers for Next.js apps behind proxy
- Root domain redirect to portal subdomain
- Production URL documentation in .env.example

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Caddyfile with subdomain routing** - `b4a6a64` (feat)
2. **Task 2: Update .env.example with reverse proxy docs** - `e267c3d` (docs)

## Files Created/Modified
- `Caddyfile` - Caddy reverse proxy config with 8 subdomain blocks, gzip, auto-HTTPS
- `glomalin-portal/.env.example` - Added Reverse Proxy section with production URL guidance

## Decisions Made
- Used `{$DOMAIN:farm.example.com}` env var pattern so domain is configurable at deploy time
- Only added X-Forwarded-Proto to Next.js apps (portal on 3000, cert on 3004) since Express apps don't need scheme-aware redirects

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Caddyfile ready to deploy on VPS once DNS A records configured
- Phase 36-02 (deploy checklist) can proceed
- Requires: wildcard DNS (*.yourdomain.com) pointing to VPS IP before Caddy can issue certs

---
*Phase: 36-reverse-proxy-https*
*Completed: 2026-03-07*
