# Field shape management — scope

Read-only survey and design, 2026-09-17. **No writes, no schema changes.**

Decision taken as given: manual import of generic zipped shapefiles, farm by farm, as boundaries
change. No FieldView or monitor-specific formats.

---

## 1. What geometry exists now, and what parsing is reusable

### The inventory

| store | what it holds | count | CRS |
|---|---|---|---|
| **farm-registry** `fields[].geometry` | field polygons, GeoJSON in `data.json` | 53 fields | WGS84 lon/lat |
| **fsa-acres** | **no geometry at all** — zero `coordinates` in its store | — | — |
| **Supabase** `field_boundaries` | `geojson` jsonb **and** `geometry` PostGIS, plus centroid, `total_acres`, `source` | 53 rows, 51 with geometry | PostGIS |
| **Supabase** `clu_boundaries` | FSA CLU polygons, **carries `crop_year`** | 814 | PostGIS |
| **Supabase** `management_zones` | named sub-field polygons | 135 | PostGIS |
| **Supabase** `field_boundary_history` | previous geometry on replace: `field_boundary_id`, `geometry`, `total_acres`, `replaced_at`, `replaced_by`, `source` | 4 | PostGIS |
| farm-budget `fields[].geometry` | **placeholders** — four-corner boxes on 6 rows | 6 | ignore |

Two copies of field geometry are live: farm-registry's JSON and Supabase's `field_boundaries`.
They agree in count (53) and `field_boundaries.source` says where it came from —
**`shapefile_usb_2026` on 51 rows**, `shapefile` on 2. So this flow has effectively been run once
already, by hand.

### Is fsa-acres' shapefile parsing reusable?

**There isn't any.** fsa-acres holds the raw `Rock ShapeFiles/` (11 tracts × .shp/.dbf/.prj/.shx)
and `Rock ShapeFiles.zip`, but its `package.json` has only `express`, `xlsx`, `cors`,
`cookie-parser`, `dotenv` and `supabase-js`. No shapefile library. The files are data, not a parser.

**The portal already has the parser, and an import route.**

- deps: **`shpjs` 6.2**, `shapefile` 0.6, **`proj4` 2.20**, `@mapbox/mapbox-gl-draw`
- `POST /api/maps/import` — admin-only, accepts a `.zip`, parses with `shpjs`, matches features to
  registry fields by name + alias, computes centroids, writes `field_boundaries`
- `src/lib/fsa/shapefile.ts` and `GET /api/fsa/export-shapefile` — export already exists
- `src/components/maps/boundary-import.tsx` — an upload UI exists

**One thing in fsa-acres *is* worth reusing:** `scripts/backfill-clu-registry.js` already does the
two-stage match this flow needs — normalised **name** against registry names and aliases, then
**spatial** (centroid inside exactly one registry polygon), leaving ambiguous rows null for a human.
That is the matching stage of the new flow, already written and proven against 814 CLUs.

### The problem with the route that exists

```
// --- Full replace: DELETE ALL existing boundaries ---
await adminClient.from('field_boundaries').delete().neq('id', '000…000')
```

`/api/maps/import` **deletes every boundary row before inserting the matched ones**. Uploading one
farm's zip today would wipe the other 52 fields' geometry. That is the exact behaviour your spec
forbids, and it is live. Everything else about the route is sound and worth keeping.

Other gaps against the spec: no farm scoping, no `.prj` requirement, no attribute-column choice
(hardcoded to `Name`/`name`/`FIELD_NAME`/`field_name`), no manual assignment, no diff or preview
(it writes on upload), no validation, no versioning, no acre-delta report, and it can only ever
write `field_boundaries` — never `management_zones`.

On reprojection: `shpjs` reprojects via proj4 **when a `.prj` is present** and silently assumes
WGS84 when it is not. So "require `.prj`" has to be a pre-check on the zip's contents — the parser
will not complain on its own.

---

## 2. Do zones support versioning by crop year?

**Geometry: no. Attributes: yes.**

