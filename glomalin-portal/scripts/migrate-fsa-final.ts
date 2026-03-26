/**
 * scripts/migrate-fsa-final.ts
 *
 * Definitive one-time FSA data consolidation migration.
 * Reads fsa-acres/data/data.json and upserts into Supabase with:
 *   - Duplicate detection (pre-flight check before any writes)
 *   - Batch upserts in chunks of 500
 *   - Verification: row counts + spot-check of 10-20 random records
 *   - Renames data.json → data.json.migrated after successful migration
 *
 * GCS enrollments are intentionally SKIPPED — program discontinued.
 *
 * Run:
 *   cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts
 *   cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts --dry-run
 *   cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts --force
 *
 * Flags:
 *   --dry-run  Show what would be migrated without writing to Supabase
 *   --force    Skip interactive duplicate confirmation prompt
 *
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ─── CLI Flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')

// ─── Env Loading ─────────────────────────────────────────────────────────────

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

// Load .env.local from the glomalin-portal directory
loadEnvFile(path.resolve(__dirname, '../.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('ERROR: Missing required environment variables.')
  console.error('  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL):', SUPABASE_URL ? 'set' : 'MISSING')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING')
  console.error('')
  console.error('Create glomalin-portal/.env.local with:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  process.exit(1)
}

// Dry-run: allow missing env vars (no actual writes)
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// ─── Source Data ─────────────────────────────────────────────────────────────

const dataPath = path.resolve(__dirname, '../../fsa-acres/data/data.json')
const migratedPath = dataPath + '.migrated'

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface CluRow {
  legacy_id: string
  crop_year: number
  farm_number: string
  tract_number: string
  clu: string
  field_name: string | null
  farm_name: string | null
  fsa_acres: number
  crop: string | null
  irrigated: boolean
  organic: boolean
  double_crop: boolean
  cover_crop: boolean
  grain_plant_date: string | null
  use: string | null
  reported: boolean
  tillage_2024: string | null
  tillage_2025: string | null
  cc_2024: string | null
  cc_2025: string | null
  nt_adoption_2024: string | null
  nt_adoption_2025: string | null
  cc_adoption_2024: string | null
  cc_adoption_2025: string | null
  unit_number: string | null
  aph: number | null
  line_number: string | null
  policy_number: string | null
  registry_field_id: string | null
}

interface PricingRow {
  legacy_id: string
  crop: string
  year: number
  spring_price: number
  fall_price: number
  manual_override: boolean
}

interface PolicyRow {
  legacy_id: string
  farm_name: string | null
  farm_number: string | null
  line_number: string | null
  policy_number: string | null
  crop: string | null
  policy_year: number
  planted_acres: number
  fsa_acres_manual: number | null
  guarantee: number
  actual: number
  coverage_level: number
  unit_type: string | null
  premium_per_acre: number | null
  agent_name: string | null
  prevented_planting: boolean
  prevented_planting_acres: number | null
  notes: string | null
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

interface DuplicateReport {
  cluDuplicates: Array<{ key: string; ids: string[] }>
  policyDuplicates: Array<{ key: string; ids: string[] }>
  pricingDuplicates: Array<{ key: string; ids: string[] }>
}

function detectDuplicates(): DuplicateReport {
  // CLU: composite key = farmNumber + tractNumber + clu + crop
  const cluSeen = new Map<string, string[]>()
  for (const r of store.cluRecords) {
    const key = [r.farmNumber, r.tractNumber, r.clu, r.crop].join('|')
    if (!cluSeen.has(key)) cluSeen.set(key, [])
    cluSeen.get(key)!.push(r.id as string)
  }
  const cluDuplicates = Array.from(cluSeen.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))

  // Policy: composite key = policyNumber + farmNumber + crop
  const policySeen = new Map<string, string[]>()
  for (const r of store.insurancePolicies) {
    const key = [r.policyNumber, r.farmNumber, r.crop].join('|')
    if (!policySeen.has(key)) policySeen.set(key, [])
    policySeen.get(key)!.push(r.id as string)
  }
  const policyDuplicates = Array.from(policySeen.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))

  // Pricing: key = crop (one price per crop, year is already unique index)
  const pricingSeen = new Map<string, string[]>()
  for (const r of store.pricing) {
    const key = String(r.crop)
    if (!pricingSeen.has(key)) pricingSeen.set(key, [])
    pricingSeen.get(key)!.push(r.id as string)
  }
  const pricingDuplicates = Array.from(pricingSeen.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))

  return { cluDuplicates, policyDuplicates, pricingDuplicates }
}

// ─── User Prompt (interactive) ───────────────────────────────────────────────

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// ─── Row Builders ─────────────────────────────────────────────────────────────

function buildCluRows(): CluRow[] {
  const cropYear = store.settings?.year ?? 2026
  return store.cluRecords.map((r) => ({
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
    registry_field_id: (r.registryFieldId as string) || null,
  }))
}

function buildPricingRows(): PricingRow[] {
  return store.pricing.map((r) => ({
    legacy_id: r.id as string,
    crop: String(r.crop ?? ''),
    year: (r.year as number) ?? store.settings?.year ?? 2026,
    spring_price: (r.springPrice as number) ?? 0,
    fall_price: (r.fallPrice as number) ?? 0,
    manual_override: Boolean(r.manualOverride),
  }))
}

function buildPolicyRows(): PolicyRow[] {
  return store.insurancePolicies.map((r) => {
    const legacyId = r.id as string
    const isCorrupt = legacyId === 'ins_482'
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
      prevented_planting_acres:
        (r.preventedPlantingAcres as number) > 0 ? (r.preventedPlantingAcres as number) : null,
      notes: isCorrupt
        ? 'VERIFY — data may be corrupt (no farm/crop, actual=40000)'
        : (r.notes as string) || null,
    }
  })
}

// ─── Migration Functions ──────────────────────────────────────────────────────

async function detectMissingColumns(rows: CluRow[]): Promise<CluRow[]> {
  // Probe with a single row to detect missing columns
  const probe = [{ ...rows[0] }]
  const { error } = await supabase!.from('clu_records').upsert(probe, { onConflict: 'legacy_id', count: 'exact' })
  if (error?.message?.includes("'registry_field_id'")) {
    console.log('  ⚠ registry_field_id column not found — stripping from migration (run migration 004 later)')
    return rows.map(({ registry_field_id, ...rest }) => rest as CluRow)
  }
  // Probe succeeded — delete the probe row and return rows as-is
  await supabase!.from('clu_records').delete().eq('legacy_id', rows[0].legacy_id)
  return rows
}

async function migrateCluRecords(rows: CluRow[]): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would upsert ${rows.length} CLU records to clu_records`)
    return
  }

  rows = await detectMissingColumns(rows)

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase!.from('clu_records').upsert(chunk, { onConflict: 'legacy_id' })
    if (error) throw new Error(`CLU records upsert failed (chunk ${i}): ${error.message}`)
    console.log(`  Upserted CLU chunk ${i + 1}–${Math.min(i + chunk.length, rows.length)} of ${rows.length}`)
  }
}

async function migratePricing(rows: PricingRow[]): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would upsert ${rows.length} pricing rows to insurance_pricing`)
    return
  }

  const { error } = await supabase!
    .from('insurance_pricing')
    .upsert(rows, { onConflict: 'legacy_id' })
  if (error) throw new Error(`Pricing upsert failed: ${error.message}`)
  console.log(`  Upserted ${rows.length} pricing rows`)
}

async function migrateInsurancePolicies(rows: PolicyRow[]): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would upsert ${rows.length} insurance policies to insurance_policies`)
    console.log('  [DRY-RUN] Claims skipped (Phase 31 schema incompatibility)')
    return
  }

  const { error } = await supabase!
    .from('insurance_policies')
    .upsert(rows, { onConflict: 'legacy_id' })
  if (error) throw new Error(`Insurance policies upsert failed: ${error.message}`)
  console.log(`  Upserted ${rows.length} insurance policies`)
  console.log('  Claims skipped — Phase 31 claims schema is incompatible with legacy format')
}

// ─── Verification: Row Counts ─────────────────────────────────────────────────

async function verifyRowCounts(
  sourceClu: number,
  sourcePricing: number,
  sourcePolicies: number
): Promise<boolean> {
  console.log('\nVerification: Row counts...')

  const tables = ['clu_records', 'insurance_pricing', 'insurance_policies'] as const
  const counts: Record<string, number> = {}

  for (const table of tables) {
    const { count, error } = await supabase!
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
  const { data: acreData, error: acreError } = await supabase!
    .from('clu_records')
    .select('fsa_acres')
    .eq('crop_year', store.settings?.year ?? 2026)

  const totalAcres = acreError
    ? 'ERROR'
    : (acreData ?? [])
        .reduce((s: number, r: { fsa_acres: number }) => s + (r.fsa_acres || 0), 0)
        .toFixed(2)

  const sourceTotalAcres = store.cluRecords
    .reduce((s, r) => s + ((r.fsaAcres as number) || 0), 0)
    .toFixed(2)

  console.log('')
  console.log('  Source data vs Supabase:')
  console.log(`    CLU records:        Source ${sourceClu}  →  Supabase ${counts.clu_records}  ${counts.clu_records >= sourceClu ? '✓' : '✗ MISMATCH'}`)
  console.log(`    Insurance pricing:  Source ${sourcePricing}  →  Supabase ${counts.insurance_pricing}  ${counts.insurance_pricing >= sourcePricing ? '✓' : '✗ MISMATCH'}`)
  console.log(`    Insurance policies: Source ${sourcePolicies}  →  Supabase ${counts.insurance_policies}  ${counts.insurance_policies >= sourcePolicies ? '✓' : '✗ MISMATCH'}`)
  console.log(`    GCS enrollments:    Source ${store.gcsEnrollments.length}  →  Supabase (skipped — program discontinued)`)
  console.log(`    Total FSA acres:    Source ${sourceTotalAcres}  →  Supabase ${totalAcres}`)

  const allPass =
    counts.clu_records >= sourceClu &&
    counts.insurance_pricing >= sourcePricing &&
    counts.insurance_policies >= sourcePolicies

  return allPass
}

// ─── Verification: Spot Check ─────────────────────────────────────────────────

async function spotCheckRecords(cluRows: CluRow[]): Promise<boolean> {
  console.log('\nVerification: Spot-checking 15 random CLU records...')

  // Pick 15 random rows deterministically (spread across dataset)
  const SPOT_COUNT = 15
  const step = Math.floor(cluRows.length / SPOT_COUNT)
  const sampleRows = Array.from({ length: SPOT_COUNT }, (_, i) => cluRows[i * step])

  const sampleIds = sampleRows.map((r) => r.legacy_id)
  const { data: dbRows, error } = await supabase!
    .from('clu_records')
    .select('legacy_id, field_name, farm_number, fsa_acres, crop')
    .in('legacy_id', sampleIds)

  if (error) {
    console.error(`  ERROR fetching spot-check records: ${error.message}`)
    return false
  }

  const dbMap = new Map((dbRows ?? []).map((r) => [r.legacy_id, r]))

  let allPass = true
  for (const src of sampleRows) {
    const db = dbMap.get(src.legacy_id)
    if (!db) {
      console.log(`  FAIL  ${src.legacy_id}: not found in Supabase`)
      allPass = false
      continue
    }

    const acresMatch = Math.abs((db.fsa_acres ?? 0) - src.fsa_acres) < 0.01
    const fieldMatch = (db.field_name ?? '') === (src.field_name ?? '')
    const farmMatch = (db.farm_number ?? '') === (src.farm_number ?? '')
    const cropMatch = (db.crop ?? '') === (src.crop ?? '')
    const pass = acresMatch && fieldMatch && farmMatch && cropMatch

    const status = pass ? 'PASS' : 'FAIL'
    if (!pass) {
      allPass = false
      console.log(`  ${status} ${src.legacy_id}: field_name=${db.field_name}/${src.field_name} farm=${db.farm_number}/${src.farm_number} acres=${db.fsa_acres}/${src.fsa_acres} crop=${db.crop}/${src.crop}`)
    } else {
      console.log(`  ${status}  ${src.legacy_id}: ${src.field_name ?? '(no field)'} farm=${src.farm_number} acres=${src.fsa_acres} crop=${src.crop ?? 'none'}`)
    }
  }

  return allPass
}

// ─── Rename Source File ───────────────────────────────────────────────────────

function renameSourceFile(): void {
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Would rename: ${dataPath} → ${migratedPath}`)
    return
  }

  if (fs.existsSync(migratedPath)) {
    console.log(`\nNOTE: ${migratedPath} already exists — not renaming (migration already ran before?)`)
    return
  }

  fs.renameSync(dataPath, migratedPath)
  console.log(`\nSource file renamed: data.json → data.json.migrated (read-only backup)`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = DRY_RUN ? ' [DRY-RUN]' : ''
  console.log(`FSA Data Migration (Final)${mode}`)
  console.log('='.repeat(50))
  console.log(`Source: ${dataPath}`)
  if (!DRY_RUN) console.log(`Target: ${SUPABASE_URL}`)
  console.log('')

  // ── Source summary ─────────────────────────────────────────────────────────
  const sourceTotalAcres = store.cluRecords
    .reduce((s, r) => s + ((r.fsaAcres as number) || 0), 0)
    .toFixed(2)

  console.log('Source data:')
  console.log(`  CLU records:        ${store.cluRecords.length}`)
  console.log(`  Insurance pricing:  ${store.pricing.length}`)
  console.log(`  Insurance policies: ${store.insurancePolicies.length}`)
  console.log(`  GCS enrollments:    ${store.gcsEnrollments.length} (will be SKIPPED — program discontinued)`)
  console.log(`  Total FSA acres:    ${sourceTotalAcres}`)
  console.log(`  Crop year:          ${store.settings?.year ?? 2026}`)
  console.log('')

  // ── Phase 1: Duplicate detection ───────────────────────────────────────────
  console.log('Phase 1: Duplicate detection...')
  const { cluDuplicates, policyDuplicates, pricingDuplicates } = detectDuplicates()

  console.log(`  Found ${cluDuplicates.length} duplicate CLU records`)
  console.log(`  Found ${policyDuplicates.length} duplicate insurance policies`)
  console.log(`  Found ${pricingDuplicates.length} duplicate pricing entries`)

  const hasDuplicates =
    cluDuplicates.length > 0 || policyDuplicates.length > 0 || pricingDuplicates.length > 0

  if (hasDuplicates) {
    console.log('')
    if (cluDuplicates.length > 0) {
      console.log('  Duplicate CLU records (farmNumber|tractNumber|clu|crop):')
      for (const d of cluDuplicates) {
        console.log(`    key="${d.key}"  ids=[${d.ids.join(', ')}]`)
      }
    }
    if (policyDuplicates.length > 0) {
      console.log('  Duplicate policies (policyNumber|farmNumber|crop):')
      for (const d of policyDuplicates) {
        console.log(`    key="${d.key}"  ids=[${d.ids.join(', ')}]`)
      }
    }
    if (pricingDuplicates.length > 0) {
      console.log('  Duplicate pricing (crop):')
      for (const d of pricingDuplicates) {
        console.log(`    key="${d.key}"  ids=[${d.ids.join(', ')}]`)
      }
    }
    console.log('')

    if (!FORCE && !DRY_RUN) {
      const answer = await promptUser(
        'Duplicates found. Upserts use legacy_id as conflict key so all records will be written. Proceed? (yes/no): '
      )
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('Migration aborted by user.')
        process.exit(0)
      }
    } else if (FORCE) {
      console.log('  --force flag set, proceeding despite duplicates')
    } else {
      console.log('  [DRY-RUN] Duplicates shown above — would proceed (upsert by legacy_id)')
    }
  } else {
    console.log('  No duplicates found.')
  }

  // ── Phase 2: Build rows ────────────────────────────────────────────────────
  console.log('\nPhase 2: Building rows...')
  const cluRows = buildCluRows()
  const pricingRows = buildPricingRows()
  const policyRows = buildPolicyRows()

  console.log(`  CLU rows built:      ${cluRows.length}`)
  console.log(`  Pricing rows built:  ${pricingRows.length}`)
  console.log(`  Policy rows built:   ${policyRows.length}`)
  console.log(`  GCS:                 0 (skipped)`)

  if (DRY_RUN) {
    console.log('\nPhase 3: Migration [DRY-RUN — no writes]')
    await migrateCluRecords(cluRows)
    await migratePricing(pricingRows)
    await migrateInsurancePolicies(policyRows)
    console.log('\nDry-run complete. No data was written to Supabase.')
    console.log(`Would rename: data.json → data.json.migrated after successful migration`)
    return
  }

  // ── Phase 3: Migrate ───────────────────────────────────────────────────────
  console.log('\nPhase 3: Migrating to Supabase...')
  await migrateCluRecords(cluRows)
  await migratePricing(pricingRows)
  await migrateInsurancePolicies(policyRows)

  // ── Phase 4: Verification ─────────────────────────────────────────────────
  console.log('\nPhase 4: Verification...')
  const countsPass = await verifyRowCounts(cluRows.length, pricingRows.length, policyRows.length)
  const spotPass = await spotCheckRecords(cluRows)

  console.log('')
  if (countsPass && spotPass) {
    console.log('MIGRATION VERIFIED: row counts match and all spot checks passed.')
    renameSourceFile()
    console.log('\nMigration complete.')
  } else {
    console.error('MIGRATION WARNING: some checks did not pass.')
    if (!countsPass) console.error('  - Row count mismatch detected (see output above)')
    if (!spotPass) console.error('  - Spot-check failures detected (see output above)')
    console.error('\ndata.json NOT renamed — investigate failures before retrying.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
