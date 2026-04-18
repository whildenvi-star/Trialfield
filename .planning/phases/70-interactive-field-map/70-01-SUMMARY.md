---
phase: 70-interactive-field-map
plan: "01"
subsystem: glomalin-portal
tags: [map, supabase, migration, maplibre, crop-colors, schema]
dependency_graph:
  requires: []
  provides: [field_boundaries-table, farm_map_config-table, map-config-ts]
  affects: [70-02, 70-03, 70-04, 70-05]
tech_stack:
  added: [maplibre-gl (planned for downstream plans)]
  patterns: [RLS-authenticated-select, admin-write-only, key-value-jsonb-config, named-exports-only]
key_files:
  created:
    - glomalin-portal/supabase/migrations/006-field-boundaries.sql
    - glomalin-portal/src/lib/map-config.ts
  modified: []
decisions:
  - "Migration numbered 006 — 005 was already taken by add-registry-crop-id.sql"
  - "getSatelliteStyleUrl() uses MapTiler Cloud (NEXT_PUBLIC_MAPTILER_KEY) with MapLibre demo tiles fallback — no Mapbox token required"
  - "CROP_COLORS keys match Phase 50 canonical crop registry names exactly"
  - "RLS: authenticated SELECT, admin-only INSERT/UPDATE/DELETE; import API route uses service-role key to bypass RLS"
  - "Admin write policy checks auth.jwt() ->> 'role' = 'admin' — consistent with portal RBAC pattern"
metrics:
  duration: "~1 min"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 70 Plan 01: Schema Foundation + Crop Color Config Summary

**One-liner:** Supabase field_boundaries + farm_map_config migration and MapLibre-compatible crop color config with satellite tile URL helper and no Mapbox dependency.

## What Was Built

### Task 1 — Supabase Migration (006-field-boundaries.sql)

Created `glomalin-portal/supabase/migrations/006-field-boundaries.sql` with two tables:

- `field_boundaries`: stores per-field GeoJSON polygons imported from SMS shapefile. Columns: `id` (UUID PK), `registry_field_id TEXT UNIQUE NOT NULL`, `name TEXT`, `geojson JSONB`, `centroid_lat/lng DOUBLE PRECISION`, `imported_at TIMESTAMPTZ`. The UNIQUE constraint on `registry_field_id` ensures no duplicate boundaries for a single canonical field.
- `farm_map_config`: key-value JSONB store for derived map settings computed at import time (`farm_center`, `bounds`). Columns: `key TEXT PK`, `value JSONB`, `updated_at TIMESTAMPTZ`.

RLS is enabled on both tables. Authenticated users can SELECT. Only admin role (via `auth.jwt() ->> 'role' = 'admin'`) can INSERT/UPDATE/DELETE. The shapefile import API route (Plan 02) will use the Supabase service-role key, which bypasses RLS entirely.

Migration file is ready to apply. The Supabase CLI push failed because the project is not linked in this environment. Apply with `npx supabase db push` after linking.

### Task 2 — Crop Color Config (src/lib/map-config.ts)

Created `glomalin-portal/src/lib/map-config.ts` as the single source of truth for all map styling constants:

- `CROP_COLORS`: 9 crop entries (Yellow Corn, Soybeans, Soft Red Winter Wheat, Hard Red Winter Wheat, Hybrid Rye, Oats, Barley, Natto Beans, Seed Beans) plus `__unassigned` and `__unknown` fallbacks — all matching Phase 50 canonical registry names.
- Opacity constants: `FILL_OPACITY`, `HOVER_FILL_OPACITY`, `SELECTED_FILL_OPACITY`
- Organic overlay: `ORGANIC_DASH_PATTERN`, `ORGANIC_BORDER_COLOR`, `ORGANIC_BORDER_WIDTH`
- Standard border: `STANDARD_BORDER_COLOR`, `STANDARD_BORDER_WIDTH`
- Map defaults: `DEFAULT_MAP_CENTER` (`[-92.5, 41.9]`), `DEFAULT_MAP_ZOOM` (`13`) — fallbacks only; runtime view uses `fitBounds()`
- `getSatelliteStyleUrl()`: returns MapTiler Cloud URL when `NEXT_PUBLIC_MAPTILER_KEY` is set, otherwise falls back to `demotiles.maplibre.org` (no account required). No Mapbox URIs anywhere.

All exports are named (no default export) for tree-shaking compatibility. TypeScript compiles with no errors (`npx tsc --noEmit --skipLibCheck` clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration number conflict — used 006 instead of 005**
- **Found during:** Task 1 pre-flight
- **Issue:** `005-add-registry-crop-id.sql` already existed in the migrations directory; plan specified 005-field-boundaries.sql
- **Fix:** Named file `006-field-boundaries.sql` as instructed in the plan's contingency note ("if 005 is taken, use 006")
- **Files modified:** glomalin-portal/supabase/migrations/006-field-boundaries.sql (naming only)
- **Commit:** a0b6cdb

None — plan executed exactly as written (with the contingency branch taken for migration number).

## Manual Steps Required

The migration must be applied to Supabase manually because the CLI project link is not configured in the current environment:

```bash
cd glomalin-portal
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Alternatively, copy the SQL from `006-field-boundaries.sql` into the Supabase dashboard SQL editor.

## Self-Check

Files created:
- glomalin-portal/supabase/migrations/006-field-boundaries.sql — FOUND
- glomalin-portal/src/lib/map-config.ts — FOUND

Commits: a0b6cdb, f34f2f7 — both verified.

## Self-Check: PASSED
