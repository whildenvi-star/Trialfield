# The 8 unlinked zones, a rename pass, and the versioned importer

Read-only, 2026-09-17. **No writes.** Nothing below runs without your approval.

---

## 1. The 8 unlinked live zones — none of them should be linked

Every one is **100% overlapped by an existing live zone on the same field, at the same acreage**.
They are the raw-shapefile-named twins of zones that are already linked and already live. My dedupe
missed them because I scoped it to `registry_field_id is not null`, and these are the unlinked side.

| zone | acres | is 100% the same ground as | that zone's acres | verdict |
|---|---|---|---|---|
| OM1SHOP | 32.4 | `OM1 – Parcel 1` (fld_043) | 32.4 | duplicate → retire |
| Cuff | 130.1 | `Cuffs – Parcel 1` (fld_010) | 130.1 | duplicate → retire |
| Klug-Davis | 136.2 | `Klug Davis – Parcel 1` (fld_032) | 136.2 | duplicate → retire |
| East | 40.6 | `Kopp – SEED26 1 2026` (fld_033) | 40.6 | duplicate → retire |
| Murray | 52.7 | `Murray – Parcel 1` (fld_036) | 52.7 | duplicate → retire |
| Simpsons | 42.2 | `Simpsons – SEED26 2026` (fld_050) | 42.2 | duplicate → retire |
| Buchanon | 9.1 | `Buchanon – Parcel 1` (fld_007) | 9.1 | duplicate → retire |
| Gessert | 17.8 | `Gessert – Parcel 1` (fld_021) | 17.8 | duplicate → retire |

Four are byte-identical after snapping (OM1SHOP, East, Buchanon, Gessert). The other four —
Cuff, Klug-Davis, Murray, Simpsons — are the same ground and the same acreage but no longer match
exactly, because all four were among the 25 polygons `ST_MakeValid` repaired. The repair moved the
vertices; it did not make them different zones.

**So "link these 8" was the wrong instinct, mine included.** Nothing is lost by retiring them: the
ground is already represented, under a better name.

### A second set the layer split created

Moving the raw irrigation zones to `layer = 'irrigation'` left each one beside its tidy twin, which
is still sitting in `layer = 'production'` — the same polygon in two layers. The unique index cannot
see it, because `layer` is part of the key.

| raw, now `irrigation` | tidy twin, still `production` | acres |
|---|---|---|
| PhilhowerRdIrrBoun | Phillhower East – Irrigation 1 | 270.2 |
| TownlineRdIrrBound | Townline – Irrigation | 230.5 |
| Gessley Irrigation | Gessley – Irrigation 1 | 158.9 |
| Simpson Irrigation | Simpsons – Irrigation 1 | 113.7 |
| KoppEastIrrBound | Kopp – Irrigation | 81.9 |
| Jones Irrigation | Jones – Irrigation | 78.6 |
| Hoff Irrigation | Hoff – Irrigation | 67.6 |
| Christopherson Irr | Delong Christpherson – Irrigation | 52.5 |
| Gessert Irrigation | Gessert – Irrigation | 254.2 *(near-identical, not byte-equal — repaired)* |

**Proposed:** retire the raw one, and move the tidy twin to `layer = 'irrigation'`. That keeps the
better name, puts the irrigation extents in the right layer, and leaves nine pairs as nine zones.

This is my error to own: I set the layer on the raw rows without checking whether the tidy rows were
the same ground. The rehearsal would not have caught it — the constraint permits it by design.

### Where that leaves the count

| | now | after |
|---|---|---|
| live production | 51 | **34** |
| live irrigation | 9 | **9** |
| retired | 75 | **92** |
| total rows | 135 | 135 |

---

## 2. Rename pass — one list, nothing renamed yet

Only three zones need renaming. The rest of the "raw label" problem dissolves into the retirements
above, because the tidy twin already exists and survives.

| live zone | acres | field | rename to | where the name comes from |
|---|---|---|---|---|
| `Peas26` | 267.9 | fld_042 Omni | **`Omni – PEAS26 2026`** | its retired duplicate twin |
| `SimpSouthSeed26` | 45.9 | fld_050 Simpsons | **`Simpsons – SEED26 1 2026`** | its retired duplicate twin |
| `SimpTrianSeed26` | 6.0 | fld_050 Simpsons | **`Simpsons – SEED26 2026`** | its retired duplicate twin |

These three survived because "keep the older" kept the raw-named import and retired the tidy one.
The rename restores the label without touching geometry, links or attributes.

**Note on the third:** renaming `SimpTrianSeed26` to `Simpsons – SEED26 2026` gives fld_050 two live
zones called `Simpsons – SEED26 2026` — the 42.2 ac one and this 6.0 ac one. That is legal under the
shape-keyed index, but confusing. **`Simpsons – SEED26 2 2026` would be better**, matching the
`SEED26 2` / `SEED26 3` siblings already there. Your call.

---

## 3. The versioned importer — design

### What is already done

The migration is applied: `effective_crop_year`, `import_batch_id`, `retired_at` / `retired_reason` /
`retired_batch`, `geom_key`, `layer`, `needs_geometry`, plus `import_batches` and
`farm_import_prefs`, and the two partial unique indexes. **No further schema work is needed for
versioning** — the columns the importer writes already exist.

