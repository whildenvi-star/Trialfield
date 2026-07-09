-- Migration 034: CLU-level intended use (grain/forage/seed/silage)
--
-- Adds an intended_use column to clu_records so the 578 "USE" attribute can be
-- set per-CLU (batch or individually) instead of living only on management
-- zones. Also updates export_clu_shapefile_rows to emit
-- COALESCE(cr.intended_use, zya.intended_use) instead of cr.use — the `use`
-- column has been polluted with 'Irrigated'/'Non-Irrigated' practice strings
-- by the CLU card UI and is no longer read by exports.

ALTER TABLE clu_records
  ADD COLUMN IF NOT EXISTS intended_use text
  CHECK (intended_use IS NULL OR intended_use IN ('grain', 'forage', 'seed', 'silage'));

COMMENT ON COLUMN clu_records.intended_use IS
  '578 intended use for this CLU: grain | forage | seed | silage. Falls back to zone_year_attributes.intended_use in exports when NULL.';


-- ── Updated export_clu_shapefile_rows ─────────────────────────────────────────
--
-- Changes from migration 033:
--   intended_use output column now reads COALESCE(cr.intended_use, zya.intended_use)
--   instead of cr.use (contaminated with irrigation practice strings).
-- RETURNS TABLE signature unchanged.

CREATE OR REPLACE FUNCTION export_clu_shapefile_rows(
  p_crop_year       int,
  p_confirmed_only  boolean DEFAULT true
)
RETURNS TABLE (
  farm_number        text,
  tract_number       text,
  clu_number         text,
  field_name         text,
  crop               text,
  intended_use       text,
  fsa_acres          numeric,
  calc_acres         numeric,
  irrigated          boolean,
  organic            boolean,
  cover_crop         boolean,
  prevented_planting boolean,
  grain_plant_date   text,
  reported           boolean,
  zone_id            uuid,
  zone_crop          text,
  zone_irrigated     boolean,
  zone_organic       boolean,
  geojson            text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.farm_number,
    cr.tract_number,
    -- Composite CLU number: '1' for whole CLU, '1a'/'1b' for sub-records
    (cr.clu || COALESCE(cr.sub_label, ''))::text,
    cr.field_name,
    cr.crop,
    COALESCE(cr.intended_use, zya.intended_use),
    cr.fsa_acres,
    cb.fsa_acres,
    cr.irrigated,
    cr.organic,
    cr.cover_crop,
    cr.prevented_planting,
    cr.grain_plant_date::text,
    cr.reported,
    cr.zone_id,
    zya.crop,
    zya.irrigated,
    zya.organic,
    -- Use split_geometry for sub-CLU rows; fall back to CLU boundary geometry
    CASE
      WHEN cr.split_geometry IS NOT NULL
        THEN ST_AsGeoJSON(cr.split_geometry)::text
      ELSE
        ST_AsGeoJSON(cb.geometry)::text
    END
  FROM clu_records cr
  LEFT JOIN clu_boundaries cb ON (
    cb.farm_number  = cr.farm_number  AND
    cb.tract_number = cr.tract_number AND
    cb.clu_label    = cr.clu          AND
    cb.crop_year    = p_crop_year
  )
  LEFT JOIN zone_year_attributes zya ON (
    zya.zone_id   = cr.zone_id AND
    zya.crop_year = p_crop_year
  )
  WHERE cr.crop_year  = p_crop_year
    AND cr.superseded = false
    AND (NOT p_confirmed_only OR cr.reported = true)
  ORDER BY cr.farm_number, cr.tract_number, cr.clu, cr.sub_label NULLS FIRST;
END;
$$;
