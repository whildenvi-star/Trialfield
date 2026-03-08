---
phase: 37-database-backups
verified: 2026-03-07T21:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 37: Database Backups Verification Report

**Phase Goal:** Production data is safe -- PostgreSQL databases run with correct credentials and daily backups protect against data loss
**Verified:** 2026-03-07
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | backup.sh backs up all JSON data files, all PostgreSQL databases, and Supabase to /var/backups/farm-ops/ with timestamped directories | VERIFIED | Script handles 5 JSON apps (associative array lines 66-72), 2 local PG via pg_dump --format=custom (lines 93-129), 1 Supabase PG (lines 137-155), all to $BACKUP_DIR/{json,postgres}/ |
| 2 | Backups older than 7 days are automatically deleted each run | VERIFIED | find with -mtime +$RETENTION_DAYS -exec rm at lines 162-175, RETENTION_DAYS=7 at line 23 |
| 3 | restore.sh takes a backup date and restores all data stores | VERIFIED | Accepts YYYY-MM-DD arg with --component filter (json/postgres/all), confirmation prompt (line 126), restores all 5 JSON + 3 PG databases, post-restore PM2 restart guidance |
| 4 | SECRETS.template.md documents every production secret with rotation instructions | VERIFIED | 10 secrets documented: Supabase (4), PostgreSQL (2), CNH (2), PORTAL_ORIGIN (1), plus 5-step rotation checklist |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/backup.sh` | Daily backup automation for JSON + PostgreSQL + Supabase | VERIFIED | 194 lines, valid bash syntax, executable (755), contains pg_dump, no stubs |
| `scripts/restore.sh` | Point-in-time restore from any daily backup | VERIFIED | 257 lines, valid bash syntax, executable (755), contains pg_restore --clean --if-exists, no stubs |
| `scripts/SECRETS.template.md` | Production secrets reference document | VERIFIED | 52 lines, covers all secret categories with rotation procedures, no real credentials |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scripts/backup.sh | /var/backups/farm-ops/ | mkdir -p + cp for JSON, pg_dump for databases | VERIFIED | pg_dump for grain-tickets (line 123), organic-cert (line 128), glomalin-portal/Supabase (line 146) |
| scripts/restore.sh | /var/backups/farm-ops/ | reads timestamped backup, restores JSON + databases | VERIFIED | cp for JSON restore (line 156), pg_restore for PG (line 194), Supabase restore (line 224) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-02 | 37-01-PLAN | Daily backup scripts run for JSON data files (7-day retention) and PostgreSQL (pg_dump) | SATISFIED | backup.sh covers all 8 data stores with 7-day retention cleanup |
| SEC-04 | 37-01-PLAN | Production secrets documented (what to rotate, where they go) | SATISFIED | SECRETS.template.md lists every secret with purpose, app, env file, and rotation instructions |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected in any artifact |

### Human Verification Required

### 1. Backup Script Execution on VPS

**Test:** Run `scripts/backup.sh` on VPS with all apps deployed and .env files populated
**Expected:** Creates /var/backups/farm-ops/YYYY-MM-DD/ with 5 JSON files and 3 .dump files, logs to /var/log/farm-ops-backup.log, exits 0
**Why human:** Requires live PostgreSQL databases and Supabase connection; cannot test without production environment

### 2. Restore Round-Trip Verification

**Test:** After a backup runs, restore to a test database using `scripts/restore.sh YYYY-MM-DD` and verify apps work
**Expected:** All data restored correctly, apps start and serve data after pm2 restart
**Why human:** Success criterion explicitly requires manual verification at least once; needs live databases

### 3. Cron Installation

**Test:** Install cron with `0 2 * * * /srv/farm-ops/scripts/backup.sh` and verify it fires the next night
**Expected:** Backup directory created at ~2am, log file updated
**Why human:** Cron scheduling is a runtime VPS configuration task

### Gaps Summary

No gaps found. All four must-have truths are verified against actual file content. Both scripts pass bash syntax validation, are executable, and contain substantive implementations (not stubs). The secrets template covers all documented production secrets without including real credentials. Both requirement IDs (SEC-02, SEC-04) are satisfied.

The phase goal -- production data safety through daily backups -- is achieved at the script level. Human verification is needed to confirm the scripts work against live databases on the VPS, which is expected for infrastructure scripts that cannot be tested in a development environment.

---

_Verified: 2026-03-07_
_Verifier: Claude (gsd-verifier)_
