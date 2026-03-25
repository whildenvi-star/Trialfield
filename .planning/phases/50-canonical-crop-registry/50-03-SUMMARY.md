---
phase: 50-canonical-crop-registry
plan: 03
subsystem: consumer-switchover
tags: [farm-budget, grain-tickets, fsa-acres, glomalin-portal, organic-cert, canonical-data, crop-registry]

# Dependency graph
requires:
  - phase: 50-01
    provides: 38-record canonical crop registry with /api/crops endpoint
  - phase: 50-02
    provides: registryCropId backfill scripts and schema changes
provides:
  - farm-budget crop dropdown populated from farm-registry /api/crops
  - grain-tickets crop autocomplete fetched from farm-registry /api/crops
  - fsa-acres CLU editor crop autocomplete fetched from farm-registry /api/crops
  - glomalin-portal CropTypeahead fetching from /api/registry/crops-autocomplete proxy
  - organic-cert field-enterprises page fetching from http://localhost:3005/api/crops
  - GET /api/registry/crops proxy in farm-budget, grain-tickets, fsa-acres servers
  - GET /api/registry/crops-autocomplete proxy in glomalin-portal
  - Cross-module crop aggregation via GET /api/summary/by-crop in grain-tickets (CONS-11)
affects:
  - All apps that create or edit records with crop fields now store registryCropId
  - Cross-module crop aggregation now groups by canonical ID, not display name string

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 60s in-memory cache on registry proxy endpoints (same origin fetch avoids CORS)
    - data-registry-crop-id attribute on <option> elements for browser-side ID capture
    - registryCropId stored on form submission alongside crop name string
    - Direct cross-app HTTP fetch pattern (organic-cert, no proxy needed)
    - FSA_LAND_USE_CATEGORIES local constant separate from crop registry (Idle/Fallow/CRP/Cover Crop)
    - computeCropSummariesByRegistryId() for canonical cross-module aggregation

key-files:
  created:
    - glomalin-portal/src/app/api/registry/crops-autocomplete/route.ts
  modified:
    - farm-budget/server.js
    - farm-budget/public/enterprise.js
    - farm-budget/public/crop-colors.js
    - farm-budget/public/field-editor.js
    - grain-tickets/server.js
    - grain-tickets/public/tickets.js
    - fsa-acres/server.js
    - fsa-acres/public/app.js
    - glomalin-portal/src/lib/fsa/fsa-crop-list.ts
    - glomalin-portal/src/components/fsa/crop-typeahead.tsx
    - glomalin-portal/src/components/fsa/clu-card.tsx
    - glomalin-portal/src/lib/fsa/calc.ts
    - glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts
    - organic-cert/src/app/(app)/field-enterprises/page.tsx

key-decisions:
  - "field-editor.js (not enterprise.js) contains the actual farm-budget crop dropdown — plan's description was slightly off about which file has the crop selection UI; both files modified with registry references"
  - "FSA land-use categories (Idle/Fallow/CRP/Cover Crop) kept as FSA_LAND_USE_CATEGORIES local constant in portal — these are not crops in the registry and are merged at point of use"
  - "Fallow retained as LOCAL_NON_CROPS constant in organic-cert — it is a rotation state handled via the isFallow toggle, not a registry crop in the dropdown"
  - "organic-cert is a nested git repo — committed task 3 changes to organic-cert/.git, not the parent repo"
  - "grain-tickets adds GET /api/summary/by-crop endpoint for cross-module crop aggregation grouped by registryCropId (CONS-11)"
  - "CropColors.setRegistryCropColors() added to provide registry-backed color lookup when registryCropId is available; falls back to cropTypes-based colors for backward compatibility"
  - "Portal CropTypeahead onChange signature extended to pass optional registryCropId second argument; existing callers (setAssignCrop etc) continue to work — TypeScript permits functions with fewer parameters"

patterns-established:
  - "Same-origin proxy with 60s cache: each Express app has GET /api/registry/crops that caches farm-registry response"
  - "Form submissions include registryCropId alongside crop name string for cross-module joins"
  - "Registry unavailable = visible error state (no silent fallback) across all consumer apps"
  - "FSA non-crop land-use categories kept as separate local constants, NOT merged into registry"

requirements-completed: [CONS-10, CONS-11]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 50 Plan 03: Consumer Switchover Summary

**All 5 consumer apps (farm-budget, grain-tickets, fsa-acres, portal, organic-cert) now fetch crop lists from farm-registry /api/crops, storing registryCropId for canonical cross-module joins — hardcoded FSA_CROP_LIST and CROPS arrays deleted**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T02:46:30Z
- **Completed:** 2026-03-25T02:58:28Z
- **Tasks:** 3
- **Files modified/created:** 14

## Accomplishments

