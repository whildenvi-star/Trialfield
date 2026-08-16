# PHASE 2 — Repair or replace, per layer. Get sign-off.

Written 2026-08-16 against the Phase 0 inventory, the Phase 1 measurement, the live
Supabase (read-only), the four Phase 72 worktrees, and `HANDOFF-PROMPT.md` (§A–§H).
Nothing was changed. **Nothing in here is built until you sign the last section.**

Where a number appears it was measured today or in Phase 1; where a decision rests on
a file that is not on this machine, the row says so.

---

## The short version

| Layer | Verdict | One reason |
|---|---|---|
| **Schema** — `clu_records` as the acreage grain | **Replace.** New tables beside the old; old dropped after §E passes | Cannot express consume-vs-overlay; one row per CLU by unique index; joins on the unstable 4-string tuple; 7 of 12 CLU functions bound to it |
| **Schema** — `clu_boundaries` (CLU polygon layer) | **Repair, then fold in.** Data is right; container is wrong | Reproduces §C.2 exactly; loaded twice; CLUID GUID buried in jsonb |
| **Schema** — zones / coverage / practice / rotation (010–013) | **Keep, untouched.** Orthogonal to the 578 grain | Nothing in them keys on the CLU tuple except two RPCs; `coverage_events` is empty; revisit after the 578 model is proven |
| **Schema** — insurance / APH / claims (020) | **Keep, untouched** | Different domain; joins to acreage by loose `farm_number` text only |
| **Data** — `clu_records` content (444 rows) | **Do not migrate.** Salvage two columns, then archive | It is the February spreadsheet, not the filed 578; carries the phantom 1,936.00 |
| **Data** — `clu_boundaries` content (814 rows) | **Migrate one load, keyed on GUID** | 407 distinct CLUIDs; 0 duplicate composites in the 2026 load; 2025 load attribute-identical |
| **Data** — the filed 2026 FSA-578 | **Load from `fsa578_2026_lines.csv` / `_tracts.csv`** | Both still absent from this machine. Nothing else on disk is the filed form |
| **Data** — `field_names.csv` | **Load** into `fsa_field.name` / `fsa_tract.name` | Received and verified; joins cleanly on the 2026 layer |
| **App** — `fsa-acres/` (Express, :3002) | **Retire** after its consumers are re-pointed | Third-generation tooling still targeting a deleted `data.json`; every rollup sums `fsa_acres` unguarded; fuzzy-name joins |
| **App** — portal Compliance › Acreage tab (5 views) | **Replace with one field-review screen.** Keep the shell | Labels ground by number; treats cover crop as a crop; can't show the overlay gap; 5 views ≈ §G's "one screen abandoned five times" |
| **App** — orphaned 578 subtree (`form-578-*`, `reconciliation-*`, `export-578`) | **Harvest shape, rewrite body** | Only artifacts shaped like the form (share %, signature); bodies read the wrong grain |
| **App** — Phase 72 worktrees | **Harvest 3 things, discard 1, park 2, close the phase as superseded** | Detail in §3.4 |
| **Tests** | **Add.** §E as a runnable SQL fixture + vitest on the derivations | Zero acreage tests exist anywhere |
| **Cross-app consumers** | **Shim during cutover** | See §5 (who reads `clu_records` / :3002 today) |

Order of build (Phase 3, per the handoff): schema → import → one screen → editing → rest.
Steps 1–2 are the whole value proposition; §E decides whether step 3 starts.

---

## §1 Schema — replace the acreage grain

### 1.1 Why not repair `clu_records`

Repair was considered. It fails on three structural facts, not on style:

1. `idx_clu_records_unique_unsplit (farm, tract, clu, crop_year) WHERE sub_label IS NULL`
   forbids a second line on the same CLU. The 578 needs it on every double-crop and
   cover-crop field (728.41 ac of overlay lines in 2026). Dropping the index turns
   every existing rollup, RPC and screen into a double-counter overnight.
2. Identity is the 4-string tuple. §D proves it unstable (14903/224 renumbered between
   April and August). Adding a `clu_id` column to `clu_records` doesn't help while
   `create_clu_split`, `get_farm_reconciliation`, `export_clu_shapefile_rows`,
   `detect_clu_split_candidates`, `get_clu_overlay_intersections`, `preview_clu_snip`
   and `seed_zones_from_clus` all correlate on the tuple.
