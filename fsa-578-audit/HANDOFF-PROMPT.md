<!-- Recovered 2026-08-16 from the 2026-08-14 session transcript (pasted operator prompt). Saved here so the audit series has its spec alongside it. Encoding repaired; content otherwise verbatim. -->

# Glomalin — FSA acreage module: audit and replace

**This is a prompt, not documentation. Read all of it before running anything.**

There is already an FSA reporting module in this repo. It was built earlier and it is
not usable. You are being asked to find out why, decide what is salvageable, and replace
what isn't.

**Do not start rewriting.** Phase 0 is an inventory and Phase 1 is a measurement. Both
produce a written report and stop. The operator signs off before any code changes. This
is the same discipline that produced the spec below, and it exists because the last two
attempts at this module — one by you, one by another model — both failed by building
before understanding.

The spec in §A–§F is verified against source documents. Where it says a number, that
number reproduces exactly. Treat it as ground truth and measure the existing code
against it.

---

# PHASE 0 — Inventory. Write a report. Stop.

Find and describe, without changing anything:

**Schema.** Which migrations exist and which have run. Every table, view, function and
trigger belonging to acreage reporting. Which have RLS. Which have data in them and how
many rows.

**Data.** Is the 2026 FSA-578 loaded? The CLU layer? Where did they come from — a parser
in this repo, a manual import, hand entry? Are there duplicate or partial loads?

**Application.** Every route, page and component touching acreage. What each screen is
supposed to do. Which are reachable from navigation and which are orphaned.

**Tests.** What exists. What it covers. Whether it passes.

**Divergence.** Where the existing schema disagrees with §C below — different grain,
different keys, missing concepts, extra concepts. Be specific: table and column.

Report as a written inventory. Do not propose fixes yet.

---

# PHASE 1 — Measure it. Write a report. Stop.

Run the §E acceptance tests against whatever is in the database **now**, unchanged.
Report pass/fail per row with the actual value beside the expected one.

This is the decision point:

- **Most tests pass** → the data layer is sound and the problem is above it. Keep the
  schema, replace the UI.
- **Tests fail on totals** → the import is wrong. Schema may still be fine.
- **Tests can't run because the concepts don't exist** → the schema is wrong at the
  grain. Replace it.

Then answer one question in writing: **does the existing schema have a `cc_stat`
equivalent, and does it distinguish lines that consume field acres from lines that
overlay them?** If it doesn't, the schema cannot express an FSA-578 correctly and no
amount of UI work will make the module usable. That single distinction is the most
likely root cause of "not usable" and it is the first thing to check.

---

# PHASE 2 — Propose. Get sign-off.

A written plan: per layer, repair or replace, with reasons. Migration strategy if the
schema changes and data already exists. Then stop for the operator.

---

# PHASE 3 — Build

Order: schema → import → **one** field-review screen → editing → everything else.
Steps 1–2 are the whole value proposition. If the rollups agree with a hand count off
the filed 578, the model is proven and the rest is convenience.

---
---

# §A — What this replaces, and why the shape matters

A Google Sheet exported to `.xlsx`, running acreage reporting and crop insurance off one
446-row table. Its failure modes are the design brief:

- Displayed values did not match its own formulas. It showed 1,936 irrigated acres;
  recalculating the same formula gave 0. Google open-ended ranges (`$I$3:$I`) were frozen
  by the export at row 67 — the *other sheet's* row count.
- Crop, status and land use shared one column, so `NC`, `gls`, `idle` and `CRP` rolled
  up as if they were crops.
- The insurance schedule joined on a Line Number populated on 41 of 446 rows. The
  three-way reconciliation had never once worked.
- Producer shares didn't exist. Double crop was a boolean used on 2 rows of 446. The
  2025 tillage and cover-crop columns were byte-identical to 2024, because they were
  copied forward and never filled.

Do not port any of it.

---

# §B — Sources of truth

| File | What it is | Status |
|---|---|---|
| `fsa578_2026_lines.csv` | 320 acreage lines from the filed FSA-578 | **Verified twice.** Every crop/type/use/irrigation subtotal reproduces the form's own totals block. Independently confirmed against an Excel rendering of the same form |
| `fsa578_2026_tracts.csv` | 62 tract blocks: Farmland, Cropland, Reported, Difference | Verbatim; all 62 identical across both renderings |
| `clu_attributes_2026.csv` | 407 CLU polygons, attributes | Rock County shapefiles, 2026-04-30 |
| `clu_boundaries_2026.geojson` | Same 407, reprojected 26916 → 4326 | For PostGIS |
| `field_names.csv` | **The operator's own names for 390 of his fields** | 54 distinct names across 65 tracts |

These are outputs. The parsing is done. **Do not rebuild the PDF parser or the CLU
reader.** If the repo contains its own parser, Phase 0 should say so and Phase 1 should
check whether its output matches these files.

