-- Migration 024: Canonical clu_records table definition
--
-- clu_records was created manually and was not in the migration history.
-- This migration makes a fresh deploy safe: CREATE TABLE IF NOT EXISTS means
-- existing databases are unaffected; subsequent ADD COLUMN IF NOT EXISTS
-- backfills any columns that 004/005/010 may have already added.

CREATE TABLE IF NOT EXISTS clu_records (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                text        UNIQUE,
  crop_year                int         NOT NULL,
  farm_number              text        NOT NULL,
  tract_number             text        NOT NULL,
  clu                      text        NOT NULL,
  field_name               text,
  farm_name                text,
  fsa_acres                numeric(10, 2),
  crop                     text,
  irrigated                boolean     NOT NULL DEFAULT false,
  organic                  boolean     NOT NULL DEFAULT false,
  double_crop              boolean     NOT NULL DEFAULT false,
  cover_crop               boolean     NOT NULL DEFAULT false,
  grain_plant_date         text,
  use                      text,
  reported                 boolean     NOT NULL DEFAULT false,
  prevented_planting       boolean     NOT NULL DEFAULT false,
  prevented_planting_acres numeric(10, 2),
  registry_field_id        text,
  registry_crop_id         text,
  zone_id                  uuid        REFERENCES management_zones (id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Backfill columns that earlier migrations may not have applied
ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_field_id text;
ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_crop_id  text;
ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES management_zones (id) ON DELETE SET NULL;
ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS prevented_planting_acres numeric(10, 2);

-- Natural unique key: one record per CLU per crop year
CREATE UNIQUE INDEX IF NOT EXISTS idx_clu_records_unique
  ON clu_records (farm_number, tract_number, clu, crop_year);

CREATE INDEX IF NOT EXISTS idx_clu_records_year             ON clu_records (crop_year);
CREATE INDEX IF NOT EXISTS idx_clu_records_farm             ON clu_records (farm_number, crop_year);
CREATE INDEX IF NOT EXISTS idx_clu_records_registry_field_id ON clu_records (registry_field_id);
CREATE INDEX IF NOT EXISTS idx_clu_records_registry_crop_id  ON clu_records (registry_crop_id);
CREATE INDEX IF NOT EXISTS idx_clu_zone
  ON clu_records (zone_id) WHERE zone_id IS NOT NULL;

ALTER TABLE clu_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clu_records' AND policyname = 'clu_read_all'
  ) THEN
    CREATE POLICY clu_read_all ON clu_records FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clu_records' AND policyname = 'clu_write_admin'
  ) THEN
    CREATE POLICY clu_write_admin ON clu_records FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist')
      ));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_clu_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'clu_records_updated_at'
  ) THEN
    CREATE TRIGGER clu_records_updated_at
      BEFORE UPDATE ON clu_records
      FOR EACH ROW EXECUTE FUNCTION set_clu_updated_at();
  END IF;
END $$;
