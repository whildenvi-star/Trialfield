-- Migration 013: Coverage import helper RPCs
--
-- PostgREST cannot call ST_GeomFromGeoJSON inside .insert() — geometry columns
-- must be set via SQL functions. These two RPCs handle:
--   1. Inserting a single coverage_event with a GeoJSON geometry string
--   2. Finding the best-matching management_zone for a GeoJSON geometry (spatial lookup)
--
-- Both are SECURITY DEFINER so the caller's RLS is bypassed after the guard
-- check in the API route (requireModuleAccess).

-- ── Coverage event insert with geometry ───────────────────────────────────────

CREATE OR REPLACE FUNCTION import_coverage_event(
  p_zone_id        uuid,
  p_crop_year      int,
  p_source_adapter text,
  p_operation_type text,
  p_op_date        text,     -- ISO date string, e.g. '2026-05-01', or empty string
  p_geojson        text,     -- GeoJSON Polygon string, or empty string for no geometry
  p_applied_acres  numeric,
  p_product        text,
  p_rate           numeric,
  p_rate_unit      text,
  p_raw_payload    jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO coverage_events (
    zone_id, crop_year, source_adapter, operation_type, op_date,
    geometry, applied_acres, product, rate, rate_unit, raw_payload
  ) VALUES (
    p_zone_id,
    p_crop_year,
    p_source_adapter,
    p_operation_type,
    CASE WHEN p_op_date IS NOT NULL AND p_op_date <> ''
         THEN p_op_date::date ELSE NULL END,
    CASE WHEN p_geojson IS NOT NULL AND p_geojson <> ''
         THEN ST_GeomFromGeoJSON(p_geojson) ELSE NULL END,
    p_applied_acres,
    p_product,
    p_rate,
    p_rate_unit,
    COALESCE(p_raw_payload, '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ── Spatial zone lookup ───────────────────────────────────────────────────────
-- Returns the management_zone with the largest intersection area for a given
-- GeoJSON geometry. Returns NULL if no zone intersects.

CREATE OR REPLACE FUNCTION find_zone_for_geometry(p_geojson text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT mz.id
  FROM   management_zones mz
  WHERE  ST_Intersects(mz.geometry, ST_GeomFromGeoJSON(p_geojson))
  ORDER  BY ST_Area(ST_Intersection(mz.geometry, ST_GeomFromGeoJSON(p_geojson))) DESC
  LIMIT  1;
$$;

-- ── Coverage event summary view ───────────────────────────────────────────────
-- Convenience view for the import panel: shows count + last import per adapter.

CREATE OR REPLACE VIEW coverage_events_summary AS
SELECT
  crop_year,
  source_adapter,
  operation_type,
  COUNT(*)                          AS event_count,
  SUM(applied_acres)                AS total_applied_ac,
  MAX(imported_at)                  AS last_imported_at,
  COUNT(zone_id)                    AS matched_zone_count,
  COUNT(*) - COUNT(zone_id)         AS unmatched_count
FROM coverage_events
GROUP BY crop_year, source_adapter, operation_type
ORDER BY crop_year DESC, source_adapter, operation_type;
