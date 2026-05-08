-- Migration 019: Widen coverage_events.geometry to accept any geometry type
--
-- The coverage import path accepts MultiPolygon GeoJSON from SMS Advanced exports.
-- The original column was constrained to Polygon; widening to Geometry accepts both.

ALTER TABLE coverage_events
  ALTER COLUMN geometry TYPE geometry(Geometry, 4326)
  USING geometry::geometry(Geometry, 4326);
