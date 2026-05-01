-- get_farm_reconciliation(p_farm_number, p_crop_year)
--
-- Returns one row per (CLU × zone) intersection for a given farm and crop year.
-- Each CLU may appear multiple times if it intersects more than one management zone.
-- If a CLU has no intersecting zones it still appears with NULL zone columns.
--
-- Area computation: cast geometry to geography for accurate sq-meter result,
-- then divide by 4046.856422 to convert to acres.
--
-- Called from: /api/fsa/reconciliation?farm=NNNNN&year=YYYY
-- The API route groups rows by clu_label + tract_number and aggregates zones.

CREATE OR REPLACE FUNCTION get_farm_reconciliation(
  p_farm_number text,
  p_crop_year   int
)
RETURNS TABLE (
  clu_label        text,
  tract_number     text,
  fsa_acres        numeric,
  clu_geojson      jsonb,
  fsa_attributes   jsonb,
  clu_record_id    uuid,
  rec_crop         text,
  rec_organic      boolean,
  rec_irrigated    boolean,
  rec_cover_crop   boolean,
  rec_reported     boolean,
  zone_id          uuid,
  zone_name        text,
  zone_geojson     jsonb,
  zone_crop        text,
  zone_organic     boolean,
  intersection_ac  numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    cb.clu_label,
    cb.tract_number,
    cb.fsa_acres,
    ST_AsGeoJSON(cb.geometry)::jsonb                              AS clu_geojson,
    cb.fsa_attributes,
    cr.id                                                          AS clu_record_id,
    cr.crop                                                        AS rec_crop,
    cr.organic                                                     AS rec_organic,
    cr.irrigated                                                   AS rec_irrigated,
    cr.cover_crop                                                  AS rec_cover_crop,
    cr.reported                                                    AS rec_reported,
    mz.id                                                          AS zone_id,
    mz.name                                                        AS zone_name,
    ST_AsGeoJSON(mz.geometry)::jsonb                              AS zone_geojson,
    zya.crop                                                       AS zone_crop,
    zya.organic                                                    AS zone_organic,
    ROUND(
      CAST(
        ST_Area(
          ST_Intersection(cb.geometry::geography, mz.geometry::geography)
        ) / 4046.856422
      AS numeric),
      2
    )                                                              AS intersection_ac
  FROM clu_boundaries cb
  LEFT JOIN clu_records cr ON (
    cr.farm_number  = cb.farm_number  AND
    cr.tract_number = cb.tract_number AND
    cr.clu          = cb.clu_label    AND
    cr.crop_year    = cb.crop_year
  )
  LEFT JOIN management_zones mz ON ST_Intersects(mz.geometry, cb.geometry)
  LEFT JOIN zone_year_attributes zya ON (
    zya.zone_id   = mz.id       AND
    zya.crop_year = p_crop_year
  )
  WHERE cb.farm_number = p_farm_number
    AND cb.crop_year   = p_crop_year
  ORDER BY cb.tract_number, cb.clu_label, mz.name
$$;
