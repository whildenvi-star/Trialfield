-- Migration 017: Spatial RPC to link CLU records to management zones
--
-- Finds the management zone with the largest geometry intersection for each
-- clu_boundary, then updates clu_records.zone_id. Safe to run repeatedly —
-- only updates rows where zone_id IS NULL (idempotent).
--
-- Call: SELECT link_clus_to_zones(2026);
-- Returns: { linked: N, already_linked: N, no_geometry: N, no_zone_found: N }

CREATE OR REPLACE FUNCTION link_clus_to_zones(p_crop_year int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  linked_count      int := 0;
  already_linked    int := 0;
  no_geometry_count int := 0;
  no_zone_count     int := 0;
  r                 record;
  best_zone_id      uuid;
BEGIN
  -- Count already-linked records (skip them)
  SELECT COUNT(*) INTO already_linked
  FROM clu_records
  WHERE crop_year = p_crop_year AND zone_id IS NOT NULL;

  -- Iterate over unlinked CLU records that have a matching boundary geometry
  FOR r IN
    SELECT
      cr.id          AS cr_id,
      cb.geometry    AS cb_geom
    FROM clu_records cr
    JOIN clu_boundaries cb ON (
      cb.farm_number  = cr.farm_number  AND
      cb.tract_number = cr.tract_number AND
      cb.clu_label    = cr.clu          AND
      cb.crop_year    = p_crop_year
    )
    WHERE cr.crop_year  = p_crop_year
      AND cr.zone_id   IS NULL
      AND cb.geometry  IS NOT NULL
  LOOP
    -- Find the management zone whose centroid is closest to this CLU's centroid,
    -- among zones that spatially intersect the CLU.
    -- Using centroid distance instead of ST_Intersection area to avoid
    -- GEOS TopologyException on shapefiles with minor coordinate precision issues.
    SELECT mz.id INTO best_zone_id
    FROM management_zones mz
    WHERE ST_Intersects(mz.geometry, r.cb_geom)
    ORDER BY ST_Distance(
      ST_Centroid(ST_MakeValid(mz.geometry)),
      ST_Centroid(ST_MakeValid(r.cb_geom))
    )
    LIMIT 1;

    IF best_zone_id IS NOT NULL THEN
      UPDATE clu_records SET zone_id = best_zone_id WHERE id = r.cr_id;
      linked_count := linked_count + 1;
    ELSE
      no_zone_count := no_zone_count + 1;
    END IF;
  END LOOP;

  -- Count records with no boundary geometry at all
  SELECT COUNT(*) INTO no_geometry_count
  FROM clu_records cr
  WHERE cr.crop_year = p_crop_year
    AND cr.zone_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM clu_boundaries cb
      WHERE cb.farm_number  = cr.farm_number
        AND cb.tract_number = cr.tract_number
        AND cb.clu_label    = cr.clu
        AND cb.crop_year    = p_crop_year
        AND cb.geometry     IS NOT NULL
    );

  RETURN jsonb_build_object(
    'linked',          linked_count,
    'already_linked',  already_linked,
    'no_geometry',     no_geometry_count,
    'no_zone_found',   no_zone_count
  );
END;
$$;
