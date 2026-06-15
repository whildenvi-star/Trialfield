# Phase 72: Acreage Reconciliation Tool - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing Compliance Hub Acreage tab (`/app/compliance`, "Acreage" tab) with a full spatial reconciliation tool for crop insurance reporting. The tool ingests three data sources — FSA CLU shapefiles, the Glomalin farm registry, and FieldView API as-planted data — spatially overlays them via PostGIS, flags acreage discrepancies by severity (Green/Yellow/Red), and produces three outputs: an interactive map view, a tabular acreage report, and an output shapefile carrying the full RMA attribute schema, ready for the crop insurance agent.

Manual editing (split CLU, merge CLUs, draw from scratch, manual acreage override) is a HARD REQUIREMENT. The tool must function completely with zero automated inputs — it is the replacement for the paper-and-pencil acreage reporting workflow, so anything that workflow can do, this tool must do at least as well.

</domain>

<decisions>
## Implementation Decisions

### Portal Location
- **D-01:** Replaces/extends the existing Acreage tab in `/app/compliance`. No new top-level nav entry — the Phase 68 ComplianceShell, tab routing, and shared farm/crop filter remain unchanged. Only the Acreage tab content is replaced.

### Phase Scope
- **D-02:** One phase, multiple plans (estimated 4–6 sequential plans). Automated path and manual editor ship together — manual capability is not a stretch goal.

### Stack
- **D-03:** Next.js 14 App Router (existing portal), Supabase + PostGIS for all spatial operations, Vercel hosting.
- **D-04:** n8n for FieldView sync scheduling only — nightly or on-demand pull from FieldView API → Supabase `coverage_events` table. Researcher to confirm n8n availability on VPS droplet; Vercel cron is the fallback if n8n is not available.
- **D-05:** Map library: MapLibre GL or Leaflet + draw plugin — researcher picks based on Phase 70's MapLibre GL infrastructure and available draw/edit plugin ecosystem. Phase 70 already uses MapLibre GL; prefer staying on it unless the draw plugin story is significantly better on Leaflet.

### Data Sources
- **D-06:** Three sources, each with a distinct ingest path:
  1. **FSA CLU shapefiles** — from Rock County FSA service agency, ESRI shapefile format, bidirectional (import for CLU boundaries, export for final report). Admin-controlled upload (similar to Phase 70 boundary import pattern).
  2. **Glomalin farm registry** — growers → farms → fields, cross-walked to FSA farm#/tract#. Fetched from the existing `farm-registry` Express app via `fetchRegistryService` proxy. This is the cross-walk anchor between FieldView field IDs and FSA farm#/tract#/CLU.
  3. **FieldView API (Climate FieldView)** — as-planted data via OAuth API. Fields to ingest per boundary: geometry (WGS84 polygon), field name, FieldView field ID, crop type, hybrid/variety name, planted acres, plant date (start/end), seeding rate/population, operation/season identifier.

### FieldView API Integration
- **D-07:** FieldView OAuth is NOT yet configured in production (DAT file upload works, but automated API sync is stubbed). Phase 72 includes establishing the live FieldView OAuth connection.
- **D-08:** Cross-walk path: FieldView field ID → Glomalin registry field → FSA farm#/tract#/CLU. Build on the existing `NormalizedCoverageEvent` + `CoverageAdapter` pattern in `/src/lib/fsa/adapters/fieldview.ts`.

### Spatial Reconciliation Engine
- **D-09:** All spatial operations run server-side in PostGIS via Supabase RPC functions:
  - Overlay: `ST_Intersection` (as-planted vs FSA CLU vs field registry)
  - Split: `ST_Split` / `ST_Difference`
  - Merge: `ST_Union`
  - Area: `ST_Area` with Geography cast for accurate acreage in acres
- **D-10:** Client-side map editing (draw new boundary, split, merge) writes geometry back to Supabase via portal API routes. No spatial ops run in the browser.

### Acreage Thresholds (ALL configurable — stored as config values, NOT hardcoded)
- **D-11:** **Green (auto-accept):** delta ≤ ±2% OR ≤ ±0.5ac (whichever is larger) — no flag, auto-finalize permitted.
- **D-12:** **Yellow (review):** delta 2–5% or 0.5–2.0ac — flag for review, reportable as-is but surfaced in UI.
- **D-13:** **Red (must resolve):** delta >5% or >2.0ac, sliver geometry <0.1ac, or planted area falling outside any CLU — blocks auto-finalize until reviewed or manually overridden.
- **D-14:** Reported acres rounded to 0.1ac (RMA convention).

