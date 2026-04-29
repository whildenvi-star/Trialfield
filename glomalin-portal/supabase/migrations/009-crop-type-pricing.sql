-- 009-crop-type-pricing.sql
-- Recovery migration: restores the two-tier commodity/variant model (dropped by 008),
-- fixes sale_instruments (crop_type_id text → commodity_id uuid + variant_id uuid),
-- and creates commodity_pricing for per-year pricing config.
-- Run in Supabase Dashboard > SQL Editor.

-- ── 1. Commodities (uuid PK — replaces old text PK from migration 007) ──────────

CREATE TABLE commodities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  cbot_symbol  text,
  is_hedgeable boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

INSERT INTO commodities (name, cbot_symbol, is_hedgeable, sort_order) VALUES
  ('Corn',                'ZC',  true,  10),
  ('Soybeans',            'ZS',  true,  20),
  ('Natto Soybeans',      NULL,  false, 30),
  ('High Oil Soybeans',   'ZS',  true,  40),
  ('Hybrid Rye',          NULL,  false, 50),
  ('Winter Wheat',        'ZW',  true,  60);

CREATE TRIGGER commodities_updated_at
  BEFORE UPDATE ON commodities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE commodities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commodities_select_authenticated"
  ON commodities FOR SELECT TO authenticated USING (true);

CREATE POLICY "commodities_write_admin_agronomist"
  ON commodities FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

-- ── 2. Crop variants ─────────────────────────────────────────────────────────────

CREATE TABLE crop_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id  uuid NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  name          text NOT NULL,
  is_contracted boolean NOT NULL DEFAULT false,
  crop_year     integer NOT NULL,
  estimated_bu  numeric,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX ON crop_variants (crop_year);
CREATE INDEX ON crop_variants (commodity_id);

CREATE TRIGGER crop_variants_updated_at
  BEFORE UPDATE ON crop_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crop_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crop_variants_select_authenticated"
  ON crop_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "crop_variants_write_admin_agronomist"
  ON crop_variants FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

-- ── 3. Fix sale_instruments ──────────────────────────────────────────────────────
-- Migration 008 renamed commodity_id → crop_type_id (text) and dropped variant_id.
-- Restore to the new schema: commodity_id uuid + variant_id uuid.
-- Existing rows with crop_type_id will have NULL commodity_id (orphaned legacy data).

ALTER TABLE sale_instruments
  ADD COLUMN commodity_id  uuid REFERENCES commodities(id),
  ADD COLUMN variant_id    uuid REFERENCES crop_variants(id);

-- Keep crop_type_id in place for now — drop it manually after confirming no legacy
-- data needs preserving:  ALTER TABLE sale_instruments DROP COLUMN crop_type_id;

CREATE INDEX ON sale_instruments (crop_year, commodity_id);
CREATE INDEX ON sale_instruments (variant_id);

-- ── 4. Per-year pricing config ───────────────────────────────────────────────────

CREATE TABLE commodity_pricing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id  uuid NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  crop_year     integer NOT NULL,
  pricing_mode  text NOT NULL DEFAULT 'cbot_basis'
    CHECK (pricing_mode IN ('cbot_basis', 'flat_contract')),
  price_value   numeric(10,4),
  price_unit    text NOT NULL DEFAULT 'per_bu'
    CHECK (price_unit IN ('per_bu', 'per_ton', 'per_cwt')),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(commodity_id, crop_year)
);

CREATE TRIGGER commodity_pricing_updated_at
  BEFORE UPDATE ON commodity_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE commodity_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commodity_pricing_select_authenticated"
  ON commodity_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "commodity_pricing_write_admin_agronomist"
  ON commodity_pricing FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );
