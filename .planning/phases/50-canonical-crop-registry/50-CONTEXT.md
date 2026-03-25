# Phase 50: Canonical Crop Registry - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A single authoritative crop list lives in farm-registry and all apps fetch from it — no app hardcodes its own crop array. Includes schema additions, API endpoint, alias seeding, backfill scripts, and consumer switchover for farm-budget, grain-tickets, fsa-acres, organic-cert, seed-inventory, and glomalin-portal.

</domain>

<decisions>
## Implementation Decisions

### Crop Identity Model
- Flat list of crop entries — each crop is a single record (no parent→child hierarchy required, but Claude may add a `category` field for grouping if useful)
- Each crop that differs meaningfully is a separate entry: "Yellow Corn", "White Corn", "Blue Corn", "Hybrid Rye", "Rye" are all distinct crops with distinct IDs
- Organic is a boolean attribute on the crop record, NOT baked into the name — "Yellow Corn" with `organic=true`, not "ORG Yellow Corn"
- Varieties (Pioneer P63ME80, Gazelle rye) are NOT in the crop registry — variety tracking stays in seed-inventory and farm-budget enterprises

### Alias & Display Names
- Canonical names are full human-readable: "Soft Red Winter Wheat", "Yellow Corn", "Hybrid Rye"
- Apps always display the canonical name (no per-app display overrides)
- Each crop has a single array of known aliases for matching: e.g., `["SRWW", "Org SRWW", "Winter Wheat", "Organic Winter Wheat"]`
- Aliases are used for backfill matching and legacy data reconciliation, not for display
- Initial alias list auto-scanned from existing app data (farm-budget cropTypes, grain-tickets cropConfig, fsa-acres records, portal FSA list, seed-inventory products), then user reviews before committing

### Crop List Scope
- Only crops actually grown/handled — approximately 20-30 entries
- FSA land-use categories (Idle, Fallow, CRP, Cover Crop) are NOT crops — they stay in the portal's FSA module
- New crops added admin-only through farm-registry UI
- Crop records include key metadata: bushel weight (lb/bu), hex color (for charts), optionally RMA crop code
- Colors in registry (consistent cross-app chart colors)

### Consumer Switchover
- Hard cutover: delete local crop arrays, apps fetch from farm-registry `/api/crops` or fail visibly
- No local fallback — all apps on same VPS, if registry is down everything is down
- Backfill historical records with canonical crop IDs (same pattern as Phase 49 field ID backfill): dry-run + commit mode with coverage reports
- Backfill scripts match existing crop strings against alias list to resolve canonical crop ID

### Claude's Discretion
- Whether to use flat list or add a lightweight `category` grouping field (e.g., "Corn", "Small Grains", "Oilseeds") for farm-budget chart grouping
- UI dropdown changes: whether to update dropdowns to show canonical names now or defer visual changes
- Exact crop record schema design (field names, data types, JSON structure)
- How farm-budget's cropTypes/sub-crop UI adapts to the flat registry model
- Which metadata fields beyond bushel weight and color are worth including

</decisions>

<specifics>
## Specific Ideas

- Follow the Phase 49 pattern for backfill scripts (dry-run/commit mode, coverage reports, match vs unmatched)
- Auto-scan script should parse: farm-budget `data.json` cropTypes/subCrops, grain-tickets Prisma cropConfig, fsa-acres `data.json` crop strings, portal `fsa-crop-list.ts`, seed-inventory product crops, organic-cert crop strings
- The alias matching during backfill should be case-insensitive and handle prefix variations (ORG/Organic)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-canonical-crop-registry*
*Context gathered: 2026-03-24*