3. `fsa_acres` holds entered acres on parents and geometry-derived acres on split
   children (032/036), and 038 would make it a mutable computed column. One column,
   three meanings.

Adding `cc_stat` and a tract table to this shape would be a fourth generation stacked
on three. The handoff's rule applies: schema wrong at the grain → replace it.

### 1.2 The replacement — five core tables, two reference tables, three views

(Plus `fsa578_tract_printed` as an acceptance fixture and `fsa_field_zone` as a
crosswalk, both in §2.)

All new objects are prefixed `fsa_` and created **beside** the existing tables. Nothing
existing is altered or dropped in this step. RLS on every table (read: authenticated;
write: `profiles.role IN ('admin','agronomist')`, and this time `WITH CHECK` as well as
`USING` — 024's policies have `USING` only). Acres `numeric(10,2)`, FSA identifiers
`text`, timestamps `timestamptz`.

```
fsa_farm         farm_number text PK, name text, county text, state text,
                 confirmed_on date, created_at, updated_at

fsa_tract        id uuid PK, farm_number text FK→fsa_farm, tract_number text,
                 name text,                      -- field_names.csv tract_name
                 UNIQUE (farm_number, tract_number)
                 -- NO farmland / cropland columns. Ever. (§C.2, §H)

fsa_field        clu_id uuid PK,                 -- the FSA CLUID GUID. THE key.
                 tract_id uuid FK→fsa_tract,
                 clu_number text,                -- current number; may change
                 name text,                      -- field_names.csv field_name; nullable (66 have none)
                 registry_field_id text,         -- farm-registry field this CLU belongs to (many CLUs → one registry field);
                                                 -- name-matched then confirmed; the crosswalk §5 consumers need
                 geometry geometry(MultiPolygon,4326),     -- NULL = "no boundary on file" (14891/15208). Never an empty frame. (§G)
                 calc_acres numeric(10,2),                 -- CALCACRES as printed by FSA; NULL iff geometry IS NULL
                 cropland_flag boolean NOT NULL DEFAULT false,  -- CLUCLSCD = 2 (§F: only class 2 confirmed)
                 clu_class smallint, hel_type text,
                 layer_date date,                 -- 2026-04-30 for the current load; NULL on no-polygon stubs
                 fsa_attributes jsonb NOT NULL DEFAULT '{}',
                 source_file text, imported_at timestamptz,
                 UNIQUE (tract_id, clu_number) WHERE geometry IS NOT NULL   -- partial; stubs exempt
                 CHECK ((geometry IS NULL) = (calc_acres IS NULL))
                 -- GIST on geometry.

fsa_field_history  clu_id, layer_date, clu_number, calc_acres, geometry, fsa_attributes,
                   archived_at   -- BEFORE UPDATE OF geometry/clu_number trigger,
                                 -- same pattern as 028 field_boundary_history.
                                 -- This is where 14903/224's old numbering lives.

fsa_acreage_line id uuid PK,
                 crop_year int NOT NULL,
                 clu_id uuid FK→fsa_field NOT NULL,
                 sub_field_label text,           -- '4A', '18J'. Label only. No geometry. (§D)
                 cc_stat text NOT NULL,          -- raw code as filed: I / IN / C / X / L / J. Never normalised. (§F)
                 reported_acres numeric(10,2) NOT NULL,
                 crop_code text, type_code text, use_code text,   -- raw FSA codes as filed
                 crop_id text,                   -- farm-registry canonical crop id (Phase 50); NULL when non-producing
                 land_use_status text,           -- 'NC' | 'GLS' | 'IDLE' | 'CRP' | NULL
                 irrigation text,                -- 'I' | 'N'
                 organic boolean NOT NULL DEFAULT false,   -- a practice, not part of the crop name (§D)
                 planting_date date,
                 share_pct numeric(5,2) NOT NULL DEFAULT 100,
                 certified_on date,              -- per line (§D: three tranches in 2026)
                 source text NOT NULL,           -- 'fsa578_import' | 'manual' | 'fieldview'
                 form_line_no int,               -- position on the filed form, for audit
                 confirmed_on timestamptz,       -- (§F: seed nothing unconfirmed)
                 notes text, created_at, updated_at, created_by uuid
                 CHECK (land_use_status IS NULL OR crop_id IS NULL)   -- §D
                 CHECK (share_pct > 0 AND share_pct <= 100)
                 -- No unique on (clu_id, crop_year): many lines per field is the point.

fsa_cc_stat      code text PK, consumes_cropland boolean NOT NULL, label text,
                 confirmed_on date, notes text
                 -- seeded from §C.1: I,IN,X → true ; C,L,J → false. Semantics unconfirmed
                 -- (§F) so this is a table, not a CHECK, and it carries confirmed_on.
```

Views (queries, never stored — §C.2, §H):

```
fsa_tract_acres          per tract: farmland = SUM(calc_acres), cropland = SUM(calc_acres) WHERE cropland_flag
fsa_tract_reconciliation per tract × crop_year: reported_on_cropland = SUM(reported_acres) JOIN fsa_cc_stat WHERE consumes_cropland,
                         difference = reported_on_cropland − cropland, plus the polygon-less flag (14891/15208)
fsa_field_allocation     per field × crop_year: consuming_acres, calc_acres, over_by, and the count of overlay lines
```

Constraint that must live in the database, not the UI (§D, §H): **splits close against
the CLU polygon.** Trigger on `fsa_acreage_line` INSERT/UPDATE: for `NEW.clu_id`,
`NEW.crop_year`, if `SUM(reported_acres)` over consuming lines exceeds
`fsa_field.calc_acres + 0.05`, RAISE. Two design points, stated so they can be argued:

- The trigger applies to `source = 'manual'` (producer-entered) lines. Lines with
  `source = 'fsa578_import'` are the record of what was actually filed, and the filed
  2026 form **contains** six over-allocated CLUs (§E). Loading them must succeed and
  §E must find exactly six; the reconciliation view flags them. Rejecting them at import
  would falsify the acceptance test.
- Tolerance 0.05 ac, matching §C.2 / §E.
- Fields with `geometry IS NULL` (no polygon on file) are not checked — there is nothing
  to close against. The reconciliation view shows them as "no boundary", not as fine.

Two §D points that fall out of the shape rather than needing a column: cover crop is a
**line** (`cc_stat='C'`, `crop_code` COVRC/CEG/CO), not a boolean on the cash-crop row;
double-crop second plantings are **lines** (`L`/`J`), so 728.41 ac of overlay is visible
as rows, and the "farmed 4,997.79 vs lines 5,726.20" gap is a query, not a mystery.

Crop labels (§G item 2): `fsa_crop_code (crop_code, type_code, label, registry_crop_id,
confirmed_on)` — seeded only from codes present on the filed form, labels blank until
you supply them. Codes stay in tooltips; labels go on screen.

### 1.3 What the reference migrations `001`–`006` change here

The handoff says they "implement all of this" and to reconcile against them. They are
not on this machine (Phase 0). Please paste them. Until then, the schema above is
derived directly from §C/§D and will be diffed against them before anything is applied
— column names in particular (`acreage_line`, `sub_field_label`, `reported_acres` are
the handoff's; the `fsa_` prefix is mine, to keep the two generations apart in one
database during cutover).

### 1.4 What is deliberately NOT in the new schema

- Tract farmland/cropland columns (§H).
- Sub-field geometry. Sub-fields are labels on lines. The `create_clu_split` machinery
  (032/036), which requires drawn geometry and computes acres from it, is the inverse of
  §D and is retired with `clu_records`.
- RMA unit number, policy number, "reporting unit" (Phase 72 D-18/D-19). Those are the
  insurance report's projection of the same lines and come after the 578 model is
  proven — see §7.
- Any column whose meaning is unconfirmed (§F): `clu_class` labels beyond 2, `L` vs `J`.
  Stored raw, labelled later.

---

## §2 Data — replace the lines, repair the layer

### 2.1 `clu_boundaries` → `fsa_field`

Measured today: 814 rows = 407 GUIDs × 2 loads (`crop_year` 2025 and 2026), attribute
keys `CLUID, FARMNBR, TRACTNBR, CLUNBR, CALCACRES, CLUCLSCD, HELTYPECD, CROPLND3CM,
STATECD, COUNTYCD, ADMNSTATE, ADMNCOUNTY, COMMENTS, FSA_ACRES, Id`. Zero duplicate
`(farm, tract, clu_label)` composites within the 2026 load. `HELTYPECD ∈ {'', N, Y}`;
`CLUCLSCD ∈ {1, 2, 3, 4, 10}`.

Steps: (a) take the `crop_year = 2026` load only, after asserting the 2025 load is
geometry- and attribute-identical per GUID (if it isn't, stop and report); (b) key on
`fsa_attributes->>'CLUID'`; (c) `ST_Multi(ST_MakeValid(geometry))`; (d) `calc_acres` from
`CALCACRES` (not from `ST_Area` — the printed figure is what §C.2 reproduces; `ST_Area`
becomes a validation column in the view, not the stored value); (e) `cropland_flag =
(CLUCLSCD = 2)`; (f) `fsa_tract`/`fsa_farm` derived from the distinct tuples — 65 tract
pairs, 11 farms; (g) names from `field_names.csv` joined on `(farm, tract, clu_number)`.

Gate: §E rows 1 (polygons = 407), 9 (6,261.69 / 5,410.70) — pass required before 2.2.

### 2.2 The filed 2026 FSA-578 → `fsa_acreage_line`

Requires `fsa578_2026_lines.csv` and `fsa578_2026_tracts.csv`, neither on this machine.
No parser is rebuilt (§H). Importer is a script: CSV → `fsa_acreage_line` with
`source = 'fsa578_import'`, joining each line's `(farm, tract, clu_number)` to
`fsa_field.clu_id` via the 2026 layer. **Where the form's CLU number does not resolve**
— 14891/15208 (no polygon at all) and whatever 14903/224 does after renumbering — the
line loads against an `fsa_field` row created with `geometry IS NULL`, `calc_acres IS
NULL`, `clu_id = gen_random_uuid()` and `fsa_attributes->>'no_polygon' = 'true'`, so the
map can "say so rather than rendering an empty frame" (§G). Never invented geometry.
The import report counts and lists them; expected: 14891/15208 (§E row 12) plus the
224 cases.

The tract CSV (Farmland/Cropland/Reported/Difference as printed) loads into
`fsa578_tract_printed (farm_number, tract_number, crop_year, farmland, cropland,
reported, difference, source_file)`. This is **not** stored tract acreage in the §H
sense — the app never reads it. It is the acceptance fixture for §E rows 11–13, kept
in the database so the tests can be re-run after any change. Named so nobody mistakes it.

Gate: **all fourteen §E rows**, including the six over-allocated CLUs by name and the
zero-residual check on tract Differences. If any row fails, the import is wrong; stop.

Column mapping from the CSVs is the one part of this proposal I cannot finalise until
the files arrive. Everything else stands.

### 2.3 `clu_records` — salvage two columns, then archive

Not migrated as lines. Two things in it are worth keeping:

- `field_name` (441 of 444 rows, 55 distinct values) — cross-check against
  `field_names.csv` (54 names). Differences reported, `field_names.csv` wins.
- `zone_id` (243 rows → 50 zones) — the only link between the CLU world and the
  management-zone world. Preserved as `fsa_field_zone (clu_id, zone_id)` so nothing in
  010–013 loses its footing. Not used by the 578 model.

Then the table is renamed `clu_records_feb2026_archive`, RLS kept, and left until §5
consumers are re-pointed. Dropped in the last cutover step, with `clu_boundaries`.

### 2.4 Migration numbering

037–039 exist only in worktrees and were never applied. 037 (thresholds) is harvested
as-is (§3.4). 038 is discarded. 039's *view recreation* is harvested; its RPC is not.
New work starts at **040**, so the numbers in the worktree branches never collide with
anything on `main`.

---

## §3 Application

### 3.1 `fsa-acres/` (Express, :3002) — retire

Reasons already in Phase 0: importer and both backfills target a deleted file; every
rollup in `calc.js` is `total += fsaAcres`; cross-app joins are fuzzy-name ≥30/100;
runs unauthenticated locally. Nothing in it survives a grain change. It stays running,
read-only against `clu_records_feb2026_archive`, until every consumer in §5 is
re-pointed; then the process is stopped and the directory moved to `_retired/`.

### 3.2 Portal Compliance › Acreage — one field-review screen

Keep: ComplianceShell, tab routing, farm/crop filter (Phase 68); MapLibre GL stack,
satellite style, `field-map.tsx` patterns (Phase 70). Replace the five Acreage views
(Map View, CLU Records, Zone Setup, Overlay, As-Applied) with **one** screen, built in a
rendered environment (`glomalin-portal:verify` skill exists for exactly this), against
§G point by point:

| §G | The screen does |
|---|---|
| Names | Every polygon and every row labelled `fsa_field.name`; tract headers `fsa_tract.name`; numbers in a muted secondary line and in tooltips. Unnamed fields get an inline "name this" affordance (66 today) |
| No codes | `fsa_crop_code.label`; `fsa_cc_stat.label`; raw codes on hover only |
| Overlay visible | Header shows *lines* total, *farmed* total, and the gap, with the overlay lines rendered as a distinct hatched band on the field they sit on. 5,726.20 vs 4,997.79 explained on screen |
| Map first | Map on top; **every field also has a row beneath** (§G trap 1). Row list is the same data as the map, filterable, sortable |
| One colour = one thing | Four states only: **over-allocated** / **acres missing** (polygon with no consuming line) / **fine** / **not cropland**. Green reserved for "fine". Palette navy `#0a0f1a` + cyan per §D |
| Non-cropland | Hatched, toggleable, never absent (130 polygons, 851 ac) |
| Labels | Pole of inaccessibility, sized to inscribed circle (`polylabel` — verified in all 407 per §G); no bounding-box centroids |
| No polygon | 14891/15208 rendered as a chip in the row list with "no boundary on file", not an empty frame |
| Sub-fields | Stated in the row: "3 lines on this polygon" — no fake split geometry |

Editing (Phase 3 step 4, after the screen is right): add/edit/delete a `manual` line on
a field; the DB trigger rejects over-allocation; nothing else. Merge/draw/split-with-
geometry from Phase 72 are **not** in scope for the 578 (§1.4).

Retire from the Acreage tab: `reporting-map.tsx` (1,131), `clu-workspace.tsx`,
`clu-card.tsx`, `overlay-map.tsx`, `split-panel.tsx`, `zone-setup-panel.tsx`,
`coverage-import-panel.tsx`, `auto-populate-panel.tsx`, `reporting-clu-panel.tsx`,
`farm-/tract-accordion.tsx`, `bulk-action-bar.tsx`, `map-batch-edit-bar.tsx`,
`acreage-pdf*.tsx`. Zone/coverage panels are not deleted — they move behind an
"Advanced" entry once the 578 screen is the default; they read tables this proposal
doesn't touch.

### 3.3 The orphaned 578 subtree — harvest shape, rewrite body

`form-578-pdf.tsx` (371) is the only component with Share % and a Producer Signature
block; it hard-codes `100%`. `export-578/route.ts` is the only 578-schema CSV; its
columns are per-CLU. `reconciliation-view/-table/-map` + `/api/fsa/reconciliation` +
`get_farm_reconciliation` are CLU×zone intersections keyed on the tuple.

Keep the PDF layout and the export's *intent* (a hand-off file for the county office).
Rewrite both to read `fsa_acreage_line` joined to `fsa_field`/`fsa_tract`, one row per
line, `share_pct` real, `certified_on` real. Retire the reconciliation trio with
`clu_records`; the new `fsa_tract_reconciliation` view replaces what it was for.

### 3.4 Phase 72 worktrees — harvest, discard, park, close

| Artifact | Worktree | Call | Reason |
|---|---|---|---|
| 037 `acreage_thresholds` + `thresholds.ts` + test + admin route | a9fd05c | **Harvest as-is** | Pure math on two numbers; no CLU key; RLS correct. Feeds the "over-allocated" colour |
| 039 `clu_boundaries_geo` view recreation | afc0df6 | **Harvest the pattern** | Needed for `fsa_field_geo` |
| 039 `import_clu_boundary` RPC + `/clu-boundaries/import` route + test | afc0df6 (uncommitted) | **Harvest the route skeleton, rewrite the RPC** | Upsert target must be `clu_id`, not the tuple. Route must read `CLUID` from the DBF (it currently ignores it). Note: route uses `shpjs` server-side; `src/lib/fsa/shapefile.ts` says shpjs is browser-only. Resolve before reuse |
| 72-06 FieldView cron sync + `vercel.json` | a2fc800 | **Harvest as-is** | Touches `fieldview_tokens` and `import_coverage_event` only. Orthogonal |
| 038 `merge_reporting_units` / `insert_manual_clu` + MultiPolygon widen of `split_geometry` | ac549da | **Discard** | Structurally bound to one-row-per-CLU; inherits identity from parent row; writes `fsa_acres` as computed; contradicts §D (sub-fields have no geometry) |
| `merge-panel.tsx`, `overlay-map.tsx` draw mode | ac549da | **Park** (tag, don't merge) | Near-agnostic UI on opaque ids; useful later if a boundary-editing feature is ever specified — it isn't, for the 578 |
| Plans 72-02, 72-05, 72-07 | — | **Close** | No code exists |

Then: `git tag phase72/<plan> <branch>` for each of the four branches, remove the
worktrees, mark Phase 72 **superseded** in ROADMAP/STATE, and open the replacement as
its own phase in `.planning/` (numbering follows whatever GSD assigns).

The uncommitted files in `afc0df6` are committed to that branch before tagging so
nothing is lost.

---

## §4 Tests — add

Today: zero acreage tests in `fsa-acres`, zero FSA tests in the portal (19 vitest files,
all marketing/macro). Two Phase 72 test files exist only in worktrees.

- `fsa-578-audit/e-tests.sql` — the fourteen §E queries as one script printing
  expected beside actual, runnable read-only against Supabase. Run after every
  migration step in §6; the output table is committed next to this file each time.
- vitest (colocated, per project convention): `fsa_cc_stat` consume set, tract
  derivations, allocation trigger semantics (via a pure-TS mirror of the SQL), field-name
  join, and the CSV importer's column mapping once the CSVs exist.
- The one field-review screen is verified rendered, with the `glomalin-portal:verify`
  skill, before it is called done (§H: ship no UI you haven't rendered).

---

## §5 Cross-app consumers — shim during cutover

Everything outside the Acreage tab that reads `clu_records` or calls `fsa-acres` :3002.
Grep'd today across all apps (`node_modules`, worktrees excluded). grain-tickets has
**no** dependency on FSA data (fsa-acres reads grain-tickets, not the reverse).

### 5.1 Inside the portal, outside the Acreage tab (Supabase reads of `clu_records`)

| Consumer | Reads | Today's reality | Re-point to |
|---|---|---|---|
| `app/performance/page.tsx:122` | count of records; count `reported=true` | `reported` is true on 0/444 → shows 0% forever | `fsa_acreage_line` count; count `certified_on IS NOT NULL` |
| `api/dashboard/action-items/route.ts:59` | "unreported CLU records" | every record, always | fields (cropland) with **no consuming line** for the year — the "acres missing" state |
| `api/dashboard/summary/route.ts:34` | record totals | spreadsheet totals (5,977.24) | `fsa_tract_reconciliation` totals |
| `admin/audit/page.tsx:39`, `api/admin/audit/route.ts:32` | record listing | — | `fsa_acreage_line` |
| `api/insurance/aph-lookup/route.ts:25` + `lib/insurance/calc.ts:57` | `farm_name, farm_number, aph, fsa_acres` | `aph` is empty on all 444 rows → lookup returns nothing usable | `aph_records` (020) — already the right table; drop the `clu_records` fallback |
| `api/insurance/pricing/scrape/route.ts:15` | distinct `crop` for scraper scope | crop column mixes `NC`/`gls`/casing variants | distinct `crop_id` on lines where `land_use_status IS NULL` |
| `api/maps/boundaries/route.ts:49` | `registry_field_id, reported` | `registry_field_id` NULL on all 444 → join yields nothing; the map's "reported" ring has never lit | `fsa_field.registry_field_id` + per-field line status |
| `api/maps/field-scorecard/route.ts:60` | `SUM(fsa_acres)` by `registry_field_id` | same — always null | `SUM(calc_acres)` over `fsa_field` by `registry_field_id` |
| `components/claims/claim-drawer.tsx:121` → `api/fsa/clu-summary?policy_id` | records by `farm_number` for the claim's policy | works, on spreadsheet data | lines by farm for the year; label says "FSA Form 578 records" — will finally be true |
| `api/fsa/webhook/field-created` (target of farm-registry propagation) | **writes** a placeholder record `farm_number=0, tract_number=0, clu=field_name` | creates fake CLUs | A registry field is not a CLU. Webhook becomes: upsert nothing; record the registry field name for the name-match queue that fills `fsa_field.registry_field_id`. No placeholder rows in `fsa_field` |
| `sw.ts:272` | caches `/api/fsa/clu-records` for offline | — | cache the new lines endpoint; bump cache name |

Two of these (maps/boundaries, field-scorecard) are already dead because
`registry_field_id` was never populated. The new `fsa_field.registry_field_id` — filled by
name-match against farm-registry, confirmed in the field-review screen — is what makes
them work for the first time.

### 5.2 Other apps → `fsa-acres` :3002

| Consumer | Calls | Purpose | Re-point to |
|---|---|---|---|
| `farm-registry/server.js:775` proxy → `public/app.js:618`, `public/report.js:64` | `GET :3002/api/clu-records`, 5-min TTL cache with stale fallback | field detail page lists "its" CLUs by **normalised field-name match** | portal `GET /api/fsa/fields?registry_field_id=` (new, thin) returning `fsa_field` rows + line summary. Exact key, no fuzzy match |
| `farm-registry/server.js:60` | `POST portal /api/fsa/webhook/field-created` on field propagation | see 5.1 | same webhook, new no-placeholder behaviour |
| `farm-budget/server.js:2454` | `GET :3002/api/rollup/summary-metrics` in the cross-module health tile, 3 s timeout, `allSettled` | shows "Enrolled/Farms/Compliance/Reporting" chips | portal `fsa_tract_reconciliation` summary; the tile already tolerates absence, so this can move last |
| `farm-budget/server.js:470` | `PORTAL_API_URL \|\| 'http://localhost:3002'` | default points the *portal* fetch at fsa-acres' port | Incidental bug, harmless with env set; fix to :3010 while in there |

### 5.3 Shim

During steps 4–8 of §6, `fsa-acres` keeps running read-only against
`clu_records_feb2026_archive`; nothing that reads it breaks until its replacement
endpoint exists and is verified. Each consumer moves individually with a check that its
screen still renders. When the last moves, :3002 stops.

---

## §6 Cutover sequence, with gates

| Step | Do | Gate |
|---|---|---|
| 0 | Receive `fsa578_2026_lines.csv`, `fsa578_2026_tracts.csv`; paste reference migrations 001–006; diff §1.2 against them | Your sign-off on this document |
| 1 | Migration 040: `fsa_farm`, `fsa_tract`, `fsa_field`, `fsa_field_history`, `fsa_cc_stat`, `fsa_crop_code`, `fsa_acreage_line`, `fsa578_tract_printed`, views, trigger, RLS. Beside the old; nothing dropped | Applies clean; `e-tests.sql` runs (all rows CANNOT RUN except polygons = 0) |
| 2 | Migration 041 data: `clu_boundaries` (2026 load) → `fsa_field`/`fsa_tract`/`fsa_farm`; `field_names.csv` → names | §E rows 1 (407 polygons, 65 tracts, 11 farms), 9 |
| 3 | Import script: lines + tracts CSVs → `fsa_acreage_line`, `fsa578_tract_printed`; `fsa_field_zone` from `clu_records.zone_id` | **All 14 §E rows.** This is the decision point of Phase 3 |
| 4 | Harvest 037 + 72-06 + 039 view (renumbered 042+); tag and remove worktrees; Phase 72 → superseded | Suite green, `tsc` clean |
| 5 | One field-review screen, rendered and verified. Compliance › Acreage default view | You look at it and say it reads |
| 6 | Manual line add/edit/delete against the trigger | Over-allocation rejected in DB, shown in UI |
| 7 | Rewrite `form-578-pdf` + `export-578` on lines | Output reconciles to §E totals |
| 8 | Re-point §5 consumers; retire `fsa-acres`; rename `clu_records` → archive | Each consumer verified after its move |
| 9 | Drop `clu_records_feb2026_archive`, `clu_boundaries`, the seven tuple-bound RPCs, `create_clu_split`, orphaned components | §E still all-pass; nothing 404s |

Steps 1–3 are Phase 3 steps 1–2 in the handoff's words. If step 3's gate fails, nothing
after it starts.

---

## §7 Open — do not invent (§F carried forward, plus new)

- **`L` / `J`** — six lines, 273.34 ac carry `L`; operator says both should be `J`. Stored
  raw; `fsa_cc_stat` rows for both with `confirmed_on NULL`.
- **`clu_class` 1/3/4/10** — 130 polygons, 851 ac, unlabelled. `cropland_flag` uses only
  class 2. Labels wait.
- **14903/224 renumbering** — how many lines on the form fail to resolve to a 2026-layer
  GUID is unknown until the lines CSV is here. Import report will list them.
- **`clu_attributes_2026.csv` / `clu_boundaries_2026.geojson`** — absent, but the live
  2026 load reproduces their totals; proposal uses the live load. If you'd rather load
  from the files, step 2 changes source, not shape.
- **Reference migrations 001–006** — absent. §1.2 will be diffed against them.
- **shpjs server-side** — two files in the repo make opposite claims. Settle before the
  import route is reused.
- **RMA / crop-insurance projection** (Phase 72's original goal: unit #, policy #,
  reporting unit, output `.shp` for the agent) — real need, wrong moment. It is a
  projection of `fsa_acreage_line` plus insurance joins, specified after §E passes.
- **Management zones** — 135 zones, 85 unlinked to any CLU record; kept, not touched, fate
  decided when the coverage/as-planted work is next picked up.
- **`gcs_enrollments`** — orphaned table, no migration creates it. §D says conservation
  programs are rows, not tables. Proposal: one `fsa_acreage_line` per enrolment with
  `land_use_status='CRP'`/practice codes when the program data is next needed; table left
  alone until then.
- **`fsa-acres` local `.env` has no `EMBED_TOKEN`** — unauthenticated locally. Moot once
  retired; noted so it isn't forgotten if retirement slips.

---

## §8 Sign-off

Answer per line; "yes" or a correction. Nothing is built until this is returned.

| # | Decision | Yes / No / Change |
|---|---|---|
| 1 | Replace `clu_records` grain with `fsa_acreage_line` / `fsa_field` (GUID) / `fsa_tract`, beside the old, per §1.2 | |
| 2 | Allocation trigger enforces `manual` lines only; imported filed lines load as-is and are flagged (§1.2) | |
| 3 | `fsa_cc_stat` is a reference table with `consumes_cropland`, not a CHECK; seeded I/IN/X = true, C/L/J = false | |
| 4 | `calc_acres` stored from `CALCACRES`; `ST_Area` is a validation column, not the truth | |
| 5 | `fsa578_tract_printed` kept as an acceptance fixture (not app-read) | |
| 6 | `clu_records` content not migrated; `field_name` and `zone_id` salvaged; table archived then dropped | |
| 7 | `fsa-acres` retired after §5 consumers move | |
| 8 | Acreage tab → one field-review screen; five current views retired/moved behind Advanced | |
| 9 | Phase 72: harvest 037, 039-view, 72-06; discard 038; park merge/draw UI; close as superseded | |
| 10 | Migration numbering resumes at 040 | |
| 11 | RMA/insurance projection deferred until §E passes | |
| 12 | You will supply: `fsa578_2026_lines.csv`, `fsa578_2026_tracts.csv`, reference migrations 001–006 | |
