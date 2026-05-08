-- Migration 018: RPC for inserting a management zone with geometry + registry field link
--
-- The portal API POST /api/fsa/zones calls this function when geojson is provided.
-- It wraps insert_management_zone logic, adding support for registry_field_id.
-- Returns the new zone id as text.

CREATE OR REPLACE FUNCTION insert_management_zone_with_geometry(
  p_registry_field_id  text,
  p_name               text,
  p_geojson            text,           -- GeoJSON Polygon or MultiPolygon string
  p_organic_default    boolean DEFAULT false,
  p_irrigated_default  boolean DEFAULT false,
  p_notes              text    DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO management_zones (
    registry_field_id,
    name,
    geometry,
    organic_default,
    irrigated_default,
    notes
  )
  VALUES (
    p_registry_field_id::uuid,
    p_name,
    ST_GeomFromGeoJSON(p_geojson),
    p_organic_default,
    p_irrigated_default,
    p_notes
  )
  RETURNING id INTO new_id;

  RETURN new_id::text;
END;
$$;
