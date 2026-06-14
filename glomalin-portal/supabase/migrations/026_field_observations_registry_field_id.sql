-- Migration 026: Add registry_field_id to field_observations
--
-- Links field observations to the farm-registry field ID so observations
-- can be queried per-field in the activity timeline and field scorecard.

ALTER TABLE field_observations
  ADD COLUMN IF NOT EXISTS registry_field_id text;

-- Index for per-field observation queries
CREATE INDEX IF NOT EXISTS idx_field_observations_registry_field_id
  ON field_observations (registry_field_id);

-- Allow filtering by field_id + date for timeline queries
CREATE INDEX IF NOT EXISTS idx_field_observations_registry_field_date
  ON field_observations (registry_field_id, created_at DESC);
