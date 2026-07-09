-- Migration 029: Align field_boundaries RLS with management_zones
--
-- field_boundaries write was admin-only (migration 006).
-- Every other spatial table (management_zones, clu_boundaries, coverage_events)
-- allows admin + agronomist writes. This migration brings field_boundaries
-- in line so agronomists can redraw field boundaries in-app without needing
-- admin elevation.

DROP POLICY IF EXISTS field_boundaries_admin_insert ON field_boundaries;
DROP POLICY IF EXISTS field_boundaries_admin_update ON field_boundaries;
DROP POLICY IF EXISTS field_boundaries_admin_delete ON field_boundaries;

CREATE POLICY fb_write_admin ON field_boundaries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'agronomist')
  ));
