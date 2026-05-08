-- Phase 1: Management Zone Three-Layer Data Model
-- Implements the architectural foundation from the FSA design brief:
-- zones (persistent geometry) / coverage_events (as-applied) / clu_boundaries (FSA overlay)
--
-- The CREATE EXTENSION line ensures PostGIS is available in the runner's
-- current schema context. IF NOT EXISTS is safe when already installed.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Management Zones ──────────────────────────────────────────────────────────

CREATE TABLE management_zones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_field_id   text,
  name                text NOT NULL,
  geometry            geometry(Polygon, 4326),
  organic_default     boolean NOT NULL DEFAULT false,
  irrigated_default   boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mz_registry_field ON management_zones (registry_field_id);
CREATE INDEX idx_mz_geometry ON management_zones USING GIST (geometry);

-- ── Zone Year Attributes ──────────────────────────────────────────────────────

CREATE TABLE zone_year_attributes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      uuid NOT NULL REFERENCES management_zones (id) ON DELETE CASCADE,
  crop_year    int  NOT NULL,
  crop         text,
  variety      text,
  irrigated    boolean,
  organic      boolean,
  intended_use text,
  tillage      text,
  cover_crop   boolean,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone_id, crop_year)
);

CREATE INDEX idx_zya_zone_year ON zone_year_attributes (zone_id, crop_year);

-- ── CLU Boundaries ────────────────────────────────────────────────────────────

CREATE TABLE clu_boundaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_year       int  NOT NULL,
  farm_number     text NOT NULL,
  tract_number    text NOT NULL,
  clu_label       text NOT NULL,
  geometry        geometry(Polygon, 4326),
  fsa_acres       numeric(10, 2),
  fsa_attributes  jsonb NOT NULL DEFAULT '{}',
  source_file     text,
  imported_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cb_farm_tract_year ON clu_boundaries (farm_number, tract_number, crop_year);
CREATE INDEX idx_cb_geometry ON clu_boundaries USING GIST (geometry);
CREATE UNIQUE INDEX idx_cb_unique_clu ON clu_boundaries (farm_number, tract_number, clu_label, crop_year);

-- ── Coverage Events ───────────────────────────────────────────────────────────

CREATE TABLE coverage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         uuid REFERENCES management_zones (id) ON DELETE SET NULL,
  crop_year       int  NOT NULL,
  source_adapter  text NOT NULL,
  operation_type  text NOT NULL,
  op_date         date,
  geometry        geometry(Polygon, 4326),
  applied_acres   numeric(10, 2),
  product         text,
  rate            numeric(10, 4),
  rate_unit       text,
  raw_payload     jsonb NOT NULL DEFAULT '{}',
  imported_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ce_zone_year ON coverage_events (zone_id, crop_year);
CREATE INDEX idx_ce_year_adapter ON coverage_events (crop_year, source_adapter);
CREATE INDEX idx_ce_geometry ON coverage_events USING GIST (geometry);

-- ── Practice Ledger ───────────────────────────────────────────────────────────

CREATE TABLE practice_ledger (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id        uuid NOT NULL REFERENCES management_zones (id) ON DELETE CASCADE,
  crop_year      int  NOT NULL,
  practice_code  text NOT NULL,
  value          text,
  source         text NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_zone_year ON practice_ledger (zone_id, crop_year);
CREATE INDEX idx_pl_practice ON practice_ledger (practice_code, crop_year);

-- ── Rotation Rules ────────────────────────────────────────────────────────────

CREATE TABLE rotation_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  crop                  text NOT NULL,
  rule_type             text NOT NULL,
  max_frequency_years   int,
  cannot_follow_crop    text,
  cannot_follow_product text,
  notes                 text,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Backward Compat: zone_id on clu_records ──────────────────────────────────

ALTER TABLE clu_records
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES management_zones (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clu_zone ON clu_records (zone_id) WHERE zone_id IS NOT NULL;

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE management_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_year_attributes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clu_boundaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_rules        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mz_read_all"    ON management_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "mz_write_admin" ON management_zones FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

CREATE POLICY "zya_read_all"    ON zone_year_attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "zya_write_admin" ON zone_year_attributes FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

CREATE POLICY "cb_read_all"    ON clu_boundaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_write_admin" ON clu_boundaries FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

CREATE POLICY "ce_read_all"    ON coverage_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ce_write_admin" ON coverage_events FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

CREATE POLICY "pl_read_all"     ON practice_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "pl_insert_admin" ON practice_ledger FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

CREATE POLICY "rr_read_all"    ON rotation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_write_admin" ON rotation_rules FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')));

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER mz_updated_at  BEFORE UPDATE ON management_zones     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER zya_updated_at BEFORE UPDATE ON zone_year_attributes  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
