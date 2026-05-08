/**
 * Import Rock County FSA CLU shapefiles → Supabase clu_boundaries table.
 *
 * Plain CommonJS so it runs with `node scripts/import-fsa-shapefiles.js`
 * without tsx, Babel, or any transpiler.
 *
 * Usage:
 *   node scripts/import-fsa-shapefiles.js
 *   node scripts/import-fsa-shapefiles.js --dry-run
 *   node scripts/import-fsa-shapefiles.js --year 2026
 *   node scripts/import-fsa-shapefiles.js --farm 14904
 */

'use strict'

const fs = require('fs')
const path = require('path')
const shapefile = require('shapefile')
const { createClient } = require('@supabase/supabase-js')

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const YEAR_IDX = args.indexOf('--year')
const CROP_YEAR = YEAR_IDX !== -1 ? parseInt(args[YEAR_IDX + 1]) : 2025
const FARM_IDX = args.indexOf('--farm')
const ONLY_FARM = FARM_IDX !== -1 ? args[FARM_IDX + 1] : null

// ── Env ──────────────────────────────────────────────────────────────────────

function loadEnv(file) {
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
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null

// ── Reprojection: NAD83 UTM Zone 16N → WGS84 ────────────────────────────────
// proj4 is an ESM-only package in newer versions. Use the formula directly.
// UTM to geographic (WGS84 ≈ NAD83 for our precision needs).

const DEG = Math.PI / 180
const a = 6378137.0          // WGS84 semi-major axis
const f = 1 / 298.257222101  // GRS80 flattening (same as WGS84 for this precision)
const b = a * (1 - f)
const e2 = 1 - (b * b) / (a * a)
const e = Math.sqrt(e2)
const k0 = 0.9996
const E0 = 500000
const N0 = 0
const lon0 = -87 * DEG  // Zone 16N central meridian

function utmToWgs84(easting, northing) {
  const x = easting - E0
  const y = northing - N0

  const M = y / k0
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256))

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
    + (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu)

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1))
  const T1 = Math.tan(phi1) * Math.tan(phi1)
  const C1 = e2 / (1 - e2) * Math.cos(phi1) * Math.cos(phi1)
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5)
  const D = x / (N1 * k0)

  const lat = phi1
    - (N1 * Math.tan(phi1) / R1)
    * (D * D / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2 / (1 - e2)) * D * D * D * D / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 / (1 - e2) - 3 * C1 * C1) * D * D * D * D * D * D / 720)

  const lon = lon0 + (D
    - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 / (1 - e2) + 24 * T1 * T1) * D * D * D * D * D / 120)
    / Math.cos(phi1)

  return [lon / DEG, lat / DEG]  // [lng, lat] GeoJSON order
}

function reprojectRing(ring) {
  return ring.map(([x, y]) => utmToWgs84(x, y))
}

function reprojectGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map(reprojectRing) }
  }
  if (geom.type === 'MultiPolygon') {
    // Take the largest exterior ring as a single Polygon
    const largest = geom.coordinates.reduce((a, b) =>
      a[0].length >= b[0].length ? a : b
    )
    return { type: 'Polygon', coordinates: largest.map(reprojectRing) }
  }
  throw new Error(`Unsupported geometry: ${geom.type}`)
}

// ── Parse one shapefile set ──────────────────────────────────────────────────

async function parseOne(farmNumber, shpPath, dbfPath) {
  const features = []
  const errors = []
  const source = await shapefile.open(shpPath, dbfPath, { encoding: 'UTF-8' })

  while (true) {
    const result = await source.read()
    if (result.done) break

    const feat = result.value
    if (!feat || !feat.geometry) { errors.push('null geometry'); continue }

    let geometry
    try {
      geometry = reprojectGeometry(feat.geometry)
    } catch (e) {
      errors.push(`CLU ${feat.properties?.CLUNBR}: ${e.message}`)
      continue
    }

    const p = feat.properties
    features.push({
      farmNumber,
      tractNumber: String(p.TRACTNBR ?? ''),
      cluLabel: String(p.CLUNBR ?? ''),
      calcAcres: Number(p.CALCACRES ?? 0),
      fsaAcres: Number(p.FSA_ACRES ?? 0),
      geometry,
      fsaAttributes: p,
    })
  }

  return { features, errors }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const SHP_DIR = path.resolve(__dirname, '../../fsa-acres/Rock ShapeFiles')
  console.log('FSA Shapefile Import')
  console.log(`  Source    : ${SHP_DIR}`)
  console.log(`  Crop year : ${CROP_YEAR}`)
  console.log(`  Dry run   : ${DRY_RUN}`)
  if (ONLY_FARM) console.log(`  Farm filter: ${ONLY_FARM}`)
  console.log()

  const shpFiles = fs.readdirSync(SHP_DIR)
    .filter(f => f.endsWith('.shp'))
    .filter(f => !ONLY_FARM || f.replace('.shp', '') === ONLY_FARM)
    .sort()

  const allRows = []
  let totalErrors = 0

  for (const shpFile of shpFiles) {
    const farmNumber = shpFile.replace('.shp', '')
    const shpPath = path.join(SHP_DIR, shpFile)
    const dbfPath = path.join(SHP_DIR, shpFile.replace('.shp', '.dbf'))

    if (!fs.existsSync(dbfPath)) {
      console.log(`  SKIP ${farmNumber}: no .dbf`)
      continue
    }

    process.stdout.write(`  Farm ${farmNumber} ... `)
    const { features, errors } = await parseOne(farmNumber, shpPath, dbfPath)

    console.log(
      `${features.length} CLUs` + (errors.length ? ` (${errors.length} errs)` : '')
    )
    for (const e of errors) console.warn(`    ⚠ ${e}`)

    totalErrors += errors.length

    for (const feat of features) {
      allRows.push({
        crop_year: CROP_YEAR,
        farm_number: feat.farmNumber,
        tract_number: feat.tractNumber,
        clu_label: feat.cluLabel,
        // Pass GeoJSON string — PostGIS accepts it via implicit cast on geometry columns
        geometry: JSON.stringify(feat.geometry),
        fsa_acres: feat.calcAcres || feat.fsaAcres || null,
        fsa_attributes: feat.fsaAttributes,
        source_file: shpFile,
      })
    }
  }

  console.log()
  console.log(`Parsed: ${allRows.length} CLUs, ${totalErrors} parse errors`)

  if (DRY_RUN) {
    console.log()
    console.log('Dry run — sample (first 3 rows):')
    for (const row of allRows.slice(0, 3)) {
      const coords = JSON.parse(row.geometry).coordinates[0][0]
      console.log(`  Farm ${row.farm_number} Tract ${row.tract_number} CLU ${row.clu_label} — ${row.fsa_acres} ac  [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}]`)
    }
    return
  }

  // Upsert in batches of 50
  console.log()
  console.log('Writing to Supabase...')
  const BATCH = 50
  let written = 0

  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('clu_boundaries')
      .upsert(batch, { onConflict: 'farm_number,tract_number,clu_label,crop_year' })

    if (error) {
      console.error(`\n  Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
    } else {
      written += batch.length
      process.stdout.write(`\r  Written: ${written}/${allRows.length}   `)
    }
  }

  console.log()
  console.log()
  console.log(`Done. ${written} rows upserted into clu_boundaries (crop_year=${CROP_YEAR}).`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
