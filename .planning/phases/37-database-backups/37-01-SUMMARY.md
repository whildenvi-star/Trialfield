---
phase: 37-database-backups
plan: 01
subsystem: infra
tags: [bash, pg_dump, backup, restore, supabase, postgresql, cron]

requires:
  - phase: 35-vps-provisioning-process-management
    provides: ".env templates with DATABASE_URL conventions"
  - phase: 36-reverse-proxy-https
    provides: "DEPLOY.md with /srv/farm-ops deploy path"
provides:
  - "Daily backup script for all 8 data stores (5 JSON + 3 PostgreSQL)"
  - "Point-in-time restore script with component filtering"
  - "Production secrets reference template with rotation procedures"
affects: [37-database-backups, 38-deployment-pipeline, 39-team-onboarding]

tech-stack:
  added: []
  patterns: ["bash backup/restore with error counting instead of set -e", "pg_dump --format=custom for compressed selective restore"]

key-files:
  created:
    - scripts/backup.sh
    - scripts/restore.sh
    - scripts/SECRETS.template.md
  modified: []

key-decisions:
  - "Used pg_dump --format=custom for compressed dumps with selective restore support"
  - "Error counting pattern (not set -e) so partial failures complete remaining backups"
  - "Exit code equals error count for cron monitoring integration"

patterns-established:
  - "Backup naming: /var/backups/farm-ops/YYYY-MM-DD/{json,postgres}/"
  - "JSON backups use app-prefixed names (farm-budget.json, not data.json)"
  - "pg_restore --clean --if-exists for idempotent database restore"

requirements-completed: [SEC-02, SEC-04]

duration: 2min
completed: 2026-03-07
---

# Phase 37 Plan 01: Backup & Restore Scripts Summary

**Daily backup automation for 5 JSON apps + 3 PostgreSQL databases with 7-day retention, point-in-time restore, and production secrets reference**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T02:23:47Z
- **Completed:** 2026-03-08T02:25:50Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- backup.sh covers all 8 data stores with structured logging and 7-day retention cleanup
- restore.sh supports date-based restore with component filtering (json/postgres/all) and confirmation prompt
- SECRETS.template.md documents every production secret (10 total) with rotation procedures per secret

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backup.sh** - `0115beb` (feat)
2. **Task 2: Create restore.sh and SECRETS.template.md** - `d9ae448` (feat)

## Files Created/Modified
- `scripts/backup.sh` - Daily cron target: backs up 5 JSON files, 2 local PG databases, 1 Supabase database with 7-day retention
- `scripts/restore.sh` - Disaster recovery: restores from timestamped backup with component filtering and confirmation
- `scripts/SECRETS.template.md` - Production secrets reference: Supabase (4), PostgreSQL (2), CNH (2), PORTAL_ORIGIN (1), rotation checklist

## Decisions Made
- Used pg_dump --format=custom for compressed dumps supporting selective restore (vs plain SQL)
- Error counting pattern (exit code = error count) instead of set -e, so partial failures don't abort remaining backups
- Supabase backup explicitly flagged as most critical since free tier has no built-in backups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - scripts are ready to deploy. On VPS:
1. Copy SECRETS.template.md to /root/SECRETS.md and fill in real values
2. Install cron: `0 2 * * * /srv/farm-ops/scripts/backup.sh`

## Next Phase Readiness
- Backup infrastructure ready for production deployment
- Scripts reference /srv/farm-ops paths (matches DEPLOY.md from Phase 36)
- SECRETS.template.md ready for team onboarding (Phase 39)

---
*Phase: 37-database-backups*
*Completed: 2026-03-07*
