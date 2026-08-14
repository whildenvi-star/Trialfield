# PHASE 0 — Inventory of the existing FSA acreage module

Audit date: 2026-08-14. Read-only; nothing was changed. Companion file: `PHASE1-MEASUREMENT.md`.

## The short version

There is not one FSA module — there are **three generations stacked on each other**, none finished:

1. **`fsa-acres/`** — an Express SPA (port 3002) that started as a direct import of the condemned Google Sheet. Its JSON store was migrated to Supabase on 2026-03-09; its importer and backfill scripts still target the deleted `data/data.json`.
2. **`glomalin-portal` Compliance hub** — Next.js, Supabase, PostGIS. Migrations 001–036, ~22 FSA components, maps, zones, splits, overlays. Built May–July 2026 largely in one ad-hoc burst.
3. **Phase 72 (acreage reconciliation)** — 7 plans, 12 commits, **all stranded in four unmerged `.claude/worktrees/` branches**. Nothing on `main`. `.planning/STATE.md` still says "EXECUTING, Plan 1 of 7" (last activity 2026-08-02). Migrations 037–041 were never applied.

The database holds the **spreadsheet's data, not the filed 2026 FSA-578**. The 320-line filed form exists nowhere on this machine.

---

## Schema

### What exists in the live Supabase (project `hmjmrdhwrzltckzuoaoh`)

| Table | Rows | RLS | Notes |
|---|---|---|---|
| `clu_records` | 444 | yes (024) | The acreage "lines". One row per CLU, spreadsheet lineage. 12 live columns (`tillage_2024/25`, `cc_2024/25`, `nt/cc_adoption_*`, `unit_number`, `aph`, `line_number`, `policy_number`) appear in **no migration** — table predates 024, which says so in its header. |
| `clu_boundaries` | 814 | yes (010) | The CLU polygon layer, **loaded twice** (see Data). |
| `field_boundaries` | 53 | yes (006/029) | Registry-field polygons (Phase 70 map work), separate from CLUs. |
| `management_zones` | 135 | yes (010) | Zone layer between CLUs and coverage. |
| `zone_year_attributes` | 74 | yes (010) | Per-zone-per-year crop attributes. |
| `coverage_events` | 0 | yes (010) | As-planted/as-applied imports. Empty. |
| `practice_ledger` | 0 | yes (010) | Empty. |
| `rotation_rules` | 0 | yes (010) | Empty. |
| `gcs_enrollments` | 149 | yes | **Orphaned** — no route, no UI reads it (removed in Phase 51 but table remains). |
| `insurance_policies` / `insurance_pricing` | 3 / 22 | yes | Used by both apps. |
| `aph_records`, `claims` | 0 / 0 | yes | Empty. |

Views: `clu_boundaries_geo`, `management_zones_geo`, `coverage_events_summary` (no RLS of their own — caller permissions). RPCs: `create_clu_split`, `detect_clu_split_candidates`, `get_clu_overlay_intersections`, `preview_clu_snip`, `export_clu_shapefile_rows`, `get_farm_reconciliation`, `link_clus_to_zones`, `seed_zones_from_clus`, `import_coverage_event`, `insert_management_zone(_with_geometry)`.

Anon-key probes on `clu_records`, `clu_boundaries`, `gcs_enrollments` return empty — RLS is enforced.

### Which migrations have run

- On disk: `001`–`036` in `glomalin-portal/supabase/migrations/` (no migration runner; applied by hand + ad-hoc scripts).
- **Applied through at least 034, almost certainly 036**: the live DB has `sub_label`/`split_geometry`/`parent_clu_id`/`superseded` (032), the overlay RPCs (033), `intended_use` (034).
- **037–041 exist only inside the four Phase 72 worktree branches and were never applied.** Plan 72-07 (the apply step) was never executed.

### What does NOT exist, at any layer

- **No `cc_stat` or any crop-status-code column.** `grep -ri cc_stat` across the entire workspace: zero hits.
- **No tract table.** `tract_number` is a text column repeated on rows; tract Farmland/Cropland are neither entered nor derived — they are simply absent.
- **No acreage-line concept.** One row per `(farm, tract, clu, crop_year)` enforced by unique index (`032`).
- **No producer share** (hard-coded "100%" in the CSV and PDF exports).
- **No certification/signature date** — only a `reported` boolean, no date, no attribution.
- **No CLUID GUID column.** The shapefile parser extracts `CLUID` and then discards it into the `fsa_attributes` jsonb blob; every join uses the unstable `(farm, tract, clu_number)` composite.
- **The handoff's reference migrations 001–006 are not on this machine.** No SQL anywhere mentions `acreage_line`, `sub_field_label`, or `reported_acres`.