### Manual Editing (Hard Requirement — must work with zero automated inputs)
- **D-15:** Tool opens in a fully functional state even when no FieldView data or FSA files have been imported. Manual-only workflow is a complete, valid operating mode.
- **D-16:** Required manual operations:
  - **Select** — pick any CLU, field, or planted area → assign/edit crop, variety, acres, plant date directly
  - **Split CLU** — draw a line or boundary → `ST_Split` / `ST_Difference` → acres recalculated per piece server-side
  - **Merge CLUs** — select adjacent CLUs/sub-areas → `ST_Union` → single reporting unit
  - **Draw from scratch** — digitize a new boundary by hand when no shapefile exists, or trace over aerial imagery
  - **Manual acreage entry/override** — type acres directly, overrides any calculated figure when geometry can't be trusted
- **D-17:** Edge cases handled explicitly and never blocking: split fields, drowned-out spots, partial plantings, prevent-plant zones, hand-entered acreage. If automated overlay fails for any reason, manual entry path remains open.

### RMA Output Schema (per reporting unit)
- **D-18:** Grower/policyholder, FSA farm#, tract#, CLU/field#, RMA unit number (user-entered), crop code & name, type/variety/practice (irrigated/non-irrigated/organic), intended use, reported acres (0.1ac), plant date, share (grower %), prevent-plant/failed-acre flag, source flag (auto/manual/overridden).

### RMA Unit Numbers
- **D-19:** User enters RMA unit numbers manually — assigned by the AIP/crop insurance agent, not derived by the tool. UI provides an editable field per reporting unit before export.

### Outputs
- **D-20:** **Map view** — overlay of FSA CLU boundaries, as-planted polygons color-coded by crop/variety, manual edits, and discrepancy status indicators (Green/Yellow/Red ring or fill). Labeled by farm#/tract#/field name.
- **D-21:** **Tabular report** — by farm#/tract#/CLU/crop/variety/RMA unit, showing planted ac, CLU ac, and delta. Manually entered/overridden values clearly marked. Formatted for crop insurance submission.
- **D-22:** **Output .shp** — ESRI shapefile format, reconciled units (auto + manual) carrying the full RMA attribute schema, ready to hand to the crop insurance agent. Bidirectional format confirmed with Rock County FSA.

### Design Language
- **D-23:** Design spec being handled in a separate conversation. Researcher/planner defaults to the existing Glomalin portal design system. Design CONTEXT will be provided before implementation begins.

