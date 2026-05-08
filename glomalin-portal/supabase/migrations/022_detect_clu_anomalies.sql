-- detect_clu_split_candidates(p_crop_year)
--
-- Returns CLUs that spatially intersect 2+ management zones with different
-- crops or organic status — these are candidates for A/B/C sub-CLU splitting.
--
-- Logic: A CLU needs splitting when it physically overlaps multiple SMS zones
-- that have conflicting crop or organic attributes for the given crop year.
-- The FSA office performs the actual split; this function surfaces the candidates
-- objectively so the correction isn't left to subjective judgment.
--
-- Called from: /api/fsa/clu-anomalies?year=YYYY
-- Depends on: clu_boundaries, clu_records, management_zones, zone_year_attributes
-- Indices used: idx_cb_geometry (GIST), idx_mz_geometry (GIST)

CREATE OR REPLACE FUNCTION detect_clu_split_candidates(p_crop_year int)
RETURNS TABLE (
  clu_record_id    uuid,
  farm_number      text,
  tract_number     text,
  clu_label        text,
  field_name       text,
  fsa_acres        numeric,
  zone_count       bigint,
  zone_names       text[],
  zone_crops       text[],
  zone_organics    boolean[],
  intersection_acs numeric[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH intersections AS (
    SELECT
      cr.id                                                         AS clu_record_id,
      cr.farm_number,
      cb.tract_number,
      cb.clu_label,
      cr.field_name,
      cb.fsa_acres,
      mz.id                                                         AS zone_id,
      mz.name                                                       AS zone_name,
      COALESCE(zya.crop, '(none)')                                  AS zone_crop,
      COALESCE(zya.organic, mz.organic_default, false)              AS zone_organic,
      ROUND(CAST(
        ST_Area(ST_Intersection(
          cb.geometry::geography,
          mz.geometry::geography
        )) / 4046.856422 AS numeric), 2)                            AS intersection_ac
    FROM clu_boundaries cb
    JOIN clu_records cr
      ON  cr.farm_number  = cb.farm_number
      AND cr.tract_number = cb.tract_number
      AND cr.clu          = cb.clu_label
      AND cr.crop_year    = cb.crop_year
    JOIN management_zones mz
      ON ST_Intersects(mz.geometry, cb.geometry)
    LEFT JOIN zone_year_attributes zya
      ON  zya.zone_id   = mz.id
      AND zya.crop_year = p_crop_year
    WHERE cb.crop_year = p_crop_year
  )
  SELECT
    i.clu_record_id,
    i.farm_number,
    i.tract_number,
    i.clu_label,
    i.field_name,
    i.fsa_acres,
    COUNT(i.zone_id)::bigint                                              AS zone_count,
    ARRAY_AGG(i.zone_name      ORDER BY i.intersection_ac DESC)          AS zone_names,
    ARRAY_AGG(i.zone_crop      ORDER BY i.intersection_ac DESC)          AS zone_crops,
    ARRAY_AGG(i.zone_organic   ORDER BY i.intersection_ac DESC)          AS zone_organics,
    ARRAY_AGG(i.intersection_ac ORDER BY i.intersection_ac DESC)         AS intersection_acs
  FROM intersections i
  GROUP BY
    i.clu_record_id,
    i.farm_number,
    i.tract_number,
    i.clu_label,
    i.field_name,
    i.fsa_acres
  HAVING COUNT(i.zone_id) >= 2
    AND (
      COUNT(DISTINCT i.zone_crop) > 1
      OR COUNT(DISTINCT i.zone_organic::text) > 1
    )
  ORDER BY i.farm_number, i.tract_number, i.clu_label;
END;
$$;
