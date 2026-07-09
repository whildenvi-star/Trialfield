-- Migration 032: CLU sub-record splitting support
--
-- Adds columns to clu_records that enable the FSA 578 overlay/split workflow:
--
--   sub_label       — 'a', 'b', 'c' etc. NULL on un-split rows
--   split_geometry  — PostGIS geometry for the sub-polygon; NULL uses full CLU boundary
--   parent_clu_id   — FK pointing to the parent (un-split) clu_record row
--   superseded      — TRUE when a parent has been split and sub-rows replace it
--
-- UNIQUE constraint strategy:
--   The old idx_clu_records_unique covers ALL rows on (farm, tract, clu, year).
--   After splitting: the parent stays in the table (superseded=true) alongside
--   its children (sub_label='a','b',...). We need two partial indexes:
--
--   1. Un-split rows (sub_label IS NULL, superseded=false): same natural key uniqueness
--   2. Sub-rows (sub_label IS NOT NULL): unique on natural key + sub_label
--
--   The superseded parent (sub_label IS NULL, superseded=true) is excluded from
--   both partial indexes — it coexists alongside children without collisions.

ALTER TABLE clu_records
  ADD COLUMN IF NOT EXISTS sub_label      text
    CHECK (sub_label ~ '^[a-z]$'),
  ADD COLUMN IF NOT EXISTS split_geometry geometry(Polygon, 4326),
  ADD COLUMN IF NOT EXISTS parent_clu_id uuid
    REFERENCES clu_records (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded     boolean NOT NULL DEFAULT false;

-- Drop old unique index (does not accommodate sub_labels)
DROP INDEX IF EXISTS idx_clu_records_unique;

-- Partial unique index for un-split rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_clu_records_unique_unsplit
  ON clu_records (farm_number, tract_number, clu, crop_year)
  WHERE sub_label IS NULL AND superseded = false;

-- Partial unique index for split sub-rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_clu_records_unique_sublabel
  ON clu_records (farm_number, tract_number, clu, crop_year, sub_label)
  WHERE sub_label IS NOT NULL;

-- Spatial index on split_geometry for future spatial queries on sub-polygons
CREATE INDEX IF NOT EXISTS idx_cr_split_geometry
  ON clu_records USING GIST (split_geometry)
  WHERE split_geometry IS NOT NULL;

-- Index for querying children of a parent
CREATE INDEX IF NOT EXISTS idx_cr_parent_clu_id
  ON clu_records (parent_clu_id)
  WHERE parent_clu_id IS NOT NULL;

-- ── SECURITY DEFINER function: create_clu_split ───────────────────────────────
--
-- Creates one child sub-record from a parent CLU record.
-- Called once per split piece by POST /api/fsa/clu-records/[id]/split.
-- The API route marks the parent superseded=true only after ALL children succeed.
--
-- Validates:
--   1. Parent row exists
--   2. The provided geometry intersects the parent CLU boundary (clu_boundaries)
--
-- Computes acres from geometry (ST_Area → geography → divide by sq-meters/acre).
-- Inherits farm metadata from parent; caller supplies crop-specific fields.

CREATE OR REPLACE FUNCTION create_clu_split(
  p_parent_id   uuid,
  p_sub_label   text,
  p_geojson     text,
  p_crop        text,
  p_irrigated   boolean,
  p_organic     boolean,
  p_use         text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  parent     clu_records%ROWTYPE;
  new_id     uuid;
  split_geom geometry(Polygon, 4326);
  split_ac   numeric(10, 2);
BEGIN
  SELECT * INTO parent FROM clu_records WHERE id = p_parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent CLU record % not found', p_parent_id;
  END IF;

  IF parent.superseded THEN
    RAISE EXCEPTION 'Parent CLU record % is already superseded (already split)', p_parent_id;
  END IF;

  -- Parse the GeoJSON polygon
  split_geom := ST_GeomFromGeoJSON(p_geojson);

  -- Validate: the sub-polygon must intersect the parent CLU boundary
  IF NOT EXISTS (
    SELECT 1
    FROM   clu_boundaries cb
    WHERE  cb.farm_number  = parent.farm_number
      AND  cb.tract_number = parent.tract_number
      AND  cb.clu_label    = parent.clu
      AND  cb.crop_year    = parent.crop_year
      AND  ST_Intersects(cb.geometry, split_geom)
  ) THEN
    RAISE EXCEPTION
      'Split geometry does not intersect CLU boundary for CLU % (farm %, tract %, year %)',
      parent.clu, parent.farm_number, parent.tract_number, parent.crop_year;
  END IF;

  -- Compute sub-polygon acres from geography area
  split_ac := ROUND(
    CAST(ST_Area(split_geom::geography) / 4046.856422 AS numeric),
    2
  );

  INSERT INTO clu_records (
    crop_year,
    farm_number,
    tract_number,
    clu,
    field_name,
    farm_name,
    fsa_acres,
    registry_field_id,
    registry_crop_id,
    zone_id,
    sub_label,
    split_geometry,
    parent_clu_id,
    crop,
    irrigated,
    organic,
    use,
    double_crop,
    cover_crop,
    grain_plant_date,
    prevented_planting,
    reported,
    superseded
  ) VALUES (
    parent.crop_year,
    parent.farm_number,
    parent.tract_number,
    parent.clu,
    parent.field_name,
    parent.farm_name,
    split_ac,
    parent.registry_field_id,
    parent.registry_crop_id,
    parent.zone_id,
    p_sub_label,
    split_geom,
    p_parent_id,
    p_crop,
    p_irrigated,
    p_organic,
    p_use,
    parent.double_crop,
    parent.cover_crop,
    parent.grain_plant_date,
    false,
    false,
    false
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ── Update detect_clu_split_candidates to exclude already-superseded rows ─────
--
-- Without this, CLUs that have already been split still surface as candidates.

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
    WHERE cb.crop_year    = p_crop_year
      AND cr.superseded   = false      -- exclude already-split parents
      AND cr.sub_label   IS NULL       -- exclude sub-rows themselves
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
