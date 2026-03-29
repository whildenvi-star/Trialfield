/**
 * scripts/migrate-57.ts
 *
 * Phase 57 schema migration: creates grain_contracts table in Supabase
 * for the grain marketing position feature.
 *
 * Run: cd glomalin-portal && npx tsx scripts/migrate-57.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * What this script does:
 *   1. Creates grain_contracts table with all marketing contract columns
 *   2. Enables RLS with authenticated read and write policies
 *   3. Creates indexes for crop_year and registry_crop_id filtering
 *   4. Prints the SQL so the user can also run it manually in Supabase SQL editor
 *   5. Verifies the table exists by selecting from it after migration
 *
 * Idempotent: safe to run multiple times (CREATE TABLE IF NOT EXISTS).
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

// ─── Phase 57 SQL ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- Phase 57: Create grain_contracts table for grain marketing position feature
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS grain_contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  crop text NOT NULL,
  registry_crop_id text,
  contract_type text NOT NULL CHECK (contract_type IN ('cash', 'accumulator', 'hta', 'options', 'min-price', 'basis')),
  bushels numeric(12,2) NOT NULL,
  price_per_bushel numeric(8,4),
  basis numeric(8,4),
  futures_reference numeric(8,4),
  buyer text,
  delivery_start date,
  delivery_end date,
  crop_year integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE grain_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grain_contracts'
      AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY "authenticated_read" ON grain_contracts
      FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grain_contracts'
      AND policyname = 'authenticated_write'
  ) THEN
    CREATE POLICY "authenticated_write" ON grain_contracts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Index for crop year filtering (primary query pattern)
CREATE INDEX IF NOT EXISTS grain_contracts_crop_year_idx ON grain_contracts(crop_year);

-- Index for canonical crop registry cross-app aggregation
CREATE INDEX IF NOT EXISTS grain_contracts_registry_crop_id_idx ON grain_contracts(registry_crop_id);
`

// ─── Migration ────────────────────────────────────────────────────────────────

async function runMigration() {
  console.log('Phase 57 Schema Migration')
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
    console.log('  Attempting to verify table exists anyway...')
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
  console.log('\nVerifying grain_contracts table...')

  const { data, error } = await supabase
    .from('grain_contracts')
    .select('id, crop, contract_type, bushels, crop_year, created_at')
    .limit(1)

  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      console.error('  TABLE MISSING:', error.message)
      console.error('')
      console.error('  Run the SQL above in Supabase SQL editor to create the grain_contracts table.')
      process.exit(1)
    } else {
      console.error('  ERROR querying grain_contracts:', error.message)
      process.exit(1)
    }
  }

  console.log('  grain_contracts table verified:')
  console.log('    id                — OK')
  console.log('    crop              — OK')
  console.log('    contract_type     — OK')
  console.log('    bushels           — OK')
  console.log('    crop_year         — OK')
  console.log('    created_at        — OK')

  if (data && data.length > 0) {
    const row = data[0] as Record<string, unknown>
    console.log('')
    console.log('  Sample row:')
    console.log(`    id:            ${row.id}`)
    console.log(`    crop:          ${row.crop}`)
    console.log(`    contract_type: ${row.contract_type}`)
    console.log(`    bushels:       ${row.bushels}`)
    console.log(`    crop_year:     ${row.crop_year}`)
  } else {
    console.log('  (Table is empty — ready for contract data entry.)')
  }

  console.log('\nPhase 57 migration complete.')
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
