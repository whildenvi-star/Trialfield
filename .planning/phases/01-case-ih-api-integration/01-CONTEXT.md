# Phase 1: Case IH API Integration - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect to Case IH FieldOps API via OAuth2, pull field operation data (tillage, planting, application, harvest), normalize into structured records in the organic-cert database. Farm manager can connect their account, trigger sync, review pulled data before it enters audit records, and see sync status per field.

</domain>

<decisions>
## Implementation Decisions

### OAuth Connection Flow
- Admin-only permission to connect/disconnect the Case IH account
- One Case IH account per farm operation (not per-operator)
- After connecting, show the farm/field list pulled from Case IH so admin can verify it's the right account
- Manual field matching screen: admin links each Case IH field to an organic-cert field (50+ fields — needs search/filter)
- Unmatched Case IH fields prompt admin to create a new field record (admin fills in organic-specific details)
- Field mappings are persistent but editable — admin can re-map later in settings
- Case IH uses full grower → farm → field → boundary (GFFB) hierarchy
- Disconnect/reconnect option available in settings
- API credentials (client ID, client secret, subscription key) are already available
- OAuth2 flow type uncertain — researcher should investigate whether CNH requires client_credentials or authorization_code for this use case

### Sync Trigger & Feedback
- Manual sync only (no scheduled background jobs in v1.0)
- "Sync Now" button triggers data pull
- Progress bar with details during sync: show which fields are syncing, operation counts, real-time progress
- Initial sync pulls last 3 years of data (NOP compliance lookback)
- Validate API connection only when sync is attempted (no startup health check)

### Data Mapping & Review
- Review-before-commit workflow: synced operations land in a staging area, admin reviews and confirms before they become official audit records
- Operation type mapping: first time a new Case IH operation type appears, admin maps it to NOP category (tillage, input application, harvest, etc.) — mapping auto-applies to subsequent syncs
- Approved inputs list: maintain a list of NOP-approved inputs — auto-match known products, flag unknowns for admin review
- Conflict resolution: manually entered data always wins — synced data does not overwrite manual records

### Mock/Dev Mode
- Auto-detect: if no API credentials configured, automatically use mock data (zero-config dev experience)
- Base mock data on existing farm-budget/fieldops/mock-data.js, extend as needed for organic cert scenarios
- Mock mode disabled in production — dev/staging only

### Claude's Discretion
- Where to place the connection setup in the app (settings page vs dedicated wizard)
- Error surfacing for expired tokens or broken connections (banner vs alert on sync)
- Post-sync summary format (per-field breakdown vs totals)
- Credential storage approach (env variables vs encrypted DB)
- Mock data volume (small vs realistic scale)
- Testing strategy (mocks in CI, integration tests approach)

</decisions>

<specifics>
## Specific Ideas

- User has live Case IH API credentials already (client ID, client secret, subscription key) — can build against real data from the start
- Existing OAuth2 sync code in farm-budget/fieldops/client.js and sync.js can be ported to TypeScript
- Farm has 50+ fields — matching UI needs search/filter capability, not just a simple list
- Full GFFB hierarchy (grower → farm → field → boundary) in Case IH account

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-case-ih-api-integration*
*Context gathered: 2026-02-24*
