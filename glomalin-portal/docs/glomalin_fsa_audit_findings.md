# Glomalin FSA/Insurance Audit Findings

> Generated: 2026-05-01
> Purpose: Working document for FSA redesign per design brief `glomalin_fsa_insurance_design_brief.md`.
> This file is the mandatory §6.1 audit output. Update it as the build progresses.

---

## 1. Active Infrastructure Inventory

### Pages & Routes

| Route | File | Status | Notes |
|---|---|---|---|
| `/app/compliance` | `src/app/(protected)/app/compliance/page.tsx` | **Active** | Main hub — 5 tabs, server fetches all data |
| `/app/fsa-578` | `src/app/(protected)/app/fsa-578/page.tsx` | Dormant redirect | → `/app/compliance?tab=acreage` |
| `/app/insurance` | `src/app/(protected)/app/insurance/page.tsx` | Dormant redirect | → `/app/compliance?tab=insurance` |
| `/app/claims` | `src/app/(protected)/app/claims/page.tsx` | Dormant redirect | → `/app/compliance?tab=claims` |

### Components — Compliance Shell

| Component | File | Status | Disposition |
|---|---|---|---|
| `ComplianceShell` | `src/components/compliance/compliance-shell.tsx` | Active | **Reuse** — tab nav + filter bar |
| `OverviewTab` | `src/components/compliance/overview-tab.tsx` | Active | **Extend** — add zone reconciliation stats |
| `AcreageTab` | `src/components/compliance/acreage-tab.tsx` | Active | **Extend** — wire ReconciliationView instead of CluWorkspace |
| `InsuranceTab` | `src/components/compliance/insurance-tab.tsx` | Active | **Extend** — expose production tracker |
| `ClaimsTab` | `src/components/compliance/claims-tab.tsx` | Active | **Reuse** |
| `CalendarTab` | `src/components/compliance/calendar-tab.tsx` | Active | **Extend** — add FSA-specific deadlines |
| `StatCard`, `ActionButton` | `src/components/compliance/ui.tsx` | Active | **Reuse** |

### Components — FSA

| Component | File | Status | Disposition |
|---|---|---|---|
| `CluWorkspace` | `src/components/fsa/clu-workspace.tsx` | Active — **CONFLICT** | **Replace** — assumes CLU is unit of record |
| `FarmAccordion` | `src/components/fsa/farm-accordion.tsx` | Active — **CONFLICT** | **Replace** — part of wrong-model UI |
| `TractAccordion` | `src/components/fsa/tract-accordion.tsx` | Active — **CONFLICT** | **Replace** |
| `CluCard` | `src/components/fsa/clu-card.tsx` | Active | **Evaluate at Phase 3** — CLU card inline edit may survive as zone attribute editor |
| `BulkActionBar` | `src/components/fsa/bulk-action-bar.tsx` | Active | **Evaluate** — bulk confirm on reconciliation table |
| `AcreagePdf` | `src/components/fsa/acreage-pdf.tsx` | Active — **CONFLICT** | **Replace** — basic CLU table, not Form 578 |
| `CropTypeahead` | `src/components/fsa/crop-typeahead.tsx` | Active | **Reuse** in zone year-attribute editor |

### Components — Insurance

| Component | File | Status | Disposition |
|---|---|---|---|
| `InsuranceWorkspace` | `src/components/insurance/insurance-workspace.tsx` | Active | **Extend** — add production tracker panel |
| `PolicyDrawer` | `src/components/insurance/policy-drawer.tsx` | Active | **Extend** — pull planted acres from FSA layer |
| `AphPanel` | `src/components/insurance/aph-panel.tsx` | Active | **Reuse** |
| `CoverageMatrix` | `src/components/insurance/coverage-matrix.tsx` | Active | **Reuse** |
| `PayoutSimulator` | `src/components/insurance/payout-simulator.tsx` | Active | **Reuse** |
| `InsurancePdf` | `src/components/insurance/insurance-pdf.tsx` | Active | **Extend** — add adjuster packet data |
| `PricingStalenessBadge` | `src/components/insurance/pricing-staleness-badge.tsx` | Active | **Reuse** |

### Components — Claims

| Component | File | Status | Disposition |
|---|---|---|---|
| `ClaimsWorkspace` | `src/components/claims/claims-workspace.tsx` | Active | **Reuse** |
| `ClaimsKanban` | `src/components/claims/claims-kanban.tsx` | Active | **Reuse** |
| `ClaimCard` | `src/components/claims/claim-card.tsx` | Active | **Reuse** |
| `ClaimColumn` | `src/components/claims/claim-column.tsx` | Active | **Reuse** |
| `ClaimDrawer` | `src/components/claims/claim-drawer.tsx` | Active | **Extend** — pull planted/FSA acres, add scale ticket cross-ref |
| `DeadlineAlertBanner` | `src/components/claims/deadline-alert-banner.tsx` | Active | **Reuse** |
| `DocumentUpload` | `src/components/claims/document-upload.tsx` | Active | **Reuse** |
| `TimelineFeed` | `src/components/claims/timeline-feed.tsx` | Active | **Reuse** |

