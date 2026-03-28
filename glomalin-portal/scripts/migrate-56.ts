/**
 * scripts/migrate-56.ts
 *
 * Phase 56 schema migration: creates aph_records table for structured
 * multi-year yield history with source tracking and disaster-year exclusion.
 *
 * Run: cd glomalin-portal && npx tsx scripts/migrate-56.ts
 * Dry run: cd glomalin-portal && npx tsx scripts/migrate-56.ts --dry-run
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * What this script does:
 *   1. Creates aph_records table with FK to insurance_policies
 *   2. Adds RLS policies for authenticated users (read + write)
 *   3. Adds index on policy_id for efficient lookups
 *   4. Verifies the table exists by selecting after migration
 *
 * Idempotent: safe to run multiple times (IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
 * APH-01: Structured multi-year yield storage with source tracking.
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
const DRY_RUN = process.argv.includes('--dry-run')

if (!DRY_RUN) {
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
}

// ─── Phase 56 SQL ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- Phase 56: Create aph_records table for structured multi-year APH yield history
-- APH-01: source tracking + disaster-year exclusion per policy per year
-- APH-02: computed APH from non-excluded yield history
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS aph_records (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id         uuid        NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  crop_year         integer     NOT NULL,
  actual_yield      numeric     NOT NULL,
  source            text        NOT NULL DEFAULT 'manual',
  is_disaster_year  boolean     NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(policy_id, crop_year)
);

-- Index for efficient policy lookups (Plan 02 queries by policy_id)
CREATE INDEX IF NOT EXISTS aph_records_policy_id_idx
  ON aph_records(policy_id);

-- RLS: enable row-level security
ALTER TABLE aph_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: authenticated users can read all APH records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aph_records' AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY authenticated_read ON aph_records
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- RLS Policy: authenticated users can insert/update/delete APH records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aph_records' AND policyname = 'authenticated_write'
  ) THEN
    CREATE POLICY authenticated_write ON aph_records
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
`

// ─── Migration ────────────────────────────────────────────────────────────────

async function runMigration() {
  console.log('Phase 56 Schema Migration')
  console.log('='.repeat(50))
  if (DRY_RUN) {
    console.log('Mode: DRY RUN — printing SQL only, no execution')
  } else {
    console.log(`Target: ${SUPABASE_URL}`)
  }
  console.log('')
  console.log('SQL to execute:')
  console.log('─'.repeat(50))
  console.log(MIGRATION_SQL)
  console.log('─'.repeat(50))
  console.log('')

  if (DRY_RUN) {
    console.log('Dry run complete — SQL printed above. Run without --dry-run to execute.')
    return
  }

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
    console.log('  Attempting to verify existing table anyway...')
  } else {
    const result = await response.json().catch(() => null)
    if (result && result.error) {
      console.log('  Migration warning:', result.error)
      console.log('  (This may be OK if table already exists.)')
    } else {
      console.log('  Migration SQL executed successfully.')
    }
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verifyTable() {
  if (DRY_RUN) return

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('\nVerifying Phase 56 aph_records table...')

  const { data, error } = await supabase
    .from('aph_records')
    .select('id, policy_id, crop_year, actual_yield, source, is_disaster_year, notes, created_at, updated_at')
    .limit(1)

  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('  TABLE MISSING:', error.message)
      console.error('')
      console.error('  Run the SQL above in Supabase SQL editor to create the aph_records table.')
      process.exit(1)
    } else {
      console.error('  ERROR querying aph_records:', error.message)
      process.exit(1)
    }
  }

  console.log('  aph_records table verified:')
  console.log('    id                — OK')
  console.log('    policy_id         — OK')
  console.log('    crop_year         — OK')
  console.log('    actual_yield      — OK')
  console.log('    source            — OK')
  console.log('    is_disaster_year  — OK')
  console.log('    notes             — OK')
  console.log('    created_at        — OK')
  console.log('    updated_at        — OK')

  if (data && data.length > 0) {
    const row = data[0] as Record<string, unknown>
    console.log('')
    console.log('  Sample row values:')
    console.log(`    policy_id:        ${row.policy_id}`)
    console.log(`    crop_year:        ${row.crop_year}`)
    console.log(`    actual_yield:     ${row.actual_yield}`)
    console.log(`    source:           ${row.source}`)
    console.log(`    is_disaster_year: ${row.is_disaster_year}`)
  } else {
    console.log('  (No rows yet — insert APH records via POST /api/insurance/aph to populate.)')
  }

  console.log('\nPhase 56 migration complete.')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await runMigration()
  await verifyTable()
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
