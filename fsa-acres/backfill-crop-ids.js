#!/usr/bin/env node
/**
 * FSA Acres - Backfill Registry Crop IDs
 *
 * Maps existing crop strings in fsa-acres cluRecords to farm-registry crop IDs
 * using case-insensitive, whitespace-normalized alias matching.
 *
 * Note: fsa-acres crop values are often FSA category strings like "MIXED FORAGE / HAY",
 * "NC" (non-crop), "idle", "gls" (grass), "rye", etc. Only crop strings that match
 * the canonical registry will receive a registryCropId. Non-crop FSA categories
 * (NC, idle, gls, etc.) are expected to remain unmatched.
 *
 * Usage:
 *   node backfill-crop-ids.js           # dry-run (shows matches, writes report, no data changes)
 *   node backfill-crop-ids.js --commit  # write registryCropId to matched records in data.json
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *
 * Output:
 *   - Console summary table (matched/unmatched/skipped counts)
 *   - fsa-acres/backfill-crop-report.json with detailed match results
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_URL = 'http://localhost:3005/api/crops';
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const REPORT_FILE = path.join(__dirname, 'backfill-crop-report.json');
const COMMIT = process.argv.includes('--commit');

// Non-crop FSA categories that are expected to be unmatched — not errors
const FSA_NON_CROP = new Set([
  'nc', 'idle', 'gls', 'grass', 'csr', 'crp', 'fallow', 'wetland', 'pasture', 'other', '',
]);

// Normalize a string for comparison: trim, collapse multiple whitespace to single space, lowercase
function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Build lookup map: normalized alias string -> [{cropId, cropName, organic}]
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

// Match a crop string against the lookup map
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
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.crops)) return body.crops;
  console.error('ERROR: Unexpected response from farm-registry /api/crops');
  process.exit(1);
}

async function main() {
  console.log('fsa-acres backfill-crop-ids.js');
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
    cluRecords: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0, results: [] },
  };

  // --- Process cluRecords[] ---
  const cluRecords = data.cluRecords || [];
  report.cluRecords.total = cluRecords.length;

  // Track unique names for compact summary output
  const seenUnmatchedNames = new Map(); // name -> count
  const seenUnmatchedNonCrop = new Set(); // non-crop FSA categories (expected unmatched)

  for (const record of cluRecords) {
    if (record.registryCropId) {
      report.cluRecords.skipped++;
      report.cluRecords.results.push({
        id: record.id,
        crop: record.crop,
        status: 'skipped',
        registryCropId: record.registryCropId,
      });
      continue;
    }

    const result = matchCrop(record.crop, lookupMap);
    result.id = record.id;
    report.cluRecords.results.push(result);

    if (result.status === 'matched') {
      report.cluRecords.matched++;
      if (COMMIT) record.registryCropId = result.registryCropId;
    } else if (result.status === 'unmatched') {
      report.cluRecords.unmatched++;
      const key = normalize(record.crop || '');
      if (FSA_NON_CROP.has(key)) {
        seenUnmatchedNonCrop.add(record.crop || '(empty)');
      } else {
        seenUnmatchedNames.set(record.crop || '(empty)', (seenUnmatchedNames.get(record.crop || '(empty)') || 0) + 1);
      }
    } else if (result.status === 'ambiguous') {
      report.cluRecords.ambiguous++;
    }
  }

  // --- Write data.json if --commit ---
  if (COMMIT) {
    const matchedCount = report.cluRecords.matched;
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

  // --- Print summary ---
  console.log('=== CLU RECORDS SUMMARY ===');
  console.log(`  Total:     ${report.cluRecords.total}`);
  console.log(`  Matched:   ${report.cluRecords.matched}`);
  console.log(`  Unmatched: ${report.cluRecords.unmatched}`);
  console.log(`  Ambiguous: ${report.cluRecords.ambiguous}`);
  console.log(`  Skipped:   ${report.cluRecords.skipped}  (already had registryCropId)`);

  if (seenUnmatchedNames.size > 0) {
    console.log('\n  Unmatched crop names (need aliases added to registry):');
    const sorted = [...seenUnmatchedNames.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      console.log(`    - "${name}" (${count} records)`);
    }
  }

  if (seenUnmatchedNonCrop.size > 0) {
    console.log('\n  Non-crop FSA categories (expected unmatched, no action needed):');
    for (const name of [...seenUnmatchedNonCrop].sort()) {
      console.log(`    - "${name}"`);
    }
  }

  if (report.cluRecords.ambiguous > 0) {
    const ambiguous = report.cluRecords.results.filter(r => r.status === 'ambiguous');
    const seen = new Set();
    console.log('\n  Ambiguous crop names:');
    for (const r of ambiguous) {
      if (seen.has(r.name)) continue;
      seen.add(r.name);
      const ids = r.candidates.map(c => `${c.cropId} (${c.cropName})`).join(', ');
      console.log(`    - "${r.name}" -> candidates: ${ids}`);
    }
  }

  console.log('');
  const cropUnmatched = report.cluRecords.unmatched - seenUnmatchedNonCrop.size;
  if (seenUnmatchedNames.size === 0 && report.cluRecords.ambiguous === 0) {
    if (seenUnmatchedNonCrop.size > 0) {
      console.log(`Coverage: 100% of crop records matched (${seenUnmatchedNonCrop.size} non-crop FSA categories skipped as expected)`);
    } else {
      console.log('Coverage: 100% - all records matched!');
    }
  } else {
    console.log(`Coverage: ${seenUnmatchedNames.size} unique crop names unmatched, ${report.cluRecords.ambiguous} ambiguous`);
    console.log('Fix workflow: add missing aliases to farm-registry /api/crops, then re-run this script');
  }
  console.log('');
  console.log(`Report written to: ${REPORT_FILE}`);

  if (!COMMIT && report.cluRecords.matched > 0) {
    console.log(`\nDry-run: ${report.cluRecords.matched} records would be updated. Run with --commit to apply.`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
