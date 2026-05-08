-- 008-crop-type-instruments.sql
-- Simplify sale_instruments to use local crop type IDs instead of Supabase commodity/variant FKs.
-- Run in Supabase Dashboard > SQL Editor.

-- Drop FK constraints
ALTER TABLE sale_instruments DROP CONSTRAINT IF EXISTS sale_instruments_variant_id_fkey;
ALTER TABLE sale_instruments DROP CONSTRAINT IF EXISTS sale_instruments_commodity_id_fkey;

-- Repurpose commodity_id → crop_type_id (stores local farm-budget JSON crop type ID)
ALTER TABLE sale_instruments RENAME COLUMN commodity_id TO crop_type_id;
ALTER TABLE sale_instruments DROP COLUMN IF EXISTS variant_id;

-- Drop tables no longer needed
DROP TABLE IF EXISTS crop_variants;
DROP TABLE IF EXISTS commodities;
