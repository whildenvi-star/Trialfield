/**
 * scripts/migrate-29.ts
 *
 * Phase 29 schema migration: adds APH auto-detect and claim alert columns to
 * insurance_policies (which already exists from Phase 27-01 migration).
 *
 * Run: cd glomalin-portal && npx tsx scripts/migrate-29.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * What this script does:
 *   1. Adds Phase 29 columns to insurance_policies (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
 *   2. Creates index on claim_alert for fast filtering
 *   3. Adds authenticated_write RLS policy if not already present
 *   4. Prints the SQL so the user can also run it manually in Supabase SQL editor
 *   5. Verifies the columns exist by selecting one row after migration
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

// ─── Phase 29 SQL ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- Phase 29: Add APH auto-detect and claim alert columns to insurance_policies
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS aph_computed              numeric(10,2),
  ADD COLUMN IF NOT EXISTS aph_clu_count             integer,
  ADD COLUMN IF NOT EXISTS actual_synced_from_grain  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_alert               text NOT NULL DEFAULT 'none';

-- Index for fast alert filtering on the insurance module page
CREATE INDEX IF NOT EXISTS insurance_policies_claim_alert_idx
  ON insurance_policies(claim_alert);

-- RLS: add authenticated_write policy if not present
-- (authenticated_read was set in Phase 27; this adds write access for yield sync + APH update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_policies'
      AND policyname = 'authenticated_write'
  ) THEN
    CREATE POLICY "authenticated_write" ON insurance_policies
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;
`

// ─── Migration ────────────────────────────────────────────────────────────────

async function runMigration() {
  console.log('Phase 29 Schema Migration')
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
      console.log('  (This may be OK if columns already exist.)')
    } else {
      console.log('  Migration SQL executed successfully.')
    }
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verifyColumns() {
  console.log('\nVerifying Phase 29 columns...')

  const { data, error } = await supabase
    .from('insurance_policies')
    .select('id, aph_computed, aph_clu_count, actual_synced_from_grain, claim_alert')
    .limit(1)

  if (error) {
    // Check if the error is column-not-found vs connection error
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.error('  COLUMN MISSING:', error.message)
      console.error('')
      console.error('  Run the SQL above in Supabase SQL editor to add the Phase 29 columns.')
      process.exit(1)
    } else {
      console.error('  ERROR querying insurance_policies:', error.message)
      console.error('  (The table may not exist yet — run migrate-fsa.ts first.)')
      process.exit(1)
    }
  }

  console.log('  Phase 29 columns verified:')
  console.log('    aph_computed              — OK')
  console.log('    aph_clu_count             — OK')
  console.log('    actual_synced_from_grain  — OK')
  console.log('    claim_alert               — OK')

  if (data && data.length > 0) {
    const row = data[0] as Record<string, unknown>
    console.log('')
    console.log('  Sample row values:')
    console.log(`    aph_computed:             ${row.aph_computed ?? 'null'}`)
    console.log(`    aph_clu_count:            ${row.aph_clu_count ?? 'null'}`)
    console.log(`    actual_synced_from_grain: ${row.actual_synced_from_grain}`)
    console.log(`    claim_alert:              ${row.claim_alert}`)
  } else {
    console.log('  (No rows in insurance_policies — run migrate-fsa.ts to populate data.)')
  }

  console.log('\nPhase 29 migration complete.')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await runMigration()
  await verifyColumns()
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
