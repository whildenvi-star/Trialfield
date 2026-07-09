-- Migration 028: Boundary edit history table
--
-- Records every geometry replacement so the source-of-record (USB shapefile
-- import) is never lost and any accidental edit is reversible.
-- Written exclusively by the archive trigger below — no direct user writes.

CREATE TABLE field_boundary_history (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_boundary_id   uuid        NOT NULL REFERENCES field_boundaries(id) ON DELETE CASCADE,
  geometry            geometry(Geometry, 4326),
  total_acres         numeric(10, 2),
  replaced_at         timestamptz NOT NULL DEFAULT now(),
  replaced_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  source              text
);

CREATE INDEX idx_fbh_field
  ON field_boundary_history (field_boundary_id, replaced_at DESC);

-- Capture the outgoing geometry before any update changes it.
-- Only fires when geometry actually changes (IS DISTINCT FROM guard).
CREATE OR REPLACE FUNCTION archive_field_boundary()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.geometry IS NOT NULL AND OLD.geometry IS DISTINCT FROM NEW.geometry THEN
    INSERT INTO field_boundary_history
      (field_boundary_id, geometry, total_acres, replaced_by, source)
    VALUES
      (OLD.id, OLD.geometry, OLD.total_acres, NEW.last_edited_by, OLD.source);
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'fb_archive_before_update'
  ) THEN
    CREATE TRIGGER fb_archive_before_update
      BEFORE UPDATE OF geometry ON field_boundaries
      FOR EACH ROW EXECUTE FUNCTION archive_field_boundary();
  END IF;
END $$;
