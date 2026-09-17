# Geometry migration — archive + versioning in one change

Read-only draft, 2026-09-17. **No writes. The SQL below has not been run.**

Backup in place: `~/FarmOpsBackups/geo-pre-import-lock-20260917/`.

---

## Your decisions, applied

| | decision | how it lands |
|---|---|---|
| 1 | `Omni – BLUECORN26 1 2026` stays live | `needs_geometry = true`; excluded from area checks and from the unique index by the index predicate |
| 2 | split seed blocks from irrigated extents | a `layer` column — `production` \| `irrigation`. The no-overlap rule applies to `production` only |
| 4 | duplicates: keep the **older** by `created_at` | `row_number() … order by created_at asc`, archive `rn > 1` |
| 5 | `ST_MakeValid` approved | repaired acres below |
| 6 | one migration, not two | `superseded_at` turns out to be unnecessary — see the reconciliation |

### Item 5 — repaired acres for the three real zones

| zone | before | after | change |
|---|---|---|---|
| **Gessert Irrigation** | 262.09 | **254.21** | −3.01% |
| **Cuff** | 134.89 | **130.07** | −3.57% |
| **Klug-Davis** | 137.32 | **136.21** | −0.81% |

Only Gessert Irrigation and Cuff clear 1%. All three shrink, which is what repairing a
self-intersection does — the overlap was being counted twice.

---

## Item 3 — the 23 real zones, for your decision

All 23 carry exactly one attribute row, and every one of those rows is blank.

### Irrigated extents → `layer = 'irrigation'` (9)

| zone | field | zone ac | field ac | short by | IoU |
|---|---|---|---|---|---|
| PhilhowerRdIrrBoun | fld_045 Phillhower East | 270.2 | 289.4 | 19.2 | 93.1% |
| KoppEastIrrBound | fld_033 Kopp | 81.9 | 89.3 | 7.5 | 90.7% |
| Hoff Irrigation | fld_025 Hoff | 67.6 | 73.7 | 6.1 | 89.8% |
| TownlineRdIrrBound | fld_053 Townline | 230.5 | 267.0 | 36.5 | 86.3% |
| Jones Irrigation | fld_030 Jones | 78.6 | 90.7 | 12.2 | 85.9% |
| Gessley Irrigation | fld_022 Gessley | 158.9 | 192.9 | 34.0 | 82.1% |
| Christopherson Irr | fld_013 Delong Christpherson | 52.5 | 64.5 | 12.0 | 81.4% |
| Gessert Irrigation | fld_021 Gessert | 254.2 | 361.0 | 106.8 | 69.5% |
| Simpson Irrigation | fld_050 Simpsons | 113.7 | 199.6 | 86.0 | 55.7% |

These read exactly as you'd expect a pivot or irrigated block to: the field, minus the corners.

### Seed blocks → `layer = 'production'` (3)

| zone | field | zone ac | field ac | IoU |
|---|---|---|---|---|
| Peas26 | fld_042 Omni | 267.9 | 438.4 | 60.7% |
| SimpSouthSeed26 | fld_050 Simpsons | 45.9 | 199.6 | 23.0% |
| SimpTrianSeed26 | fld_050 Simpsons | 6.0 | 199.6 | 3.0% |

`BlueCorn26` was the fourth, but it is zero-area and unlinked — its linked twin
`Omni – BLUECORN26 1 2026` is the one you kept live, so this one archives as a sliver and nothing is
lost.

### Undecided — these need your eye (8)

Named for a field but materially smaller than it, and no "Irr" or "26" in the name to say what they
are:

