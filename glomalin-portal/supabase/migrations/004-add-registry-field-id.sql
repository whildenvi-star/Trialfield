-- Add registry_field_id column to clu_records
-- Links CLU records to farm-registry canonical field IDs
-- Nullable: will be null until backfill script runs
-- No FK constraint: farm-registry is a separate Express app, not in Supabase

ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_field_id text;
CREATE INDEX IF NOT EXISTS idx_clu_records_registry_field_id ON clu_records(registry_field_id);