**`field_names.csv` is not decoration.** He does not think in CLU numbers. He thinks in
*daun*, *carrol*, *buchanan*, *cuff*, *murray*, *omni*, *fox den*, *goat pasture*. Load
into `field.name` and `tract.name` and use them in every view. 66 polygons have no name;
give him a way to add them. A screen that says `14903/15662` has already lost him.

A **data** export from FSA (CSV/EFT out of Farm Records) would retire the parser. It has
been requested and not supplied — what arrived was the same printout run through a
PDF-to-Excel converter, 7,049 merged cells, values crammed into single cells like
`'COM  GR  N  C  N  I  A'`. Harder to parse than the PDF. The ask stays open.

---

# §C — The two derivations everything depends on

Both established empirically against the filed form, not assumed. If the existing schema
cannot express these, it is the wrong schema.

### C.1 Reported on Cropland

```
Reported on Cropland = SUM(reported_acres) WHERE cc_stat IN ('I','IN','X')
Difference           = Reported on Cropland - Cropland
```

Tested against all 62 tracts: **zero mismatches**. Every other combination of the six
status codes fails on at least one tract.

The concept underneath, which is the whole conceptual difficulty of the form: **some
lines divide a field, others sit on top of it.** Cover crop (`C`) and double-crop second
lines (`L`,`J`) overlay ground already counted. 320 lines total 5,726.20 acres but he
farms 4,997.79 — the 728.41 difference is not an error.

### C.2 Tract acres come from the CLU layer

```
Cropland = SUM(calc_acres) WHERE cropland_flag
Farmland = SUM(calc_acres)
```

Reproduces the form's printed figures on **61 of 62 tracts within 0.05 ac**. The miss is
14891/15208, which has no polygon. These are queries, not stored columns. If the existing
schema stores them as entered values, that is a defect.

---

# §D — Locked decisions

Argue only with evidence, because each came from the filed data.

- **`field` is the FSA CLU.** Lettered sub-fields (`4A`, `18J`, `329B`) are
  producer-assigned in-season splits — he creates them; the county office doesn't see
  them until filing. They belong on `acreage_line.sub_field_label`, not in `field`.
- **Sub-field labels are not stable across years.** Roll-forward joins on the CLU, never
  the label. Joining on the label silently carries last year's crop onto differently
  drawn acres.
- **`clu_id` (the CLU GUID) is the join key.** The number isn't stable: 14903/224
  renumbered between the April layer and the August form (578 has CLUs 31/32/33, layer
  has 9–28; tract acres still agree at 65.15 vs 65.13).
- **Organic status is a practice on the line, not part of the crop name.** `wheat` and
  `organic wheat` are one crop.
- **Non-producing status forces `crop_id IS NULL`** by check constraint, so `NC`/`gls`/
  `idle`/`CRP` can never reach a price lookup.
- **Cover crop is a reported commodity line** (`COVRC`/`CEG`/`CO`), not only a practice.
- **Conservation programs are rows, not tables.** GCS is one row; its funding is ending.
- **Certification is per line.** Three tranches in 2026: 11/17/2025 fall-seeded (40 lines,
  589.67 ac), 03/04/2026 CRP (2, 6.20), 07/15/2026 spring (278, 4,401.92).
- **Splits must close against the CLU polygon**, enforced in the database. Nobody outside
  this system checks it — the county office doesn't see a split until the form is filed.
- **Money integer cents. Acres `numeric(10,2)`. FSA identifiers text. Timestamps
  `timestamptz`, UTC stored, America/Chicago displayed. RLS on every table.**
- **Design: deep navy `#0a0f1a`, cyan/turquoise accents, Outfit / DM Sans / Berkeley Mono.
  No green** — reserved for "passing" in validation UI.

Reference migrations `001`–`006` implement all of this. **They have never been run against
Postgres.** Use them as a specification of intent; expect syntax errors; reconcile them
against whatever schema already exists rather than assuming either is right.

---

# §E — Acceptance tests

Not approximations. Run these in Phase 1 against the current database, and again after
any rebuild.

| Query | Expected |
|---|---|
| acreage lines / tracts / farms / polygons | 320 / 62 / 11 / 407 |
| SUM(reported_acres) all lines | **5,726.20** |
| SUM WHERE cc_stat IN ('I','IN','X') | **4,997.79** |
| SUM WHERE cc_stat = 'C' | **446.77** |
| SUM WHERE cc_stat IN ('L','J') | **281.64** |
| SUM WHERE cc_stat = 'X' | **38.17** |
| SUM WHERE cc_stat = 'IN' | **307.23** |
| organic / irrigated, consuming lines | **1,136.53** / **1,900.83** |
| SUM(calc_acres) all / cropland | **6,261.69** / **5,410.70** |
| lines with a signature date | **320 of 320** |
| tract reconciliation rows where reported ≠ derived | **0 of 62** |
| tracts where CLU cropland ≠ form cropland by >0.05 | **1** (14891/15208, no polygon) |
| tracts with non-zero Difference | **14** (+38.59 over on 4, −203.34 under on 10) |
| CLUs over-allocated by >0.05 | **6** |

