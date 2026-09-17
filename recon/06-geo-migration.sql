\set ON_ERROR_STOP on
\pset pager off
\timing off

BEGIN;

-- ════════ PART 1: the additive migration ════════
create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('import','cleanup')),
  layer         text check (layer in ('boundary','production','irrigation')),
  crop_year     integer,
  farm_id       text,
  filename      text,
  source_crs    text,
  name_column   text,
  operator      uuid references public.profiles(id),
  note          text,
  created_at    timestamptz not null default now()
);

create table if not exists public.farm_import_prefs (
  farm_id      text not null,
  layer        text not null check (layer in ('boundary','production','irrigation')),
  name_column  text not null,
  updated_at   timestamptz not null default now(),
  primary key (farm_id, layer)
);

alter table public.management_zones
  add column if not exists layer               text not null default 'production',
  add column if not exists needs_geometry      boolean not null default false,
  add column if not exists effective_crop_year integer,
  add column if not exists import_batch_id     uuid references public.import_batches(id),
  add column if not exists retired_at          timestamptz,
  add column if not exists retired_reason      text,
  add column if not exists retired_batch       uuid references public.import_batches(id),
  -- A zone's identity is its SHAPE, not its name: fld_050 carries two genuinely
  -- different seed blocks both called "Simpsons – SEED26 2026" (6.05 ac and
  -- 42.23 ac). Fingerprint the snapped geometry so the constraint catches the
  -- actual defect — the same polygon entered twice — without forbidding two
  -- real zones from sharing a label.
  add column if not exists geom_key text
    generated always as (md5(st_astext(st_snaptogrid(geometry, 0.000001)))) stored;

alter table public.management_zones
  add constraint management_zones_layer_ck   check (layer in ('production','irrigation')),
  add constraint management_zones_retired_ck check ((retired_at is null) = (retired_reason is null));

alter table public.field_boundaries
  add column if not exists effective_crop_year integer,
  add column if not exists import_batch_id     uuid references public.import_batches(id),
  add column if not exists retired_at          timestamptz,
  add column if not exists retired_reason      text,
  add column if not exists retired_batch       uuid references public.import_batches(id);

alter table public.field_boundaries
  add constraint field_boundaries_retired_ck check ((retired_at is null) = (retired_reason is null));

update public.management_zones set effective_crop_year = 2026 where effective_crop_year is null;
update public.field_boundaries  set effective_crop_year = 2026 where effective_crop_year is null;

update public.field_boundaries
   set retired_at = coalesce(retired_at, now()), retired_reason = coalesce(retired_reason,'junk')
 where is_deleted is true and retired_at is null;

create index if not exists management_zones_live_idx
  on public.management_zones (registry_field_id, layer, effective_crop_year) where retired_at is null;
create index if not exists field_boundaries_live_idx
  on public.field_boundaries (registry_field_id, effective_crop_year) where retired_at is null;

\echo '── PART 1 applied: columns, constraints, backfill, read indexes'

-- ════════ PART 2: the cleanup, as one batch ════════
insert into public.import_batches (id, kind, note)
values ('11111111-1111-1111-1111-111111111111','cleanup','rehearsal — zone cleanup 2026-09-17');

-- geometry repair first: everything spatial depends on it
update public.management_zones
   set geometry = st_makevalid(geometry)
 where not st_isvalid(geometry);
\echo '── validity repaired'

-- decision (1): Omni BLUECORN26 stays live, flagged, out of the index
update public.management_zones
   set needs_geometry = true
 where name = 'Omni – BLUECORN26 1 2026';

-- 41 misfiled whole-field boundaries
with misfiled as (
  select distinct z.id
  from public.management_zones z
  join public.field_boundaries b
    on b.geometry is not null and st_intersects(z.geometry, st_makevalid(b.geometry))
  where z.registry_field_id is null
    and 100*st_area(st_intersection(z.geometry, st_makevalid(b.geometry))::geography)
        /nullif(st_area(st_union(z.geometry, st_makevalid(b.geometry))::geography),0) >= 99
)
update public.management_zones z
   set retired_at = now(), retired_reason = 'misfiled-boundary',
       retired_batch = '11111111-1111-1111-1111-111111111111'
 where z.id in (select id from misfiled)
   and z.needs_geometry = false;

-- decision (4): duplicates keep the OLDER by created_at
with dups as (
  select id from (
    select id, row_number() over (
      partition by coalesce(registry_field_id,'~'), name,
                   st_astext(st_snaptogrid(geometry, 0.000001))
      order by created_at asc) rn
    from public.management_zones where retired_at is null
  ) s where rn > 1
)
update public.management_zones
   set retired_at = now(), retired_reason = 'duplicate',
       retired_batch = '11111111-1111-1111-1111-111111111111'
 where id in (select id from dups) and needs_geometry = false;

-- slivers, excluding the needs-geometry keeper
update public.management_zones
   set retired_at = now(), retired_reason = 'sliver',
       retired_batch = '11111111-1111-1111-1111-111111111111'
 where retired_at is null and needs_geometry = false
   and st_area(geometry::geography)/4046.86 < 0.1;

-- decision (2): layer, and link the ones geometry identifies
update public.management_zones set layer = 'irrigation'
 where retired_at is null and registry_field_id is null and name ~* 'irr';

-- the two Schultz junk rows
update public.field_boundaries
   set retired_at = now(), retired_reason = 'junk',
       retired_batch = '11111111-1111-1111-1111-111111111111'
 where registry_field_id !~ '^fld_[0-9]+$';

\echo '── PART 2 applied: cleanup'

-- ════════ PART 3: the indexes that prove it ════════
create unique index field_boundaries_one_live_uq
  on public.field_boundaries (registry_field_id, effective_crop_year) where retired_at is null;

create unique index management_zones_one_live_uq
  on public.management_zones (registry_field_id, layer, effective_crop_year, geom_key)
  where retired_at is null and needs_geometry = false;

\echo '── PART 3 applied: unique indexes CREATED — the cleanup holds'

-- ════════ verification ════════
\echo ''
\echo '=== management_zones ==='
select coalesce(retired_reason,'LIVE') state, layer, count(*),
       round(sum(st_area(geometry::geography)/4046.86)::numeric,1) acres
from public.management_zones group by 1,2 order by 1,2;

\echo '=== field_boundaries ==='
select coalesce(retired_reason,'LIVE') state, count(*) from public.field_boundaries group by 1 order by 1;

\echo '=== zone_year_attributes: where do they sit now? ==='
select case when m.retired_at is null then 'on a LIVE zone' else 'on a retired zone' end,
       count(*),
       count(*) filter (where coalesce(a.crop,'')<>'') as with_a_crop
from public.zone_year_attributes a join public.management_zones m on m.id = a.zone_id
group by 1 order by 1;

\echo '=== any invalid geometry left? ==='
select 'invalid zones remaining: '||count(*) from public.management_zones where not st_isvalid(geometry);

\echo '=== two live zones sharing a name (legal, but worth renaming) ==='
select registry_field_id, name, count(*),
       round(min(st_area(geometry::geography)/4046.86)::numeric,2) min_ac,
       round(max(st_area(geometry::geography)/4046.86)::numeric,2) max_ac
from public.management_zones where retired_at is null
group by 1,2 having count(*) > 1;

\echo '=== the keeper ==='
select name, layer, needs_geometry, retired_reason is null as live,
       round((st_area(geometry::geography)/4046.86)::numeric,4) acres
from public.management_zones where needs_geometry;

ROLLBACK;

\echo ''
\echo '████ ROLLED BACK — the database is unchanged ████'
