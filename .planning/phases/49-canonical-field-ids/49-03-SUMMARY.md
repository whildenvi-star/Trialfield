---
phase: 49-canonical-field-ids
plan: 03
subsystem: cross-module
tags: [farm-registry, farm-budget, grain-tickets, fsa-acres, glomalin-portal, field-ids, cross-app, dropdowns]

# Dependency graph
requires:
  - 49-01  # registry_field_id schema foundation
provides:
  - farm-budget sync-registry prefers registryFieldId over name lookup
  - grain-tickets POST /api/farms/sync-registry with ID-first and name fallback
  - grain-tickets farm form uses registry autocomplete dropdown (stores registryId)
  - fsa-acres field name autocomplete stores registryFieldId on selection
  - portal CLU card has registry field selector (sets field_name + registry_field_id)
  - portal GET /api/registry/fields-autocomplete proxy route
affects: [49-04, 50, 51, 52, 53, 54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ID-first lookup pattern: regById[id] || regByName[name.toLowerCase()] — used in both sync endpoints"
    - "Auto-upgrade pattern: store ID when name match succeeds so next sync uses canonical path"
    - "Registry dropdown: fetch /api/fields/autocomplete on first expand, cache in component state"
    - "Portal proxy pattern: Next.js API route forwards to farm-registry using fetchRegistryService helper"

key-files:
  created:
    - glomalin-portal/src/app/api/registry/fields-autocomplete/route.ts
  modified:
    - farm-budget/server.js
    - grain-tickets/server.js
    - grain-tickets/public/admin.html
    - fsa-acres/server.js
    - fsa-acres/public/app.js
    - fsa-acres/public/index.html
    - glomalin-portal/src/components/fsa/clu-card.tsx
    - glomalin-portal/src/lib/fsa/calc.ts
    - glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts

key-decisions:
  - "grain-tickets had no registry sync endpoint — added POST /api/farms/sync-registry with same ID-first pattern"
  - "fsa-acres upgraded existing name-only autocomplete to full registry field objects (id+name+aliases)"
  - "portal CLU card uses select dropdown (not autocomplete) since 56 fields fit in a dropdown without search"
  - "portal clu-records PATCH endpoint added field_name and registry_field_id to EDITABLE_FIELDS"

patterns-established:
  - "Registry sync pattern: ID-first (regById[id]) with name fallback, auto-store ID for future syncs"
  - "Field selector pattern: dropdown populated from /api/fields/autocomplete, stores both display name and ID"

requirements-completed:
  - CONS-07

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 49 Plan 03: Cross-Module Join Update Summary

**Cross-module sync endpoints updated to prefer canonical registry field IDs; field selection UIs in all 3 apps now use registry-backed dropdowns that store both display name and canonical ID**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T23:42:57Z
- **Completed:** 2026-03-24T23:49:52Z
- **Tasks:** 2
- **Files modified:** 8 modified, 1 created

## Accomplishments

- farm-budget sync-registry now prefers `registryFieldId` for direct registry lookup; falls back to name/alias matching for legacy records; auto-stores ID when name match succeeds
- Split group sync in farm-budget also upgraded to ID-first lookup
- grain-tickets `PUT /api/farms/:id` now accepts `registryId` in the field map
- grain-tickets `POST /api/farms` now accepts `registryId` in create data
- grain-tickets: new `POST /api/farms/sync-registry` endpoint using ID-first lookup with name fallback
- fsa-acres: upgraded field name autocomplete from names-only to full registry field objects; stores `registryFieldId` in hidden input on selection; new proxy endpoint `/api/registry/fields-autocomplete`
- fsa-acres editor: `registryFieldId` now flows through `openEditor` population and save handler
- grain-tickets admin.html: farm name input replaced with registry autocomplete dropdown; stores `registryId` on farm creation
- portal CLU card: new Registry Field selector (select dropdown from `/api/registry/fields-autocomplete` proxy); sets both `field_name` and `registry_field_id` in draft and PATCH payload
- portal: new `GET /api/registry/fields-autocomplete` proxy route using `fetchRegistryService` helper
- portal `CluRecord` interface: added `registry_field_id: string | null`
- portal PATCH endpoint: added `registry_field_id` and `field_name` to EDITABLE_FIELDS

## Task Commits

Each task was committed atomically:

1. **Task 1: Update cross-module sync endpoints to use registry field ID** - `08c4a7c` (feat)
2. **Task 2: Add registry field dropdown to field selection UIs** - `e71a2be` (feat)

## Files Created/Modified

- `farm-budget/server.js` - ID-first lookup in sync-registry, auto-upgrade ID storage, split group ID-first
- `grain-tickets/server.js` - registryId in field map (PUT), registryId in create (POST), new sync-registry endpoint
- `grain-tickets/public/admin.html` - registry autocomplete dropdown for farm name, stores registryId on create
- `fsa-acres/server.js` - new /api/registry/fields-autocomplete proxy endpoint
- `fsa-acres/public/app.js` - upgraded autocomplete to full field objects, registryFieldId stored on select
- `fsa-acres/public/index.html` - hidden ed-registryFieldId input added to editor
- `glomalin-portal/src/components/fsa/clu-card.tsx` - registry field selector (dropdown), draft + PATCH updates
- `glomalin-portal/src/lib/fsa/calc.ts` - registry_field_id added to CluRecord interface
- `glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts` - registry_field_id + field_name in EDITABLE_FIELDS
- `glomalin-portal/src/app/api/registry/fields-autocomplete/route.ts` - new proxy route (created)

## Decisions Made

- grain-tickets had no existing registry sync — added `POST /api/farms/sync-registry` with identical ID-first pattern to farm-budget. This is a new endpoint but follows the same pattern as the plan specified.
- fsa-acres already had a field name autocomplete (`/api/registry/field-names` returning strings only). Upgraded it in-place to full field objects rather than adding a parallel system — cleaner and no breaking change since the display behavior is identical.
- portal CLU card uses a `<select>` dropdown instead of an autocomplete typeahead. 56 fields fit comfortably in a dropdown. If registry is unavailable, falls back to a free-text input with a note.
- Portal proxy uses `fetchRegistryService` from the existing mobile API helper rather than duplicating the fetch logic — consistent with existing patterns in the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] grain-tickets had no registry sync endpoint**
- **Found during:** Task 1 (searching grain-tickets/server.js for existing sync endpoint)
- **Issue:** Plan assumed a sync endpoint existed in grain-tickets; none was found
- **Fix:** Added `POST /api/farms/sync-registry` with ID-first lookup (registryId) and name fallback, following the same pattern as farm-budget
- **Files modified:** grain-tickets/server.js
- **Committed in:** 08c4a7c (Task 1)

