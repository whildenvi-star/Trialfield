-- Migration 027: Add PostGIS geometry column to field_boundaries
--
-- field_boundaries previously stored geometry only as raw GeoJSON (jsonb).
-- This adds a proper PostGIS column so spatial queries (ST_Area, ST_Intersects,
-- ST_Contains) work against field boundaries directly — enabling acreage
-- calculation, CLU overlap detection, and in-app boundary editing.
--
-- The legacy geojson column is kept in place so existing consumers
-- (/api/maps/boundaries, /api/maps/import) continue to work unchanged.
-- The import script backfills geojson = ST_AsGeoJSON(geometry) after loading.

ALTER TABLE field_boundaries
  ADD COLUMN IF NOT EXISTS geometry       geometry(Geometry, 4326),
  ADD COLUMN IF NOT EXISTS total_acres    numeric(10, 2),
  ADD COLUMN IF NOT EXISTS source         text DEFAULT 'shapefile',
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted     boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fb_geometry
  ON field_boundaries USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_fb_registry_field
  ON field_boundaries (registry_field_id);

-- Recompute total_acres whenever geometry is written.
-- Uses geography cast so ST_Area returns square meters → convert to acres.
-- ST_MakeValid guards against any self-intersecting imports.
CREATE OR REPLACE FUNCTION compute_field_boundary_acres()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.geometry IS NOT NULL THEN
    NEW.total_acres := ROUND(CAST(
      ST_Area(ST_MakeValid(NEW.geometry)::geography) / 4046.856422
    AS numeric), 2);
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fb_compute_acres'
  ) THEN
    CREATE TRIGGER fb_compute_acres
      BEFORE INSERT OR UPDATE OF geometry ON field_boundaries
      FOR EACH ROW EXECUTE FUNCTION compute_field_boundary_acres();
  END IF;
END $$;
