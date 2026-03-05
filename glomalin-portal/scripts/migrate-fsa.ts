/**
 * scripts/migrate-fsa.ts
 *
 * Repeatable migration script: upserts FSA data from fsa-acres/data/data.json into Supabase.
 * Handles schema creation (CREATE TABLE IF NOT EXISTS) and data upsert via legacy_id.
 *
 * Run: cd glomalin-portal && npx tsx scripts/migrate-fsa.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Tables migrated:
 *   clu_records       — 444 CLU parcel records
 *   insurance_pricing — 22 pricing rows (spring + fall prices per crop/year)
 *   insurance_policies — 3 insurance policies (policy fields only)
 *   claims            — 3 claims rows (one per policy, FK to insurance_policies)
 *   gcs_enrollments   — 149 GCS enrollment rows
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

// Load source data from fsa-acres sibling app
const dataPath = path.resolve(__dirname, '../../fsa-acres/data/data.json')
if (!fs.existsSync(dataPath)) {
  console.error(`ERROR: Source data not found at ${dataPath}`)
  process.exit(1)
}

const store = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as {
  settings: { year: number; county: string; state: string }
  cluRecords: Record<string, unknown>[]
  pricing: Record<string, unknown>[]
  insurancePolicies: Record<string, unknown>[]
  gcsEnrollments: Record<string, unknown>[]
}

// ─── Schema Creation ────────────────────────────────────────────────────────

async function createSchema() {
  console.log('\nCreating tables (IF NOT EXISTS)...')

  const sql = `
    -- clu_records: FSA CLU parcel records
    CREATE TABLE IF NOT EXISTS clu_records (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id       text UNIQUE NOT NULL,
      crop_year       integer NOT NULL DEFAULT 2026,
      farm_number     text NOT NULL,
      tract_number    text NOT NULL,
      clu             text NOT NULL,
      field_name      text,
      farm_name       text,
      fsa_acres       numeric(10,2) NOT NULL DEFAULT 0,
      crop            text,
      irrigated       boolean NOT NULL DEFAULT false,
      organic         boolean NOT NULL DEFAULT false,
      double_crop     boolean NOT NULL DEFAULT false,
      cover_crop      boolean NOT NULL DEFAULT false,
      grain_plant_date text,
      use             text,
      reported        boolean NOT NULL DEFAULT false,
      tillage_2024    text,
      tillage_2025    text,
      cc_2024         text,
      cc_2025         text,
      nt_adoption_2024 text,
      nt_adoption_2025 text,
      cc_adoption_2024 text,
      cc_adoption_2025 text,
      unit_number     text,
      aph             numeric(10,2),
      line_number     text,
      policy_number   text,
      created_at      timestamptz DEFAULT now(),
      updated_at      timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS clu_records_crop_year_idx ON clu_records(crop_year);
    CREATE INDEX IF NOT EXISTS clu_records_farm_number_idx ON clu_records(farm_number);

    -- insurance_pricing: Spring + fall prices per crop per year
    CREATE TABLE IF NOT EXISTS insurance_pricing (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id       text UNIQUE NOT NULL,
      crop            text NOT NULL,
      year            integer NOT NULL DEFAULT 2026,
      spring_price    numeric(10,4) NOT NULL DEFAULT 0,
      fall_price      numeric(10,4) NOT NULL DEFAULT 0,
      manual_override boolean NOT NULL DEFAULT false,
      created_at      timestamptz DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS insurance_pricing_crop_year_idx ON insurance_pricing(crop, year);

    -- insurance_policies: Policy-level fields only (claims split out)
    CREATE TABLE IF NOT EXISTS insurance_policies (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id             text UNIQUE NOT NULL,
      farm_name             text,
      farm_number           text,
      line_number           text,
      policy_number         text,
      crop                  text,
      policy_year           integer NOT NULL DEFAULT 2026,
      planted_acres         numeric(10,2) NOT NULL DEFAULT 0,
      fsa_acres_manual      numeric(10,2),
      guarantee             numeric(10,2) NOT NULL DEFAULT 0,
      actual                numeric(10,2) NOT NULL DEFAULT 0,
      coverage_level        integer NOT NULL DEFAULT 75,
      unit_type             text,
      premium_per_acre      numeric(10,4),
      agent_name            text,
      prevented_planting    boolean NOT NULL DEFAULT false,
      prevented_planting_acres numeric(10,2),
      notes                 text,
      created_at            timestamptz DEFAULT now(),
      updated_at            timestamptz DEFAULT now()
    );

    -- claims: Claim data split from insurance_policies, FK to insurance_policies
    CREATE TABLE IF NOT EXISTS claims (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id           uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
      claim_status        text NOT NULL DEFAULT 'none',
      claim_number        text,
      loss_type           text,
      adjuster_name       text,
      adjuster_phone      text,
      claim_filed_date    date,
      claim_paid_date     date,
      claim_paid_amount   numeric(10,2),
      created_at          timestamptz DEFAULT now(),
      updated_at          timestamptz DEFAULT now()
    );

    -- gcs_enrollments: GCS conservation program enrollments
    CREATE TABLE IF NOT EXISTS gcs_enrollments (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id       text UNIQUE NOT NULL,
      farm_number     text NOT NULL,
      tract_number    text NOT NULL,
      field_id        text NOT NULL,
      commodity       text,
      cc340_acres     numeric(10,2) NOT NULL DEFAULT 0,
      rt345_acres     numeric(10,2) NOT NULL DEFAULT 0,
      nt329_acres     numeric(10,2) NOT NULL DEFAULT 0,
      default_yield   numeric(10,2),
      irrigation      text,
      tillage         text,
      state           text NOT NULL DEFAULT 'WI',
      county          text NOT NULL DEFAULT 'Rock',
      created_at      timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS gcs_enrollments_farm_tract_idx ON gcs_enrollments(farm_number, tract_number);
  `

  // Execute schema via rpc or raw SQL
  // Supabase JS client doesn't expose raw SQL directly — use the REST API via fetch
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    // exec_sql RPC may not exist — try individual table checks instead
    console.log('  exec_sql RPC not available, will proceed with upserts (tables must exist in Supabase)')
    console.log('  If tables do not exist, run the SQL from the RESEARCH.md manually in Supabase SQL editor.')
    console.log('  Continuing with data migration...')
    return
  }

  const result = await response.json()
  if (result.error) {
    console.log('  Schema SQL warning (may be OK if tables already exist):', result.error)
  } else {
    console.log('  Tables created/verified.')
  }
}

// ─── RLS Policy Setup ────────────────────────────────────────────────────────

async function enableRLS() {
  // RLS and policies must be enabled in the Supabase dashboard or via SQL editor
  // The supabase-js client cannot toggle RLS directly
  // This function logs instructions if RLS setup is needed
  console.log('\nRLS NOTE: Ensure the following is executed in Supabase SQL editor if not already done:')
  console.log('  ALTER TABLE clu_records ENABLE ROW LEVEL SECURITY;')
  console.log('  ALTER TABLE insurance_pricing ENABLE ROW LEVEL SECURITY;')
  console.log('  ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;')
  console.log('  ALTER TABLE claims ENABLE ROW LEVEL SECURITY;')
  console.log('  ALTER TABLE gcs_enrollments ENABLE ROW LEVEL SECURITY;')
  console.log('  CREATE POLICY "authenticated_read" ON clu_records FOR SELECT USING (auth.role() = \'authenticated\');')
  console.log('  CREATE POLICY "authenticated_read" ON insurance_pricing FOR SELECT USING (auth.role() = \'authenticated\');')
  console.log('  CREATE POLICY "authenticated_read" ON insurance_policies FOR SELECT USING (auth.role() = \'authenticated\');')
  console.log('  CREATE POLICY "authenticated_read" ON claims FOR SELECT USING (auth.role() = \'authenticated\');')
  console.log('  CREATE POLICY "authenticated_read" ON gcs_enrollments FOR SELECT USING (auth.role() = \'authenticated\');')
}

// ─── Data Migration Functions ─────────────────────────────────────────────────

async function migrateCluRecords() {
  const cropYear = store.settings?.year ?? 2026
  const rows = store.cluRecords.map((r: Record<string, unknown>) => ({
    legacy_id: r.id as string,
    crop_year: cropYear,
    farm_number: String(r.farmNumber ?? ''),
    tract_number: String(r.tractNumber ?? ''),
    clu: String(r.clu ?? ''),
    field_name: (r.fieldName as string) || null,
    farm_name: (r.farmName as string) || null,
    fsa_acres: (r.fsaAcres as number) ?? 0,
    crop: (r.crop as string) || null,
    irrigated: Boolean(r.irrigated),
    organic: Boolean(r.organic),
    double_crop: Boolean(r.doubleCrop),
    cover_crop: Boolean(r.coverCrop),
    grain_plant_date: (r.grainPlantDate as string) || null,
    use: (r.use as string) || null,
    reported: Boolean(r.reported),
    tillage_2024: (r.tillage2024 as string) || null,
    tillage_2025: (r.tillage2025 as string) || null,
    cc_2024: (r.cc2024 as string) || null,
    cc_2025: (r.cc2025 as string) || null,
    nt_adoption_2024: (r.ntAdoption2024 as string) || null,
    nt_adoption_2025: (r.ntAdoption2025 as string) || null,
    cc_adoption_2024: (r.ccAdoption2024 as string) || null,
    cc_adoption_2025: (r.ccAdoption2025 as string) || null,
    unit_number: (r.unitNumber as string) || null,
    aph: (r.aph as number) > 0 ? (r.aph as number) : null,
    line_number: (r.lineNumber as string) || null,
    policy_number: (r.policyNumber as string) || null,
  }))

  // Batch upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('clu_records')
      .upsert(chunk, { onConflict: 'legacy_id' })
    if (error) throw new Error(`CLU records upsert failed: ${error.message}`)
  }

  console.log(`  Upserted ${rows.length} CLU records`)
  return rows.length
}

async function migratePricing() {
  const rows = store.pricing.map((r: Record<string, unknown>) => ({
    legacy_id: r.id as string,
    crop: String(r.crop ?? ''),
    year: (r.year as number) ?? store.settings?.year ?? 2026,
    spring_price: (r.springPrice as number) ?? 0,
    fall_price: (r.fallPrice as number) ?? 0,
    manual_override: Boolean(r.manualOverride),
  }))

  const { error } = await supabase
    .from('insurance_pricing')
    .upsert(rows, { onConflict: 'legacy_id' })
  if (error) throw new Error(`Pricing upsert failed: ${error.message}`)

  console.log(`  Upserted ${rows.length} pricing rows`)
  return rows.length
}

async function migrateInsurancePoliciesAndClaims() {
  const policyRows = store.insurancePolicies.map((r: Record<string, unknown>) => {
    const legacyId = r.id as string
    const isIns482 = legacyId === 'ins_482'

    return {
      legacy_id: legacyId,
      farm_name: (r.farmName as string) || null,
      farm_number: (r.farmNumber as string) || null,
      line_number: (r.lineNumber as string) || null,
      policy_number: (r.policyNumber as string) || null,
      crop: (r.crop as string) || null,
      policy_year: (r.policyYear as number) ?? store.settings?.year ?? 2026,
      planted_acres: (r.plantedAcres as number) ?? 0,
      fsa_acres_manual: (r.fsaAcresManual as number) > 0 ? (r.fsaAcresManual as number) : null,
      guarantee: (r.guarantee as number) ?? 0,
      actual: (r.actual as number) ?? 0,
      coverage_level: (r.coverageLevel as number) ?? 75,
      unit_type: (r.unitType as string) || null,
      premium_per_acre: (r.premiumPerAcre as number) > 0 ? (r.premiumPerAcre as number) : null,
      agent_name: (r.agentName as string) || null,
      prevented_planting: Boolean(r.preventedPlanting),
      prevented_planting_acres: (r.preventedPlantingAcres as number) > 0 ? (r.preventedPlantingAcres as number) : null,
      notes: isIns482
        ? 'VERIFY — data may be corrupt (no farm/crop, actual=40000)'
        : ((r.notes as string) || null),
    }
  })

  const { error: policyError } = await supabase
    .from('insurance_policies')
    .upsert(policyRows, { onConflict: 'legacy_id' })
  if (policyError) throw new Error(`Insurance policies upsert failed: ${policyError.message}`)

  console.log(`  Upserted ${policyRows.length} insurance policies`)

  // Query back inserted policies to get UUIDs for claims FK
  const { data: insertedPolicies, error: fetchError } = await supabase
    .from('insurance_policies')
    .select('id, legacy_id')
    .in('legacy_id', policyRows.map((p) => p.legacy_id))
  if (fetchError) throw new Error(`Failed to fetch policy UUIDs: ${fetchError.message}`)

  const policyIdMap: Record<string, string> = {}
  for (const p of insertedPolicies ?? []) {
    policyIdMap[p.legacy_id] = p.id
  }

  // Build claims rows — one per policy (insert even if claim_status is 'none' for FK chain completeness)
  const claimRows = store.insurancePolicies
    .map((r: Record<string, unknown>) => {
      const legacyId = r.id as string
      const policyId = policyIdMap[legacyId]
      if (!policyId) {
        console.warn(`  WARNING: Could not find UUID for policy ${legacyId} — skipping claim row`)
        return null
      }

      // Convert empty date strings to null (PostgreSQL date columns don't accept '')
      const parseDate = (val: unknown): string | null => {
        const s = String(val || '')
        return s && s !== '' ? s : null
      }

      return {
        policy_id: policyId,
        claim_status: (r.claimStatus as string) || 'none',
        claim_number: (r.claimNumber as string) || null,
        loss_type: (r.lossType as string) || null,
        adjuster_name: (r.adjusterName as string) || null,
        adjuster_phone: (r.adjusterPhone as string) || null,
        claim_filed_date: parseDate(r.claimFiledDate),
        claim_paid_date: parseDate(r.claimPaidDate),
        claim_paid_amount: (r.claimPaidAmount as number) > 0 ? (r.claimPaidAmount as number) : null,
      }
    })
    .filter(Boolean) as Record<string, unknown>[]

  // Claims don't have a legacy_id — use policy_id as uniqueness anchor
  // On re-run, delete existing claims for these policies first, then insert fresh
  const policyIds = Object.values(policyIdMap)
  if (policyIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('claims')
      .delete()
      .in('policy_id', policyIds)
    if (deleteError) throw new Error(`Failed to clear existing claims: ${deleteError.message}`)
  }

  if (claimRows.length > 0) {
    const { error: claimError } = await supabase.from('claims').insert(claimRows)
    if (claimError) throw new Error(`Claims insert failed: ${claimError.message}`)
  }

  console.log(`  Inserted ${claimRows.length} claims rows`)
  return { policies: policyRows.length, claims: claimRows.length }
}

async function migrateGcsEnrollments() {
  const rows = store.gcsEnrollments.map((r: Record<string, unknown>) => ({
    legacy_id: r.id as string,
    farm_number: String(r.farmNumber ?? ''),
    tract_number: String(r.tractNumber ?? ''),
    field_id: String(r.fieldId ?? ''),
    commodity: (r.commodity as string) || null,
    cc340_acres: (r.cc340Acres as number) ?? 0,
    rt345_acres: (r.rt345Acres as number) ?? 0,
    nt329_acres: (r.nt329Acres as number) ?? 0,
    default_yield: (r.defaultYield as number) > 0 ? (r.defaultYield as number) : null,
    irrigation: (r.irrigation as string) || null,
    tillage: (r.tillage as string) || null,
    state: (r.state as string) || 'WI',
    county: (r.county as string) || 'Rock',
  }))

  // Batch upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('gcs_enrollments')
      .upsert(chunk, { onConflict: 'legacy_id' })
    if (error) throw new Error(`GCS enrollments upsert failed: ${error.message}`)
  }

  console.log(`  Upserted ${rows.length} GCS enrollments`)
  return rows.length
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verifyMigration() {
  console.log('\nVerifying migration...')

  const tables = ['clu_records', 'insurance_pricing', 'insurance_policies', 'claims', 'gcs_enrollments']
  const expected = { clu_records: 444, insurance_pricing: 22, insurance_policies: 3, claims: 3, gcs_enrollments: 149 }

  const counts: Record<string, number> = {}
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.error(`  ERROR querying ${table}: ${error.message}`)
      counts[table] = -1
    } else {
      counts[table] = count ?? 0
    }
  }

  // Total FSA acres
  const { data: acreData, error: acreError } = await supabase
    .from('clu_records')
    .select('fsa_acres')
    .eq('crop_year', store.settings?.year ?? 2026)

  const totalAcres = acreError
    ? 'ERROR'
    : (acreData ?? []).reduce((s: number, r: { fsa_acres: number }) => s + (r.fsa_acres || 0), 0).toFixed(2)

  console.log('\nMigration complete:')
  console.log(`  clu_records:        ${counts.clu_records} (expected: ${expected.clu_records})`)
  console.log(`  insurance_pricing:  ${counts.insurance_pricing} (expected: ${expected.insurance_pricing})`)
  console.log(`  insurance_policies: ${counts.insurance_policies} (expected: ${expected.insurance_policies})`)
  console.log(`  claims:             ${counts.claims} (expected: ${expected.claims})`)
  console.log(`  gcs_enrollments:    ${counts.gcs_enrollments} (expected: ${expected.gcs_enrollments})`)
  console.log(`  Total FSA acres:    ${totalAcres} (source total: 5977.24)`)

  const allMatch = Object.entries(expected).every(
    ([table, exp]) => counts[table] === exp
  )

  if (!allMatch) {
    console.warn('\nWARNING: Some counts do not match expected values. Review output above.')
  } else {
    console.log('\nAll counts verified.')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('FSA Data Migration Script')
  console.log('='.repeat(50))
  console.log(`Source: ${dataPath}`)
  console.log(`Target: ${SUPABASE_URL}`)
  console.log('')
  console.log('Source data:')
  console.log(`  cluRecords:        ${store.cluRecords.length}`)
  console.log(`  pricing:           ${store.pricing.length}`)
  console.log(`  insurancePolicies: ${store.insurancePolicies.length}`)
  console.log(`  gcsEnrollments:    ${store.gcsEnrollments.length}`)
  const sourceTotalAcres = store.cluRecords.reduce(
    (s: number, r: Record<string, unknown>) => s + ((r.fsaAcres as number) || 0),
    0
  )
  console.log(`  Total FSA acres:   ${sourceTotalAcres.toFixed(2)}`)
  console.log('')

  await createSchema()
  await enableRLS()

  console.log('\nMigrating data...')
  await migrateCluRecords()
  await migratePricing()
  await migrateInsurancePoliciesAndClaims()
  await migrateGcsEnrollments()

  await verifyMigration()
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