### What gets reused

| piece | where | change |
|---|---|---|
| shapefile parsing | `shpjs` in `POST /api/maps/import` | none — lift as is |
| centroid maths | same route | none |
| registry name + alias matching | same route | widen to fall back on centroid-in-polygon |
| **name-then-centroid matcher** | `fsa-acres/scripts/backfill-clu-registry.js` | port to TypeScript; it already does exactly the two-pass match, proven over 814 CLUs |
| export | `GET /api/fsa/export-shapefile`, `src/lib/fsa/shapefile.ts` | scope by farm + layer |
| map | `src/components/maps/field-map.tsx`, `mapbox-gl-draw` | add the four diff colours |
| upload UI | `src/components/maps/boundary-import.tsx` | becomes the wizard shell |

### The nine steps, and where each lives

| # | step | writes? | home |
|---|---|---|---|
| 1 | pick farm + **layer** (`boundary` \| `production` \| `irrigation`), explicit | no | wizard |
| 2 | upload `.zip`; **reject unless `.shp` + `.dbf` + `.prj`**; reproject to 4326 via proj4; record source CRS | no | `POST /api/maps/import/stage` |
| 3 | choose the name attribute from the `.dbf` columns with 3 sample values each; default to `farm_import_prefs`, say so | no | wizard + prefs read |
| 4 | match: normalised name vs registry name+aliases, then centroid-in-polygon. Exactly-one = proposed; anything else = manual, with "new field" and "ignore" | no | staged matcher |
| 5 | diff: **unchanged / changed / new / missing** with acre deltas | no | staged |
| 6 | validate: `ST_IsValid` (+ offer `ST_MakeValid`, show the acre change), slivers, **overlap only within `layer='production'`**, zone-outside-field | no | PostGIS on the staged rows |
| 7 | map preview of the four states with validation marks | no | `field-map.tsx` |
| 8 | **commit**: one `import_batches` row; insert new geometry rows with `effective_crop_year`; retire the rows they replace (`retired_reason='superseded'`); **rows missing from the file are untouched** | **yes** | `POST /api/maps/import/commit` |
| 9 | acre-drift report at **3%** against `plantedAcres` and `reportingAcres`, **never applied** | no | report |

Staging holds parsed features in the batch row (or a `import_staged_features` table) so steps 2–7
are one reviewable unit and step 8 writes what was reviewed, not a re-parse. That is the lesson from
the invoice work: the apply step should consume the audit's own output.

### `.prj` handling

`shpjs` reprojects when a `.prj` is present and **silently assumes WGS84 when it is not** — so the
requirement is ours to enforce, by inspecting the zip entries before parsing. The source CRS goes on
the batch so a wrong `.prj` is diagnosable after the fact rather than invisible.

### Folding in `field_boundary_history`

4 rows: `field_boundary_id`, `geometry`, `total_acres`, `replaced_at`, `replaced_by`, `source`. All
from 2026-06-15, all `shapefile_usb_2026`, no orphans. They are the shapes that existed *before* the
USB load.

```sql
-- each history row becomes a retired version of its boundary
insert into public.field_boundaries
  (registry_field_id, name, geometry, geojson, total_acres, source,
   effective_crop_year, retired_at, retired_reason, retired_batch)
select b.registry_field_id, b.name, h.geometry, st_asgeojson(h.geometry)::jsonb,
       h.total_acres, coalesce(h.source,'field_boundary_history'),
       2025,                      -- the shape the 2026 import replaced
       h.replaced_at, 'superseded', :batch
from public.field_boundary_history h
join public.field_boundaries b on b.id = h.field_boundary_id;

drop table public.field_boundary_history;
```

`effective_crop_year = 2025` because these are what 2026 replaced. They insert as **retired**, so
they cannot collide with the live 2026 rows on the unique index, and reading 2025 finds them. The
`PUT /api/maps/boundaries/[id]` handler stops writing history and starts retiring-and-inserting
instead — same shape as step 8, one field at a time.

### Test plan

**Wes (`fld_056`) is the test**, because it is the awkward case and already understood: one parcel,
four enterprises, a double crop sharing ground with barley. Export its current boundary, re-import
it unchanged, and the diff must read **unchanged** with no new version written. Then nudge a vertex
and re-import: **changed**, with an acre delta, one new version, the old one retired, and the other
52 fields untouched — which is the specific failure the old route had.

**Then the two real ones**: `fld_046` Phillhower West (154 ac) and `fld_049` Suiter (14 ac), the only
registry fields with no polygon in either store. Both are `new` in the diff, neither can be a false
`missing`, and together they are 168 acres currently invisible to any overlay.

### Order

1. your approval on §1 (retire 8 + 9 layer pairs) and §2 (3 renames)
2. `field_boundary_history` fold-in and drop
3. stage + match + diff + validate, read-only end to end, tested on Wes
4. commit path, re-tested on Wes
5. Phillhower West and Suiter
6. export scoped by farm and layer

Steps 3 and 4 are where the work is. Everything before is cleanup; everything after is a repeat.