### Claude's Discretion
- Specific draw plugin: MapLibre GL Draw vs Leaflet + Leaflet.draw (researcher evaluates against Phase 70's MapLibre infrastructure)
- PostGIS spatial index strategy (GiST indexes on geometry columns)
- n8n workflow structure vs Vercel cron fallback — whichever the researcher confirms is available
- Supabase schema for reconciliation records table (attribute design beyond the RMA schema minimum)
- FieldView API rate limits and caching strategy for as-planted sync

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 70 Field Map Foundation
- `.planning/phases/70-interactive-field-map/70-CONTEXT.md` — MapLibre GL infrastructure, field_boundaries table, ViewSwitcher, FieldDetailPanel. Phase 72 builds on this map stack.
- `glomalin-portal/src/components/maps/field-map.tsx` — MapLibre GL component, source/layer management, hover/click handlers
- `glomalin-portal/src/components/maps/boundary-import.tsx` — shapefile upload + field matching UI pattern (reuse for FSA CLU import)
- `glomalin-portal/src/app/api/maps/import/route.ts` — server-side shapefile processing (shpjs, GeoJSON conversion, Supabase insert)

### Existing FieldView / Coverage Infrastructure
- `glomalin-portal/src/lib/fsa/adapters/fieldview.ts` — `NormalizedCoverageEvent` schema, `CoverageAdapter` interface. Phase 72 FieldView ingest MUST extend this adapter pattern.
- `glomalin-portal/src/components/fsa/coverage-import-panel.tsx` — existing import UI (CNH FieldOps, FieldView DAT, GeoJSON upload). Reference for import UX.
- `glomalin-portal/src/app/api/fsa/coverage-import/route.ts` — coverage import API, coverage_events table write path
- `glomalin-portal/src/app/api/fsa/fieldview/` — FieldView API routes (status, DAT import, OAuth stub to be activated)

### Compliance Hub (Phase 68 — shell being extended)
- `.planning/phases/68-compliance-hub-redesign/68-CONTEXT.md` — ComplianceShell architecture, tab routing, shared farm/crop filter. Phase 72 replaces Acreage tab content only.
- `glomalin-portal/src/app/(protected)/app/compliance/` — compliance hub shell and tab routing

### Panopticon Vision
- `.planning/FIELD-MAP-VISION.md` — long-term field panopticon. Phase 72 architecture must stay compatible with 3D/time-lapse/layer overlay roadmap.

### Project Context
- `.planning/ROADMAP.md` §Phase 72 — goal, success criteria, dependencies
- `.planning/PROJECT.md` — stack constraints, UX philosophy, farm-registry as field authority

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`field-map.tsx` (MapLibre GL):** Full map rendering stack already in place — satellite basemap, polygon fill/line layers, hover/click handlers, GeoJSON source management. Draw plugin plugs directly into this map instance.
- **`coverage_events` table:** Already has geometry (GeoJSON), operation_type, product, rate, applied_acres, zone_id, source_adapter. The spatial reconciliation records table can extend or join this.
- **`NormalizedCoverageEvent` + `CoverageAdapter`:** Adapter pattern for FieldView ingest already designed. Phase 72 activates the live OAuth path on the existing interface.
- **`FieldDetailPanel`:** Slide-in right panel for per-field data. Reuse or extend for reconciliation unit detail view (crop assignment, acreage, RMA fields, source flag).
- **`BoundaryImport` component:** Shapefile drag-drop upload UI with field matching summary. Directly reusable for FSA CLU shapefile import.
- **`/api/maps/import/route.ts`:** Server-side shapefile → GeoJSON conversion (shpjs), Supabase geometry insert via service role. Extend for FSA CLU import with attribute extraction (farm#, tract#, CLU#).
- **`CROP_COLORS` map-config constant:** Crop-to-color mapping already defined. Reuse for as-planted polygon coloring on reconciliation map.

### Established Patterns
- **Server-side spatial ops via Supabase RPC:** The `import_coverage_event` RPC inserts geometry server-side. Phase 72 adds `reconcile_clu_overlay`, `split_reporting_unit`, `merge_reporting_units` RPCs following the same pattern.
- **Service role for spatial writes:** Admin-level geometry imports use Supabase service role client to bypass RLS. Same pattern for CLU import and reconciliation writes.
- **`fetchRegistryService` proxy:** Portal server components/routes proxy to farm-registry Express app. Never call farm-registry localhost from the browser.
- **Suspense wrapper for `useSearchParams`:** Required for any client component using `useSearchParams()` in Next.js 14 App Router — established in Phase 68 ComplianceShell.
- **ComplianceShell tab routing:** Tabs use `router.replace` with URL param reconstruction. Phase 72 adds no new tabs — it replaces the Acreage tab content component.

### Integration Points
- **`farm-registry` Express app:** Source of grower→farm→field cross-walk (registryFieldId, FSA farm#/tract# mapping). Fetched via `fetchRegistryService`.
- **`/app/compliance/` tab shell (Phase 68):** ComplianceShell receives the Acreage tab as a child component. Phase 72 swaps that child — shell is untouched.
- **PostGIS on Supabase:** Spatial extension already enabled (Phase 70 used it for field_boundaries). Phase 72 adds intersection/split/union functions.

</code_context>

<specifics>
## Specific Ideas

- *"The paper-and-pencil workflow is what we're replacing, so manual capability is a hard requirement, not a nice-to-have."* — Manual editing is a first-class, always-available mode. It cannot be gated behind a successful automated import.
- *"if all else fails — no FieldView data, bad FSA file, weird field — I can still produce a complete, correct report as well as someone working by hand."* — Complete fallback to manual digitizing + manual attribute entry must ship in this phase, not a later one.
- Acreage tolerance thresholds (Green/Yellow/Red values) must be stored as configurable values — admin adjustable without a code deploy.
- Output .shp is ESRI shapefile format — bidirectional confirmed with Rock County FSA service agency.
- n8n runs FieldView sync only (not FSA shapefile processing or any other ingest path).
- FieldView OAuth setup is in scope for this phase — the existing adapter is stubbed and needs live credentials.

</specifics>

<deferred>
## Deferred Ideas

- 3D terrain / panopticon rendering — long-term vision in `.planning/FIELD-MAP-VISION.md`, not Phase 72 scope
- Design language migration (navy/cyan across entire portal) — being handled in a separate design conversation; Phase 72 inherits current portal palette until that spec arrives
- RMA unit number auto-generation from farm#/tract#/CLU hierarchy — deferred; user enters manually for now
- Basemap style toggle, full-screen mode — still deferred from Phase 70

</deferred>

---

*Phase: 72-acreage-reconciliation-tool*
*Context gathered: 2026-06-14*
