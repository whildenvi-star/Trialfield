---
phase: 35-vps-provisioning-process-management
plan: 02
subsystem: infra
tags: [cors, express, env-config, security, deployment]

# Dependency graph
requires:
  - phase: 35-01
    provides: PM2 ecosystem config with port assignments
provides:
  - CORS lockdown on all 6 Express apps via PORTAL_ORIGIN env var
  - .env.example templates for all 8 apps
  - grain-tickets port changed from 3000 to 3007
affects: [35-03, 35-04, 36-caddy-reverse-proxy, 37-deployment-pipeline]

# Tech tracking
tech-stack:
  added: [cors (npm package added to grain-tickets, farm-budget, fsa-acres, meristem-malt)]
  patterns: [PORTAL_ORIGIN env-driven CORS, .env.example template convention]

key-files:
  created:
    - fsa-acres/.env.example
    - meristem-malt/.env.example
    - farm-registry/.env.example
    - seed-inventory/.env.example
    - organic-cert/.env.example
  modified:
    - grain-tickets/server.js
    - grain-tickets/package.json
    - grain-tickets/.env.example
    - farm-budget/server.js
    - farm-budget/package.json
    - farm-budget/.env.example
    - fsa-acres/server.js
    - fsa-acres/package.json
    - meristem-malt/server.js
    - meristem-malt/package.json
    - farm-registry/server.js
    - seed-inventory/server.js
    - glomalin-portal/.env.example

key-decisions:
  - "CORS fallback defaults to http://localhost:3000 for development convenience"
  - "grain-tickets port moved from 3000 to 3007 to avoid conflict with glomalin-portal"
  - "glomalin-portal embed URL for grain-tickets updated to 3007"

patterns-established:
  - "PORTAL_ORIGIN env var: single env var controls CORS origin across all Express apps"
  - ".env.example convention: every app has a documented template with section headers"

requirements-completed: [SEC-01, INFRA-03, INFRA-05]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 35 Plan 02: CORS + Env Templates Summary

**PORTAL_ORIGIN-driven CORS lockdown on all 6 Express apps with .env.example templates for all 8 apps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T04:43:31Z
- **Completed:** 2026-03-07T04:46:34Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- All 6 Express apps now restrict cross-origin requests to PORTAL_ORIGIN env var (defaults to localhost:3000 for dev)
- grain-tickets default port changed from 3000 to 3007, eliminating conflict with glomalin-portal
- All 8 apps have well-documented .env.example files with section headers and placeholder values
- glomalin-portal embed URL for grain-tickets updated to port 3007

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CORS lockdown to all 6 Express apps and fix grain-tickets port** - `40efde7` (feat)
2. **Task 2: Create .env.example templates for all 8 apps** - `9c23f4b` (chore)

## Files Created/Modified
- `grain-tickets/server.js` - CORS middleware + port 3007 default
- `farm-budget/server.js` - CORS middleware added
- `fsa-acres/server.js` - CORS middleware added
- `meristem-malt/server.js` - CORS middleware added
- `farm-registry/server.js` - Open cors() replaced with restricted corsOptions
- `seed-inventory/server.js` - Open cors() replaced with restricted corsOptions
- `grain-tickets/package.json` - Added cors dependency
- `farm-budget/package.json` - Added cors dependency
- `fsa-acres/package.json` - Added cors dependency
- `meristem-malt/package.json` - Added cors dependency
- `*/. env.example` - 8 files created/updated with documented env templates

## Decisions Made
- CORS fallback defaults to http://localhost:3000 for development convenience -- no env file needed for local dev
- grain-tickets port moved from 3000 to 3007 to avoid conflict with glomalin-portal which owns port 3000
- Updated glomalin-portal .env.example to reference grain-tickets at port 3007

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Express apps are CORS-locked and ready for production deployment
- .env.example templates ready for VPS configuration
- cors npm package needs `npm install` on apps that gained it (grain-tickets, farm-budget, fsa-acres, meristem-malt)

## Self-Check: PASSED

All 14 key files verified present. Both task commits (40efde7, 9c23f4b) verified in git log.

---
*Phase: 35-vps-provisioning-process-management*
*Completed: 2026-03-06*