| zone | field | zone ac | field ac | short by | IoU |
|---|---|---|---|---|---|
| OM1SHOP | fld_043 OM1 | 32.4 | 33.6 | 1.2 | 96.4% |
| Cuff | fld_010 Cuffs | 130.1 | 148.0 | 17.9 | 87.9% |
| Klug-Davis | fld_032 Klug Davis | 136.2 | 214.6 | 78.4 | 63.5% |
| East | fld_033 Kopp | 40.6 | 89.3 | 48.8 | 45.2% |
| Murray | fld_036 Murray | 52.7 | 131.2 | 78.5 | 40.2% |
| Simpsons | fld_050 Simpsons | 42.2 | 199.6 | 157.4 | 21.1% |
| Buchanon | fld_007 Buchanon | 9.1 | 48.1 | 39.0 | 18.9% |
| Gessert | fld_021 Gessert | 17.8 | 361.0 | 343.2 | 4.9% |

My reading, which is a guess and not a proposal: `OM1SHOP` and `Cuff` are close enough to be older
whole-field boundaries; `East` is a half of Kopp; `Buchanon` at 9.1 of 48.1 is close to the 10 acres
of corn that field carries. They stay unlinked and live until you say.

---

## Item 6 — the migration

### The reconciliation: `superseded_at` is not needed

Archive and versioning both say "not the live row", for different reasons — one because the row
should never have existed, the other because a newer shape replaced it. Adding both
`archived_at` and `superseded_at` makes four states from two flags, two of which are nonsense
(archived *and* superseded), and forces every read to test both.

They collapse cleanly:

- **`effective_crop_year` already orders versions.** The shape for year N is the live row with the
  greatest `effective_crop_year ≤ N`. Nothing needs marking as superseded — a later year simply wins.
- **`retired_at` is the single "do not read this" flag**, with `retired_reason` saying why:
  `misfiled-boundary`, `duplicate`, `sliver`, `junk` for the cleanup; `withdrawn` when an import of
  the *same* year is corrected and re-run.

Every read is `where retired_at is null`. One flag, one meaning.

### The SQL

```sql
-- ════════════════════════════════════════════════════════════════
-- 2026-09-17  geometry lifecycle: archive + crop-year versioning
-- Adds columns and tables only. Writes no data, drops nothing.
-- The unique indexes are created LAST, after the cleanup, because
-- the 22 duplicate zones would violate them today.
-- ════════════════════════════════════════════════════════════════
begin;

-- ── one batch = one import or one cleanup run, so either reverses whole ──
create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('import','cleanup')),
  layer         text check (layer in ('boundary','production','irrigation')),
  crop_year     integer,
  farm_id       text,                      -- registry farm; null = all farms
  filename      text,
  source_crs    text,                      -- from the .prj, so a bad one is diagnosable
  name_column   text,                      -- which .dbf column named the features
  operator      uuid references public.profiles(id),
  note          text,
  created_at    timestamptz not null default now()
);

-- ── the remembered name column, per farm per layer ──
create table if not exists public.farm_import_prefs (
  farm_id      text not null,
  layer        text not null check (layer in ('boundary','production','irrigation')),
  name_column  text not null,
  updated_at   timestamptz not null default now(),
  primary key (farm_id, layer)
);

-- ── management_zones ──
alter table public.management_zones
  add column if not exists layer               text not null default 'production',
  add column if not exists needs_geometry      boolean not null default false,
  add column if not exists effective_crop_year integer,
  add column if not exists import_batch_id     uuid references public.import_batches(id),
  add column if not exists retired_at          timestamptz,
  add column if not exists retired_reason      text,
  add column if not exists retired_batch       uuid references public.import_batches(id);

alter table public.management_zones
  add constraint management_zones_layer_ck
    check (layer in ('production','irrigation')),
  add constraint management_zones_retired_ck
    check ((retired_at is null) = (retired_reason is null));

-- ── field_boundaries ──
alter table public.field_boundaries
  add column if not exists effective_crop_year integer,
  add column if not exists import_batch_id     uuid references public.import_batches(id),
  add column if not exists retired_at          timestamptz,
  add column if not exists retired_reason      text,
  add column if not exists retired_batch       uuid references public.import_batches(id);

alter table public.field_boundaries
  add constraint field_boundaries_retired_ck
    check ((retired_at is null) = (retired_reason is null));

-- ── backfill: everything on file today is the 2026 shape ──
update public.management_zones set effective_crop_year = 2026 where effective_crop_year is null;
update public.field_boundaries  set effective_crop_year = 2026 where effective_crop_year is null;

-- is_deleted predates this and means the same thing. Zero rows carry it today,
-- so this is a no-op that keeps the two from disagreeing later. The column is
-- left in place and stops being written; drop it once nothing reads it.
update public.field_boundaries
   set retired_at = coalesce(retired_at, now()), retired_reason = coalesce(retired_reason,'junk')
 where is_deleted is true and retired_at is null;

-- ── read paths ──
create index if not exists management_zones_live_idx
  on public.management_zones (registry_field_id, layer, effective_crop_year)
  where retired_at is null;

create index if not exists field_boundaries_live_idx
  on public.field_boundaries (registry_field_id, effective_crop_year)
  where retired_at is null;

commit;

-- ════════════════════════════════════════════════════════════════
-- RUN ONLY AFTER THE CLEANUP — these fail while the 22 duplicates
-- and the 2 Schultz rows are still live. That is deliberate: the
-- index is the proof the cleanup worked.
-- ════════════════════════════════════════════════════════════════
-- one live boundary per field per effective year
create unique index field_boundaries_one_live_uq
  on public.field_boundaries (registry_field_id, effective_crop_year)
  where retired_at is null;

-- one live zone per field, layer, name and effective year.
-- needs_geometry rows are excluded — that is what keeps
-- Omni – BLUECORN26 1 2026 live without a polygon.
create unique index management_zones_one_live_uq
  on public.management_zones (registry_field_id, layer, name, effective_crop_year)
  where retired_at is null and needs_geometry = false;
```