The six over-allocated CLUs, which the split constraint must reject on write:

```
14903/15231/4    reported 130.66  polygon 115.42  +15.24   (omni)
14903/15662/24   reported  54.50  polygon  47.26   +7.24
14903/15209/24   reported   7.39  polygon   0.36   +7.03   (cuff)
14903/15206/126  reported 116.84  polygon 110.66   +6.18   (simpsons)
14903/15662/23   reported  11.94  polygon  10.45   +1.49
14903/15206/24   reported  32.16  polygon  30.75   +1.41   (simpsons)
```

Each tract's printed Difference is exactly the sum of its own CLU overages, with no
residual. If that doesn't hold, the import is wrong.

---

# §F — Open. Do not invent answers.

- **`L` / `J` crop status.** Operator confirmed both should be `J`; FSA made a keying
  error and will correct it. **Six lines carry `L`**, 273.34 ac. Semantics of
  `I`/`IN`/`C`/`X`/`L`/`J` remain unconfirmed — they are *not* the paper form's published
  legend. Store raw codes; never normalise them away.
- **`clu_class` labels.** Only class 2 = cropland is confirmed (matches `cropland_flag`
  exactly on all 407). Classes 1, 3, 4, 10 unlabelled — 130 polygons, 851 acres.
- **Prevented-plant lines carry planting dates.** 14903/15211 CLUs 4A and 4D, both `X`,
  both 05/01/2026. Same tract is 55.00 ac under-reported.
- **425.85 ac of cropland has a polygon and no acreage line**, across 43 CLUs. Largest
  single tract 14903/12526 at 211.41 ac. Farm 14750 appears nowhere on the form.
- **Kernza.** Reported `GRASS`/`WIN`/`SD`, 9.82 ac; his records show ~19.6.
- **Reporting deadlines.** Seed nothing unconfirmed. Carry a `confirmed_on` stamp.

---

# §G — Why it probably isn't usable, and what to build instead

The task is not data entry. **He finds errors visually.** His words: *"finding errors is
a visual task for me, that's why so many errors slip past on the 578 now, it's just so
hard to read."*

Check the existing UI against these specifically — they are the most likely causes of
"not usable":

1. **Does it use his field names?** If it labels ground by farm/tract/CLU number, that
   alone makes it unreadable to him.
2. **Does it show FSA codes on screen?** `CORN YEL SD`, `HERBS PEP`, `SOYBN HPT`, `X`,
   `IN` are not language. "Seed corn," "Peppermint," "High-protein soybeans," "Couldn't
   plant," "Grass" are. Codes belong in tooltips at most.
3. **Does it make the overlay concept visible?** If a screen shows 5,726.20 acres of
   lines against 4,997.79 farmed and doesn't explain the gap, every number on it looks
   wrong.
4. **Is it a table when it should be a map?** He has boundaries for 407 fields. Errors he
   cannot see are errors he will miss.
5. **Does colour mean one thing?** Four states — too many acres, acres missing, fine, not
   cropland. Not four abstract taxonomies to switch between.
6. **Is non-cropland rendered as absent?** 130 polygons, 851 acres of woods, pasture,
   farmsteads and roads legitimately have no acreage line. Drawn near-background they
   read as broken data. Hatch them and offer a toggle.

Two traps already hit, so you don't repeat them:

- **Label placement.** Bounding-box centres fall *outside* 122 of these 407 polygons —
  text lands on a neighbouring field and the map looks broken. Use pole of inaccessibility
  (`shapely.algorithms.polylabel` was verified inside all 407), size to the inscribed
  circle, and give every field a row or chip beneath the map so nothing is findable only
  by tapping.
- **Places with no boundary.** 14891/15208 has reported fields and no polygon. Say so
  rather than rendering an empty frame.

**Sub-fields have no geometry.** FSA maps the whole CLU; `4A`/`4B`/`4C` exist only as
numbers, so one polygon can carry three crops. State that in the UI rather than pretending
to draw a split you don't have.

There are six `.jsx` prototypes from the previous session. **They were never rendered —
written blind, parse-checked, shipped, patched from user reports.** The operator's verdict
was "feels like slop." Do not lift the code. Six screens is not a spec; it is one screen
abandoned five times. Build **one** field-review screen, in an environment where you can
see it, and make it good before building a second.

---

# §H — Do not

- Rebuild the PDF parser or CLU reader.
- Export Excel with live formulas — that rebuilds the machine that produced wrong numbers.
- Enforce the split balance only in the UI.
- Store tract Farmland/Cropland as entered values.
- Ship UI you haven't rendered.
- Skip Phase 0 and Phase 1.