### Libraries

| File | Status | Disposition |
|---|---|---|
| `src/lib/fsa/calc.ts` | Active | **Extend** — add ManagementZone, CoverageEvent, ReconciliationRow types; keep existing rollup/validation fns |
| `src/lib/fsa/fsa-crop-list.ts` | Active | **Reuse** |
| `src/lib/insurance/calc.ts` | Active | **Reuse** |
| `src/lib/claims/calc.ts` | Active | **Reuse** |
| `src/lib/action-items.ts` | Active | **Extend** — add zone/reconciliation action items |

### API Routes — FSA

| Route | Status | Disposition |
|---|---|---|
| `GET/POST /api/fsa/clu-records` | Active | **Extend** — add zone_id filter; keep for backward compat |
| `PATCH/DELETE /api/fsa/clu-records/[id]` | Active | **Extend** — allow zone_id assignment |
| `POST /api/fsa/clu-records/bulk-update` | Active | **Reuse** |
| `GET /api/fsa/validation` | Active | **Extend** — add zone-level validation rules |
| `GET /api/fsa/auto-populate-preview` | Active | **Reuse** |
| `POST /api/fsa/webhook/field-created` | Active | **Reuse** |

### API Routes — Insurance / Claims

All insurance and claims routes are **Active → Reuse**. No architectural conflicts.

---

## 2. Schema Inventory

### Tables in Supabase Migrations (`supabase/migrations/`)

| Table | Migration | Has Data? | Notes |
|---|---|---|---|
| `profiles` | 001/schema.sql | Yes | Auth users, role enum |
| `module_access` | 001/schema.sql | Yes | Per-user module grants |
| `field_observations` | 003 | Yes | Field notes (mobile PWA target) |
| `field_boundaries` | 006 | Yes | GeoJSON polygon as JSONB — **no PostGIS geometry** |
| `farm_map_config` | 006 | Yes | Derived map center/bounds |
| `commodities` | 009 | Yes | Master commodity list |
| `crop_variants` | 009 | Yes | Per-commodity crop variants |
| `sale_instruments` | 009 | Yes | Grain sales (forward, option, accumulator) |
| `commodity_pricing` | 009 | Yes | Per-commodity per-year pricing |

### Tables Referenced in Code but NOT in Migrations (created outside migrations, directly in Supabase)

| Table | Data? | Notes |
|---|---|---|
| `clu_records` | **Yes** (migrated from fsa-acres JSON via phase 51) | Core CLU table; ~1,338 rows from 2026 FSA sheet |
| `insurance_policies` | Yes | Insurance policy records |
| `insurance_pricing` | Yes | USDA RMA commodity prices |
| `aph_records` | Unknown | APH per policy/year |
| `claims` | Unknown | Claim lifecycle records |
| `claim_timeline` | Unknown | Claim audit trail |
| `claim_documents` | Unknown | Claim attachments |
| `grain_contracts` | Yes (legacy) | Superseded by `sale_instruments` |

### PostGIS Status

`field_boundaries.geojson` is stored as JSONB, not PostGIS `geometry` type — **PostGIS is likely not enabled** on this Supabase project. Must verify with `SELECT PostGIS_Version();` before Phase 1.

---

## 3. Package Status

| Package | Installed? | Purpose |
|---|---|---|
| `maplibre-gl` | **Yes** (v5.23.0) | Map rendering for spatial panels |
| `shpjs` | **Yes** (v6.2.0) | Shapefile parsing (.shp/.shx/.dbf) |
| `@types/shpjs` | **Yes** (v3.4.7) | TypeScript types for shpjs |
| `shpwrite` | **No** | Needed for shapefile export (Phase 5) |
| `proj4` | **No** | Needed for NAD83→WGS84 reprojection (Phase 2) |
| `@react-pdf/renderer` | Yes | PDF export (Form 578) |
| `dnd-kit` | Yes | Claims Kanban drag-drop |

---

## 4. Coverage Table (Brief §2–§5 vs Existing)

