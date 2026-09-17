\set ON_ERROR_STOP on
\pset pager off
BEGIN;

-- Your rule: keep what zone_year_attributes references, re-point before archiving.
-- The shape-keyed dedupe retired 26 rows rather than 22, and three of the retired
-- twins carried a real crop while the surviving twin's row was blank. Each live
-- twin already has its own 2026 row, so this is a merge onto the live row rather
-- than a re-point, which would have left two rows on one zone.
-- The retired rows are left as they are: they are on retired zones and are the
-- audit trail of where the value came from.
update public.zone_year_attributes live
   set crop          = coalesce(nullif(live.crop,''),          dead.crop),
       variety       = coalesce(nullif(live.variety,''),       dead.variety),
       tillage       = coalesce(nullif(live.tillage,''),       dead.tillage),
       intended_use  = coalesce(nullif(live.intended_use,''),  dead.intended_use),
       irrigated     = coalesce(live.irrigated,                dead.irrigated),
       organic       = coalesce(live.organic,                  dead.organic),
       cover_crop    = coalesce(live.cover_crop,               dead.cover_crop),
       updated_at    = now()
  from public.zone_year_attributes dead
  join public.management_zones dz on dz.id = dead.zone_id and dz.retired_at is not null
  join public.management_zones lz
    on lz.retired_at is null
   and lz.registry_field_id is not distinct from dz.registry_field_id
   and lz.layer = dz.layer
   and lz.effective_crop_year = dz.effective_crop_year
   and md5(st_astext(st_snaptogrid(lz.geometry,0.000001)))
     = md5(st_astext(st_snaptogrid(dz.geometry,0.000001)))
 where live.zone_id = lz.id
   and live.crop_year = dead.crop_year
   and coalesce(live.crop,'') = ''
   and coalesce(dead.crop,'') <> '';

COMMIT;

\echo ''
\echo '=== after: does any retired zone still hold content a live zone lacks? ==='
select case when m.retired_at is null then 'LIVE' else 'retired' end state,
       count(*), count(*) filter (where coalesce(a.crop,'')<>'') with_crop
from public.zone_year_attributes a join public.management_zones m on m.id=a.zone_id
group by 1 order by 1;

\echo '=== the three, now ==='
select m.name, m.retired_reason is null as live, a.crop_year, coalesce(nullif(a.crop,''),'(blank)') crop
from public.zone_year_attributes a join public.management_zones m on m.id=a.zone_id
where m.name in ('Peas26','SimpSouthSeed26','SimpTrianSeed26','Omni – PEAS26 2026','Simpsons – SEED26 1 2026','Simpsons – SEED26 2026')
order by a.crop, m.name;