## Data

### What's loaded and where it came from

- **`clu_records` (444 rows, all `crop_year=2026`, created 2026-03-06/09)** is the old spreadsheet: `2026 FSA acre  and Crop insurance.xlsx` → `fsa-acres/import.js` → `data.json` → `scripts/migrate-fsa.ts` → Supabase. The lineage is provable from the data itself:
  - `irrigated=true` sums to **1,936.00 acres** — the exact phantom number §A documents as the frozen-formula display error (true value: 1,900.83).
  - `double_crop` on exactly **2 rows** (§A: "a boolean used on 2 rows of 446").
  - `line_number` on **41 rows** (§A: "populated on 41 of 446 rows").
  - The `crop` column mixes crops with statuses and land uses: `NC` (132) + `nc` (6), `gls` (13) + `GLS` (2), `idle` (8), `CRP` (22), `MIXED FORAGE / HAY` (41), `organic wheat` (8), `organic rye` (1) — with 140 rows NULL/blank. Casing variants roll up as separate crops.
  - Sum of `fsa_acres` = **5,977.24** — matches neither the filed form (5,726.20) nor the CLU layer (6,261.69).
- **The filed 2026 FSA-578 (320 lines, certified 11/2025–07/2026) is not loaded.** It predates the March import and exists nowhere in the DB or on disk.
- **`clu_boundaries` (814 rows)** is the Rock County CLU layer imported from `fsa-acres/Rock ShapeFiles/` — **the same 407 polygons loaded twice**, once tagged `crop_year=2025` and once `2026`, attribute-identical. Each load independently reproduces the §E layer totals exactly: 6,261.69 all / 5,410.70 cropland (CLUCLSCD=2, 277 polygons), 407 distinct CLUID GUIDs. **The polygon data is good; the duplication and the discarded GUID key are the defects.**
- **Farm 14750 is missing entirely** from `clu_records` (present in the CLU layer and shapefiles). 10 farms loaded; the layer has 11.
- **Partial-load evidence vs `field_names.csv`**: 80 CSV keys absent from the records; 68 record keys absent from the CSV (mostly letter-splits `1a/1b/1c`, `334A–E`). Several splits don't reconcile to the polygon: `(14903,10084,1)` splits sum 9.4 ac vs 77.08 polygon; `(14903,15211,4)` 103.05 vs 127.57; `(14903,15231,1)` 28.56 vs 39.91. Nothing detects this.
- **Emptiness**: `reported` true on 0/444 rows ever; `landClass` on 4/444 (yet crop-sync gates on it, so sync reaches ~4 records); `aph`/`unit_number` all empty.

### §B sources of truth — on-machine status

| File | Status |
|---|---|
| `fsa578_2026_lines.csv` | **absent** |
| `fsa578_2026_tracts.csv` | **absent** |
| `clu_attributes_2026.csv` | **absent** (but the live `clu_boundaries` 2026 load carries the same attributes and reproduces its totals) |
| `clu_boundaries_2026.geojson` | **absent** (raw shapefiles present at `fsa-acres/Rock ShapeFiles/`, 11 farms) |
| `field_names.csv` | **received 2026-08-14**, saved to `fsa-acres/data/handoff-2026/field_names.csv`; verified — 456 rows, 407 with acres, sums reproduce 6,261.69 / 5,410.70 |

## Application

### fsa-acres (Express, :3002)

Six-tab SPA: Season / Dashboard / FSA Data (editable grid) / Pricing / Insurance / Reports. ~40 routes; rollups in a shared 383-line `calc.js` where **every rollup does an unguarded `total += fsaAcres`** — no status filter exists or could exist. Cross-app joins (budget :3001, registry :3005, grain-tickets :3007) match on **fuzzy field-name score ≥30/100**, not on FSA keys. `import.js` + both backfill scripts target the deleted `data/data.json` — three stranded generations of tooling in one directory. Local `.env` has no `EMBED_TOKEN`, so the API runs unauthenticated locally (the droplet gate was added 2026-08-06).

### glomalin-portal Compliance hub

