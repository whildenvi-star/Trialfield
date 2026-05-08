-- View: management_zones_geo
-- Returns management_zones with geometry serialized as GeoJSON JSONB.
-- PostgREST cannot call ST_AsGeoJSON in .select(), so this view is required
-- for any API route that needs to return zone geometry to the client.

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

-- RLS: inherit from management_zones (views in Postgres use caller permissions)
-- Authenticated users can read; admins/agronomists can manage zones via API.

-- ── Seed RPC ─────────────────────────────────────────────────────────────────
-- seed_zones_from_clus(p_crop_year)
--
-- Walks clu_records WHERE registry_field_id IS NOT NULL AND zone_id IS NULL
-- for the given crop year, creates a management_zone for each (copying
-- geometry from the matching clu_boundaries row), creates zone_year_attributes,
-- and back-fills clu_records.zone_id.
--
-- Returns: { created: N, already_linked: N }
-- Called via: supabase.rpc('seed_zones_from_clus', { p_crop_year: 2026 })

CREATE OR REPLACE FUNCTION seed_zones_from_clus(p_crop_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r             record;
  new_zone_id   uuid;
  created_count int := 0;
  linked_count  int := 0;
BEGIN
  FOR r IN
    SELECT
      cr.id            AS cr_id,
      cr.registry_field_id,
      cr.farm_number,
      cr.tract_number,
      cr.clu,
      cr.crop,
      cr.organic,
      cr.irrigated,
      cr.cover_crop,
      cr.use           AS intended_use,
      cb.geometry      AS cb_geom
    FROM clu_records cr
    LEFT JOIN clu_boundaries cb ON (
      cb.farm_number  = cr.farm_number  AND
      cb.tract_number = cr.tract_number AND
      cb.clu_label    = cr.clu          AND
      cb.crop_year    = p_crop_year
    )
    WHERE cr.registry_field_id IS NOT NULL
      AND cr.crop_year          = p_crop_year
      AND cr.zone_id            IS NULL
  LOOP
    INSERT INTO management_zones (
      registry_field_id,
      name,
      geometry,
      organic_default,
      irrigated_default
    ) VALUES (
      r.registry_field_id,
      'Farm ' || r.farm_number || ' Tract ' || r.tract_number || ' CLU ' || r.clu,
      r.cb_geom,
      COALESCE(r.organic,   false),
      COALESCE(r.irrigated, false)
    )
    RETURNING id INTO new_zone_id;

    INSERT INTO zone_year_attributes (
      zone_id,
      crop_year,
      crop,
      organic,
      irrigated,
      cover_crop,
      intended_use
    ) VALUES (
      new_zone_id,
      p_crop_year,
      r.crop,
      r.organic,
      r.irrigated,
      r.cover_crop,
      r.intended_use
    );

    UPDATE clu_records
    SET zone_id = new_zone_id
    WHERE id = r.cr_id;

    created_count := created_count + 1;
  END LOOP;

  SELECT COUNT(*) INTO linked_count
  FROM clu_records
  WHERE crop_year = p_crop_year
    AND zone_id IS NOT NULL;

  RETURN jsonb_build_object(
    'created',       created_count,
    'already_linked', linked_count
  );
END;
$$;
