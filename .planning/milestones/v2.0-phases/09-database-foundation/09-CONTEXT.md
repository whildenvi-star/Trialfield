# Phase 9: Database Foundation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Prisma 6 + PostgreSQL to grain-tickets without touching existing routes. Schema in place, client singleton working, JSON store stays active. Creates Ticket, CropConfig, and FarmEntry tables only — Buyer, Settlement, and SettlementLine models are added in later phases (11-12).

</domain>

<decisions>
## Implementation Decisions

### HBT Bin Tracking
- Dedicated nullable `hbtBin` column on Ticket from day one
- Phase 10 migration will extract bin numbers from the existing notes field

### Weight Storage
- Store weight as integer pounds (whole numbers)
- Scale tickets are whole numbers; integer avoids floating-point rounding in reconciliation

### Crop & Variety Model
- Separate fields: crop (e.g., "Winter Wheat"), variety (e.g., "SRWW"), organic flag
- CropConfig has one row per crop+variety+organic combo (matches the 31 spreadsheet tabs)
- CropConfig is a global reference table — not scoped by year
- Organic status lives on BOTH CropConfig (default) and Ticket (can override per load)

### Ticket-to-Crop Relationship
- Required FK — every ticket must reference a CropConfig (no orphan tickets)

### Moisture & Test Weight
- Nullable `moisture` decimal field on Ticket (compare farm reading vs buyer settlement later)
- Per-ticket `testWeight` field (lbs/bu) — actual test weight can vary by load

### Bushel Calculation
- Do NOT store estimated bushels — calculate on the fly from weight and test weight
- Most accurate (always uses current conversion), least human input
- calc.js continues to be the single source of truth

### Truck Identification
- Plain string `truckId` field on Ticket — no separate Truck entity
- Just a label for which truck hauled the load

### Destination
- Skip destination field entirely in Phase 9
- Phase 11 adds Buyer entity with FK on Ticket from scratch

### Dates
- `deliveryDate` (the day the load was hauled)
- Auto-managed `createdAt` / `updatedAt` timestamps

### Notes Field
- Keep nullable notes field on Ticket after extracting hbtBin
- General-purpose free text for driver notes, special instructions, etc.

### Season Scoping
- Include `cropYear` (integer, e.g., 2025) on Ticket in Phase 9
- Phase 10 migration will populate from existing data

### Schema Scope
- Phase 9 tables only: Ticket, CropConfig, FarmEntry
- Buyer, Settlement, SettlementLine added in Phases 11-12 via Prisma migrations
- Reconciliation fields (matchStatus, settlementLineId) added strictly in Phase 13

### FarmEntry Model
- One FarmEntry per field per cropYear
- Links to farm-registry field via string `registryFieldId` (no DB-level FK — separate service)
- App-level validation against farm-registry API

### Primary Keys
- Auto-increment integers — simple, fast, human-readable for internal tool

### Deletion Strategy
- Soft delete via nullable `deletedAt` timestamp on Ticket
- Deleted tickets hidden but recoverable — important for grain traceability

### Deployment Reality
- App is NOT yet deployed to production — running on dev machine only
- The 527 tickets in data.json are historical imports, not actively entered data
- Phase 10 migration has zero live-user risk

### Claude's Discretion
- Ticket number normalization approach (raw only vs raw + normalized column)
- Exact Prisma schema field types and index strategy
- db.js singleton implementation pattern
- Dev environment setup (Docker vs local PostgreSQL)
- Seed/verification approach
- .env file setup and DATABASE_URL management
- Connection pooling details

</decisions>

<specifics>
## Specific Ideas

- Bushel calculation must prioritize accuracy and minimal human input — derive from weight, never store a stale computed value
- 14 duplicate ticket numbers exist in current data — schema must NOT use @unique on ticketNo
- 507/527 tickets have HBT bin numbers in notes — extractable during Phase 10 migration
- Reconciliation compares raw pounds, not derived bushels (buyers use different shrink methods)
- CropConfig should mirror the 31 crop/variety tabs in "2025 Loads.xlsx"
- HBT bin numbers and truck IDs should be first-class fields, not buried in free text — these are part of the chain of custody

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-database-foundation*
*Context gathered: 2026-03-01*