| Brief Requirement | Existing Infrastructure | Action |
|---|---|---|
| Management zones as unit of record | None — CLU is current unit | **Build new** |
| Three-layer model (zones / coverage / CLU) | Only CLU layer exists | **Build new** |
| PostGIS spatial engine (`ST_Intersection`) | JSONB only, no geometry columns | **Enable PostGIS + build new** |
| Year-scoped CLU boundaries (PostGIS geometry) | `field_boundaries` (JSONB, no year scope) | **Build new** |
| Continuous practice ledger (no static year cols) | Static: `tillage_2024`, `cc_2024` in `clu_records` | **Build new** |
| Rotation rules engine | None | **Build new** |
| Shapefile ingestion (.zip → PostGIS) | None | **Build new** |
| Year-over-year CLU diff (renumbering detect) | None | **Build new** |
| Side-by-side reconciliation UI | `CluWorkspace` accordion (wrong model) | **Replace** |
| 0.1 ac tolerance + cause attribution | `validateCluRecords()` (different logic) | **Replace** |
| FSA Form 578 PDF | `AcreagePdf` (basic CLU table, not 578 format) | **Replace** |
| CSV import file for FSA office | `/api/export/csv` in fsa-acres only | **Build in portal** |
| Merged shapefile export (round-trip) | None | **Build new** |
| Insurance real-time tracking (🟢/🟡/🔴 vs guarantee) | `InsuranceWorkspace` has claim_alert badges (partial) | **Extend** |
| Calendar layer (FSA-specific deadlines) | `CalendarTab` claims-only | **Extend** |
| Adjuster-ready claim packet (planted ac pulled, not typed) | `ClaimDrawer` (no FSA cross-ref) | **Extend** |
| FieldView job file adapter | None | **Build new** |
| Zone setup UI (XLSX → zones migration) | None | **Build new** |
| ComplianceShell tab structure | `ComplianceShell` (5 tabs) | **Reuse** |
| Claims pipeline (Kanban, 6 stages) | `ClaimsKanban` + full pipeline | **Reuse** |
| APH management | `AphPanel`, `lib/insurance/calc.ts` | **Reuse** |
| Deadline calendar | `CalendarTab`, `lib/claims/calc.ts` | **Extend** |
| Insurance PDF | `InsurancePdf` | **Extend** |

---

## 5. Legacy fsa-acres Status (port 3002)

Phase 51 (completed 2026-03-25) migrated all JSON data to Supabase. fsa-acres now reads/writes Supabase directly.

**Still active in fsa-acres that portal doesn't cover:**
- `/api/sync-crops/*` — crop sync from farm-budget (used for populating CLU crops)
- `/api/season/status` — cross-app seasonal dashboard
- `/api/cropping-intentions` — matched CSV export

**Decision:** Do NOT decommission fsa-acres during this build. Brief §6.4 cleanup pass after new UI is confirmed working.

---

## 6. Files to Create (New)

| File | Phase |
|---|---|
| `supabase/migrations/010_management_zones.sql` | 1 |
| `src/lib/fsa/reconciliation.ts` | 4 |
| `src/lib/fsa/shapefile.ts` | 2 |
| `src/lib/fsa/adapters/fieldview.ts` | 7 |
| `src/components/fsa/reconciliation-view.tsx` | 4 |
| `src/components/fsa/tract-map-panel.tsx` | 4 |
| `src/components/fsa/reconciliation-table.tsx` | 4 |
| `src/components/fsa/zone-setup-modal.tsx` | 3 |
| `src/components/fsa/shapefile-import-modal.tsx` | 2 |
| `src/components/fsa/form-578-pdf.tsx` | 5 |
| `src/components/insurance/production-tracker.tsx` | 6 |
| `src/app/api/fsa/shapefile-import/route.ts` | 2 |
| `src/app/api/fsa/reconciliation/[tract]/route.ts` | 4 |
| `src/app/api/fsa/zones/route.ts` | 3 |
| `src/app/api/fsa/zones/[id]/route.ts` | 3 |
| `src/app/api/fsa/export-578/route.ts` | 5 |
| `src/app/api/fsa/export-csv/route.ts` | 5 |
| `src/app/api/fsa/export-shapefile/route.ts` | 5 |
| `src/app/api/fsa/coverage-import/route.ts` | 7 |
| `docs/glomalin_fsa_cleanup_proposal.md` | 8 (post-build) |

---

## 7. Open Questions (Resolve Before Coding)

1. **PostGIS enabled?** Run `SELECT PostGIS_Version();` in Supabase SQL editor. If not, enable it before Phase 1 — all spatial work depends on it.

2. **FSA shapefiles available?** Rock County FSA sent Willie CLU shapefiles. Are they on the droplet or a local machine? Phase 2 needs a real sample to test ingestion and projection handling.

3. **Phase 5 priority?** Should Form 578 PDF move before Phase 4 (reconciliation UI) so there's a printable output quickly? Current plan: reconciliation first, then 578. Rationale: the 578 should export *confirmed* data from the reconciliation flow, so the two are linked. But if time pressure demands a quick 578 from existing clu_records, that can ship independently.

4. **Shapefile import naming convention:** The brief says CLU labels drift year to year (5a/5b → 5/6). The year-over-year diff uses `ST_Intersects` geometric match. Confirm: is the intent to auto-carry zone history forward on geometric match, or present it as a candidate for human review?
