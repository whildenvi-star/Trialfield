# Phase 51: FSA/Insurance Data Consolidation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate fsa-acres JSON data to portal Supabase as single source of truth for CLU records and insurance policies. Rewire fsa-acres Express app to read/write via Supabase directly (service-role key). Move USDA RMA price scraper into the portal. Remove GCS enrollment feature (program discontinued). No new features — this is a data consolidation and ownership transfer.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- Big-bang cutover: run migration script, verify, then switch fsa-acres to Supabase. No dual-write period.
- Original JSON file kept as read-only backup after migration (renamed, e.g., `data.json.migrated`), not deleted.
- Verification: row counts + spot-check of 10-20 random records compared field-by-field. No full diff needed.

### Duplicate Detection
- Claude's discretion on dedup key selection (FSA identifiers vs registry_field_id vs both). Choose based on data quality in the JSON.

### API Contract for fsa-acres
- Auth: Supabase service-role key for server-to-server access.
- fsa-acres calls Supabase directly via `@supabase/supabase-js` — does NOT go through portal Next.js API routes. Only Supabase needs to be running, not the portal server.
- Failure mode: if Supabase is unreachable, show clear error message. Reads can show stale cached data if available, writes are blocked until connection restored.

### Write Access
- Claude's discretion on whether fsa-acres gets read+write or read-only access. Decide based on which existing features currently write data and what's least disruptive.

### RMA Price Scraper
- Dual trigger: manual "Refresh Prices" button in admin/insurance UI + daily cron job.
- Scope derived from CLU records — scraper queries what crops/counties exist in clu_records and fetches prices for those. Automatically adapts.
- Failure handling: keep last successful prices in insurance_pricing table. Show warning badge in UI when prices are stale beyond 7 days ("Last updated X days ago").

### Backward Compatibility
- GCS enrollment feature: REMOVE ENTIRELY. Program is discontinued, no need to migrate or preserve this feature.
- No shadow-read verification mode — trust the migration report and spot checks.

### Claude's Discretion
- Whether fsa-acres editing UI stays or redirects to portal (choose least disruptive path)
- Whether dashboard/reports get minor UI refreshes during migration or stay identical
- Duplicate detection key strategy
- fsa-acres read/write vs read-only access decision

</decisions>

<specifics>
## Specific Ideas

- "GCS program isn't happening next year so let's completely remove the feature" — clean removal, not just hiding
- Service-role key pattern keeps fsa-acres decoupled from portal server uptime
- 7-day staleness threshold for RMA price warning badge

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 51-fsa-insurance-data-consolidation*
*Context gathered: 2026-03-25*
