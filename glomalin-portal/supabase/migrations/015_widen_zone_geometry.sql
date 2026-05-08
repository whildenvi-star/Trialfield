-- Migration 015: Widen management_zones.geometry to accept Polygon or MultiPolygon
--
-- SMS farm boundaries can export multi-ring polygons (MultiPolygon). The original
-- column was typed geometry(Polygon, 4326) which rejects them.
-- geometry(Geometry, 4326) accepts both Polygon and MultiPolygon.
--
-- Must drop+recreate the management_zones_geo view since ALTER COLUMN cannot
-- run while a view depends on the column.

DROP VIEW IF EXISTS management_zones_geo;

ALTER TABLE management_zones
  ALTER COLUMN geometry TYPE geometry(Geometry, 4326)
  USING geometry::geometry(Geometry, 4326);

ALTER TABLE clu_boundaries
  ALTER COLUMN geometry TYPE geometry(Geometry, 4326)
  USING geometry::geometry(Geometry, 4326);

-- Recreate management_zones_geo view (same definition as migration 011)
CREATE OR REPLACE VIEW management_zones_geo AS
SELECT
  id,
  registry_field_id,
  name,
  ST_AsGeoJSON(geometry)::jsonb AS geojson,
  organic_default,
  irrigated_default,
  notes,
  created_at,
  updated_at
FROM management_zones;
