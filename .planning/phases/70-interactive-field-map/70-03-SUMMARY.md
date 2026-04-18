---
phase: 70-interactive-field-map
plan: "03"
subsystem: glomalin-portal/maps
tags: [maplibre, field-map, geospatial, satellite, polygon, hover, legend, detail-panel]
dependency_graph:
  requires: [70-02]
  provides: [/app/maps route, FieldMap component, FieldDetailPanel component, MapLegend component]
  affects: [glomalin-portal/src/lib/modules.ts, /api/maps/boundaries]
tech_stack:
  added: [maplibre-gl@^5.23.0]
  patterns: [dynamic-import-for-ssr-escape, fitBounds-auto-zoom, maplibre-feature-state-hover, promise-allSettled-graceful-degradation]
key_files:
  created:
    - glomalin-portal/src/app/(protected)/app/maps/page.tsx
    - glomalin-portal/src/components/maps/field-map.tsx
    - glomalin-portal/src/components/maps/field-detail-panel.tsx
    - glomalin-portal/src/components/maps/map-legend.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts
    - glomalin-portal/src/app/api/maps/boundaries/route.ts
    - glomalin-portal/package.json
decisions:
  - "top bar is h-14 (56px); maps page uses `fixed inset-0 top-14` to fill below sticky nav"
  - "MapLibre CSS loaded with dynamic import inside useEffect alongside the library itself — avoids Next.js SSR CSS import issues"
  - "boundaries route enriched server-side with crop+organic+reportingAcres via Promise.allSettled from farm-budget and farm-registry — single client fetch"
  - "crop from farm-budget /api/fields (registryFieldId match); organic from farm-registry certStatus === 'organic'"
  - "ORGANIC_DASH_PATTERN cast as unknown as number[] — maplibre-gl 5.x ExpressionSpecification is strict; const tuple needs widening at paint property"
  - "ExpressionSpecification for colorExpression cast as unknown first — dynamically built match expression type does not satisfy strict ExpressionSpecification union"
  - "/app/fields/${fieldId}/timeline link is a future page (Phase 58 or later) — present in panel per spec, destination not yet built"
  - "Field Map added as first entry in MODULES array — top-level nav per CONTEXT.md"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 70 Plan 03: MapLibre Interactive Field Map UI Summary

MapLibre GL JS satellite field map with polygon overlays, crop colors, organic dashed borders, fitBounds auto-zoom, hover tooltips, slide-in detail panel, and always-visible compact legend.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install maplibre-gl, /app/maps page skeleton, enrich boundaries route | eb094f6 | package.json, maps/page.tsx, modules.ts, boundaries/route.ts |
| 2 | FieldMap, FieldDetailPanel, MapLegend components | 9f7b1da | field-map.tsx, field-detail-panel.tsx, map-legend.tsx |

## What Was Built

### /app/maps page (Server Component)
`glomalin-portal/src/app/(protected)/app/maps/page.tsx`

Fixed full-viewport container (`fixed inset-0 top-14`) that clears the portal's `h-14` sticky top bar. Renders `<FieldMap />` inside a Suspense boundary with pulse skeleton fallback. No initial center/zoom props — fitBounds on loaded polygons is the canonical initial view.

### FieldMap (`field-map.tsx`)
The core deliverable. Key behaviors:

- **MapLibre loaded dynamically** inside `useEffect` (`await import('maplibre-gl')`) — no SSR issues, browser `window` available
- **Satellite basemap** via `getSatelliteStyleUrl()` from map-config (MapTiler Cloud with demo fallback)
- **Single fetch** to `/api/maps/boundaries` returns enriched GeoJSON with `{ crop, organic, reportingAcres }` already merged server-side
- **fitBounds auto-zoom** — computes bbox from all feature coordinates after load, calls `map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, animate: false })`
- **4 MapLibre layers**: `fields-fill` (crop color match expression), `fields-border` (standard), `fields-organic-border` (dashed, filtered to `organic=true`), `fields-hover` (feature-state based opacity)
- **Hover**: `mousemove` on `fields-fill` → feature-state `hover=true`, popup with field name tooltip (dark soil styling inline CSS)
- **Click**: opens FieldDetailPanel with field properties
- **No basemap toggle** — satellite only per CONTEXT.md locked decision
- **MapLegend** rendered as React child overlay inside map container

