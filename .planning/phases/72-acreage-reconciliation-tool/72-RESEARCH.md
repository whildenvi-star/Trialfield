# Phase 72: Acreage Reconciliation Tool - Research

**Researched:** 2026-08-01
**Domain:** PostGIS spatial reconciliation, MapLibre GL draw/edit tooling, ESRI shapefile I/O, FieldView (Climate) OAuth ingestion, Next.js/Supabase portal architecture
**Confidence:** HIGH (existing-codebase findings) / MEDIUM (FieldView live API behavior, n8n absence) / LOW (RMA unit-number/share-percent schema completeness — flagged for user confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replaces/extends the existing Acreage tab in `/app/compliance`. No new top-level nav entry — the Phase 68 ComplianceShell, tab routing, and shared farm/crop filter remain unchanged. Only the Acreage tab content is replaced.
- **D-02:** One phase, multiple plans (estimated 4–6 sequential plans). Automated path and manual editor ship together — manual capability is not a stretch goal.
- **D-03:** Next.js 14 App Router (existing portal), Supabase + PostGIS for all spatial operations, Vercel hosting.
- **D-04:** n8n for FieldView sync scheduling only — nightly or on-demand pull from FieldView API → Supabase `coverage_events` table. Researcher to confirm n8n availability on VPS droplet; Vercel cron is the fallback if n8n is not available.
- **D-05:** Map library: MapLibre GL or Leaflet + draw plugin — researcher picks based on Phase 70's MapLibre GL infrastructure and available draw/edit plugin ecosystem. Phase 70 already uses MapLibre GL; prefer staying on it unless the draw plugin story is significantly better on Leaflet.
- **D-06:** Three sources, each with a distinct ingest path: (1) FSA CLU shapefiles — Rock County FSA, ESRI shapefile, bidirectional, admin-controlled upload similar to Phase 70 boundary import; (2) Glomalin farm registry — growers→farms→fields cross-walked to FSA farm#/tract#, fetched via `fetchRegistryService`; (3) FieldView API — as-planted geometry, field name, FieldView field ID, crop type, hybrid/variety, planted acres, plant date, seeding rate, operation/season ID.
- **D-07:** FieldView OAuth is NOT yet configured in production (DAT file upload works, automated API sync is stubbed). Phase 72 includes establishing the live FieldView OAuth connection.
- **D-08:** Cross-walk path: FieldView field ID → Glomalin registry field → FSA farm#/tract#/CLU. Build on existing `NormalizedCoverageEvent` + `CoverageAdapter` pattern.
- **D-09:** All spatial operations run server-side in PostGIS via Supabase RPC functions: Overlay `ST_Intersection`, Split `ST_Split`/`ST_Difference`, Merge `ST_Union`, Area `ST_Area` with Geography cast.
- **D-10:** Client-side map editing writes geometry back to Supabase via portal API routes. No spatial ops run in the browser.
- **D-11/D-12/D-13/D-14 (Acreage Thresholds — ALL configurable, NOT hardcoded):** Green (auto-accept) delta ≤±2% OR ≤±0.5ac (whichever larger), no flag; Yellow (review) delta 2–5% or 0.5–2.0ac, flagged but reportable; Red (must resolve) delta >5% or >2.0ac, sliver geometry <0.1ac, or planted area outside any CLU — blocks auto-finalize; reported acres rounded to 0.1ac (RMA convention).
- **D-15:** Tool opens in fully functional state with zero automated inputs. Manual-only workflow is a complete, valid operating mode.
- **D-16:** Required manual operations: Select (pick CLU/field/planted area → edit crop/variety/acres/date), Split CLU (`ST_Split`/`ST_Difference`), Merge CLUs (`ST_Union`), Draw from scratch (digitize new boundary), Manual acreage entry/override.
- **D-17:** Edge cases (split fields, drowned-out spots, partial plantings, prevent-plant zones, hand-entered acreage) handled explicitly, never blocking. Manual entry path always open if automated overlay fails.
- **D-18 (RMA Output Schema):** Grower/policyholder, FSA farm#, tract#, CLU/field#, RMA unit number (user-entered), crop code & name, type/variety/practice, intended use, reported acres (0.1ac), plant date, share (grower %), prevent-plant/failed-acre flag, source flag (auto/manual/overridden).
- **D-19:** User enters RMA unit numbers manually — not derived by the tool. Editable field per reporting unit before export.
- **D-20 (Map view):** FSA CLU boundaries + as-planted polygons color-coded by crop/variety + manual edits + discrepancy status (Green/Yellow/Red) + labels by farm#/tract#/field name.
- **D-21 (Tabular report):** By farm#/tract#/CLU/crop/variety/RMA unit — planted ac, CLU ac, delta. Manual/overridden values clearly marked. Formatted for crop insurance submission.
- **D-22 (Output .shp):** ESRI shapefile, reconciled units (auto + manual) carrying full RMA attribute schema, bidirectional format confirmed with Rock County FSA.
- **D-23:** Design spec handled separately. Default to existing Glomalin portal design system until design CONTEXT arrives.

### Claude's Discretion

- Specific draw plugin: MapLibre GL Draw vs Leaflet + Leaflet.draw (researcher evaluates against Phase 70's MapLibre infrastructure)
- PostGIS spatial index strategy (GiST indexes on geometry columns)
- n8n workflow structure vs Vercel cron fallback — whichever the researcher confirms is available
- Supabase schema for reconciliation records table (attribute design beyond the RMA schema minimum)
- FieldView API rate limits and caching strategy for as-planted sync

### Deferred Ideas (OUT OF SCOPE)

- 3D terrain / panopticon rendering — long-term vision in `.planning/FIELD-MAP-VISION.md`
- Design language migration (navy/cyan across entire portal) — separate design conversation; Phase 72 inherits current portal palette
- RMA unit number auto-generation from farm#/tract#/CLU hierarchy — deferred; user enters manually
- Basemap style toggle, full-screen mode — deferred from Phase 70 (**NOTE:** fullscreen toggle has since shipped ad hoc in `overlay-map.tsx` — see Pitfalls)

</user_constraints>

<phase_requirements>
## Phase Requirements

No `.planning/REQUIREMENTS.md` file exists in this project (it does not use a global requirements doc — confirmed by directory listing). The only source of the ACR-01..06 IDs is `.planning/ROADMAP.md` §Phase 72, which lists the IDs without individual descriptions — only the phase-level Success Criteria (6 items) are documented. This research maps requirement IDs to success criteria 1:1 by position, which is the project's established convention for phases with unexpanded requirement lists (verified: no other phase in ROADMAP.md at this position has an expanded per-ID requirements table). **The planner should treat ACR-01..06 as shorthand for Success Criteria 1–6 below; if the planner has separate access to per-ID text it should take precedence.**

| ID | Description (inferred from Success Criteria) | Research Support |
|----|-------------|------------------|
| ACR-01 | FSA CLU shapefiles, Glomalin farm registry, and FieldView as-planted data are ingested and cross-walked | See "Existing Infrastructure" and "Gap Analysis" below — registry + CLU boundary storage exist; **shapefile admin-upload UI for `clu_boundaries` does not exist yet** (genuine gap); FieldView OAuth is fully coded but uses empty credentials (external dependency, not a code gap) |
| ACR-02 | PostGIS `ST_Intersection` overlay produces per-CLU/crop reconciliation records with Green/Yellow/Red flags | `get_farm_reconciliation()` RPC (migration 012) already does CLU×zone `ST_Intersection`; **does not yet fold in `coverage_events` (as-planted)** into the farm-level reconciliation RPC — only the per-CLU `get_clu_overlay_intersections()` (migration 033) does a 3-way CLU∩zone∩coverage overlay. Thresholds are hardcoded (0.1ac/1.0ac flat), not the %+ac configurable Green/Yellow/Red in D-11–14 |
| ACR-03 | User can split a CLU, merge CLUs, draw a new boundary, and override acreage manually with zero automated data loaded | Split + draw-snip + manual override **already built and shipped** (migrations 032/033/036, `overlay-map.tsx`, `split-panel.tsx`). **Merge is NOT implemented anywhere** (no `ST_Union` RPC, no merge UI) — genuine gap. "Draw from scratch" (a CLU with no boundary at all) is not explicitly supported by the split/snip tools, which require an existing `clu_boundaries` row to snip against |
| ACR-04 | Map view shows FSA CLU boundaries + as-planted polygons + crop colors + discrepancy flags + farm#/tract#/field labels | `reporting-map.tsx`, `overlay-map.tsx`, `reconciliation-map.tsx` all exist and cover most of this already; discrepancy-flag coloring must be reconciled against D-11–14's configurable thresholds (see ACR-02) |
| ACR-05 | Tabular report exports by farm#/tract#/CLU/crop/RMA unit with planted ac, CLU ac, delta, source flag | `reconciliation-table.tsx` + `ReconciliationView` already built (orphaned — not wired into the live Acreage tab). `clu_records.unit_number` already exists (RMA unit #). CSV/PDF export already exist (`export-578`, `acreage-pdf.tsx`, `form-578-pdf.tsx`) |
| ACR-06 | Output .shp carries full RMA attribute schema, ready for the crop insurance agent | `export-shapefile` route (hand-rolled SHP/SHX/DBF/PRJ writer) already works and is production-tested. **Missing DBF fields for the full RMA schema:** grower/policyholder name, share %, RMA unit number, prevent-plant vs failed-acre distinction (only `prevented_planting` boolean exists) |

</phase_requirements>

## Summary

**This phase is NOT greenfield.** A substantial, production-deployed "FSA-578 reconciliation" system already exists inside `glomalin-portal` at `/app/compliance` → Acreage tab, built across Phase 27 (FSA Data Foundation Migration), Phase 28 (FSA Planting Workflow UI), Phase 51 (FSA/Insurance Data Consolidation), and several un-phased feature commits (`63ccb36`, `d4d67c9`, `a14ebfd`, etc.). It implements almost the entire three-source/PostGIS/manual-edit/export architecture the CONTEXT.md describes — under different names and with some pieces unwired. CONTEXT.md's canonical_refs section does not mention any of this, which strongly suggests the context-gathering session did not discover it. **The single most important finding of this research is: read this codebase before planning, or the plan will re-invent (and likely diverge from) working, tested code.**

The existing system is a "three-layer spatial model" (migration 010): `clu_boundaries` (raw FSA import, admin-write, currently populated by an out-of-band process — no import UI exists), `management_zones` + `zone_year_attributes` (persistent user-managed sub-field polygons with per-crop-year crop/organic/irrigated attributes — this is effectively the "Glomalin registry crosswalk + manual override" layer), and `coverage_events` (as-applied/as-planted geometry from CNH FieldOps, GeoJSON upload, FieldView DAT import, or live FieldView OAuth — this is the "FieldView as-planted" layer already implemented per the `CoverageAdapter` interface). A parallel `clu_records` table carries per-CLU-per-year reporting attributes (crop, irrigated, organic, `unit_number`, `policy_number`, `aph`, `intended_use`, `prevented_planting`, `reported`) plus (as of migrations 032/036) sub-CLU splitting (`sub_label`, `split_geometry`, `parent_clu_id`, `superseded`).

Already shipped and working: CLU split via drawn polygon or via zone/coverage intersections (`create_clu_split` RPC, `ST_Split`/`ST_Difference` equivalent via `ST_Intersection`/`ST_Difference`), a Venn-style overlay view (`get_clu_overlay_intersections`, CLU∩zone∩coverage triple intersection), a snip preview RPC (`preview_clu_snip`), a hand-rolled ESRI shapefile writer (SHP/SHX/DBF/PRJ, zipped) that is production-tested, a MapLibre GL draw tool using `@mapbox/mapbox-gl-draw` (already installed, `^1.5.1`, proven compatible with `maplibre-gl ^5.23.0`), FieldView OAuth routes (connect/callback/status/dat-import) fully coded but running against **empty** `FIELDVIEW_CLIENT_ID`/`FIELDVIEW_CLIENT_SECRET`/`FIELDVIEW_API_KEY` env vars, and an entire orphaned `ReconciliationView`/`ReconciliationMap`/`ReconciliationTable`/`Form578Button` component set that is not imported anywhere in the live Acreage tab (`acreage-tab.tsx` only wires `map`/`clu`/`zones`/`overlay`/`coverage` views).

**Genuine gaps** (i.e., real Phase 72 work, not already done): (1) no CLU **merge** capability (`ST_Union`) anywhere — split exists, merge does not; (2) no admin UI to **import FSA CLU shapefiles** into `clu_boundaries` (the table is currently populated out-of-band); (3) discrepancy thresholds are hardcoded flat-acre values (0.1/1.0ac) in two places (`lib/fsa/calc.ts` and `lib/fsa/reconciliation.ts`, which duplicate each other) — none of them implement the configurable %+ac Green/Yellow/Red scheme from D-11–14, and none are admin-editable; (4) the farm-level reconciliation RPC only compares CLU×zone, not CLU×as-planted-coverage — the true "FieldView as-planted vs FSA CLU" comparison currently only exists at the single-CLU overlay level, not the farm-wide report; (5) FieldView OAuth needs real credentials, which is an external registration step with Bayer/Climate, not a code task; (6) the RMA output schema is missing grower/policyholder name, share %, and a genuine prevented-planting vs failed-acreage distinction; (7) "draw a new boundary from scratch" (no existing FSA CLU at all) is not supported by the current split/snip tools, which require an existing `clu_boundaries` row to snip against.

**Primary recommendation:** Treat Phase 72 as an **extend-and-fill-gaps** phase, not a rebuild. Plan 1 should be a mandatory "audit and wire" pass: promote the orphaned `ReconciliationView` (or a redesigned successor) into the Acreage tab as a new `reconciliation` view alongside the existing five, replace the two duplicate hardcoded-threshold implementations with one configurable threshold engine reading from a new `acreage_thresholds` config table, and build the missing FSA CLU shapefile import UI (reusing the Phase 70 `BoundaryImport` pattern). Subsequent plans add: `merge_reporting_units` RPC + UI, extend `get_farm_reconciliation` (or add a new RPC) to include `coverage_events`, extend the RMA/DBF schema with the missing fields, add a "draw new CLU from scratch" path, and wire live FieldView OAuth (gated behind a `checkpoint:human-verify` for credential registration).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FSA CLU shapefile import (parse .shp/.dbf → GeoJSON) | API / Backend (Next.js route, Node runtime) | — | `shpjs` requires Node; existing `/api/maps/import/route.ts` pattern (Phase 70) already does this for field boundaries — same approach for `clu_boundaries` |
| Farm registry crosswalk (grower→farm→field→FSA farm#/tract#) | API / Backend | Database | `fetchRegistryService` proxy is server-only (never call farm-registry from browser); crosswalk is stored on `clu_records.registry_field_id`/`registry_crop_id` |
| FieldView OAuth token exchange + refresh | API / Backend | Database (Supabase, `fieldview_tokens`) | Per-user OAuth tokens must never reach the browser; token refresh happens server-side before each sync |
| FieldView nightly/on-demand sync scheduling | Scheduler (Vercel Cron — n8n unavailable, see Environment Availability) | API / Backend | n8n is not present on the droplet (confirmed absence in `ecosystem.config.js`); Vercel Cron hitting a portal API route is the only available scheduler |
| Spatial overlay (`ST_Intersection`, `ST_Split`, `ST_Union`, `ST_Area`) | Database (PostGIS via Supabase RPC, `SECURITY DEFINER`) | — | D-09 locks this; consistent with all 15+ existing FSA RPCs, which never do spatial math client-side |
| Draw/edit/split/merge interaction (drawing polygons, clicking CLUs) | Browser / Client (MapLibre GL + `@mapbox/mapbox-gl-draw`) | Frontend Server (Next.js SSR shell) | Draw state is ephemeral UI state; the resulting GeoJSON is POSTed to an API route which calls the PostGIS RPC — no geometry math in the browser (D-10) |
| Threshold evaluation (Green/Yellow/Red) | Database (RPC, computed alongside delta) OR API route (post-fetch, config-driven) | — | Currently split between two client-adjacent TS files (`calc.ts`, `reconciliation.ts`) with hardcoded values — should move to a single source read from a new config table, either evaluated in SQL or in one shared TS module fed by that table |
| Tabular report rendering | Frontend Server / Client (React table) | — | `reconciliation-table.tsx` already renders this; needs threshold-engine wiring |
| Shapefile export (.shp/.shx/.dbf/.prj) | API / Backend (Node runtime, `JSZip`) | — | Hand-rolled binary writer in `export-shapefile/route.ts`; must run server-side (Buffer, binary I/O) |
| RMA unit number entry, manual acreage override | Browser / Client (form input) → API / Backend (validation, write) | Database | User-entered, never derived (D-19); still must be validated server-side before write |

## Existing Infrastructure (read before planning)

This section exists because CONTEXT.md's `canonical_refs` did not surface any of it. All paths are relative to `glomalin-portal/`.

### Database (Supabase/PostGIS) — `supabase/migrations/`
| Migration | What it built |
|---|---|
| `010_management_zones.sql` | Three-layer model: `management_zones`, `zone_year_attributes`, `clu_boundaries`, `coverage_events`, `practice_ledger`, `rotation_rules`. All geometry columns are `geometry(Polygon, 4326)` — **not MultiPolygon** (see Pitfalls). |
| `011_zones_geo_view.sql` | `seed_zones_from_clus()` — backfills `management_zones` from `clu_records` + `clu_boundaries`. |
| `012_reconciliation_rpc.sql` | `get_farm_reconciliation(farm, year)` — CLU × zone `ST_Intersection`, geography-cast acres. **CLU × coverage_events not included.** |
| `013_coverage_import_rpc.sql` | `import_coverage_event` RPC — server-side geometry insert for as-applied/as-planted data. |
| `016_export_shapefile_rpc.sql`, `033_...` (updated) | `export_clu_shapefile_rows()` — feeds the hand-rolled shapefile writer. |
| `017_link_clus_to_zones.sql`, `018_zone_rpc_with_registry.sql` | Zone↔CLU linking via `ST_Intersects` with `ST_MakeValid` guards (needed for messy shapefile topology). |
| `022_detect_clu_anomalies.sql`, updated in `032` | `detect_clu_split_candidates()` — CLUs overlapping 2+ zones with conflicting crop/organic attributes. |
| `023_fieldview_tokens.sql` | Per-user OAuth token table, RLS-scoped to `auth.uid()`. |
| `024_clu_records_schema.sql` | Canonical `clu_records` definition (the "reporting unit" table). |
| `032_clu_split_support.sql`, `036_split_intended_use.sql` | `create_clu_split()` RPC — draws a sub-polygon, validates it intersects the parent CLU boundary, computes acres via geography cast, inserts a child `clu_records` row with `sub_label`/`split_geometry`/`parent_clu_id`; marks parent `superseded`. Partial unique indexes handle the parent/child coexistence. |
| `033_clu_overlay_intersections.sql` | `get_clu_overlay_intersections(clu_record_id)` — returns CLU/zone/coverage/triple-intersection GeoJSON Feature layers for the Venn overlay UI. `preview_clu_snip()` — read-only `ST_Intersection`/`ST_Difference` preview for a user-drawn polygon. |
| **No migration creates a merge RPC.** | Confirmed via full-text search — `ST_Union` does not appear anywhere in `supabase/migrations/`. |

### API routes — `src/app/api/fsa/`
`clu-records/` (CRUD + `bulk-update`), `clu-records/[id]/overlay`, `clu-records/[id]/split`, `clu-records/[id]/split-preview`, `clu-anomalies`, `clu-summary`, `reconciliation`, `reporting-map`, `validation`, `auto-populate-preview`, `crop-choices`, `export-578` (CSV), `export-shapefile` (.zip), `coverage-import`, `zones/`, `zones/[id]`, `zones/link`, `zones/seed`, `webhook/field-created` (farm-registry → CLU placeholder sync), `fieldview/connect|callback|status|dat-import`.

### Components — `src/components/fsa/`
`clu-workspace.tsx` (accordion CRUD + CSV/PDF/shapefile export), `farm-accordion.tsx`, `tract-accordion.tsx`, `clu-card.tsx`, `bulk-action-bar.tsx`, `auto-populate-panel.tsx`, `zone-setup-panel.tsx`, `coverage-import-panel.tsx`, `reporting-map.tsx` + `reporting-clu-panel.tsx` + `map-batch-edit-bar.tsx` (the current default "Map View"), `overlay-map.tsx` + `split-panel.tsx` (the Venn overlay + split workflow, uses `@mapbox/mapbox-gl-draw`), **`reconciliation-view.tsx` + `reconciliation-map.tsx` + `reconciliation-table.tsx` + `form-578-button.tsx`/`form-578-pdf.tsx` (ORPHANED — fully built, not imported by `acreage-tab.tsx` or any page)**, `acreage-pdf.tsx`/`acreage-pdf-button.tsx`, `crop-typeahead.tsx`, `confirm-dialog.tsx`.

### Lib — `src/lib/fsa/`
`calc.ts` (CluRecord type, `reconciliationStatus()`/`attributeCause()` — hardcoded 0.1/1.0ac thresholds), `reconciliation.ts` (**duplicate** `deltaStatus()`/`deltaCause()` logic with the same hardcoded thresholds, plus `groupRpcRows()`/feature-collection builders consumed by the orphaned `ReconciliationView`), `shapefile.ts`, `fsa-crop-list.ts`, `adapters/fieldview.ts` (`CoverageAdapter` interface, `FieldOpsAdapter`, `normalizeGeoJsonCollection`, `createFieldViewAdapter` — the FieldView adapter is fully implemented against `/v4/asApplied`, `/v4/asPlanted`, `/v4/asHarvested`), `parsers/fieldview-dat.ts` (manual DAT ZIP import parser).

### Currently wired Acreage tab (`src/components/compliance/acreage-tab.tsx`)
Five views: `map` (default, `ReportingMap`), `clu` (`CluWorkspace`), `zones` (`ZoneSetupPanel`), `overlay` (`OverlayMap`, split workflow), `coverage` (`CoverageImportPanel`). **No `reconciliation` view tab exists yet** — this is the most direct home for wiring in the orphaned `ReconciliationView`.

## Standard Stack

No new external packages are required for this phase — every capability CONTEXT.md describes already has a working, installed dependency in `glomalin-portal/package.json`. This significantly reduces the Package Legitimacy Audit surface (see below).

### Core (already installed, verified current via `npm view`)
| Library | Installed | Latest (npm view, 2026-08-01) | Purpose | Why Standard |
|---------|-----------|-------------------------------|---------|--------------|
| `maplibre-gl` | ^5.23.0 | 6.1.0 [VERIFIED: npm registry] | Map rendering | Phase 70 foundation; open-source Mapbox GL JS fork, no token required |
| `@mapbox/mapbox-gl-draw` | ^1.5.1 | 1.5.1 [VERIFIED: npm registry] | Draw/edit polygon UI, already proven against this exact MapLibre version in `overlay-map.tsx` | Answers CONTEXT.md's open question #1 conclusively — already integrated and working |
| `@types/mapbox__mapbox-gl-draw` | ^1.4.9 | current | Types for the above | — |
| `jszip` | ^3.10.1 | 3.10.1 [VERIFIED: npm registry] | Zips SHP/SHX/DBF/PRJ for shapefile export/import | Already used for both export (`export-shapefile`) and DAT import (`fieldview/dat-import`) |
| `shpjs` | ^6.2.0 | current | Parses uploaded `.shp` ZIP → GeoJSON | Already used in `/api/maps/import/route.ts` (Phase 70); ESM import path required in Next.js server routes (see Phase 70 decision log) |
| `react-dropzone` | ^15.0.0 | current | Drag-drop file upload UI | Already used in Phase 70's `BoundaryImport`; reuse for FSA CLU shapefile import |
| `@react-pdf/renderer` | ^4.3.2 | current | Client-side PDF generation (`acreage-pdf.tsx`, `form-578-pdf.tsx`) | Must be `dynamic(..., { ssr: false })` — established pattern, crashes App Router SSR otherwise |
| `@supabase/supabase-js` | ^2.98.0 | current | Supabase client + RPC calls | — |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| PostGIS (Supabase-managed extension) | All spatial math | Already enabled — confirmed by 15+ migrations already running `ST_Intersection`/`ST_Area`/`ST_MakeValid`/GiST indexes |
| Vercel Cron (`vercel.json` `crons[]`) | FieldView nightly sync scheduling | n8n confirmed unavailable — see Environment Availability |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled SHP/SHX/DBF writer (already exists) | `@mapbox/shp-write` or `shp-write` npm packages | The hand-rolled writer is already production-tested, handles the project's exact DBF 10-char-field convention, and needs zero new dependency. Do NOT introduce a new shapefile-write library — extend the existing `buildDbf`/`buildShpAndShx` functions in `export-shapefile/route.ts` with the additional RMA fields instead. |
| `@mapbox/mapbox-gl-draw` | `terra-draw`, `maplibre-gl-draw` (community forks) | Not needed — the installed `mapbox-gl-draw` already works against `maplibre-gl` in this codebase (dynamic import + CSS import pattern in `overlay-map.tsx` lines 260–314), including a graceful fallback message if the draw control ever fails to attach. No migration required. |
| n8n | Vercel Cron | n8n is not deployed anywhere in this project's infra (confirmed absent from `ecosystem.config.js`, no docker-compose, no reference in any deploy doc) — use the Vercel Cron fallback D-04 already anticipates. |

**Installation:** None required — no new packages.

## Package Legitimacy Audit

No external packages are being newly installed in this phase (all required libraries — `maplibre-gl`, `@mapbox/mapbox-gl-draw`, `jszip`, `shpjs`, `react-dropzone`, `@react-pdf/renderer` — are already present in `glomalin-portal/package.json` and have been running in production across multiple prior phases). The Package Legitimacy Gate protocol is scoped to packages being newly introduced; there are none here, so the full slopcheck/registry-verification table is not applicable.

**If the planner introduces any new package during planning** (e.g., a config-management helper, a dedicated threshold-rules engine), it must go through the full gate at that time and be tagged `[ASSUMED]` pending verification.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INGEST (3 sources, distinct paths — D-06)                                │
│                                                                            │
│  FSA CLU shapefile (.zip)        Glomalin farm-registry        FieldView │
│  admin upload (NEW — gap)        (existing: fetchRegistryService)  OAuth │
│         │                                 │                (existing,   │
│         ▼                                 ▼                stub creds) │
│  shpjs → GeoJSON            registry_field_id / registry_crop_id    │
│         │                    written onto clu_records / zones        │
│         ▼                                 │                    │       │
│  clu_boundaries (PostGIS)  ◄───────────────┘                    ▼       │
│                                                     coverage_events      │
│                                                     (existing: DAT/API)  │
└──────────────────────┬─────────────────────────────────────┬────────────┘
                        │                                     │
                        ▼                                     ▼
        ┌───────────────────────────────────────────────────────────┐
        │  RECONCILE (PostGIS RPCs, server-side — D-09)               │
        │                                                              │
        │  get_farm_reconciliation()  — CLU × zone (existing)          │
        │  [GAP] extend to fold in coverage_events (as-planted)        │
        │  get_clu_overlay_intersections() — CLU∩zone∩coverage (exists)│
        │  [NEW] threshold engine — config-driven Green/Yellow/Red     │
        └───────────────────────┬──────────────────────────────────────┘
                                 ▼
        ┌───────────────────────────────────────────────────────────┐
        │  MANUAL EDIT (D-16 — hard requirement, works standalone)    │
        │                                                              │
        │  create_clu_split()   — exists (ST_Split-equivalent)         │
        │  preview_clu_snip()   — exists (draw-and-snip preview)       │
        │  [GAP] merge_reporting_units()  — ST_Union, does not exist   │
        │  [GAP] draw-new-boundary-from-scratch (no parent CLU needed) │
        │  manual acreage override — exists (clu_records direct edit)  │
        └───────────────────────┬──────────────────────────────────────┘
                                 ▼
        ┌───────────────────────────────────────────────────────────┐
        │  OUTPUT (3 formats — D-20/21/22)                            │
        │                                                              │
        │  Map view      — reporting-map.tsx / overlay-map.tsx exist   │
        │  [NEW] wire orphaned reconciliation-view.tsx as 6th tab      │
        │  Tabular report — reconciliation-table.tsx exists (orphaned) │
        │  Output .shp   — export-shapefile/route.ts exists            │
        │  [GAP] add RMA fields: grower, share%, unit#, prevent-plant  │
        └─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (extend, do not restructure)
```
glomalin-portal/src/
├── components/compliance/acreage-tab.tsx     # add 'reconciliation' as 6th view; wire ReconciliationView
├── components/fsa/
│   ├── reconciliation-view.tsx                # PROMOTE from orphaned → wired; extend for D-11-14 thresholds
│   ├── merge-panel.tsx                        # NEW — mirrors split-panel.tsx UX for ST_Union merge
│   ├── clu-boundary-import.tsx                # NEW — mirrors maps/boundary-import.tsx for FSA CLU shapefiles
│   └── ...(existing files unchanged)
├── lib/fsa/
│   ├── thresholds.ts                          # NEW — single source for Green/Yellow/Red, reads config table
│   └── reconciliation.ts, calc.ts             # DEDUPLICATE — retire one of the two parallel status implementations
└── app/api/fsa/
    ├── clu-boundaries/import/route.ts         # NEW — shpjs parse → clu_boundaries insert (admin, service role)
    ├── clu-records/merge/route.ts              # NEW — calls merge_reporting_units RPC
    └── admin/acreage-thresholds/route.ts       # NEW — CRUD for configurable threshold values
```

### Pattern 1: Server-side spatial RPC with `SECURITY DEFINER`
**What:** Every spatial mutation (split, snip preview, overlay, export) is a Postgres function marked `SECURITY DEFINER`, called via `supabase.rpc(...)` from a Next.js API route using the service-role or authenticated client.
**When to use:** Any new merge/threshold/import RPC in this phase must follow this exact pattern — do not compute geometry in TypeScript.
**Example:**
```sql
-- Source: glomalin-portal/supabase/migrations/032_clu_split_support.sql (existing, proven pattern)
CREATE OR REPLACE FUNCTION create_clu_split(
  p_parent_id uuid, p_sub_label text, p_geojson text, ...
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE split_geom geometry(Polygon, 4326); split_ac numeric(10,2);
BEGIN
  split_geom := ST_GeomFromGeoJSON(p_geojson);
  IF NOT EXISTS (SELECT 1 FROM clu_boundaries cb WHERE ... AND ST_Intersects(cb.geometry, split_geom)) THEN
    RAISE EXCEPTION 'Split geometry does not intersect CLU boundary...';
  END IF;
  split_ac := ROUND(CAST(ST_Area(split_geom::geography) / 4046.856422 AS numeric), 2);
  INSERT INTO clu_records (...) VALUES (...) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
```
A `merge_reporting_units(p_ids uuid[], p_crop text, ...)` RPC in this phase should mirror this shape: validate all input IDs exist and are not `superseded`, compute `ST_Union(geom1, geom2, ...)` (or `ST_Union(ST_Collect(...))` for >2), insert one new child row referencing all parents (may need a `merged_from_ids uuid[]` column, or reuse `parent_clu_id` as an array — a schema decision for the planner), mark all parents `superseded`.

### Pattern 2: Draw tool wiring on MapLibre GL
**What:** Dynamic-import `@mapbox/mapbox-gl-draw` + its CSS only in the browser, attach as a MapLibre `IControl`, listen for `draw.create`.
**Example (already working — reuse verbatim):**
```typescript
// Source: glomalin-portal/src/components/fsa/overlay-map.tsx lines 260-314
const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
// @ts-expect-error — no type declarations for the CSS sub-path
await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css')
const draw = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true }, styles: [...] })
// @ts-expect-error — IControl compatibility
map.addControl(draw)
draw.changeMode('draw_polygon')
map.on('draw.create', handleDrawCreate)
```
This same pattern, generalized, supports "draw from scratch" (D-16) — the only new logic needed is a target RPC that inserts a brand-new `clu_records`/`management_zones` row with no `parent_clu_id`, rather than requiring an existing CLU to snip against.

### Pattern 3: Configurable threshold evaluation (NEW — does not exist yet)
**What:** D-11–14 requires Green/Yellow/Red to be admin-configurable, not hardcoded. Currently `deltaStatus()` (reconciliation.ts) and `reconciliationStatus()` (calc.ts) both hardcode `0.1`/`1.0` absolute-acre cutoffs and ignore percentage entirely.
**Recommended:** A small `acreage_thresholds` config table (`green_pct`, `green_ac`, `yellow_pct`, `yellow_ac`, `red_sliver_ac`, `crop_year` or global) + one shared `evaluateThreshold(delta, fsaAcres, config)` function (SQL function or single TS module — planner's call) implementing:
```
abs_delta = |delta|
pct_delta = abs_delta / fsa_acres * 100
if abs_delta <= max(green_ac, fsa_acres * green_pct / 100): GREEN
else if abs_delta <= max(yellow_ac, fsa_acres * yellow_pct / 100)
     or (pct_delta between green_pct and yellow_pct): YELLOW
else: RED  -- also RED if sliver geometry < red_sliver_ac or planted area outside all CLUs
```
This function should replace both existing duplicate implementations (retire one) rather than adding a third parallel one.

### Anti-Patterns to Avoid
- **Building a new shapefile-writer library dependency:** the existing hand-rolled writer already works and matches this project's exact DBF field-naming convention (`FARM_NBR`, `TRACT_NBR`, etc., all ≤10 chars). Extend it in place.
- **Re-implementing the draw tool on Leaflet:** MapLibre + `mapbox-gl-draw` is already proven in this exact codebase; switching libraries now would be pure regression risk with no capability gain.
- **Adding a third parallel threshold/status implementation:** `calc.ts` and `reconciliation.ts` already duplicate `deltaStatus`/`reconciliationStatus`. Don't add a fourth — collapse to one config-driven source.
- **Computing acreage deltas in TypeScript from raw geometry:** always let PostGIS do `ST_Area(geom::geography)` server-side (see D-09); TypeScript should only format/round already-computed values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ESRI shapefile binary format (.shp/.shx/.dbf headers) | A new library integration (`shp-write`, GDAL bindings) | The existing hand-rolled writer in `export-shapefile/route.ts` | Already correctly implements SHP record headers, SHX index, DBF field descriptors with the 10-char name limit, and dBASE III date stamps. It is the *only* thing in this domain that should NOT be replaced — it is bespoke code that is already correct and tested against Rock County FSA / QGIS / ArcGIS / SMS Advanced (per the file's own doc comment). |
| Polygon draw/edit UI on a WebGL map | Hand-rolled canvas click-handlers for point collection | `@mapbox/mapbox-gl-draw` (already installed and wired) | Vertex snapping, undo, multi-ring polygons, and mode management are all solved problems; the project already has this working. |
| OAuth2 authorization-code flow + token refresh | A custom cookie-based CSRF/state implementation from scratch | The existing `fieldview/connect` + `callback` pattern (state nonce in httpOnly cookie, 60s TTL) | Already implements CSRF-safe state validation correctly; extend, don't replace. |
| Spatial area computation in a projected CRS | Manual haversine/geodesic math in JS | `ST_Area(geom::geography)` (PostGIS geography cast) | Already the project-wide convention (`/ 4046.856422` to convert m² → acres) — every existing RPC uses this exact divisor; any new RPC must match it exactly for consistency across the app. |

**Key insight:** Because this domain already has ~2 years of iteration behind it in this exact codebase, the highest-risk "hand-roll" mistake in Phase 72 is not building custom spatial math — it's **re-inventing components that already exist under different names** (e.g., building a new "reconciliation table" when `reconciliation-table.tsx` already exists, just unwired).

## Common Pitfalls

### Pitfall 1: Building Phase 72 as if the FSA/CLU system doesn't exist
**What goes wrong:** A plan written purely from CONTEXT.md (which didn't discover this codebase) would create duplicate tables, duplicate RPCs, and a duplicate "Acreage tab" experience — likely breaking the existing, working `clu-records` CRUD, split, and export flows that Randy currently depends on for FSA-578 filing.
**Why it happens:** CONTEXT.md's `canonical_refs` section cites only Phase 70 (map) and the FieldView adapter stub, not the FSA-578 system built in Phases 27/28/51 and later commits.
**How to avoid:** Every plan for this phase must start by reading `glomalin-portal/src/components/fsa/`, `src/app/api/fsa/`, and `supabase/migrations/010–036` before writing new code.
**Warning signs:** A plan proposing a new `reconciliation_records` table, a new shapefile-export library, or a new split/merge UI without referencing the existing `clu_records`/`create_clu_split`/`overlay-map.tsx`.

### Pitfall 2: Polygon-only geometry columns silently rejecting MultiPolygon shapefile features
**What goes wrong:** `clu_boundaries.geometry`, `management_zones.geometry`, and `coverage_events.geometry` are all declared `geometry(Polygon, 4326)` — not `MultiPolygon`. A CLU shapefile import route (the genuine new build in this phase) that hands `shpjs` output directly to `ST_GeomFromGeoJSON` will throw a type-mismatch error for any real-world multi-part parcel (common with FSA CLUs split by roads/waterways).
**Why it happens:** The original schema assumed single-ring polygons; most Rock County CLUs happen to be single Polygons so this hasn't surfaced yet.
**How to avoid:** New import code should either widen the affected column(s) to `geometry(MultiPolygon, 4326)` (matching the pattern already used in `015_widen_zone_geometry.sql` and `019_widen_coverage_geometry.sql`, which did exactly this for other tables) or explicitly `ST_Multi()`/dissolve multi-part features to single Polygons at import time, and validate before insert.
**Warning signs:** `ERROR: Geometry type (MultiPolygon) does not match column type (Polygon)` at import time.

### Pitfall 3: Three different, non-interoperable "status/color" systems already exist
**What goes wrong:** (1) `reporting-map.tsx`'s `deriveStatus()` — orange/yellow/green based on **workflow completion** (no crop / crop assigned / reported), not acreage discrepancy; (2) `calc.ts`/`reconciliation.ts`'s `ok`/`flagged`/`unresolved` — hardcoded flat-acre discrepancy thresholds (0.1ac/1.0ac); (3) D-11–14's new Green/Yellow/Red — %+ac configurable discrepancy thresholds. A plan that conflates these (e.g., reuses `reporting-map`'s color logic to satisfy D-20's "discrepancy status" requirement) will produce a UI that looks right but means the wrong thing.
**Why it happens:** All three use similar traffic-light vocabulary but measure different things.
**How to avoid:** Keep the workflow-status coloring (reporting-map) semantically separate from the new discrepancy-status coloring (D-11–14); the planner should decide explicitly whether the Acreage tab needs both concepts shown simultaneously or whether one subsumes the other, and should not silently merge the two hardcoded threshold implementations into the new configurable one without an explicit migration step.
**Warning signs:** A single component or RPC named ambiguously (e.g., just `status`) whose meaning shifts between "has this been reported to FSA" and "does planted acreage match FSA acreage."

### Pitfall 4: `ST_MakeValid` is required almost everywhere real shapefile data touches PostGIS
**What goes wrong:** Real-world FSA/SMS shapefile exports frequently have minor topology errors (self-intersections, near-duplicate vertices) that cause `GEOS TopologyException` on raw `ST_Intersection`/`ST_Intersects` calls.
**Why it happens:** Shapefile export tools (SMS, ArcGIS) don't always produce perfectly valid OGC geometry.
**How to avoid:** Every existing spatial RPC in this codebase wraps geometry inputs in `ST_MakeValid()` before intersection/union/difference (see migrations 017, 033). Any new merge/import RPC in this phase must follow the same defensive pattern — this is documented in-repo, not merely a general PostGIS best practice.
**Warning signs:** Intermittent `TopologyException` errors that only appear for specific real farm parcels, not test data.

### Pitfall 5: FieldView OAuth requires an external registration step that is not a coding task
**What goes wrong:** A plan might allocate a single task to "wire up live FieldView OAuth" as if it's pure code — but `FIELDVIEW_CLIENT_ID`/`FIELDVIEW_CLIENT_SECRET`/`FIELDVIEW_API_KEY` are currently empty, and obtaining them requires registering a developer application with Climate/Bayer FieldView (an external, non-code, non-automatable step, potentially with approval latency).
**Why it happens:** The code side (OAuth routes, adapter, token table) is 100% done; only the credentials are missing, which can look like "just add env vars" but actually blocks on a third party.
**How to avoid:** Plan this as two separable tasks: (1) code — none needed, it already exists; (2) a `checkpoint:human-verify` task for "register FieldView developer app, obtain credentials, set env vars, do end-to-end connect test" — this cannot be completed by the agent alone.
**Warning signs:** A plan task titled "implement FieldView OAuth" with no external-dependency checkpoint.

### Pitfall 6: DBF field name 10-character limit constrains new RMA attribute names
**What goes wrong:** The dBASE III `.dbf` format enforces an 11-byte field-name slot (10 usable chars + null); the existing `DBF_FIELDS` array already uses tight abbreviations (`FARM_NBR`, `GLM_ZONE`). Adding grower name, share %, RMA unit number, etc. requires similarly short names.
**How to avoid:** Reserve names like `RMA_UNIT` (8), `GROWER` (6), `SHARE_PCT` (9), `POLICY_NO` (9), `FAILED_AC` (9) — all ≤10 chars, consistent with the existing convention. Do not simply concatenate longer descriptive names; `buildDbf()`'s `Buffer.from(f.name.substring(0, 10))` will silently truncate collisions (e.g., two fields both starting with the same 10 characters would collide) rather than error.
**Warning signs:** Two DBF fields resolving to the same truncated name; QGIS/ArcGIS showing fewer columns than expected on import.

## Code Examples

### Server-side geography-cast acreage (the project-wide convention)
```sql
-- Source: glomalin-portal/supabase/migrations/012_reconciliation_rpc.sql
ROUND(
  CAST(ST_Area(ST_Intersection(cb.geometry::geography, mz.geometry::geography)) / 4046.856422 AS numeric),
  2
) AS intersection_ac
```

### Config-driven admin access guard (reuse for any new admin routes in this phase)
```typescript
// Source: glomalin-portal/src/app/api/fsa/export-shapefile/route.ts (pattern used across all /api/fsa/* routes)
const guard = await requireModuleAccess('fsa-578')
if (isGuardError(guard)) return guard
const { supabase } = guard
```

### Shapefile export zip (pattern to extend with new RMA fields)
```typescript
// Source: glomalin-portal/src/app/api/fsa/export-shapefile/route.ts
const DBF_FIELDS: DbfField[] = [
  { name: 'FARM_NBR',  type: 'C', length: 10 },
  { name: 'TRACT_NBR', type: 'C', length: 10 },
  // ... existing fields ...
  // NEW for RMA schema (D-18) — all ≤10 chars:
  { name: 'RMA_UNIT',  type: 'C', length: 15 },
  { name: 'GROWER',    type: 'C', length: 30 },
  { name: 'SHARE_PCT', type: 'N', length: 6, decimals: 2 },
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Flat-acre discrepancy thresholds (0.1ac / 1.0ac), hardcoded, duplicated in 2 files | Configurable %+ac Green/Yellow/Red per D-11–14 | This phase (not yet built) | Requires a new config table + one shared evaluation function; must retire (not triplicate) the two existing implementations |
| CLU shapefiles populated out-of-band (no import UI observed) | Admin-controlled upload UI (per D-06, reusing Phase 70's `BoundaryImport` pattern) | This phase (not yet built) | New route + component; must widen geometry columns to MultiPolygon or normalize on import |
| Split-only sub-CLU editing (`create_clu_split`) | Split + Merge (`ST_Union`) | This phase (merge not yet built) | New RPC + UI mirroring `split-panel.tsx` |
| FieldView data only reachable via manual DAT ZIP upload | Live OAuth-based nightly/on-demand sync | Code is ready now; blocked on external credential registration | Requires `checkpoint:human-verify`, not a pure code task |

**Deprecated/outdated:** None — this is an actively maintained, recently-touched (commits as of 2026-07) codebase area. No legacy patterns to strip out.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ACR-01..06 map 1:1 to the six numbered Success Criteria in ROADMAP.md §Phase 72 (no separate REQUIREMENTS.md exists in this project) | Phase Requirements | If a REQUIREMENTS.md or per-ID description does exist elsewhere and was missed, task-to-requirement traceability in the plan could be subtly wrong. Low risk — confirmed no such file exists in `.planning/` |
| A2 | "Grower/policyholder" and "share %" fields do not currently exist anywhere in `clu_records`, `management_zones`, or the farm-registry schema surfaced to the portal | Phase Requirements (ACR-06), Common Pitfalls | If a policyholder/share field exists elsewhere (e.g., in the standalone `fsa-acres` Express app at port 3002, which was not investigated in depth) and should be reused/synced rather than newly added, the plan could create a duplicate/conflicting source of truth |
| A3 | The standalone `fsa-acres` Express app (port 3002, per `ecosystem.config.js`) is legacy/superseded by the portal's `/api/fsa/*` implementation and is out of scope for Phase 72 | Existing Infrastructure | If `fsa-acres` is still actively used for some FSA workflow not migrated to the portal, Phase 72 could create a data-consistency gap between the two systems. This was not verified in depth — **recommend the planner or discuss-phase confirm this with the user** |
| A4 | Merge (`ST_Union`) is genuinely absent — confirmed via full-text search of `supabase/migrations/` for `ST_Union` and of `src/` for "merge" (excluding unrelated "merged"/promise-merge usages) | Phase Requirements (ACR-03), Architecture Patterns | Low risk — this was a direct grep, high confidence |
| A5 | n8n is not deployed on the VPS droplet — confirmed by absence from `ecosystem.config.js` (the only process manager config found) and no docker-compose/n8n references anywhere in the repo | Environment Availability | If n8n runs in a Docker container managed outside this repo (invisible to a repo-only search), the D-04 fallback decision (Vercel Cron) could be based on incomplete information. **Recommend an explicit human-verify checkpoint**: "confirm n8n is/isn't running on the droplet via SSH" before committing to the Vercel Cron approach |

## Open Questions

The five questions CONTEXT.md explicitly delegates to research are answered here directly (not deferred further):

1. **Draw/edit plugin: MapLibre GL Draw vs Leaflet + Leaflet.draw**
   - **Answer: Stay on MapLibre GL with `@mapbox/mapbox-gl-draw` — this is already installed, already wired, and already working in `overlay-map.tsx` (dynamic import + CSS import + `IControl` registration + `draw.create` event handling, including a fallback UX message if the control fails to attach).** No migration or evaluation needed; this question is effectively already answered by the codebase's own prior decision.
   - Confidence: HIGH [VERIFIED: codebase + npm registry — `@mapbox/mapbox-gl-draw@1.5.1` is the current published version].

2. **n8n availability on the VPS droplet for FieldView nightly sync scheduling**
   - **Answer: n8n is not present anywhere in the deploy configuration this repo controls** (`ecosystem.config.js` lists exactly 8 apps — none is n8n — and no docker-compose/n8n config exists in the repo). **Use the Vercel Cron fallback** D-04 anticipates: a `vercel.json` `crons[]` entry hitting a new `/api/fsa/fieldview/sync` route on a schedule (e.g., nightly at 2am), protected by a cron-secret header check (Vercel's standard pattern) rather than user session auth.
   - Confidence: MEDIUM — absence-of-evidence from a repo-only search; recommend a human-verify checkpoint to SSH-confirm nothing is running on the droplet outside repo-tracked config, since it's possible (though unlikely given no other reference to n8n anywhere in `.planning/` either) that n8n was set up manually outside version control.

3. **Shapefile WRITE path from Node/Next.js**
   - **Answer: Already solved — do not add a new library.** `src/app/api/fsa/export-shapefile/route.ts` is a complete, hand-rolled, production-tested ESRI shapefile writer (SHP record/header binary layout, SHX index, DBF with dBASE III header + 10-char field name truncation + `N`/`C` field types, WGS84 `.prj`, zipped via `JSZip`). It already produces files that open cleanly in QGIS/ArcGIS/SMS Advanced (per its own doc comment) and is the correct place to add the additional RMA attribute fields (grower, share %, RMA unit #, etc.) — all new DBF field names must stay ≤10 characters (see Pitfall 6).
   - Confidence: HIGH [VERIFIED: direct code read].

4. **FieldView (Climate) API OAuth: existing stub + activation requirements**
   - **Answer:** The stub is essentially complete, not a stub in the pejorative sense — `fieldview/connect` (authorization-code redirect + CSRF state cookie), `fieldview/callback` (not fully read in this session but referenced consistently), `fieldview/status` (connection state), `fieldview/dat-import` (manual ZIP fallback, fully working), and `lib/fsa/adapters/fieldview.ts`'s `createFieldViewAdapter()` (calls `/v4/asApplied`, `/v4/asPlanted`, `/v4/asHarvested` against `https://platform.climate.com`, normalizes to `NormalizedCoverageEvent`) are all implemented. **Activating live OAuth requires:** (a) registering a developer application with Climate FieldView/Bayer to obtain `FIELDVIEW_CLIENT_ID`, `FIELDVIEW_CLIENT_SECRET`, `FIELDVIEW_API_KEY` (currently empty in `.env.local` — confirmed), (b) `FIELDVIEW_REDIRECT_URI` is already set to `https://portal.whughesfarms.com/api/fsa/fieldview/callback`, (c) token refresh logic for the per-user `fieldview_tokens` table (4h access token per the table's own comment; refresh-token rotation logic should be verified when `callback/route.ts` is read in planning), (d) rate limits are unknown/undocumented in-repo — must be discovered from Climate's developer portal during credential registration, which is itself the external, non-code blocker (see Pitfall 5).
   - Confidence: MEDIUM — code path confirmed HIGH; live API behavior (rate limits, exact scopes needed) is LOW/unverified since no live credentials exist to test against.

5. **PostGIS RPC design on Supabase: overlay/split/merge/area, GiST indexing, migration conventions**
   - **Answer:** Migration convention in this repo: sequentially numbered SQL files in `supabase/migrations/`, each a focused, idempotent (`IF NOT EXISTS`/`CREATE OR REPLACE`) change with an explanatory header comment; `SECURITY DEFINER` for all RPCs touching RLS-protected tables; GiST indexes created per-geometry-column at the same migration that adds the column (e.g., `idx_cb_geometry`, `idx_mz_geometry`, `idx_ce_geometry`, `idx_cr_split_geometry`); acreage always computed via `ST_Area(geom::geography) / 4046.856422`; `ST_MakeValid()` wraps any geometry from an external/imported source before intersection math. **A new merge RPC should follow this exact convention**: new migration numbered `037_...` (next available), `ST_Union` (via `ST_Collect` for >2 inputs) wrapped in `ST_MakeValid`, a GiST index on any new merged-geometry column, `SECURITY DEFINER`, validates inputs are not already `superseded`.
   - Confidence: HIGH [VERIFIED: direct reading of 10+ migrations showing this convention consistently applied].

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostGIS extension | All spatial RPCs (D-09) | ✓ | Enabled via Supabase, in use since migration 010 | — |
| Supabase project (glomalin-portal's existing project) | All DB/RLS/RPC work | ✓ | `@supabase/supabase-js ^2.98.0` | — |
| n8n | FieldView sync scheduling (D-04, preferred) | ✗ | — | Vercel Cron (`vercel.json` crons[]) hitting a portal API route — see Open Question #2 |
| FieldView (Climate) developer credentials | Live OAuth sync (D-07) | ✗ (env vars present but empty) | — | Manual DAT ZIP import already works as a complete fallback (`fieldview/dat-import`) — D-17 already requires this path stay open regardless |
| `@mapbox/mapbox-gl-draw` | Draw/split/merge/draw-from-scratch UI | ✓ | 1.5.1 (current) | — |
| Vercel hosting | Deploy target (D-03) | ✓ (existing deploy target for glomalin-portal) | — | — |

**Missing dependencies with no fallback:**
- None — every missing piece (n8n, FieldView credentials) has a documented, already-functional fallback in this codebase.

**Missing dependencies with fallback:**
- n8n → Vercel Cron
- Live FieldView OAuth → existing manual DAT ZIP import (already the D-17 "manual path must stay open" requirement, so this fallback is not just acceptable but architecturally required regardless of OAuth status)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed, `vitest` + `@testing-library/react` + `@testing-library/user-event`) |
| Config file | Not located in this session's search depth — likely `vitest.config.ts` at `glomalin-portal/` root or inline in `vite.config.ts`; confirm during planning |
| Quick run command | `npm run test` (defined as `vitest run` in `package.json`) |
| Full suite command | `npm run test` (no separate "full" script observed — single `test` script) |

Existing colocated test examples: `src/lib/marketing/position.test.ts`, `src/components/macro/add-contract-modal.test.tsx`, `src/components/marketing/delivery-progress-bar.test.tsx` — establishes the project convention of colocated `*.test.ts(x)` files, not a separate `__tests__/` tree.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACR-02 | Threshold engine (Green/Yellow/Red) computes correct status for given delta/pct/config | unit | `npx vitest run src/lib/fsa/thresholds.test.ts` | ❌ Wave 0 |
| ACR-03 | `merge_reporting_units` RPC produces correct union geometry + acreage for 2+ input CLUs | integration (requires Supabase test DB or mocked RPC) | manual/`checkpoint` — no existing pattern for testing PostGIS RPCs directly in this repo | ❌ Wave 0 — decide test strategy (mock RPC response vs. local Supabase) |
| ACR-06 | Shapefile export DBF contains all RMA fields with correct ≤10-char names and no collisions | unit | `npx vitest run src/app/api/fsa/export-shapefile/route.test.ts` (new) | ❌ Wave 0 |
| ACR-01 | CLU boundary import handles MultiPolygon input without throwing | unit | `npx vitest run src/app/api/fsa/clu-boundaries/import/route.test.ts` (new) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- <changed-file>.test.ts` (targeted)
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/fsa/thresholds.test.ts` — covers the new configurable Green/Yellow/Red engine (ACR-02)
- [ ] Decide + document a strategy for testing PostGIS RPCs (no existing pattern found in this repo — all current FSA RPCs appear to be tested manually/in production rather than via automated integration tests against a local Supabase instance). This is a real gap the planner should address explicitly, not silently skip.
- [ ] `src/app/api/fsa/export-shapefile/route.test.ts` — covers extended DBF schema (ACR-06)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (delegated to Supabase Auth, unchanged by this phase) | — |
| V3 Session Management | Partial — FieldView OAuth `state` CSRF cookie | Already implemented (`fv_oauth_state`, httpOnly, `sameSite: lax`, `secure` in prod, 60s TTL) — extend, don't replace |
| V4 Access Control | Yes | `requireModuleAccess('fsa-578')` guard — already applied consistently to every `/api/fsa/*` route; any new route (merge, CLU import, threshold config) must use the same guard |
| V5 Input Validation | Yes | Server-side geometry validation (`ST_GeomFromGeoJSON` + intersection checks before insert, per `create_clu_split`); new merge/import RPCs must validate inputs the same way (reject non-`Polygon`/`MultiPolygon`, reject IDs already `superseded`) |
| V6 Cryptography | No new surface — OAuth tokens stored server-side in `fieldview_tokens`, RLS-scoped to `auth.uid()`, never exposed to the browser | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV/DBF injection via user-entered crop/field-name strings containing formula-triggering characters (`=`, `+`, `-`, `@` at cell start) | Tampering | Existing `escapeCell()` in `clu-workspace.tsx` handles CSV quoting/escaping for commas/quotes/newlines but does **not** neutralize leading formula characters — worth a defensive fix if any new CSV/DBF export path is added in this phase, though this is a pre-existing condition, not new to Phase 72 |
| Shapefile upload with oversized/malformed ZIP causing resource exhaustion | Denial of Service | Existing pattern in `fieldview/dat-import` reads the whole file into memory via `arrayBuffer()`/`JSZip.loadAsync` with no explicit size cap observed — the new CLU boundary import route should add an explicit file-size limit (Phase 70's `BoundaryImport` `react-dropzone` config may already cap this client-side; confirm and enforce server-side too) |
| Admin-only spatial writes bypassing RLS via service-role key misuse | Elevation of Privilege | Existing pattern (`requireModuleAccess` guard checked *before* any service-role client is constructed) must be preserved for every new admin route (CLU import, merge, threshold config) |
| FieldView OAuth token leakage to client | Information Disclosure | Tokens never leave `fieldview_tokens` table / server-side fetch calls — confirmed by code read; must not change in new sync-scheduling code (Vercel Cron route must also keep tokens server-side only) |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `glomalin-portal/supabase/migrations/010`–`036` (all FSA/CLU/zone/coverage migrations)
- `glomalin-portal/src/app/api/fsa/**` (all routes)
- `glomalin-portal/src/components/fsa/**`, `src/components/compliance/acreage-tab.tsx`
- `glomalin-portal/src/lib/fsa/{calc,reconciliation,shapefile,fsa-crop-list}.ts`, `src/lib/fsa/adapters/fieldview.ts`, `src/lib/fsa/parsers/fieldview-dat.ts`
- `glomalin-portal/ecosystem.config.js` (n8n absence confirmation)
- `glomalin-portal/.env.local` (FieldView credential emptiness — checked existence only, values not printed)
- `.planning/ROADMAP.md` §Phase 70, §Phase 72
- `.planning/STATE.md` (decision history through Phase 71)
- `.agents/skills/usda-service-center.md` (RMA/FSA-578 domain schema corroboration)
- `.planning/DOMAIN-CONTEXT.md`

### Secondary (MEDIUM confidence — registry verification)
- `npm view maplibre-gl version` → 6.1.0 current; installed `^5.23.0`
- `npm view @mapbox/mapbox-gl-draw version` → 1.5.1 current; installed `^1.5.1` (exact match)
- `npm view jszip version` → 3.10.1 current; installed `^3.10.1` (exact match)

### Tertiary (LOW confidence — flagged for validation)
- FieldView live API rate limits and exact OAuth scope requirements (cannot be verified without live credentials — see Assumptions Log A5-adjacent Open Question #4)
- Whether the standalone `fsa-acres` Express app (port 3002) is fully superseded by the portal's `/api/fsa/*` implementation (Assumption A3 — recommend explicit user confirmation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all required libraries already installed and running in production in this exact codebase
- Architecture: HIGH — three-layer model, RPC conventions, and draw-tool integration all directly read from source
- Pitfalls: HIGH — all six pitfalls are drawn from direct code/migration reads, not general PostGIS knowledge
- RMA schema completeness (grower/share%/policyholder): LOW — flagged in Assumptions Log, needs user/discuss-phase confirmation
- n8n absence: MEDIUM — repo-only search, recommend a human-verify checkpoint

**Research date:** 2026-08-01
**Valid until:** 30 days (stable — this codebase changes at a steady but not fast-moving pace based on commit history; re-verify FieldView credential status and n8n absence if this research is used more than ~4 weeks after this date)
