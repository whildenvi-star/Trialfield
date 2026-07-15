-- Migration 036: CLU split writes intended_use; fix legacy_id NOT NULL drift
--
-- 1. Prod's clu_records.legacy_id carries a NOT NULL constraint that the
--    canonical schema (migration 024) never declared — it's drift from the
--    table's original manual creation. It breaks create_clu_split (which
--    doesn't set legacy_id) and the portal's Add-CLU POST. Relax to match 024.
--
-- 2. create_clu_split gains intended_use in place of the export-dead `use`
--    column (see migration 034): the split panel now collects
--    grain/forage/seed/silage and sub-CLUs must carry it into the 578 export.
--    Signature changes (p_use -> p_intended_use), so DROP + CREATE.

ALTER TABLE clu_records ALTER COLUMN legacy_id DROP NOT NULL;

DROP FUNCTION IF EXISTS create_clu_split(uuid, text, text, text, boolean, boolean, text);

CREATE FUNCTION create_clu_split(
  p_parent_id     uuid,
  p_sub_label     text,
  p_geojson       text,
  p_crop          text,
  p_irrigated     boolean,
  p_organic       boolean,
  p_intended_use  text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  parent     clu_records%ROWTYPE;
  new_id     uuid;
  split_geom geometry(Polygon, 4326);
  split_ac   numeric(10, 2);
BEGIN
  IF p_intended_use IS NOT NULL
     AND p_intended_use NOT IN ('grain', 'forage', 'seed', 'silage') THEN
    RAISE EXCEPTION 'Invalid intended_use "%" — must be grain, forage, seed, or silage', p_intended_use;
  END IF;

  SELECT * INTO parent FROM clu_records WHERE id = p_parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent CLU record % not found', p_parent_id;
  END IF;

  IF parent.superseded THEN
    RAISE EXCEPTION 'Parent CLU record % is already superseded (already split)', p_parent_id;
  END IF;

  -- Parse the GeoJSON polygon
  split_geom := ST_GeomFromGeoJSON(p_geojson);

  -- Validate: the sub-polygon must intersect the parent CLU boundary
  IF NOT EXISTS (
    SELECT 1
    FROM   clu_boundaries cb
    WHERE  cb.farm_number  = parent.farm_number
      AND  cb.tract_number = parent.tract_number
      AND  cb.clu_label    = parent.clu
      AND  cb.crop_year    = parent.crop_year
      AND  ST_Intersects(cb.geometry, split_geom)
  ) THEN
    RAISE EXCEPTION
      'Split geometry does not intersect CLU boundary for CLU % (farm %, tract %, year %)',
      parent.clu, parent.farm_number, parent.tract_number, parent.crop_year;
  END IF;

  -- Compute sub-polygon acres from geography area
  split_ac := ROUND(
    CAST(ST_Area(split_geom::geography) / 4046.856422 AS numeric),
    2
  );

  INSERT INTO clu_records (
    crop_year,
    farm_number,
    tract_number,
    clu,
    field_name,
    farm_name,
    fsa_acres,
    registry_field_id,
    registry_crop_id,
    zone_id,
    sub_label,
    split_geometry,
    parent_clu_id,
    crop,
    irrigated,
    organic,
    intended_use,
    double_crop,
    cover_crop,
    grain_plant_date,
    prevented_planting,
    reported,
    superseded
  ) VALUES (
    parent.crop_year,
    parent.farm_number,
    parent.tract_number,
    parent.clu,
    parent.field_name,
    parent.farm_name,
    split_ac,
    parent.registry_field_id,
    parent.registry_crop_id,
    parent.zone_id,
    p_sub_label,
    split_geom,
    p_parent_id,
    p_crop,
    p_irrigated,
    p_organic,
    p_intended_use,
    parent.double_crop,
    parent.cover_crop,
    parent.grain_plant_date,
    false,
    false,
    false
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