- 5 consumer apps switched from local hardcoded arrays to live registry fetch
- Each Express server (farm-budget, grain-tickets, fsa-acres) got a `GET /api/registry/crops` proxy with 60s in-memory cache
- Portal got `GET /api/registry/crops-autocomplete` route proxying to farm-registry
- `FSA_CROP_LIST` hardcoded array deleted; replaced with `fetchCropList()` async function
- `CROPS` hardcoded array deleted from organic-cert field-enterprises page
- All crop selection UIs now store `registryCropId` on the created/updated record
- `grain-tickets/server.js` adds `GET /api/summary/by-crop` endpoint grouping by canonical crop ID for CONS-11
- `CropColors.js` extended to accept `registryCropId` for registry-backed color lookup
- `CluRecord` TypeScript interface extended with `registry_crop_id: string | null`
- PATCH handler for portal clu-records whitelist includes `registry_crop_id`

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch farm-budget and grain-tickets to registry crop list** - `212d429` (feat)
2. **Task 2: Switch fsa-acres and portal to registry crop list** - `7e3c236` (feat)
3. **Task 3: Switch organic-cert to registry crop list** - `3b52ccb` in organic-cert sub-repo (feat)

## Files Created/Modified

- `farm-budget/server.js` - Added GET /api/registry/crops proxy with 60s cache
- `farm-budget/public/field-editor.js` - Fetch crop dropdown from registry; store registryCropId on save
- `farm-budget/public/enterprise.js` - Pass registryCropId to getCropColor(); data-registry-crop-id attribute
- `farm-budget/public/crop-colors.js` - Extended getCropColor(cropName, registryCropId); added setRegistryCropColors()
- `grain-tickets/server.js` - Added GET /api/registry/crops proxy; persist registryCropId on create/update; GET /api/summary/by-crop; computeCropSummariesByRegistryId()
- `grain-tickets/public/tickets.js` - Fetch crop autocomplete from registry; store registryCropId on selection and form submission
- `fsa-acres/server.js` - Added GET /api/registry/crops proxy with 60s cache
- `fsa-acres/public/app.js` - Crop autocomplete for CLU editor fetching from registry; hidden ed-registryCropId field; included in save
- `glomalin-portal/src/app/api/registry/crops-autocomplete/route.ts` - NEW: proxy to farm-registry /api/crops
- `glomalin-portal/src/lib/fsa/fsa-crop-list.ts` - Deleted FSA_CROP_LIST array; added fetchCropList(), fetchCropListWithLandUse(), FSA_LAND_USE_CATEGORIES
- `glomalin-portal/src/components/fsa/crop-typeahead.tsx` - Fetch from registry; pass registryCropId to onChange; error state on registry failure
- `glomalin-portal/src/components/fsa/clu-card.tsx` - Added registry_crop_id to DraftFields; capture in onChange; include in PATCH body
- `glomalin-portal/src/lib/fsa/calc.ts` - Added registry_crop_id to CluRecord interface
- `glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts` - Added registry_crop_id to EDITABLE_FIELDS
- `organic-cert/src/app/(app)/field-enterprises/page.tsx` - Deleted CROPS array; added RegistryCrop[] state; fetch from localhost:3005/api/crops; error state; registryCropId in form and POST body

## Decisions Made

- farm-budget's actual crop dropdown is in `field-editor.js`, not `enterprise.js` as described in the plan. Both files modified: field-editor.js for the actual dropdown, enterprise.js for the registry-aware color lookup using `registryCropId`.
- FSA land-use categories are NOT registry crops — they stay as `FSA_LAND_USE_CATEGORIES` local constant in the portal and are merged at the point of use for CLU crop fields.
- Fallow in organic-cert is handled via the existing `isFallow` toggle checkbox, not the crop dropdown. `LOCAL_NON_CROPS` constant retains Fallow for any edge-case inclusion.
- organic-cert is a nested git repository — its changes were committed to `organic-cert/.git` rather than the parent repo.
- CONS-11 (cross-module crop aggregation uses canonical ID) implemented via a new `GET /api/summary/by-crop` endpoint in grain-tickets that groups by `registryCropId` and falls back to crop name string for tickets without a canonical ID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] farm-budget crop dropdown is in field-editor.js, not enterprise.js**
- **Found during:** Task 1
- **Issue:** Plan said to modify enterprise.js attachCropAutocomplete() but this function doesn't exist there; the crop selection UI is in field-editor.js
- **Fix:** Modified field-editor.js to fetch from registry and added registry crop ID references to enterprise.js for the color lookup
- **Files modified:** farm-budget/public/field-editor.js, farm-budget/public/enterprise.js

---
*Phase: 50-canonical-crop-registry*
*Completed: 2026-03-25*
