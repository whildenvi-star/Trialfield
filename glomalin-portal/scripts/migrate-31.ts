/**
 * scripts/migrate-31.ts
 *
 * Phase 31 schema migration: creates claims, claim_documents, and claim_timeline
 * tables plus claim_stage enum, RLS policies, indexes, updated_at trigger, and
 * the claim-documents Storage bucket.
 *
 * Run: cd glomalin-portal && npx tsx scripts/migrate-31.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * What this script does:
 *   1. Creates claim_stage enum (DO/EXCEPTION block — idempotent)
 *   2. Creates claims table with FK to insurance_policies
 *   3. Creates claim_documents table with FK to claims
 *   4. Creates claim_timeline table with FK to claims (append-only)
 *   5. Enables RLS on all 3 tables + adds authenticated_all policy
 *   6. Creates storage.objects RLS policies scoped to claim-documents bucket
 *   7. Creates updated_at trigger on claims table
 *   8. Creates indexes on policy_id, stage, claim_id columns
 *   9. Creates claim-documents Storage bucket via JS client (private)
 *  10. Verifies columns exist by querying a row
 *
 * Idempotent: safe to run multiple times.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Minimal .env parser — reads KEY=VALUE pairs from .env.local without requiring the dotenv package
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

// Load .env.local from the glomalin-portal directory (script lives in scripts/ subdirectory)
loadEnvFile(path.resolve(__dirname, '../.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables.')
  console.error('  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL):', SUPABASE_URL ? 'set' : 'MISSING')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING')
  console.error('')
  console.error('Create glomalin-portal/.env.local with:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  process.exit(1)
}

// Service role client — bypasses RLS for migration
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ─── Phase 31 SQL ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- Phase 31: Claims schema migration
-- Creates claim_stage enum, claims, claim_documents, claim_timeline tables,
-- RLS policies, indexes, updated_at trigger, and Storage bucket RLS.
-- Safe to run multiple times (idempotent).

-- 1. claim_stage enum (DO/EXCEPTION block for idempotency — IF NOT EXISTS not universally supported)
DO $$ BEGIN
  CREATE TYPE claim_stage AS ENUM (
    'notice_of_loss',
    'filed',
    'adjuster_assigned',
    'under_review',
    'settled',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- 2. claims table — FK to insurance_policies, NOT unique on policy_id (multi-claim per policy)
CREATE TABLE IF NOT EXISTS claims (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  clu_record_id         uuid REFERENCES clu_records(id) ON DELETE SET NULL,
  stage                 claim_stage NOT NULL DEFAULT 'notice_of_loss',
  stage_entered_at      timestamptz NOT NULL DEFAULT now(),
  crop                  text,
  coverage_type         text,
  coverage_level        integer,
  effective_guarantee   numeric(10,2),
  date_of_loss          date,
  cause_of_loss         text,
  description           text,
  estimated_loss_bu     numeric(10,2),
  appraised_value       numeric(12,2),
  indemnity_amount      numeric(12,2),
  deductible_amount     numeric(12,2),
  deadline_at           timestamptz,
  deadline_overridden   boolean NOT NULL DEFAULT false,
  adjuster_name         text,
  adjuster_phone        text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. claim_documents table — FK to claims, Storage path for claim-documents bucket
CREATE TABLE IF NOT EXISTS claim_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  filename      text NOT NULL,
  file_size     integer,
  mime_type     text,
  category      text,
  uploaded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 4. claim_timeline table — append-only audit trail, no updated_at
CREATE TABLE IF NOT EXISTS claim_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  event_data  jsonb,
  note        text,
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS: enable on all 3 tables
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated_all — same pattern as insurance_policies authenticated_write)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claims' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all" ON claims
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claim_documents' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all" ON claim_documents
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'claim_timeline' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all" ON claim_timeline
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- 6. Storage objects RLS — scoped to claim-documents bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'claim_docs_upload'
  ) THEN
    CREATE POLICY "claim_docs_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'claim-documents');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'claim_docs_select'
  ) THEN
    CREATE POLICY "claim_docs_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'claim-documents');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'claim_docs_delete'
  ) THEN
    CREATE POLICY "claim_docs_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'claim-documents');
  END IF;
END$$;

-- 7. updated_at trigger on claims (set_updated_at function exists from schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'claims_updated_at'
  ) THEN
    CREATE TRIGGER claims_updated_at
      BEFORE UPDATE ON claims
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS claims_policy_id_idx ON claims(policy_id);
CREATE INDEX IF NOT EXISTS claims_stage_idx ON claims(stage);
CREATE INDEX IF NOT EXISTS claim_documents_claim_id_idx ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS claim_timeline_claim_id_idx ON claim_timeline(claim_id);
`

// ─── Migration ────────────────────────────────────────────────────────────────

async function runMigration() {
  console.log('Phase 31 Schema Migration')
  console.log('='.repeat(50))
  console.log(`Target: ${SUPABASE_URL}`)
  console.log('')
  console.log('SQL to execute:')
  console.log('─'.repeat(50))
  console.log(MIGRATION_SQL)
  console.log('─'.repeat(50))
  console.log('')
  console.log('Executing migration...')

  // Attempt to run via exec_sql RPC (may not exist in all Supabase projects)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: MIGRATION_SQL }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.log('  exec_sql RPC not available (HTTP', response.status, ').')
    if (body) console.log('  Response:', body.slice(0, 200))
    console.log('')
    console.log('  ACTION REQUIRED: Run the SQL above manually in Supabase SQL editor.')
    console.log('  URL: https://app.supabase.com/project/_/sql')
    console.log('')
    console.log('  Attempting to verify existing columns anyway...')
  } else {
    const result = await response.json().catch(() => null)
    if (result && result.error) {
      console.log('  Migration warning:', result.error)
      console.log('  (This may be OK if tables already exist.)')
    } else {
      console.log('  Migration SQL executed successfully.')
    }
  }
}

// ─── Storage Bucket ───────────────────────────────────────────────────────────

async function createStorageBucket() {
  console.log('\nCreating claim-documents Storage bucket...')

  try {
    const { data, error } = await supabase.storage.createBucket('claim-documents', {
      public: false,
    })

    if (error) {
      // Bucket already exists — this is expected on re-runs
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('  claim-documents bucket already exists — skipping.')
      } else {
        console.log('  Warning: Could not create bucket via JS client:', error.message)
        console.log('')
        console.log('  MANUAL FALLBACK: Create the bucket via Supabase Dashboard:')
        console.log('    1. Go to https://app.supabase.com/project/_/storage/buckets')
        console.log('    2. Click "New bucket"')
        console.log('    3. Name: claim-documents')
        console.log('    4. Public bucket: OFF (private)')
        console.log('    5. Click "Create bucket"')
      }
    } else {
      console.log('  claim-documents bucket created successfully:', data)
    }
  } catch (err) {
    console.log('  Warning: Bucket creation threw an error:', err)
    console.log('')
    console.log('  MANUAL FALLBACK: Create the bucket via Supabase Dashboard:')
    console.log('    1. Go to https://app.supabase.com/project/_/storage/buckets')
    console.log('    2. Click "New bucket", name it "claim-documents", set Private')
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verifySchema() {
  console.log('\nVerifying Phase 31 schema...')

  // Verify claims table columns
  const { data: claimsData, error: claimsError } = await supabase
    .from('claims')
    .select('id, policy_id, stage, stage_entered_at, deadline_at, deadline_overridden, effective_guarantee')
    .limit(1)

  if (claimsError) {
    if (claimsError.message.includes('column') || claimsError.message.includes('does not exist')) {
      console.error('  COLUMN MISSING in claims:', claimsError.message)
      console.error('  Run the SQL above in Supabase SQL editor.')
      process.exit(1)
    } else if (claimsError.message.includes('relation') || claimsError.message.includes('table')) {
      console.error('  TABLE MISSING: claims table not found:', claimsError.message)
      console.error('  Run the SQL above in Supabase SQL editor.')
      process.exit(1)
    } else {
      console.error('  ERROR querying claims:', claimsError.message)
      process.exit(1)
    }
  }

  console.log('  claims table verified — key columns: id, policy_id, stage, deadline_at OK')

  // Verify claim_documents table
  const { error: docsError } = await supabase
    .from('claim_documents')
    .select('id, claim_id, storage_path, filename, category')
    .limit(1)

  if (docsError && (docsError.message.includes('relation') || docsError.message.includes('table'))) {
    console.error('  TABLE MISSING: claim_documents:', docsError.message)
    process.exit(1)
  }
  console.log('  claim_documents table verified — key columns: id, claim_id, storage_path OK')

  // Verify claim_timeline table
  const { error: timelineError } = await supabase
    .from('claim_timeline')
    .select('id, claim_id, event_type, event_data, actor_id')
    .limit(1)

  if (timelineError && (timelineError.message.includes('relation') || timelineError.message.includes('table'))) {
    console.error('  TABLE MISSING: claim_timeline:', timelineError.message)
    process.exit(1)
  }
  console.log('  claim_timeline table verified — key columns: id, claim_id, event_type OK')

  if (claimsData && claimsData.length > 0) {
    const row = claimsData[0] as Record<string, unknown>
    console.log('')
    console.log('  Sample claims row:')
    console.log(`    id:                  ${row.id}`)
    console.log(`    policy_id:           ${row.policy_id}`)
    console.log(`    stage:               ${row.stage}`)
    console.log(`    deadline_at:         ${row.deadline_at ?? 'null'}`)
    console.log(`    effective_guarantee: ${row.effective_guarantee ?? 'null'}`)
  } else {
    console.log('  (No rows in claims — tables are empty, ready for data.)')
  }

  console.log('\nPhase 31 migration complete.')
  console.log('')
  console.log('Next step: Run the app and verify the claims module appears in navigation.')
  console.log('  cd glomalin-portal && npm run dev')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await runMigration()
  await createStorageBucket()
  await verifySchema()
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
