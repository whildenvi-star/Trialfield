-- Migration 020: Insurance, APH, and Claims schema
--
-- These tables were created outside the migration history and would be lost on
-- a fresh deploy. This migration idempotently recreates them with full RLS.

-- ── insurance_policies ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_policies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                text,
  policy_year              int NOT NULL,
  farm_name                text,
  farm_number              text,
  crop                     text,
  planted_acres            numeric NOT NULL,
  fsa_acres_manual         numeric,
  guarantee                numeric NOT NULL DEFAULT 0,
  actual                   numeric NOT NULL DEFAULT 0,
  coverage_level           numeric NOT NULL DEFAULT 75,
  unit_type                text,
  premium_per_acre         numeric,
  plan_type                text,
  agent_name               text,
  notes                    text,
  prevented_planting       boolean NOT NULL DEFAULT false,
  prevented_planting_acres numeric,
  claim_alert              text NOT NULL DEFAULT 'none',
  actual_synced_from_grain boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insurance_policies' AND policyname = 'ins_read_auth'
  ) THEN
    CREATE POLICY ins_read_auth ON insurance_policies
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insurance_policies' AND policyname = 'ins_write_admin'
  ) THEN
    CREATE POLICY ins_write_admin ON insurance_policies
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'agronomist')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insurance_policies_year ON insurance_policies (policy_year);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_farm ON insurance_policies (farm_number);

-- ── insurance_pricing ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year            int,
  crop            text NOT NULL,
  spring_price    numeric,
  fall_price      numeric,
  manual_override boolean NOT NULL DEFAULT false,
  last_scraped    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crop)
);

ALTER TABLE insurance_pricing ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insurance_pricing' AND policyname = 'pricing_read_auth'
  ) THEN
    CREATE POLICY pricing_read_auth ON insurance_pricing
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insurance_pricing' AND policyname = 'pricing_write_admin'
  ) THEN
    CREATE POLICY pricing_write_admin ON insurance_pricing
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'agronomist')
        )
      );
  END IF;
END $$;

-- ── aph_records ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aph_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid NOT NULL REFERENCES insurance_policies (id) ON DELETE CASCADE,
  crop_year       int NOT NULL,
  actual_yield    numeric NOT NULL,
  source          text NOT NULL DEFAULT 'manual',
  is_disaster_year boolean NOT NULL DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, crop_year)
);

ALTER TABLE aph_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'aph_records' AND policyname = 'aph_read_auth'
  ) THEN
    CREATE POLICY aph_read_auth ON aph_records
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'aph_records' AND policyname = 'aph_write_admin'
  ) THEN
    CREATE POLICY aph_write_admin ON aph_records
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'agronomist')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aph_records_policy ON aph_records (policy_id);

-- ── claims ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id           uuid REFERENCES insurance_policies (id) ON DELETE SET NULL,
  stage               text NOT NULL DEFAULT 'notice_of_loss',
  stage_entered_at    timestamptz,
  crop                text,
  commodity           text,
  coverage_type       text,
  coverage_level      numeric,
  effective_guarantee numeric,
  date_of_loss        date,
  description         text,
  deadline_at         timestamptz,
  deadline_overridden boolean NOT NULL DEFAULT false,
  farm_name           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claims' AND policyname = 'claims_read_auth'
  ) THEN
    CREATE POLICY claims_read_auth ON claims
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claims' AND policyname = 'claims_write_admin'
  ) THEN
    CREATE POLICY claims_write_admin ON claims
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'agronomist')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claims_policy    ON claims (policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_stage     ON claims (stage);
CREATE INDEX IF NOT EXISTS idx_claims_loss_date ON claims (date_of_loss);

-- ── claim_documents ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename     text NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0,
  mime_type    text NOT NULL,
  category     text NOT NULL DEFAULT 'other',
  uploaded_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_documents' AND policyname = 'docs_read_auth'
  ) THEN
    CREATE POLICY docs_read_auth ON claim_documents
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_documents' AND policyname = 'docs_write_auth'
  ) THEN
    CREATE POLICY docs_write_auth ON claim_documents
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim ON claim_documents (claim_id);

-- ── claim_timeline ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claim_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  event_data  jsonb,
  actor_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claim_timeline ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_timeline' AND policyname = 'timeline_read_auth'
  ) THEN
    CREATE POLICY timeline_read_auth ON claim_timeline
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_timeline' AND policyname = 'timeline_write_auth'
  ) THEN
    CREATE POLICY timeline_write_auth ON claim_timeline
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claim_timeline_claim ON claim_timeline (claim_id);
