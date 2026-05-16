---
created: 2026-05-16T02:45:45.982Z
title: Add CLU sub-field splitting tool and map legend to FSA map view
area: ui
files:
  - glomalin-portal/supabase/migrations/024_clu_records_schema.sql
  - glomalin-portal/src/app/(portal)/fsa-578
---

## Problem

The FSA map view displays CLU boundaries from uploaded FSA shapefiles but has no tools for:
1. Splitting CLUs into sub-parcels (subA, subB, etc.) for internal tracking without altering FSA geometry
2. Showing CLU numbers as labels directly on the map
3. A toggleable overlay legend so users can turn layers on/off (CLU boundaries, sub-fields, management zones, labels, etc.)

Operators need to cut up received FSA shapefiles into management sub-units (e.g., different varieties, drainage tiles) while keeping the FSA source as inviolable truth — and always being able to revert back.

## Solution

### CLU Number Labels & Immersive Map Legend
- Render CLU tract/field numbers as labels on each polygon (centroid-positioned, styled to dark soil aesthetic)
- Toggleable legend panel listing all map overlays with checkboxes:
  - CLU boundaries (FSA source, always-on default)
  - CLU number labels
  - Sub-field splits (subA, subB, etc.)
  - Management zones
  - Any future overlays
- Use `frontend-design` skill for high-quality, immersive UI — dark soil palette, not generic

### CLU Sub-Field Splitting Tool
- Drawing/split tool on the map: user draws a line across a CLU polygon to split it into subA, subB
- Merge tool: combine two adjacent sub-fields back into one
- Geometry operations via Turf.js (`@turf/turf`) — `polygonClipping` or `difference`/`union`
- Sub-fields stored in a new `clu_sub_fields` table (FK → `clu_records.id`, geometry, label like "subA")
- `clu_records` geometry is NEVER modified — it is the immutable FSA source of truth

### FSA Truth Revert
- Per-CLU "Restore to FSA Original" button — deletes all `clu_sub_fields` rows for that CLU
- Global "Revert All" action in the legend/toolbar

### Re-Upload Reconciliation
- When new FSA shapefiles arrive, a diff flow compares incoming CLU geometry vs stored `clu_records`
- Flags changed/added/removed CLUs for user review before applying
- User can accept individual changes; sub-fields on changed CLUs are flagged as needing review (not auto-deleted)

### Packages likely needed
- `@turf/turf` — polygon split/union/difference
- `mapbox-gl-draw` or equivalent — freehand/line drawing tool on the map