**2. [Rule 2 - Missing functionality] fsa-acres autocomplete missing registryFieldId flow**
- **Found during:** Task 2 (reading fsa-acres editor save/open handlers)
- **Issue:** Editor save and openEditor handlers had no `registryFieldId` field; the hidden input didn't exist in the HTML
- **Fix:** Added `ed-registryFieldId` hidden input to index.html; added `registryFieldId` to both openEditor fields array and save fields array
- **Files modified:** fsa-acres/public/index.html, fsa-acres/public/app.js
- **Committed in:** e71a2be (Task 2)

**3. [Rule 2 - Missing functionality] portal CLU card PATCH missing registry fields**
- **Found during:** Task 2 (reading clu-records/[id]/route.ts)
- **Issue:** EDITABLE_FIELDS didn't include `registry_field_id` or `field_name`; CluRecord type didn't have `registry_field_id`
- **Fix:** Added both to EDITABLE_FIELDS, added `registry_field_id` to CluRecord interface, updated draft init/reset/PATCH body
- **Files modified:** glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts, glomalin-portal/src/lib/fsa/calc.ts
- **Committed in:** e71a2be (Task 2)

---

**Total deviations:** 3 auto-fixed (all Rule 2 — missing functionality for correctness)
**Impact on plan:** All additions required for the plan to actually work end-to-end. No architectural changes.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- Schema (Plan 01), backfill scripts (Plan 02), and cross-module join updates (Plan 03) complete
- All apps now use canonical ID for sync + new records carry ID from dropdown selection
- Phase 49 is complete — canonical field IDs are fully operational across the platform

---
*Phase: 49-canonical-field-ids*
*Completed: 2026-03-24*

## Self-Check: PASSED

- farm-budget/server.js: FOUND (registryFieldId in ID-first sync lookup)
- grain-tickets/server.js: FOUND (registryId in fieldMap and sync-registry endpoint)
- grain-tickets/public/admin.html: FOUND (autocomplete dropdown for farm name)
- fsa-acres/public/app.js: FOUND (registry field objects autocomplete with ID storage)
- fsa-acres/public/index.html: FOUND (ed-registryFieldId hidden input)
- glomalin-portal/src/components/fsa/clu-card.tsx: FOUND (registry_field_id in draft + selector)
- glomalin-portal/src/app/api/registry/fields-autocomplete/route.ts: FOUND (proxy route)
- 49-03-SUMMARY.md: FOUND
- Commit 08c4a7c: FOUND (Task 1)
- Commit e71a2be: FOUND (Task 2)
