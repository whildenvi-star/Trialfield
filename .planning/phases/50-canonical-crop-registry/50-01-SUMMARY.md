---
phase: 50-canonical-crop-registry
plan: 01
subsystem: api
tags: [farm-registry, crops, json, express, canonical-data]

# Dependency graph
requires:
  - phase: 49-canonical-field-ids
    provides: Canonical field ID pattern and farm-registry data model for reference
provides:
  - crops[] array in farm-registry/data/data.json with 38 seeded records
  - GET /api/crops — active crop list with optional ?q= search
  - GET /api/crops/autocomplete — lightweight dropdown list with category/organic metadata
  - GET /api/crops/:id — single crop lookup by ID
  - POST/PUT/DELETE /api/crops — admin CRUD with soft-delete
affects:
  - 50-02 (backfill scripts will use crop aliases from this data)
  - 50-03 (consumer switchover will point apps at /api/crops)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - crop_NNN stable ID format (crop_001 through crop_038)
    - organic boolean attribute on crop record (not baked into name)
    - aliases array for multi-app alias resolution during backfill
    - soft-delete pattern (active: false) matching field registry pattern

key-files:
  created: []
  modified:
    - farm-registry/data/data.json
    - farm-registry/server.js

key-decisions:
  - "38 crop records total — organic flag is a boolean attribute, not part of canonical name (Yellow Corn + organic=true, not ORG Yellow Corn)"
  - "crop_NNN ID format with zero-padded 3-digit numbers, auto-incremented on POST"
  - "Autocomplete endpoint placed before :id route to prevent Express param shadowing"
  - "Seed Beans, Natto Beans kept as separate crop records from regular Soybeans — fundamentally different markets"
  - "FSA land-use categories (Idle, Fallow, CRP, Cover Crop) excluded from crop registry per design decision"
  - "Aliases array captures every known name variant across all apps for backfill matching"

patterns-established:
  - "Crop ID format: crop_NNN (zero-padded, sequential)"
  - "CRUD route ordering: autocomplete before :id to prevent Express param shadowing (same as fields)"
  - "Soft-delete: DELETE sets active=false, GET /api/crops filters active !== false"

requirements-completed: [CONS-09]

# Metrics
duration: 25min
completed: 2026-03-25
---

# Phase 50 Plan 01: Canonical Crop Registry Foundation Summary

**38-record canonical crop list in farm-registry data.json with full CRUD API at /api/crops — covering all crops from farm-budget, grain-tickets, fsa-acres, seed-inventory, and portal with organic boolean flag and aliases for backfill matching**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-25T02:10:00Z
- **Completed:** 2026-03-25T02:35:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 38 canonical crop records seeded across 13 categories (Corn, Soybeans, Wheat, Rye, Sweet Corn, Peas, Food Beans, Barley, Sorghum, Oilseeds, Hay, Specialty, Cover Crops)
- Organic split as boolean flag — each crop has an organic=false and organic=true variant where applicable
- Full CRUD API at /api/crops with autocomplete endpoint for dropdown population
- Every known name variant across all apps captured in aliases arrays for backfill matching in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Define crop schema and seed initial crop records in data.json** - `226d1fe` (feat)
2. **Task 2: Add /api/crops CRUD endpoints to farm-registry server** - `9bd13c4` (feat)

## Files Created/Modified
- `farm-registry/data/data.json` - Added crops[] array with 38 seeded canonical crop records
- `farm-registry/server.js` - Added 6 CRUD endpoints plus nextCropId() helper and store.crops initialization

## Decisions Made
- Organic is a boolean attribute, not part of the name: "Yellow Corn" with `organic: true`, not "ORG Yellow Corn". This allows apps to display with or without organic prefix depending on context.
- Seed Beans kept as a separate record from Soybeans because the market pricing and contracts are fundamentally different (seed production vs commodity), not just an organic premium.
- Natto Beans similarly kept separate — specialty soybean with different protein profile, different buyer, different market.
- "comp yellow" alias added to Yellow Corn crop_001 (farm-budget internal name for conventional yellow corn blends).
- "Milling Rye" as canonical name for the non-hybrid rye variety (vs "Hybrid Rye" which is the separate Meristem Malt-bound variety).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- grain-tickets data.json had been migrated to PostgreSQL — archive file used for crop discovery. Found crop names like "155 OR Seed beans", "202 OR Seed Beans" which appear to be variety codes prepended, all added as aliases to Seed Beans record.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can begin immediately: backfill scripts will use crop aliases from data.json to match existing string crop names to canonical crop IDs across all apps
- Plan 03 (consumer switchover) depends on Plan 02 backfill scripts being validated
- Server must be running (pm2 start farm-registry) for other apps to resolve /api/crops

---
*Phase: 50-canonical-crop-registry*
*Completed: 2026-03-25*
