-- Migration 033: CLU overlay intersection RPCs
--
-- Provides two new PostGIS functions that power the Overlay/Split view:
--
--   get_clu_overlay_intersections(p_clu_record_id)
--     Returns a JSON array of GeoJSON Feature objects for the Venn overlay:
--       'clu'                 — full CLU boundary
--       'zone'                — each management zone clipped to CLU
--       'coverage'            — each planting-pass coverage event clipped to CLU
--       'intersection_triple' — CLU ∩ zone ∩ coverage (highest-confidence region)
--
--   preview_clu_snip(p_clu_record_id, p_drawn_geojson)
--     Given a user-drawn polygon, returns ST_Intersection (the snipped piece)
--     and ST_Difference (the remainder). Read-only — does not write to the DB.
--
-- Also updates export_clu_shapefile_rows to:
--   - Exclude superseded parent rows
--   - Use split_geometry when present (sub-CLU export)
--   - Output CLU identifier as clu || sub_label (e.g. '1a', '1b')

-- ── get_clu_overlay_intersections ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_clu_overlay_intersections(p_clu_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  rec        clu_records%ROWTYPE;
  cb_geom    geometry(Polygon, 4326);
  cb_geojson text;
  result     jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO rec FROM clu_records WHERE id = p_clu_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLU record % not found', p_clu_record_id;
  END IF;

  -- Fetch matching CLU boundary geometry
  SELECT ST_MakeValid(geometry), ST_AsGeoJSON(ST_MakeValid(geometry))
  INTO   cb_geom, cb_geojson
  FROM   clu_boundaries
  WHERE  farm_number  = rec.farm_number
    AND  tract_number = rec.tract_number
    AND  clu_label    = rec.clu
    AND  crop_year    = rec.crop_year;

  IF cb_geom IS NULL THEN
    -- No boundary geometry on file — return empty array rather than raising
    RETURN '[]'::jsonb;
  END IF;

  -- ── Layer: CLU boundary ────────────────────────────────────────────────────
  result := result || jsonb_build_array(
    jsonb_build_object(
      'type',       'Feature',
      'geometry',   cb_geojson::jsonb,
      'properties', jsonb_build_object(
        'layer_type',    'clu',
        'clu_record_id', p_clu_record_id,
        'clu_label',     rec.clu,
        'farm_number',   rec.farm_number,
        'tract_number',  rec.tract_number,
        'fsa_acres',     rec.fsa_acres,
        'crop',          rec.crop,
        'irrigated',     rec.irrigated,
        'organic',       rec.organic
      )
    )
  );

  -- ── Layer: management zones clipped to CLU ────────────────────────────────
  -- Uses ST_MakeValid on both geometries to avoid GEOS TopologyException from
  -- minor coordinate precision issues in imported shapefiles (same pattern as
  -- link_clus_to_zones in migration 017).
  result := result || (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(
                          ST_MakeValid(ST_Intersection(
                            ST_MakeValid(mz.geometry), cb_geom
                          ))
                        )::jsonb,
          'properties', jsonb_build_object(
            'layer_type',      'zone',
            'zone_id',         mz.id,
            'zone_name',       mz.name,
            'zone_crop',       COALESCE(zya.crop, '(none)'),
            'zone_irrigated',  COALESCE(zya.irrigated, mz.irrigated_default, false),
            'zone_organic',    COALESCE(zya.organic,   mz.organic_default,   false),
            'intersection_ac', ROUND(CAST(
              ST_Area(
                ST_Intersection(
                  ST_MakeValid(mz.geometry)::geography,
                  cb_geom::geography
                )
              ) / 4046.856422 AS numeric
            ), 2)
          )
        )
      ) FILTER (WHERE
        ST_Intersects(ST_MakeValid(mz.geometry), cb_geom)
        AND NOT ST_IsEmpty(ST_Intersection(ST_MakeValid(mz.geometry), cb_geom))
      ),
      '[]'::jsonb
    )
    FROM management_zones mz
    LEFT JOIN zone_year_attributes zya
      ON  zya.zone_id   = mz.id
      AND zya.crop_year = rec.crop_year
    WHERE ST_Intersects(ST_MakeValid(mz.geometry), cb_geom)
  );

  -- ── Layer: coverage events (planting) clipped to CLU ─────────────────────
  -- Only planting passes with geometry are included; DAT-imported events (no
  -- geometry) are excluded here and shown in the sidebar count only.
  result := result || (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(
                          ST_MakeValid(ST_Intersection(
                            ST_MakeValid(ce.geometry), cb_geom
                          ))
                        )::jsonb,
          'properties', jsonb_build_object(
            'layer_type',      'coverage',
            'event_id',        ce.id,
            'op_date',         ce.op_date,
            'product',         ce.product,
            'source_adapter',  ce.source_adapter,
            'applied_acres',   ce.applied_acres,
            'intersection_ac', ROUND(CAST(
              ST_Area(
                ST_Intersection(
                  ST_MakeValid(ce.geometry)::geography,
                  cb_geom::geography
                )
              ) / 4046.856422 AS numeric
            ), 2)
          )
        )
      ) FILTER (WHERE
        ST_Intersects(ST_MakeValid(ce.geometry), cb_geom)
        AND NOT ST_IsEmpty(ST_Intersection(ST_MakeValid(ce.geometry), cb_geom))
      ),
      '[]'::jsonb
    )
    FROM coverage_events ce
    WHERE ce.crop_year      = rec.crop_year
      AND ce.operation_type = 'planting'
      AND ce.geometry       IS NOT NULL
      AND ST_Intersects(ST_MakeValid(ce.geometry), cb_geom)
  );

  -- ── Layer: triple intersections (CLU ∩ zone ∩ coverage) ──────────────────
  -- These are the highest-confidence reporting regions: we know crop, practice,
  -- AND that the planter physically went there.
  result := result || (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(
                          ST_MakeValid(
                            ST_Intersection(
                              ST_Intersection(
                                ST_MakeValid(mz.geometry), cb_geom
                              ),
                              ST_MakeValid(ce.geometry)
                            )
                          )
                        )::jsonb,
          'properties', jsonb_build_object(
            'layer_type',      'intersection_triple',
            'zone_id',         mz.id,
            'zone_name',       mz.name,
            'zone_crop',       COALESCE(zya.crop, '(none)'),
            'zone_irrigated',  COALESCE(zya.irrigated, mz.irrigated_default, false),
            'zone_organic',    COALESCE(zya.organic,   mz.organic_default,   false),
            'event_id',        ce.id,
            'op_date',         ce.op_date,
            'product',         ce.product,
            'intersection_ac', ROUND(CAST(
              ST_Area(
                ST_Intersection(
                  ST_Intersection(
                    ST_MakeValid(mz.geometry)::geography,
                    cb_geom::geography
                  ),
                  ST_MakeValid(ce.geometry)::geography
                )
              ) / 4046.856422 AS numeric
            ), 2)
          )
        )
      ) FILTER (WHERE NOT ST_IsEmpty(
        ST_Intersection(
          ST_Intersection(ST_MakeValid(mz.geometry), cb_geom),
          ST_MakeValid(ce.geometry)
        )
      )),
      '[]'::jsonb
    )
    FROM management_zones mz
    LEFT JOIN zone_year_attributes zya
      ON  zya.zone_id   = mz.id
      AND zya.crop_year = rec.crop_year
    JOIN coverage_events ce
      ON  ce.crop_year      = rec.crop_year
      AND ce.operation_type = 'planting'
      AND ce.geometry IS NOT NULL
    WHERE ST_Intersects(ST_MakeValid(mz.geometry), cb_geom)
      AND ST_Intersects(ST_MakeValid(ce.geometry), cb_geom)
  );

  RETURN result;
