# Phase 37: Database + Backups - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Production data safety for the entire 8-app platform. Daily automated backups of all data stores (JSON files + PostgreSQL databases + Supabase), a restore script, and a secrets document. No new features — pure infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Backup scope & schedule
- Back up EVERYTHING: all JSON data files (farm-budget, farm-registry, fsa-acres, meristem-malt, seed-inventory) AND all PostgreSQL databases (grain-tickets, organic-cert) AND Supabase database (glomalin-portal)
- Daily cron at 2am local time
- 7-day retention — keep last 7 daily backups, auto-delete older
- Storage: local VPS only, separate directory (e.g., /var/backups/farm-ops/)
- No off-site copy for now — VPS is the single environment

### Supabase data strategy
- Free tier Supabase — NO built-in Supabase backups available
- Local pg_dump of Supabase PostgreSQL is the ONLY backup of portal data — critical
- Backup script must include Supabase connection string for pg_dump
- Supabase connection details already exist (user has production credentials)

### Secrets management
- Private SECRETS.md file on VPS (chmod 600, root-only) — NOT in git
- Single-person access model (just the user) — no shared vault needed
- Document every production secret: Supabase keys (anon, service_role, DB connection string), PostgreSQL passwords (grain-tickets, organic-cert), Case IH OAuth2 credentials, any API tokens
- For each secret: what it is, which app uses it, which .env file it goes in, how to rotate it
- Supabase project already provisioned with production keys — document where each key goes

### Restore procedure
- Simple restore.sh script — takes a backup date, restores all data stores
- Verify restore works once during Phase 37 setup (test against a temp database)
- No ongoing test-restore cadence — trust daily backups unless something breaks
- Backup script logs to a file (no email notifications, no external alerting)
- Log file for manual review — check via PM2 logs or direct file inspection

### Claude's Discretion
- Backup directory structure and naming convention
- pg_dump flags (custom format vs plain SQL, compression)
- Cron job implementation details (system cron vs PM2 cron)
- Log rotation for backup logs
- Exact restore.sh interface (flags, confirmation prompts)

</decisions>

<specifics>
## Specific Ideas

- Supabase is on free tier, so the local pg_dump is the ONLY backup of portal data — this is the most critical backup in the script
- User is the only person with VPS SSH access — secrets doc is for their own reference and disaster recovery
- DEPLOY.md already exists from Phase 36 — secrets doc should complement it, not duplicate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-database-backups*
*Context gathered: 2026-03-07*
