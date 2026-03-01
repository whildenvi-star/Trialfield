# Phase 9: Database Foundation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Prisma 6 + PostgreSQL to the grain-tickets Express app. Schema in place for ALL v2.0 entities, PrismaClient singleton working, no existing functionality changed. JSON data store remains active — migration happens in Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Database isolation
- Other apps in the ecosystem (farm-budget, fsa-acres, meristem-malt, farm-registry) may migrate to PostgreSQL in the future
- Currently running on local PostgreSQL install; Docker or managed service possible later
- Office staff and personal devices access the app over local network (PWA)

### Schema scope
- Define ALL v2.0 tables in the initial schema: Ticket, Farm, CropConfig, Buyer, Settlement, SettlementLine, Reconciliation — even though settlement tables will be empty until later phases
- Local farms table synced from farm-registry API — grain-tickets maintains its own copy of farm data in PostgreSQL, periodically synced from the registry. Works even if registry is down.
- Crop config is per-year — each CropConfig row has a cropYear, allowing configs to change across seasons

### Data shape
- Dedicated `hbtBinNo` column on tickets — extract from notes field during migration (507/527 tickets have HBT bin numbers)
- Dedicated `truckId` column on tickets — extract from notes field during migration
- Duplicate ticket numbers (14 found) are data entry errors — use non-unique index on ticketNo, not unique constraint. Flag duplicates for review.
- Notes field is preserved after extraction — original text stays, structured fields are additive

### Deployment reality
- App is NOT yet deployed to production — running on dev machine only
- Farm office staff is still using the 31-sheet Excel spreadsheet
- The 527 tickets in data.json are historical imports, not actively entered data
- Phase 10 migration has zero live-user risk — no write-lock cutover procedure needed

### Claude's Discretion
- Separate database vs shared database (leaning separate for clean isolation)
- ID format: auto-increment integers vs preserving string IDs (t_000001)
- .env file setup and DATABASE_URL management
- Prisma schema naming conventions
- Connection pooling and singleton implementation details

</decisions>

<specifics>
## Specific Ideas

- Farm registry integration should use a local farms table, not just API lookup — reliability matters for farm operations where registry server might not always be running
- Per-year crop configs enable tracking how test weights, shrink rates, and FM discounts change season to season
- HBT bin numbers and truck IDs should be first-class fields, not buried in free text — these are part of the chain of custody

</specifics>

<deferred>
## Deferred Ideas

- Phase 14 (from roadmap): Chat agent for system information and recall — noted in roadmap, not blocking v2.0 phases

</deferred>

---

*Phase: 09-database-foundation*
*Context gathered: 2026-03-01*
