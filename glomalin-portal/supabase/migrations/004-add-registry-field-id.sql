DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clu_records'
  ) THEN
    ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_field_id text;
    CREATE INDEX IF NOT EXISTS idx_clu_records_registry_field_id ON clu_records (registry_field_id);
  END IF;
END $$;
