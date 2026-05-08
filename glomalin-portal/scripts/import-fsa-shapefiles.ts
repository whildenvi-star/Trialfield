/**
 * One-time import script: loads all Rock County FSA CLU shapefiles from
 * fsa-acres/Rock ShapeFiles/ into the Supabase clu_boundaries table.
 *
 * Each .shp file is named by farm number (e.g., 14904.shp).
 * Geometry is reprojected from NAD83 UTM Zone 16N → WGS84.
 * All original .dbf attributes are preserved verbatim in fsa_attributes.
 *
 * Run:
 *   cd glomalin-portal && npx tsx scripts/import-fsa-shapefiles.ts
 *   cd glomalin-portal && npx tsx scripts/import-fsa-shapefiles.ts --dry-run
 *   cd glomalin-portal && npx tsx scripts/import-fsa-shapefiles.ts --year 2025
 *
 * Flags:
 *   --dry-run    Parse and report without writing to Supabase
 *   --year NNNN  Crop year to stamp records with (default: 2025)
 *   --farm NNNN  Import only a specific farm number
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parseShapefileSet, type CluFeature } from '../src/lib/fsa/shapefile'

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const YEAR_FLAG = args.indexOf('--year')
const CROP_YEAR = YEAR_FLAG !== -1 ? parseInt(args[YEAR_FLAG + 1]) : 2025
const FARM_FLAG = args.indexOf('--farm')
const ONLY_FARM = FARM_FLAG !== -1 ? args[FARM_FLAG + 1] : null

// ── Env ──────────────────────────────────────────────────────────────────────

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (k && !(k in process.env)) process.env[k] = v
  }
}

loadEnv(path.resolve(__dirname, '../.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

// ── Shapefile directory ───────────────────────────────────────────────────────

const SHP_DIR = path.resolve(__dirname, '../../fsa-acres/Rock ShapeFiles')

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`FSA Shapefile Import`)
  console.log(`  Crop year : ${CROP_YEAR}`)
  console.log(`  Dry run   : ${DRY_RUN}`)
  console.log(`  Farm filter: ${ONLY_FARM ?? 'all'}`)
  console.log()

  const shpFiles = fs
    .readdirSync(SHP_DIR)
    .filter((f) => f.endsWith('.shp'))
    .filter((f) => !ONLY_FARM || f.replace('.shp', '') === ONLY_FARM)
    .sort()

  if (shpFiles.length === 0) {
    console.error(`No .shp files found in ${SHP_DIR}`)
    process.exit(1)
  }

  let totalFeatures = 0
  let totalErrors = 0
  const allRows: Record<string, unknown>[] = []

  for (const shpFile of shpFiles) {
    const farmNumber = shpFile.replace('.shp', '')
    const shpPath = path.join(SHP_DIR, shpFile)
    const dbfPath = path.join(SHP_DIR, shpFile.replace('.shp', '.dbf'))

    if (!fs.existsSync(dbfPath)) {
      console.warn(`  SKIP ${farmNumber}: no matching .dbf`)
      continue
    }

    const shpBuf = fs.readFileSync(shpPath).buffer as ArrayBuffer
    const dbfBuf = fs.readFileSync(dbfPath).buffer as ArrayBuffer

    process.stdout.write(`  Farm ${farmNumber} ... `)
    const result = await parseShapefileSet(shpBuf, dbfBuf, farmNumber)

    console.log(
      `${result.features.length} CLUs` +
      (result.errors.length ? ` (${result.errors.length} errors)` : '')
    )

    for (const err of result.errors) {
      console.warn(`    ⚠ ${err}`)
    }

    totalFeatures += result.features.length
    totalErrors += result.errors.length

    for (const feat of result.features) {
      allRows.push(featureToRow(feat, CROP_YEAR, shpFile))
    }
  }

  console.log()
  console.log(`Total: ${totalFeatures} CLUs, ${totalErrors} parse errors`)

  if (DRY_RUN) {
    console.log()
    console.log('Dry run — no writes. First 3 rows:')
    for (const row of allRows.slice(0, 3)) {
      const r = row as Record<string, unknown>
      console.log(`  Farm ${r.farm_number} Tract ${r.tract_number} CLU ${r.clu_label} — ${r.fsa_acres ?? r.fsa_attributes} ac`)
    }
    return
  }

  // Write in batches of 100 (PostGIS geometry insertion can be slow in bulk)
  console.log()
  console.log('Writing to Supabase clu_boundaries...')
  const BATCH = 100
  let written = 0

  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH)
    const { error } = await supabase!
      .from('clu_boundaries')
      .upsert(batch as never[], {
        onConflict: 'farm_number,tract_number,clu_label,crop_year',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`  Batch ${i / BATCH + 1} error:`, error.message)
    } else {
      written += batch.length
      process.stdout.write(`\r  Written: ${written}/${allRows.length}`)
    }
  }

  console.log()
  console.log()
  console.log(`Done. ${written} rows inserted/updated in clu_boundaries.`)
}

function featureToRow(
  feat: CluFeature,
  cropYear: number,
  sourceFile: string
): Record<string, unknown> {
  // Supabase expects geometry as WKT or GeoJSON string for PostGIS columns.
  // Use ST_GeomFromGeoJSON via the geometry literal syntax.
  const geomGeoJson = JSON.stringify(feat.geometry)

  return {
    crop_year: cropYear,
    farm_number: feat.farmNumber,
    tract_number: feat.tractNumber,
    clu_label: feat.cluLabel,
    // Pass geometry as a GeoJSON string — Supabase/PostGIS accepts this
    // via the geometry column type with implicit ST_GeomFromGeoJSON cast.
    geometry: geomGeoJson,
    // Use CALCACRES as the authoritative acreage (FSA_ACRES is often 0)
    fsa_acres: feat.calcAcres || feat.fsaAcres || null,
    fsa_attributes: feat.fsaAttributes,
    source_file: sourceFile,
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