| table | crop year? |
|---|---|
| `management_zones` | **no** — only `created_at` / `updated_at`. One geometry, forever |
| `zone_year_attributes` | **yes** — `zone_id` + `crop_year`, with crop, variety, irrigated, organic, intended_use, tillage, cover_crop. 74 rows, all 2026 |
| `field_boundaries` | **no** version or effective date |
| `field_boundary_history` | an audit trail, not a version: `replaced_at` + `replaced_by`. 4 rows |
| `clu_boundaries` | **yes** — carries `crop_year` |

So the model already separates *where the zone is* from *what was grown on it in a given year* —
which is the right split, and it means attribute history is safe today. What is missing is that
**re-importing a boundary overwrites the polygon**, so last year's shape is lost except for
whatever `field_boundary_history` happened to capture, and a 2025 acre figure silently becomes a
2026 one.

### What versioning needs

The smallest change that satisfies "save as a new version effective from a chosen crop year,
never deleting fields missing from the file":

- an **`effective_crop_year`** on the geometry row (both `field_boundaries` and `management_zones`),
- a **`superseded_at`** (null = current) instead of deleting,
- an **`import_batch_id`** so one upload is one reviewable, reversible unit,
- a partial unique index on (registry_field_id, layer) `where superseded_at is null`, so exactly one
  current shape per field per layer.

Reading a shape for year N is then "the row with the greatest `effective_crop_year` ≤ N". A field
absent from a file is simply not superseded — it keeps its current shape, which is the
never-delete rule expressed as data rather than as care.

`clu_boundaries` already works this way, so there is a precedent in the same database.

---

## 3. The import flow

Nine steps. Steps 1–7 write nothing; only step 8 does.

