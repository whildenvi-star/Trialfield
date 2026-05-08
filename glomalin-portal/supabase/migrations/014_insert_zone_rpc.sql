-- Migration 014: RPC for inserting a management zone with PostGIS geometry
--
-- Used by the SMS boundary import script. Accepts a GeoJSON Polygon or
-- MultiPolygon string and inserts into management_zones + zone_year_attributes.
-- Returns { id, action: 'created' | 'skipped' } — idempotent on zone name.

CREATE OR REPLACE FUNCTION insert_management_zone(
  p_name              text,
  p_geojson           text,           -- GeoJSON Polygon or MultiPolygon string
  p_organic_default   boolean DEFAULT false,
  p_irrigated_default boolean DEFAULT false,
  p_crop_year         int     DEFAULT 2026,
  p_crop              text    DEFAULT NULL,
  p_notes             text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_id      uuid;
  existing_id uuid;
BEGIN
  -- Idempotent: skip if a zone with the same name already exists
  SELECT id INTO existing_id FROM management_zones WHERE name = p_name LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', existing_id, 'action', 'skipped');
  END IF;

  INSERT INTO management_zones (name, geometry, organic_default, irrigated_default, notes)
  VALUES (
    p_name,
    ST_GeomFromGeoJSON(p_geojson),
    p_organic_default,
    p_irrigated_default,
    p_notes
  )
  RETURNING id INTO new_id;

  INSERT INTO zone_year_attributes (zone_id, crop_year, organic, irrigated, crop)
  VALUES (new_id, p_crop_year, p_organic_default, p_irrigated_default, p_crop)
  ON CONFLICT (zone_id, crop_year) DO NOTHING;

  RETURN jsonb_build_object('id', new_id, 'action', 'created');
END;
$$;
