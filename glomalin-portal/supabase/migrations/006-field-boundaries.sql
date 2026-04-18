-- Migration: 006-field-boundaries.sql
-- Creates field_boundaries and farm_map_config tables for the Interactive Field Map (Phase 70).
-- field_boundaries stores per-field GeoJSON polygons imported from SMS shapefile exports.
-- farm_map_config is a key-value store for derived map settings (e.g., computed farm center).

-- ---------------------------------------------------------------------------
-- field_boundaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_field_id TEXT NOT NULL,
  name TEXT NOT NULL,
  geojson JSONB NOT NULL,
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT field_boundaries_registry_field_id_unique UNIQUE (registry_field_id)
);

ALTER TABLE field_boundaries ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read field boundaries
CREATE POLICY field_boundaries_select
  ON field_boundaries
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin role can insert or update boundaries
-- Imports use the service-role key (bypasses RLS entirely), but this policy
-- also covers direct Supabase dashboard edits by admin users.
CREATE POLICY field_boundaries_admin_insert
  ON field_boundaries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY field_boundaries_admin_update
  ON field_boundaries
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY field_boundaries_admin_delete
  ON field_boundaries
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- ---------------------------------------------------------------------------
-- farm_map_config
-- ---------------------------------------------------------------------------
-- Key-value store for map settings derived at import time.
-- Expected keys:
--   "farm_center"  → { "lat": number, "lng": number }  (mean centroid of all fields)
--   "bounds"       → { "minLat": n, "maxLat": n, "minLng": n, "maxLng": n }
CREATE TABLE IF NOT EXISTS farm_map_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE farm_map_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_map_config_select
  ON farm_map_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY farm_map_config_admin_insert
  ON farm_map_config
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY farm_map_config_admin_update
  ON farm_map_config
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY farm_map_config_admin_delete
  ON farm_map_config
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
