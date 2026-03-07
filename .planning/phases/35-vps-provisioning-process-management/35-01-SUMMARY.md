---
phase: 35-vps-provisioning-process-management
plan: 01
subsystem: infra
tags: [pm2, process-management, next.js, express, production]

# Dependency graph
requires: []
provides:
  - PM2 ecosystem config for all 8 apps with unique ports and auto-restart
  - Production-ready Next.js start scripts with correct port assignments
affects: [35-02-caddy-reverse-proxy, 36-environment-deploy-scripts]

# Tech tracking
tech-stack:
  added: [pm2]
  patterns: [ecosystem.config.js at repo root, centralized port map]

key-files:
  created:
    - ecosystem.config.js
  modified:
    - glomalin-portal/package.json
    - organic-cert/package.json

key-decisions:
  - "grain-tickets moved from port 3000 to 3007 to avoid conflict with glomalin-portal"
  - "512M memory limit for Next.js apps, 256M for Express apps"
  - "watch: false — manual git-pull deploy, not file-watch"

patterns-established:
  - "Port map: 3000=portal, 3001=budget, 3002=fsa, 3003=malt, 3004=organic-cert, 3005=registry, 3006=seed, 3007=tickets"
  - "Deploy workflow: git pull, npm install, npm run build (Next.js only), pm2 restart"

requirements-completed: [INFRA-01, INFRA-06]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 35 Plan 01: PM2 Ecosystem Config Summary

**PM2 ecosystem config for 8 apps with unique ports (3000-3007), auto-restart, and production Next.js start scripts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T04:43:07Z
- **Completed:** 2026-03-07T04:46:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created ecosystem.config.js with all 8 apps configured for PM2 process management
- Unique port assignments for all apps (3000-3007) with grain-tickets moved to 3007
- organic-cert start script updated to explicitly use port 3004
- Added prod convenience scripts to both Next.js apps

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PM2 ecosystem config** - `101c858` (feat) — parent repo
2. **Task 2: Configure Next.js production scripts** - `271b32e` (feat) — parent repo (glomalin-portal), `e568299` (feat) — organic-cert repo

## Files Created/Modified
- `ecosystem.config.js` - PM2 process management config for all 8 apps with port map, deploy workflow comments
- `glomalin-portal/package.json` - Added prod convenience script
- `organic-cert/package.json` - Updated start to use -p 3004, added prod convenience script

## Decisions Made
- grain-tickets port changed from 3000 to 3007 to avoid conflict with glomalin-portal (per plan)
- Next.js apps get 512M memory limit vs 256M for Express (Next.js SSR is more memory-intensive)
- organic-cert/package.json committed in its own git repo (organic-cert/ has a separate .git directory)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] organic-cert has separate git repository**
- **Found during:** Task 2 (committing organic-cert/package.json)
- **Issue:** organic-cert/ directory has its own .git — parent repo cannot track its files
- **Fix:** Committed organic-cert/package.json change within the organic-cert git repo directly
- **Files modified:** organic-cert/package.json
- **Verification:** File correctly modified, committed as e568299 in organic-cert repo
- **Committed in:** e568299 (organic-cert repo)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to handle nested git repo. No scope creep.

## Issues Encountered
None beyond the nested git repo addressed above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ecosystem.config.js ready for Caddy reverse proxy configuration (Plan 02)
- Port map established for nginx/Caddy upstream definitions
- PM2 can be installed on VPS via `npm install -g pm2`

---
*Phase: 35-vps-provisioning-process-management*
*Completed: 2026-03-06*

## Self-Check: PASSED
- ecosystem.config.js: FOUND
- glomalin-portal/package.json: FOUND
- organic-cert/package.json: FOUND
- Commit 101c858: FOUND
- Commit 271b32e: FOUND
