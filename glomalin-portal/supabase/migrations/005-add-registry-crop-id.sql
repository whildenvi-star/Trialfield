-- Migration 005: Add registry_crop_id to clu_records
-- Phase 50: Canonical Crop Registry backfill support
--
-- Adds a nullable text column to store the farm-registry canonical crop ID
-- (e.g., crop_009 for Soybeans, crop_018 for Hybrid Rye).
-- Populated by glomalin-portal/scripts/backfill-crop-ids.ts after running this migration.

ALTER TABLE clu_records
  ADD COLUMN IF NOT EXISTS registry_crop_id TEXT;

-- Index for cross-module crop aggregation queries (Phase 50+)
CREATE INDEX IF NOT EXISTS idx_clu_records_registry_crop_id ON clu_records (registry_crop_id);
