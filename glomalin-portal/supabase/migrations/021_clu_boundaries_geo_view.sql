-- View: clu_boundaries_geo
-- Returns clu_boundaries with geometry serialized as GeoJSON JSONB.
-- PostgREST cannot call ST_AsGeoJSON() inside .select(), so this view is
-- required for the reporting-map API route (same pattern as management_zones_geo).

CREATE OR REPLACE VIEW clu_boundaries_geo AS
SELECT
  id,
  crop_year,
  farm_number,
  tract_number,
  clu_label,
  ST_AsGeoJSON(geometry)::jsonb AS geojson,
  fsa_acres,
  fsa_attributes,
  source_file,
  imported_at
FROM clu_boundaries;
