-- Migration: Create field_observations table for Phase 04 field data entry
-- Requirements: FIELD-01, FIELD-02

CREATE TABLE IF NOT EXISTS field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own observations"
  ON field_observations FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can read own observations"
  ON field_observations FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE INDEX IF NOT EXISTS idx_field_obs_user_date
  ON field_observations(submitted_by, created_at DESC);
