# PHASE 1 — §E acceptance tests against the current database, unchanged

Run 2026-08-14 against live Supabase (`clu_records`, `clu_boundaries`), read-only.
Where a §E concept does not exist in the schema, the row is marked **CANNOT RUN** and the nearest measurable analog is shown.

| # | §E query | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | acreage lines / tracts / farms / polygons | 320 / 62 / 11 / 407 | 444 rows (but they are CLU-crop rows, not form lines) / **no tract entity** (65 distinct farm-tract pairs) / **10** (14750 missing) / **814** (407 loaded twice) | **FAIL** |
| 2 | SUM(reported_acres) all lines | 5,726.20 | no `reported_acres` column; nearest: SUM(`fsa_acres`) = **5,977.24** | **FAIL** (concept absent) |
| 3 | SUM WHERE cc_stat IN ('I','IN','X') | 4,997.79 | — | **CANNOT RUN** — no `cc_stat` |
| 4 | SUM WHERE cc_stat = 'C' | 446.77 | nearest: `cover_crop=true` = 1,678.36 over 81 rows, as flags **on** consuming rows | **CANNOT RUN** |
| 5 | SUM WHERE cc_stat IN ('L','J') | 281.64 | nearest: `double_crop=true` = 161.00 over 2 rows | **CANNOT RUN** |
| 6 | SUM WHERE cc_stat = 'X' | 38.17 | nearest: `prevented_planting=true` on **0** rows | **CANNOT RUN** |
| 7 | SUM WHERE cc_stat = 'IN' | 307.23 | — | **CANNOT RUN** |
| 8 | organic / irrigated, consuming lines | 1,136.53 / 1,900.83 | `organic=true` **1,145.23** / `irrigated=true` **1,936.00** — the exact phantom figure from the broken sheet (§A) | **FAIL** |
| 9 | SUM(calc_acres) all / cropland | 6,261.69 / 5,410.70 | **6,261.69 / 5,410.70** per load (CLUCLSCD=2, 277 polygons) — but the layer is duplicated, so raw table sums are 2× | **PASS** (per-load) |
| 10 | lines with a signature date | 320 of 320 | no such column; `reported=true` on **0 of 444** | **FAIL** (concept absent) |
| 11 | tract reconciliation rows reported ≠ derived | 0 of 62 | — | **CANNOT RUN** — no tract entity, no derivation |
| 12 | tracts where CLU cropland ≠ form cropland > 0.05 | 1 (14891/15208) | — | **CANNOT RUN** — form tract data not loaded |
| 13 | tracts with non-zero Difference | 14 | — | **CANNOT RUN** |
| 14 | CLUs over-allocated by > 0.05 | 6 | — | **CANNOT RUN** against form lines (not loaded). Inverse defect present: recorded splits **under**-shoot their polygon by up to 67.7 ac (`14903/10084/1`: 9.4 vs 77.08) with nothing to catch it | **CANNOT RUN** |

Score: **1 conditional pass** (the CLU polygon layer, which was imported from the county shapefiles and bypasses the spreadsheet lineage), **3 fails**, **8 cannot-run**.

## The decision-point question, answered in writing

**Does the existing schema have a `cc_stat` equivalent, and does it distinguish lines that consume field acres from lines that overlay them?**

**No, and no.**

- `cc_stat` appears nowhere in the workspace — not in any migration, any TypeScript, the legacy app, the live database, or the source spreadsheet's column map. The concept was never present at any generation of this module; the gap originates in the spreadsheet the data came from.
- The consume/overlay distinction is structurally unrepresentable: `clu_records` permits **one row per CLU** (unique index `idx_clu_records_unique_unsplit`), cover crop and double crop are booleans on that single consuming row, "Cover Crop" is offered as a pseudo-crop that *replaces* the cash crop, and the split mechanism partitions geometry so children always consume disjoint acres. There is no path for two lines covering the same ground with different status. Every rollup in both apps sums `fsa_acres` unconditionally.

Per the handoff's own decision tree, this is the third branch: **the tests can't run because the concepts don't exist — the schema is wrong at the grain. Replace it.**

## What the measurement says is salvageable (facts only; the plan is Phase 2)

- **The CLU boundary data** reproduces §C.2 exactly (6,261.69 / 5,410.70; 407 distinct CLUID GUIDs). Defects are containment-level: duplicated load, GUID buried in jsonb instead of being the key.
- **PostGIS plumbing exists and works**: geometry columns, GIST indexes, overlay/intersection RPCs, shapefile import (×4 implementations) and export.
- **RLS discipline is real** on all base tables.
- **`field_names.csv`** (received today) verifies cleanly and covers naming for 390 fields.
- **The acreage-line content of `clu_records` is not salvageable as 578 data**: it is the February spreadsheet, incomplete (140 blank crops, farm 14750 absent, 0 rows ever marked reported), and it embeds the sheet's known-wrong figures (1,936.00 irrigated). The filed 2026 FSA-578 must come from `fsa578_2026_lines.csv` / `fsa578_2026_tracts.csv`, which are **not yet on this machine**.

**Stopped here per the handoff. Phase 2 (repair/replace proposal) awaits operator sign-off on these two reports.**
