#!/usr/bin/env node
/**
 * Farm Budget - Backfill Registry Crop IDs
 *
 * Maps existing crop name strings in farm-budget data to farm-registry crop IDs
 * using case-insensitive, whitespace-normalized alias matching.
 *
 * Processes:
 *   - fields[].crop — the crop planted on each field
 *   - cropTypes[].subCrops[].name — crop variety names in the pricing/config table
 *
 * Usage:
 *   node backfill-crop-ids.js           # dry-run (shows matches, writes report, no data changes)
 *   node backfill-crop-ids.js --commit  # write registryCropId to matched records in data.json
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *
 * Output:
 *   - Console summary table (matched/unmatched/skipped counts per section)
 *   - farm-budget/backfill-crop-report.json with detailed match results
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_URL = 'http://localhost:3005/api/crops';
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const REPORT_FILE = path.join(__dirname, 'backfill-crop-report.json');
const COMMIT = process.argv.includes('--commit');

// Normalize a string for comparison: trim, collapse multiple whitespace to single space, lowercase
function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Build lookup map: normalized alias string -> [{cropId, cropName, organic}]
// Arrays to detect ambiguous matches (should be rare with well-defined aliases)
function buildLookupMap(crops) {
  const map = new Map();

  for (const crop of crops) {
    const keys = new Set();

    // Add canonical name
    keys.add(normalize(crop.name));

    // Add all aliases
    if (Array.isArray(crop.aliases)) {
      for (const alias of crop.aliases) {
        keys.add(normalize(alias));
      }
    }

    for (const key of keys) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ cropId: crop.id, cropName: crop.name, organic: crop.organic || false });
    }
  }

  return map;
}

// Match a crop name string against the lookup map
// Returns: { status, name, registryCropId?, registryCropName?, candidates? }
function matchCrop(name, lookupMap) {
  const key = normalize(name);
  if (!key) return { status: 'unmatched', name: name || '' };

  const candidates = lookupMap.get(key);
  if (!candidates || candidates.length === 0) {
    return { status: 'unmatched', name };
  }
  if (candidates.length === 1) {
    return {
      status: 'matched',
      name,
      registryCropId: candidates[0].cropId,
      registryCropName: candidates[0].cropName,
      organic: candidates[0].organic,
    };
  }
  // Multiple candidates — ambiguous
  return { status: 'ambiguous', name, candidates };
}

async function fetchRegistryCrops() {
  let res;
  try {
    res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error(`ERROR: Could not reach farm-registry at ${REGISTRY_URL}`);
    console.error(`  Make sure farm-registry is running on port 3005 (npm start in farm-registry/)`);
    console.error(`  Original error: ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`ERROR: farm-registry returned HTTP ${res.status}`);
    process.exit(1);
  }

  const body = await res.json();
  // /api/crops returns { crops: [...] } or array directly
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.crops)) return body.crops;
  console.error('ERROR: Unexpected response from farm-registry /api/crops');
  process.exit(1);
}

async function main() {
  console.log('farm-budget backfill-crop-ids.js');
  console.log(`Mode: ${COMMIT ? '--commit (WILL WRITE DATA)' : 'dry-run (no changes)'}`);
  console.log('');

  // Load data.json
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ERROR: data.json not found at ${DATA_FILE}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Fetch registry crops
  console.log(`Fetching crops from ${REGISTRY_URL}...`);
  const registryCrops = await fetchRegistryCrops();
  console.log(`  Found ${registryCrops.length} registry crops`);
  const lookupMap = buildLookupMap(registryCrops);
  console.log('');

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? 'commit' : 'dry-run',
    fields: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0, results: [] },
    subCrops: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0, results: [] },
  };

  // --- Process fields[].crop ---
  const fields = data.fields || [];
  report.fields.total = fields.length;

  for (const field of fields) {
    if (field.registryCropId) {
      report.fields.skipped++;
      report.fields.results.push({
        id: field.id,
        name: field.name,
        crop: field.crop,
        status: 'skipped',
        registryCropId: field.registryCropId,
      });
      continue;
    }

    const result = matchCrop(field.crop, lookupMap);
    result.fieldId = field.id;
    result.fieldName = field.name;
    report.fields.results.push(result);

    if (result.status === 'matched') {
      report.fields.matched++;
      if (COMMIT) field.registryCropId = result.registryCropId;
    } else if (result.status === 'unmatched') {
      report.fields.unmatched++;
    } else if (result.status === 'ambiguous') {
      report.fields.ambiguous++;
    }
  }

  // --- Process cropTypes[].subCrops[].name ---
  const cropTypes = data.cropTypes || [];
  for (const cropType of cropTypes) {
    const subCrops = cropType.subCrops || [];
    report.subCrops.total += subCrops.length;

    for (const subCrop of subCrops) {
      if (subCrop.registryCropId) {
        report.subCrops.skipped++;
        report.subCrops.results.push({
          cropTypeId: cropType.id,
          cropTypeName: cropType.name,
          name: subCrop.name,
          status: 'skipped',
          registryCropId: subCrop.registryCropId,
        });
        continue;
      }

      const result = matchCrop(subCrop.name, lookupMap);
      result.cropTypeId = cropType.id;
      result.cropTypeName = cropType.name;
      report.subCrops.results.push(result);

      if (result.status === 'matched') {
        report.subCrops.matched++;
        if (COMMIT) subCrop.registryCropId = result.registryCropId;
      } else if (result.status === 'unmatched') {
        report.subCrops.unmatched++;
      } else if (result.status === 'ambiguous') {
        report.subCrops.ambiguous++;
      }
    }
  }

  // --- Write data.json if --commit ---
  if (COMMIT) {
    const matchedCount = report.fields.matched + report.subCrops.matched;
    if (matchedCount > 0) {
      // Backup original
      const backupFile = DATA_FILE + '.bak';
      if (!fs.existsSync(backupFile)) {
        fs.copyFileSync(DATA_FILE, backupFile);
        console.log(`Backup created: ${backupFile}`);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`Wrote ${matchedCount} registry crop IDs to data.json`);
    } else {
      console.log('No new matches to write (all records already matched or unmatched)');
    }
    console.log('');
  }

  // --- Write report file ---
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // --- Print fields summary ---
  console.log('=== FIELDS SUMMARY ===');
  console.log(`  Total:     ${report.fields.total}`);
  console.log(`  Matched:   ${report.fields.matched}`);
  console.log(`  Unmatched: ${report.fields.unmatched}`);
  console.log(`  Ambiguous: ${report.fields.ambiguous}`);
  console.log(`  Skipped:   ${report.fields.skipped}  (already had registryCropId)`);

  if (report.fields.unmatched > 0) {
    const unmatched = report.fields.results.filter(r => r.status === 'unmatched');
    const uniqueNames = [...new Set(unmatched.map(r => r.name))].sort();
    console.log('\n  Unmatched crop names (unique):');
    for (const n of uniqueNames) console.log(`    - "${n}"`);
  }
  if (report.fields.ambiguous > 0) {
    const ambiguous = report.fields.results.filter(r => r.status === 'ambiguous');
    const seen = new Set();
    console.log('\n  Ambiguous crop names:');
    for (const r of ambiguous) {
      if (seen.has(r.name)) continue;
      seen.add(r.name);
      const ids = r.candidates.map(c => `${c.cropId} (${c.cropName})`).join(', ');
      console.log(`    - "${r.name}" -> candidates: ${ids}`);
    }
  }

  // --- Print subCrops summary ---
  console.log('');
  console.log('=== SUBCROPS SUMMARY ===');
  console.log(`  Total:     ${report.subCrops.total}`);
  console.log(`  Matched:   ${report.subCrops.matched}`);
  console.log(`  Unmatched: ${report.subCrops.unmatched}`);
  console.log(`  Ambiguous: ${report.subCrops.ambiguous}`);
  console.log(`  Skipped:   ${report.subCrops.skipped}  (already had registryCropId)`);

  if (report.subCrops.unmatched > 0) {
    const unmatched = report.subCrops.results.filter(r => r.status === 'unmatched');
    console.log('\n  Unmatched subCrop names:');
    for (const r of unmatched) console.log(`    - "${r.name}" (cropType: ${r.cropTypeName})`);
  }
  if (report.subCrops.ambiguous > 0) {
    const ambiguous = report.subCrops.results.filter(r => r.status === 'ambiguous');
    console.log('\n  Ambiguous subCrop names:');
    for (const r of ambiguous) {
      const ids = r.candidates.map(c => `${c.cropId} (${c.cropName})`).join(', ');
      console.log(`    - "${r.name}" -> candidates: ${ids}`);
    }
  }

  // --- Overall summary ---
  console.log('');
  const totalUnmatched = report.fields.unmatched + report.subCrops.unmatched;
  const totalAmbiguous = report.fields.ambiguous + report.subCrops.ambiguous;
  if (totalUnmatched === 0 && totalAmbiguous === 0) {
    console.log('Coverage: 100% - all crop strings matched!');
  } else {
    console.log(`Coverage: ${totalUnmatched} unmatched, ${totalAmbiguous} ambiguous`);
    console.log('Fix workflow: add missing aliases to farm-registry /api/crops, then re-run this script');
  }
  console.log('');
  console.log(`Report written to: ${REPORT_FILE}`);

  if (!COMMIT) {
    const total = report.fields.matched + report.subCrops.matched;
    if (total > 0) {
      console.log(`\nDry-run: ${total} records would be updated. Run with --commit to apply.`);
    }
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
