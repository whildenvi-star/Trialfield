---
phase: 63-crop-autocomplete-server-proxy
plan: 01
subsystem: api
tags: [next.js, proxy, farm-registry, marketing, autocomplete]

# Dependency graph
requires:
  - phase: 57-grain-contracts
    provides: contract-drawer.tsx component with crop autocomplete
  - phase: 49-canonical-field-ids
    provides: farm-registry proxy pattern (fetchRegistryService)
provides:
  - Portal proxy route /api/registry/crops forwarding ?q= to farm-registry server-side
  - Contract drawer crop autocomplete works on VPS (no direct client access to port 3005)
affects: [marketing, contract-drawer, farm-registry proxy routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side proxy route for farm-registry autocomplete — same pattern as fields-autocomplete/route.ts"
    - "Portal-relative fetch in client components avoids hardcoded localhost URLs"

key-files:
  created:
    - glomalin-portal/src/app/api/registry/crops/route.ts
  modified:
    - glomalin-portal/src/components/marketing/contract-drawer.tsx

key-decisions:
  - "New route at /api/registry/crops (no -autocomplete suffix) — matches plan spec and calls /api/crops/autocomplete with ?q= filtering"
  - "Response handler accepts both { crops: [{name}] } shape (new proxy) and flat array fallback (defensive compat)"

patterns-established:
  - "fetchRegistryService proxy pattern: import from ../../mobile/_lib/proxy, call dedicated autocomplete endpoint, return data.crops array"

requirements-completed: [MKT-01]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 63 Plan 01: Crop Autocomplete Server Proxy Summary

**New /api/registry/crops Next.js proxy route replaces hardcoded localhost:3005 URL in contract-drawer.tsx, fixing silent crop autocomplete failure on VPS production**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T02:16:12Z
- **Completed:** 2026-03-30T02:17:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `/api/registry/crops/route.ts` that proxies `?q=` to farm-registry `/api/crops/autocomplete` server-side using existing `fetchRegistryService` helper
- Removed hardcoded `http://localhost:3005/api/crops/autocomplete` from `contract-drawer.tsx` — unreachable from VPS client browser
- Updated response handler in contract-drawer to extract names from `{ crops: [{name}] }` shape returned by proxy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/registry/crops portal proxy route** - `e166518` (feat)
2. **Task 2: Update contract-drawer.tsx to call portal-relative proxy** - `e273275` (fix)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `glomalin-portal/src/app/api/registry/crops/route.ts` - New proxy route forwarding GET ?q= to farm-registry /api/crops/autocomplete, returns data.crops array
- `glomalin-portal/src/components/marketing/contract-drawer.tsx` - Fetch URL changed from hardcoded localhost:3005 to /api/registry/crops; .then handler updated for { crops } shape

## Decisions Made
- New route lives at `api/registry/crops` (not `crops-autocomplete`) per plan spec — distinct from existing `crops-autocomplete` route which calls `/api/crops` full list for CropTypeahead
- Flat-array fallback retained in contract-drawer response handler for defensive compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Crop autocomplete in contract drawer now works on VPS — portal proxy fetch runs server-to-server on internal network where port 3005 is reachable
- Pattern established: any future client component needing farm-registry data should use portal-relative `/api/registry/*` routes rather than direct localhost URLs

---
*Phase: 63-crop-autocomplete-server-proxy*
*Completed: 2026-03-30*
