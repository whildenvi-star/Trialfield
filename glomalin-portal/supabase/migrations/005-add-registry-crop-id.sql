DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clu_records'
  ) THEN
    ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_crop_id text;
    CREATE INDEX IF NOT EXISTS idx_clu_records_registry_crop_id ON clu_records (registry_crop_id);
  END IF;
END $$;
