-- 007-sales-marketing-redesign.sql
-- Introduces the two-tier commodity/variant model and sale_instruments table.
-- Run in Supabase Dashboard > SQL Editor.
-- Requires: schema.sql (set_updated_at function must exist)

-- ── Commodities (hedgeable unit — the CBOT roll-up target) ────────────────────

CREATE TABLE commodities (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  cbot_symbol  text,             -- 'ZC', 'ZS' — NULL for non-hedgeable specialty
  is_hedgeable boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

INSERT INTO commodities (id, name, cbot_symbol, is_hedgeable, sort_order) VALUES
  ('cbot_corn',           'CBOT Corn',              'ZC',  true,  1),
  ('cbot_soybeans',       'CBOT Soybeans',          'ZS',  true,  2),
  ('specialty_blue_corn', 'Blue Corn (Specialty)',   NULL,  false, 3),
  ('specialty_seed_corn', 'Seed Corn',               NULL,  false, 4);

-- ── Crop variants (physical crop grown, belongs to a commodity) ───────────────

CREATE TABLE crop_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id  text NOT NULL REFERENCES commodities(id),
  name          text NOT NULL,
  is_contracted boolean NOT NULL DEFAULT false,  -- true = pre-sold, no open hedging position
  crop_year     integer NOT NULL,
  estimated_bu  numeric,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON crop_variants (crop_year);
CREATE INDEX ON crop_variants (commodity_id);

-- ── Sale instruments (replaces grain_contracts for all new data entry) ─────────

CREATE TABLE sale_instruments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id    text NOT NULL REFERENCES commodities(id),
  variant_id      uuid REFERENCES crop_variants(id),
  instrument_type text NOT NULL CHECK (
    instrument_type IN ('cash', 'forward_contract', 'option', 'accumulator')
  ),
  crop_year       integer NOT NULL,

  -- Common
  buyer           text,
  counterparty    text,
  notes           text,

  -- Cash + Forward Contract
  bushels           numeric,
  price_per_bushel  numeric,
  basis             numeric,
  futures_reference numeric,
  delivery_start    date,
  delivery_end      date,
  delivered_bu      numeric NOT NULL DEFAULT 0,
  contract_number   text,          -- forward_contract only

  -- Option
  option_type  text CHECK (option_type IN ('call', 'put')),
  option_side  text CHECK (option_side IN ('long', 'short')),
  strike_price numeric,
  premium_paid numeric,
  expiry_date  date,

  -- Accumulator
  ko_level           numeric,
  ki_level           numeric,    -- optional knock-in
  daily_bu           numeric,
  weekly_bu          numeric,
  accumulation_start date,
  accumulation_end   date,
  leverage_ratio     numeric NOT NULL DEFAULT 1.0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON sale_instruments (crop_year, commodity_id);
CREATE INDEX ON sale_instruments (variant_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE TRIGGER crop_variants_updated_at
  BEFORE UPDATE ON crop_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sale_instruments_updated_at
  BEFORE UPDATE ON sale_instruments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE commodities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_instruments ENABLE ROW LEVEL SECURITY;

-- Commodities: read for all authenticated users; no client writes (seed data)
CREATE POLICY commodities_select_all ON commodities
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Crop variants: all authenticated read; admin/agronomist write
CREATE POLICY crop_variants_select_all ON crop_variants
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY crop_variants_insert_admin ON crop_variants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

CREATE POLICY crop_variants_update_admin ON crop_variants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

CREATE POLICY crop_variants_delete_admin ON crop_variants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

-- Sale instruments: same policy pattern
CREATE POLICY sale_instruments_select_all ON sale_instruments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY sale_instruments_insert_admin ON sale_instruments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

CREATE POLICY sale_instruments_update_admin ON sale_instruments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );

CREATE POLICY sale_instruments_delete_admin ON sale_instruments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agronomist'))
  );