### What this does not do

- **Drops nothing.** `is_deleted` stays (backfilled, then unwritten), `field_boundary_history` stays
  with its 4 rows and stops being written — versioning replaces it, but removing it is a separate
  decision.
- **Adds no `superseded_at`**, for the reason above.
- **Writes no cleanup.** Retiring the 72 zones and the 2 Schultz rows is the next script, and it
  wants its own approval.

---

## Dry-run end state

**`management_zones` — 135 rows, still 135 rows. 63 live, 72 retired.**

| bucket | rows | acres |
|---|---|---|
| LIVE production, already linked | 42 | 3,660.5 |
| LIVE irrigation, newly linked | 9 | 1,308.1 |
| LIVE production-seed, newly linked | 3 | 319.9 |
| LIVE undecided, still unlinked | 8 | 461.1 |
| LIVE needs-geometry (`Omni – BLUECORN26 1 2026`) | 1 | 0.0 |
| retired `misfiled-boundary` | 41 | 2,927.6 |
| retired `duplicate` | 22 | 1,398.8 |
| retired `sliver` | 9 | 0.0 |

**`zone_year_attributes` — 74 rows, unchanged.** 30 stay on live zones (including all 10 that carry
a real crop); **44 sit on retired zones, and all 44 are entirely blank.** Nothing is deleted and
nothing of substance is orphaned.

**`field_boundaries` — 53 rows, unchanged.** 51 live, **2 retired as `junk`** (`schultz-field-1`,
`schultz-field-3` — no geometry, non-registry ids, imported 2026-05-08).

**`field_boundary_history` — 4 rows, untouched.**

**`import_batches` — new, 1 row** (the cleanup batch).
**`farm_import_prefs` — new, 0 rows.**

After this, `management_zones_one_live_uq` becomes creatable. It is not today: the 22 duplicates
would violate it, which is the point of creating it last.

---

## First imports once the flow exists

**`fld_046` Phillhower West (154 ac)** and **`fld_049` Suiter (14 ac)** — the only two registry
fields with no polygon in *either* store. 168 acres of active ground currently invisible to any
overlay, acreage check or map. They are the natural first run of the new importer, and a good test:
both are `new` in the diff, neither can be a false `missing`.