END;
$$;


-- ── preview_clu_snip ──────────────────────────────────────────────────────────
--
-- Given a user-drawn polygon (from the Snip tool in the overlay map), returns:
--   snip:      ST_Intersection(drawn, clu_boundary) — the carved-out piece
--   remainder: ST_Difference(clu_boundary, drawn)   — what remains
-- Both returned as GeoJSON with computed acres. READ-ONLY — no writes.

CREATE OR REPLACE FUNCTION preview_clu_snip(
  p_clu_record_id uuid,
  p_drawn_geojson text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  rec        clu_records%ROWTYPE;
  cb_geom    geometry(Polygon, 4326);
  drawn_geom geometry;
  snip_geom  geometry;
  rem_geom   geometry;
BEGIN
  SELECT * INTO rec FROM clu_records WHERE id = p_clu_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLU record % not found', p_clu_record_id;
  END IF;

  SELECT ST_MakeValid(geometry) INTO cb_geom
  FROM   clu_boundaries
  WHERE  farm_number  = rec.farm_number
    AND  tract_number = rec.tract_number
    AND  clu_label    = rec.clu
    AND  crop_year    = rec.crop_year;

  IF cb_geom IS NULL THEN
    RAISE EXCEPTION 'No boundary geometry found for CLU record %', p_clu_record_id;
  END IF;

  drawn_geom := ST_MakeValid(ST_GeomFromGeoJSON(p_drawn_geojson));
  snip_geom  := ST_MakeValid(ST_Intersection(drawn_geom, cb_geom));
  rem_geom   := ST_MakeValid(ST_Difference(cb_geom, drawn_geom));

  RETURN jsonb_build_object(
    'snip', jsonb_build_object(
      'geojson', ST_AsGeoJSON(snip_geom)::jsonb,
      'acres',   ROUND(CAST(ST_Area(snip_geom::geography) / 4046.856422 AS numeric), 2)
    ),
    'remainder', jsonb_build_object(
      'geojson', ST_AsGeoJSON(rem_geom)::jsonb,
      'acres',   ROUND(CAST(ST_Area(rem_geom::geography) / 4046.856422 AS numeric), 2)
    )
  );
END;
$$;


-- ── Updated export_clu_shapefile_rows ─────────────────────────────────────────
--
-- Changes from migration 016:
--   1. Excludes superseded parent rows (WHERE cr.superseded = false)
--   2. Uses split_geometry when present (sub-CLU rows have their own polygon)
--   3. Outputs clu || sub_label as CLU identifier (e.g. '1', '1a', '1b')
--   4. Orders by sub_label so sub-rows appear in sequence after natural key

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
    -- Composite CLU number: '1' for whole CLU, '1a'/'1b' for sub-records
    (cr.clu || COALESCE(cr.sub_label, ''))::text,
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
    -- Use split_geometry for sub-CLU rows; fall back to CLU boundary geometry
    CASE
      WHEN cr.split_geometry IS NOT NULL
        THEN ST_AsGeoJSON(cr.split_geometry)::text
      ELSE
        ST_AsGeoJSON(cb.geometry)::text
    END
  FROM clu_records cr
  LEFT JOIN clu_boundaries cb ON (
    cb.farm_number  = cr.farm_number  AND
    cb.tract_number = cr.tract_number AND
    cb.clu_label    = cr.clu          AND
    cb.crop_year    = p_crop_year
  )
  LEFT JOIN zone_year_attributes zya ON (
    zya.zone_id   = cr.zone_id AND
    zya.crop_year = p_crop_year
  )
  WHERE cr.crop_year  = p_crop_year
    AND cr.superseded = false
    AND (NOT p_confirmed_only OR cr.reported = true)
  ORDER BY cr.farm_number, cr.tract_number, cr.clu, cr.sub_label NULLS FIRST;
END;
$$;
