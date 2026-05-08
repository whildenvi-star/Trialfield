-- Migration 016: RPC for shapefile export
--
-- Returns CLU records joined with boundary geometry (as GeoJSON text) and
-- zone year attributes. Used by the /api/fsa/export-shapefile route to build
-- the .shp/.shx/.dbf binary files server-side without needing PostgREST
-- geometry support.

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
    cr.clu,
    cr.field_name,
    cr.crop,
    cr.use,
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
    ST_AsGeoJSON(cb.geometry)::text
  FROM clu_records cr
  LEFT JOIN clu_boundaries cb ON (
    cb.farm_number  = cr.farm_number  AND
    cb.tract_number = cr.tract_number AND
    cb.clu_label    = cr.clu          AND
    cb.crop_year    = p_crop_year
  )
  LEFT JOIN zone_year_attributes zya ON (
    zya.zone_id  = cr.zone_id AND
    zya.crop_year = p_crop_year
  )
  WHERE cr.crop_year = p_crop_year
    AND (NOT p_confirmed_only OR cr.reported = true)
  ORDER BY cr.farm_number, cr.tract_number, cr.clu;
END;
$$;