**1 — Pick the farm and the layer.** Farm from farm-registry `farms[]`. Layer is chosen explicitly,
never inferred: **field boundary** or **production zone**. Same pipeline, different destination
table and different match target (registry fields vs that field's existing zones).

**2 — Upload the `.zip`.** Reject unless it contains `.shp`, `.dbf` **and `.prj`**. Say which is
missing. The `.prj` requirement is ours, not the parser's — `shpjs` will happily assume WGS84.
Reproject to EPSG:4326 through proj4 and record the source CRS on the batch, so a wrong `.prj`
is diagnosable later.

**3 — Choose the name attribute.** Show the `.dbf` columns with three sample values each, and let
the operator pick which one carries the field name. **Remember it per farm** (a small
`farm_import_prefs` row keyed by farm + layer), defaulting to the remembered choice next time and
saying so. This replaces the current hardcoded guess.

**4 — Match shapes to that farm's registry fields.** Two passes, borrowed from
`backfill-clu-registry.js`: normalised name against registry `name` + `aliases`, then centroid-in-
polygon against the current boundary. A shape that matches exactly one field is proposed; anything
else lands in a manual assignment list with a dropdown of that farm's fields, plus "new field" and
"ignore". **Nothing auto-assigns on a tie.**

**5 — Diff.** Per shape, one of four states:

| state | meaning |
|---|---|
| **unchanged** | geometry equal within tolerance |
| **changed** | matched an existing field, shape differs — show old acres, new acres, delta and % |
| **new** | no existing shape for that field |
| **missing** | field has a current shape but is absent from this file — **listed, never deleted** |

**6 — Validate**, per shape, blocking on the first two:

- **invalid geometry** — `ST_IsValid`; offer `ST_MakeValid` and show what it changed
- **slivers** — area below a threshold (0.1 ac is where the existing zone data's junk sits), or a
  thinness ratio, to catch digitising noise
- **overlap with neighbours** — `ST_Intersects` against other current shapes in the same farm and
  layer, reporting overlapping acres; small slivers are a warning, material overlap is a block
- **not inside its field** — for the zone layer, a zone materially outside its field's boundary

**7 — Map preview.** The four diff states as colours over the current boundaries, with the
validation hits marked. This is the review surface; `field-map.tsx` and `mapbox-gl-draw` are already
in the portal.

**8 — Save as a version effective from a chosen crop year.** One `import_batch` row (farm, layer,
crop year, filename, source CRS, name column, operator, timestamp). For each accepted shape: insert
a new geometry row with `effective_crop_year`, and set `superseded_at` on the row it replaces.
**Fields missing from the file are untouched.** The batch is the unit of undo.

**9 — Report acre drift, and change nothing.** For every field in the batch, compare polygon acres
against **`plantedAcres`** (the farm-budget enterprise figure, which is what every per-acre cost is
computed on) and **`reportingAcres`** (farm-registry). List anything over **3%** with both deltas.
**No automatic acre changes** — the report is the deliverable. Given `plantedAcres` drives rent,
inputs and every $/ac figure in the budget, an automatic write here would silently restate the
whole book.

**Export.** Per farm, per layer, per crop year, as a zip with a `.prj`. `GET /api/fsa/export-shapefile`
and `src/lib/fsa/shapefile.ts` already exist and need scoping by farm and layer rather than rewriting.

---

## 4. Where it lives, and how farm-registry links

**The portal, against Supabase.** It is the only store with PostGIS — `ST_IsValid`, `ST_Area`,
`ST_Intersects` and `ST_MakeValid` are the whole of step 6, and doing that anywhere else means
reimplementing geometry in JavaScript. The parser, the map component, the export and an import route
are already there, and it is the only app with a real auth/role model (`profiles.role`, admin-only)
for something this destructive.

**The link is `registry_field_id`, a plain text `fld_NNN`, and it already exists** on
`field_boundaries`, `management_zones`, `clu_records` and `clu_boundaries`. farm-registry stays the
authority for *which fields exist*, their names, aliases and reporting acres; Supabase becomes the
authority for *their shape over time*. No foreign key across the two, so a nightly or on-demand
check for `registry_field_id` values with no registry field is worth having.

What I would **not** do: make Supabase geometry authoritative for acres. `reportingAcres` in
farm-registry and `plantedAcres` in farm-budget stay hand-maintained, with the 3% report as the
prompt to change them deliberately.

The duplicate in farm-registry's own `fields[].geometry` should become a read-through or a
one-directional sync from Supabase, or it will drift. Worth deciding before the first real import,
not after.

---

## 5. Zone data cleanup needed first

`management_zones` is not in a state to build on. Of 135 rows:

| | count | |
|---|---|---|
| **no `registry_field_id` at all** | **64 (47%)** | and their names are *field* names — Airport, Bakke, Buchanon, Caravilla, Blues, Brads — not zone names. These look like field boundaries loaded into the zone table |
| **exact duplicate pairs** | **22** | same field, same name, `ST_Equals` geometry — a double import |
| **invalid geometry** | **25** | self-intersections, nested shells, "too few points" |
| **under 0.1 acre** | **14** | slivers |
| **overlapping pairs within a field** | **41** | of which 22 are the exact duplicates above; ~19 are genuine overlaps |
| linked, plausibly real zones | **71** across 16 fields | named "Field – Parcel N" |

`zone_year_attributes` is clean by comparison: 74 rows, all `crop_year` 2026, **no orphans** — every
row points at a zone that exists.

Four decisions, in order, before any import writes to this table:

1. **The 64 unlinked rows.** If they are field boundaries, they belong in `field_boundaries`, not
   here. Link them by name, move them, or delete them — but pick one.
2. **The 22 duplicate pairs.** Mechanical once decided: keep the newer, drop the other. Check
   `zone_year_attributes` first — if attributes hang off the copy being dropped, they move.
3. **The 25 invalid geometries.** `ST_MakeValid` each, and eyeball the ones whose acreage moves.
4. **The 14 slivers and ~19 real overlaps.** These need your eye; they are the ones that say
   something about the ground rather than about the import.

Until 1 and 2 are settled, the "one current shape per field per layer" index in §2 cannot be
created — the duplicates would violate it. Which is a good sign the index is the right constraint.
