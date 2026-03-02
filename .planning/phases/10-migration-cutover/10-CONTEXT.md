# Phase 10: Migration & Cutover - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Move all existing grain ticket data (527 tickets, 63 farms, crop configs) from JSON flat-file storage to PostgreSQL via Prisma. Rewrite server.js to use Prisma for all CRUD operations. Archive data.json as read-only backup. No new features — existing UI and PWA must work identically after cutover.

</domain>

<decisions>
## Implementation Decisions

### Data enrichment during migration
- Extract HBT bin numbers from notes field into dedicated `hbtBinNo` column (507 of 527 tickets have them)
- Extract truck/trailer IDs from notes field into dedicated `truckId` column (best-effort parse)
- Notes field keeps original text intact — extraction copies data, doesn't remove it
- All 14 duplicate ticket numbers migrate as-is — schema uses @@index (not @unique) on ticketNo
- All existing crop configs get `cropYear=2025` as default (current harvest season data)

### Cutover approach
- Big-bang cutover: stop server, run migration script, restart with Prisma routes
- Off-season timing — no field users active, brief downtime is acceptable
- Migration script includes `--dry-run` mode that reports what it would do without writing to PostgreSQL
- Rollback plan: data.json.archive stays intact; if PostgreSQL has issues, revert server.js to JSON routes from git history

### Archive and code cleanup
- data.json renamed to data.json.archive after successful migration
- All .bak rotating backup files (data.json.bak.1 through .bak.5) deleted after migration
- All JSON-based code removed from server.js entirely (loadData, saveData, withLock, backup rotation, in-memory store)
- In-memory caching layer removed (farmSummaryCache, ticketById/ticketByNo maps) — PostgreSQL handles queries directly
- Dead code deleted, not commented out — git history preserves it

### Migration verification
- Console summary output: tickets migrated, farms migrated, crop configs migrated, HBT bins extracted, truck IDs extracted, any warnings
- Auto-verify calc.js: pick 10 random tickets, run calc.js against both JSON source and DB records, confirm byte-identical totals
- Data anomalies (0 weight, missing dates, empty farm names): warn in console output but migrate everything — bad data in JSON stays as-is in DB
- Post-cutover: manual smoke test of create, edit, delete ticket through browser UI

### Claude's Discretion
- HBT bin number parsing regex/pattern
- Truck ID extraction heuristics
- Random ticket selection strategy for calc.js verification
- PWA CACHE_NAME bump approach
- Prisma query patterns and error handling in route handlers
- Write-lock implementation during migration (if needed)

</decisions>

<specifics>
## Specific Ideas

- Tool is used from phones/tablets in the field during harvest season, but we're between seasons now — no urgency on timing
- The existing write-lock pattern (promise queue) in server.js can be dropped since Prisma/PostgreSQL handles concurrent writes natively
- The whitespace migration (migrateWhitespace function) can be dropped — data is already trimmed and Prisma schema should enforce clean data going forward

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-migration-cutover*
*Context gathered: 2026-03-01*
