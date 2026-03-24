# Phase 49: Canonical Field IDs - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `registry_field_id` to every field record in farm-budget, grain-tickets, portal clu_records, and fsa-acres. Build per-app backfill scripts that map existing name-based field references to farm-registry IDs. Eliminate string-name fuzzy matching for cross-module joins.

</domain>

<decisions>
## Implementation Decisions

### Matching strategy
- Alias lookup first: check registry field name + all aliases for match
- Case-insensitive matching throughout
- Trim whitespace and normalize multiple spaces to single space before comparison
- Ambiguous matches (multiple registry fields match one record) flagged for manual pick in coverage report

### Unmatched field handling
- Skip unmatched records (leave registry_field_id null) and add to 'unmatched' section of coverage report
- Fix workflow: add missing aliases in farm-registry, then re-run backfill script
- 100% coverage required before phase is considered complete — zero null registry_field_ids
- Scripts are idempotent: re-running only processes records with null registry_field_id, already-matched records untouched

### Transition approach
- Hard switch to ID-based joins once backfill hits 100% — no name-based fallback
- New field records created after this phase require a registry_field_id (enforced)
- Field selection in all apps uses dropdown/autocomplete from registry — no free-text field names
- Old field name columns kept in each app's data for display and historical reference

### Backfill workflow
- One backfill script per app (farm-budget, grain-tickets, portal clu_records, fsa-acres)
- Dry-run by default: shows what would be matched/unmatched without writing changes
- Pass --commit flag to actually write changes
- Coverage report: summary stats to console + detailed report saved as file in the app's directory
- Scripts live inside each app directory (e.g., farm-budget/backfill-field-ids.js)

### Claude's Discretion
- Coverage report file format (JSON vs markdown)
- Exact matching algorithm implementation details
- How dropdown/autocomplete integrates with each app's existing UI patterns
- Schema migration approach per app (JSON apps vs Prisma vs Supabase)

</decisions>

<specifics>
## Specific Ideas

- Backfill scripts should feel like a repeatable workflow: run dry-run, review report, fix aliases, re-run until 100%
- No data destruction — old name columns preserved, no records deleted during migration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-canonical-field-ids*
*Context gathered: 2026-03-24*