- `/app/fsa-578` is a redirect stub → `/app/compliance?tab=acreage` (Phase 68). Only nav entry is "Compliance".
- Acreage tab has 5 views: **Map View** (traffic-light reporting map, 1,131 lines), **CLU Records** (accordion + cards), **Zone Setup**, **Overlay** (Venn + snip/split drawing), **As-Applied** (FieldView/DAT import). ~22 components, ~25 API routes under `/api/fsa/`.
- **Orphaned subtree**: `reconciliation-view/-table/-map`, `form-578-button/-pdf` (the only component shaped like an actual Form 578, with share % and signature block), the `/api/fsa/reconciliation` route, the `get_farm_reconciliation` RPC, and `/api/fsa/export-578` (the only 578-schema CSV export) — **none reachable from any screen**. The May audit doc planned to wire them in; it never happened. The reachable PDF self-disclaims "not an official FSA-578".
- Screens show operator names only where `field_name` is populated, falling back to `CLU {n}`; accordion headers are raw `Farm {number}` / `Tract {number}` throughout.
- Land use is a pseudo-crop: the typeahead merges `Cover Crop`, `CRP`, `Fallow`, `Idle` into the crop list, so a cover crop **replaces** the cash crop on a CLU row rather than overlaying it. The `use` column was polluted with "Irrigated/Non-Irrigated" strings by the card UI (documented in migration 034's header) and `intended_use` was added beside it; both remain writable.

### Phase 72 (the most recent attempt)

Planned as the spatial reconciliation tool (thresholds engine, merge/draw editing, boundary import UI, RMA export schema, FieldView cron). All 12 code commits sit in four unmerged worktrees — two of them locked; plans 72-02, 72-05, 72-07 have no code at all. No UAT, no verification. From `main`'s perspective, Phase 72 shipped nothing.

### The six .jsx prototypes (§G)

**Not found.** No `.jsx` files exist anywhere on the Desktop outside `node_modules`. The iCloud `fsa-578` folders are minified Next.js build artifacts leaked from `.next/` by iCloud Desktop sync (three sync-conflict generations), not prototypes. If the prototypes existed, they are not on this machine.

## Tests

- **fsa-acres: zero.** No framework, no test script. 383 lines of shared acreage/indemnity math untested.
- **Portal: zero FSA tests.** All 19 vitest files cover marketing/macro. `src/lib/fsa/calc.ts` (813 lines incl. validation), `reconciliation.ts` (210 lines), `shapefile.ts`, `fieldview-dat.ts` — all untested.
- The two Phase 72 test files (`thresholds.test.ts`, `merge/route.test.ts`) exist only in worktree branches.
- Root `tests/` is the unrelated trialfield Python suite.

## Divergence from §C/§D — table and column

| §C/§D requirement | What exists | Verdict |
|---|---|---|
| `cc_stat` distinguishing consuming vs overlay lines (§C.1) | Nothing. `double_crop`/`cover_crop` booleans on the single consuming row (`clu_records`); unique index forbids a second line per CLU | **Missing concept — the root cause** |
| Acreage **lines** on fields | One row per CLU *is* the crop assignment; splits partition geometry, never overlay | Missing concept |
| Tract; Farmland/Cropland derived from CLU layer (§C.2) | No tract entity anywhere; totals only ever sum `fsa_acres` at render time | Missing concept |
| `field` = CLU; sub-fields as labels on lines, no geometry (§D) | `sub_label` (single letter) exists but splits **require** drawn geometry (`create_clu_split` computes acres from the polygon) — inverse of §D | **Contradicts** |
| `clu_id` GUID join key (§D) | Parsed, then discarded into jsonb; all joins on `(farm, tract, clu_number)` — the key §D proves unstable (14903/224 renumbering) | Contradicts |
| Organic is a practice, not part of crop name (§D) | `crop='organic wheat'` rows alongside an `organic` boolean that is `false` on the same row | Contradicts |
| Non-producing status forces `crop_id IS NULL` (§D) | `NC`/`gls`/`idle`/`CRP` stored **in** the crop column; case-variant duplicates roll up separately | Contradicts |
| Cover crop is a reported commodity line (§D) | "Cover Crop" is a pseudo-crop replacing the cash crop | Contradicts |
| Conservation programs are rows, not tables (§D) | `gcs_enrollments` table, orphaned | Contradicts |
| Certification date per line (§D) | `reported` boolean, no date | Missing |
| Splits close against the polygon, enforced in DB (§D) | No constraint; live data contains splits off by up to 67.7 ac | Missing; violated in data |
| Producer share | Hard-coded "100%" in exports | Missing |
| Acres `numeric(10,2)`, FSA ids text, `timestamptz` (§D) | All true in `clu_records`/`clu_boundaries` | Conforms |
| RLS on every table (§D) | Enabled on all base tables (verified by anon probe) | Conforms |
| Field names in every view (§B) | Present where populated; raw numbers as fallback and in all group headers | Partial |

*Not proposed here: fixes. That is Phase 2, after sign-off.*