### FieldDetailPanel (`field-detail-panel.tsx`)
Right-side slide-in panel. Key behaviors:
- `fixed right-0 top-14 h-[calc(100vh-56px)] w-96` — fills from below top bar to bottom
- `translate-x-full` → `translate-x-0` CSS transition (300ms) when `field !== null`
- Click-outside transparent overlay (`fixed inset-0 z-10`, panel at `z-20`)
- Content: field name (accent color), crop badge or "No crop assigned", organic badge (green), reporting acres, organic status
- "View Field Activity Timeline →" link to `/app/fields/${registry_field_id}/timeline` (future page — Phase 58 built it for a different route; this links to field-specific timeline which is not yet built as a route, only as a timeline workspace)
- **No weather, no GDD, no Open-Meteo** — intentionally minimal per CONTEXT.md

### MapLegend (`map-legend.tsx`)
`absolute bottom-4 left-4 z-10` inside map container (which is `position: relative`). Shows:
- Color swatch + label for each crop present on the map (passed as `crops` prop from FieldMap)
- "No crop" swatch (`__unassigned` color)
- Dashed line indicator for "Organic certified" using inline border-dashed style matching ORGANIC_BORDER_COLOR

### Boundaries route enrichment
`/api/maps/boundaries/route.ts` updated to call farm-budget `/api/fields` and farm-registry `/api/fields?active=true` in parallel via `Promise.allSettled`. Merges `crop` (from budget field's `registryFieldId` match) and `organic`/`reportingAcres` (from registry `certStatus` and `reportingAcres`). Client sees a single enriched FeatureCollection — no separate `/api/maps/fields-meta` route needed.

### modules.ts
`maps` module added as the first entry in MODULES array — appears first in portal nav, `route: '/app/maps'`, label: "Field Map".

## Deviations from Plan

### Deviation 1: Server-side enrichment approach
Plan offered two options for crop+organic data: (a) separate `/api/maps/fields-meta` route or (b) update boundaries route server-side. Chose option (b) — single client fetch. Implemented via `Promise.allSettled` in the boundaries route combining farm-budget `/api/fields` and farm-registry `/api/fields?active=true`.

### Deviation 2: `top-14` vs `top-[48px]` for map offset
Plan specified `top-[48px]`. Actual top bar height is `h-14` (56px). Used `top-14` (56px) for accuracy. Also `h-[calc(100vh-56px)]` used in FieldDetailPanel for the same reason.

### Auto-fixed Issues

**1. [Rule 1 - Bug] MapLibre 5.x attributionControl type**
- **Found during:** Task 2 TypeScript check
- **Issue:** `attributionControl: true` is not assignable — MapLibre 5.x requires `AttributionControlOptions | false`
- **Fix:** Changed to `{ compact: true }`
- **Files modified:** field-map.tsx

**2. [Rule 1 - Bug] ExpressionSpecification cast for dynamically-built match expression**
- **Found during:** Task 2 TypeScript check
- **Issue:** Spread of CROP_COLORS entries produces `string[]` type; strict ExpressionSpecification union doesn't overlap
- **Fix:** Cast as `unknown as ExpressionSpecification` — runtime value is valid MapLibre expression
- **Files modified:** field-map.tsx

**3. [Rule 2 - Missing] maplibre-gl CSS import needs @ts-expect-error**
- **Found during:** Task 2 TypeScript check
- **Issue:** `import 'maplibre-gl/dist/maplibre-gl.css'` causes TS2307 — no type declarations for CSS module
- **Fix:** Added `// @ts-expect-error` comment before the dynamic CSS import
- **Files modified:** field-map.tsx

## Future Work (Deferred)

- `/app/fields/${fieldId}/timeline` route — the detail panel links to this but the destination page is not yet built. The field-timeline module (`/app/field-timeline`) is a separate workspace; per-field deep-links are a future phase.
- MapTiler API key setup — see `user_setup` in plan frontmatter. Map works with demo tiles fallback (lower quality) without the key.

## Self-Check: PASSED

Files exist:
- FOUND: glomalin-portal/src/app/(protected)/app/maps/page.tsx
- FOUND: glomalin-portal/src/components/maps/field-map.tsx
- FOUND: glomalin-portal/src/components/maps/field-detail-panel.tsx
- FOUND: glomalin-portal/src/components/maps/map-legend.tsx

Commits exist:
- eb094f6: feat(70-03): install maplibre-gl, scaffold /app/maps page, add Field Map nav entry
- 9f7b1da: feat(70-03): build FieldMap, FieldDetailPanel, and MapLegend components
