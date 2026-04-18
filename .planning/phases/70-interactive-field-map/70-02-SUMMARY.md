---
phase: 70-interactive-field-map
plan: "02"
subsystem: api
tags: [map, shapefile, geojson, shpjs, supabase, admin-gating, field-boundaries]
dependency_graph:
  requires:
    - phase: 70-01
      provides: [field_boundaries-table, farm_map_config-table]
  provides:
    - GET /api/maps/boundaries — field boundaries as GeoJSON FeatureCollection
    - POST /api/maps/import — admin-only shapefile zip import with full-replace semantics
    - GET /api/maps/center — farm center config read
    - POST /api/maps/center — admin-only farm center upsert
  affects: [70-03, 70-04, 70-05]
tech-stack:
  added: [shpjs@6.2.0, @types/shpjs@3.4.7]
  patterns:
    - profiles.role admin check via supabase session client (Phase 69 pattern)
    - service-role client fallback for RLS bypass on destructive ops
    - full-replace DELETE+INSERT (not upsert) for shapefile import
    - SMS shapefile property key fallback order (Name → name → FIELD_NAME)
    - polygon centroid via coordinate average (outer ring for Polygon, all outer rings for MultiPolygon)

key-files:
  created:
    - glomalin-portal/src/app/api/maps/boundaries/route.ts
    - glomalin-portal/src/app/api/maps/center/route.ts
    - glomalin-portal/src/app/api/maps/import/route.ts
  modified:
    - glomalin-portal/package.json (added shpjs + @types/shpjs)

key-decisions:
  - "shpjs ESM import (lib/index.js) works in Next.js server routes — CJS dist bundle uses browser self global and fails in Node.js, but ESM path does not"
  - "PGRST116 (row not found) silently treated as null center — expected when import hasn't run yet, not a 500 error"
  - "DELETE .neq('id', '00000000...') pattern used for full-table delete — Supabase requires a filter clause, uuid sentinel covers all real rows"
  - "Service role client used for DELETE+INSERT to bypass RLS — import is admin-authenticated at application layer, not DB layer"
  - "@types/shpjs placed in dependencies (not devDependencies) because npm install defaulted it there alongside shpjs"

patterns-established:
  - "SMS shapefile name matching: try Name → name → FIELD_NAME → field_name property keys in order"
  - "centroid computation: average all outer ring coordinate pairs across all polygons in a feature"
  - "full-replace import: DELETE all → INSERT matched → upsert farm_map_config center — single atomic admin operation"

requirements-completed: [MAP-04, MAP-05]

duration: 2min
completed: 2026-04-18
---

# Phase 70 Plan 02: Map API Routes Summary

**Three Next.js App Router routes powering field boundary reads, admin shapefile import with full-replace semantics, and farm center config using shpjs server-side parsing.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T05:18:58Z
- **Completed:** 2026-04-18T05:21:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GET /api/maps/boundaries returns all field_boundaries rows wrapped as a GeoJSON FeatureCollection (type+geometry+properties shape) — ready for MapLibre consumption
- POST /api/maps/import is admin-only, accepts .zip shapefiles only (400 for anything else), parses with shpjs, deletes all existing boundaries then inserts matched set, returns full summary with replaced:true and previousBoundariesCleared:true
- GET/POST /api/maps/center reads and writes farm center config from farm_map_config table; POST is admin-gated via profiles.role check

## Task Commits

1. **Task 1: GET /api/maps/boundaries + GET/POST /api/maps/center** - `4c39fbe` (feat)
2. **Task 2: POST /api/maps/import** - `f0e89e6` (feat)

## Files Created/Modified

- `glomalin-portal/src/app/api/maps/boundaries/route.ts` — GET endpoint returning field_boundaries as FeatureCollection
- `glomalin-portal/src/app/api/maps/center/route.ts` — GET/POST for farm center config; POST admin-gated
- `glomalin-portal/src/app/api/maps/import/route.ts` — POST admin-only shapefile import with full-replace semantics, shpjs parsing, centroid computation, farm center auto-update
- `glomalin-portal/package.json` — added shpjs@6.2.0 and @types/shpjs@3.4.7

## Decisions Made

- shpjs ESM import (`lib/index.js`) works in Next.js server routes — the CJS dist bundle references the browser `self` global and fails in Node.js bare require(), but ESM `import` resolves to the ESM path which uses globalThis and works fine.
- `PGRST116` (row not found) on farm_map_config is silently treated as `{ center: null }` — expected state when import hasn't run yet.
- `DELETE .neq('id', '00000000-0000-0000-0000-000000000000')` is the Supabase pattern for deleting all rows — Supabase requires at least one filter on DELETE, the uuid sentinel covers all real rows.
- Service role client used for DELETE+INSERT to bypass RLS — the import is admin-authenticated at the application layer, and service role allows unfiltered writes that RLS would otherwise block.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

shpjs CJS dist bundle uses `self` (a browser global) — attempting `require('shpjs')` in bare Node.js throws. However this was a non-issue in practice: Next.js App Router route handlers use ESM imports, so `import shp from 'shpjs'` resolves to the ESM entry point (`lib/index.js`) which uses `globalThis` instead and works correctly. The verification step confirmed the ESM import succeeds before implementation proceeded.

## Next Phase Readiness

- All three API routes are available for Plan 03 (map UI page + MapLibre component)
- GET /api/maps/boundaries returns the exact FeatureCollection shape MapLibre expects
- GET /api/maps/center provides the auto-zoom starting point
- POST /api/maps/import is ready for the admin settings page (Plan 04) to wire up

---
*Phase: 70-interactive-field-map*
*Completed: 2026-04-18*
