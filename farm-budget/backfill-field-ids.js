#!/usr/bin/env node
/**
 * Farm Budget - Backfill Registry Field IDs
 *
 * Maps existing field name strings in farm-budget data to farm-registry IDs
 * using case-insensitive, whitespace-normalized alias matching.
 *
 * Usage:
 *   node backfill-field-ids.js           # dry-run (shows matches, writes report, no data changes)
 *   node backfill-field-ids.js --commit  # write registryFieldId to matched records in data.json
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *
 * Output:
 *   - Console summary table (matched/unmatched/ambiguous/skipped counts)
 *   - farm-budget/backfill-report.json with detailed match results
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_URL = 'http://localhost:3005/api/fields';
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const REPORT_FILE = path.join(__dirname, 'backfill-report.json');
const COMMIT = process.argv.includes('--commit');

// Normalize a string for comparison: trim, collapse multiple whitespace to single space, lowercase
function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Build lookup map: normalized string -> { fieldId, fieldName }[]
// (arrays to detect ambiguous matches)
function buildLookupMap(registryFields) {
  const map = new Map();

  for (const field of registryFields) {
    const keys = new Set();

    // Add canonical name
    keys.add(normalize(field.name));

    // Add all aliases
    if (Array.isArray(field.aliases)) {
      for (const alias of field.aliases) {
        keys.add(normalize(alias));
      }
    }

    for (const key of keys) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ fieldId: field.id, fieldName: field.name });
    }
  }

  return map;
}

// Match a record name against the lookup map
function matchRecord(name, lookupMap) {
  const key = normalize(name);
  if (!key) return { status: 'unmatched', name };

  const candidates = lookupMap.get(key);
  if (!candidates || candidates.length === 0) {
    return { status: 'unmatched', name };
  }
  if (candidates.length === 1) {
    return { status: 'matched', name, registryFieldId: candidates[0].fieldId, registryFieldName: candidates[0].fieldName };
  }
  // Multiple candidates — ambiguous
  return { status: 'ambiguous', name, candidates };
}

async function fetchRegistryFields() {
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
  // /api/fields returns { fields: [...] } or array directly
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.fields)) return body.fields;
  console.error('ERROR: Unexpected response from farm-registry /api/fields');
  process.exit(1);
}

async function main() {
  console.log('farm-budget backfill-field-ids.js');
  console.log(`Mode: ${COMMIT ? '--commit (WILL WRITE DATA)' : 'dry-run (no changes)'}`);
  console.log('');

  // Load data.json
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ERROR: data.json not found at ${DATA_FILE}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Fetch registry fields
  console.log(`Fetching fields from ${REGISTRY_URL}...`);
  const registryFields = await fetchRegistryFields();
  console.log(`  Found ${registryFields.length} registry fields`);
  const lookupMap = buildLookupMap(registryFields);
  console.log('');

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? 'commit' : 'dry-run',
    fields: { total: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0, results: [] },
    rent:   { total: 0, matched: 0, unmatched: 0, ambiguous: 0, skipped: 0, results: [] },
  };

  // --- Process fields[] ---
  const fields = data.fields || [];
  report.fields.total = fields.length;

  for (const field of fields) {
    if (field.registryFieldId) {
      report.fields.skipped++;
      report.fields.results.push({ id: field.id, name: field.name, status: 'skipped', registryFieldId: field.registryFieldId });
      continue;
    }
    const result = matchRecord(field.name, lookupMap);
    result.id = field.id;
    report.fields.results.push(result);

    if (result.status === 'matched') {
      report.fields.matched++;
      if (COMMIT) field.registryFieldId = result.registryFieldId;
    } else if (result.status === 'unmatched') {
      report.fields.unmatched++;
    } else if (result.status === 'ambiguous') {
      report.fields.ambiguous++;
    }
  }

  // --- Process rent[] ---
  const rent = data.rent || [];
  report.rent.total = rent.length;

  for (const record of rent) {
    if (record.registryFieldId) {
      report.rent.skipped++;
      report.rent.results.push({ id: record.id, name: record.fieldName, status: 'skipped', registryFieldId: record.registryFieldId });
      continue;
    }
    const result = matchRecord(record.fieldName, lookupMap);
    result.id = record.id;
    result.fieldName = record.fieldName;
    report.rent.results.push(result);

    if (result.status === 'matched') {
      report.rent.matched++;
      if (COMMIT) record.registryFieldId = result.registryFieldId;
    } else if (result.status === 'unmatched') {
      report.rent.unmatched++;
    } else if (result.status === 'ambiguous') {
      report.rent.ambiguous++;
    }
  }

  // --- Write data.json if --commit ---
  if (COMMIT) {
    const matchedCount = report.fields.matched + report.rent.matched;
    if (matchedCount > 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`Wrote ${matchedCount} registry field IDs to data.json`);
    } else {
      console.log('No new matches to write (all records already matched or unmatched)');
    }
    console.log('');
  }

  // --- Write report file ---
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // --- Print summary ---
  console.log('=== FIELDS SUMMARY ===');
  console.log(`  Total:     ${report.fields.total}`);
  console.log(`  Matched:   ${report.fields.matched}`);
  console.log(`  Unmatched: ${report.fields.unmatched}`);
  console.log(`  Ambiguous: ${report.fields.ambiguous}`);
  console.log(`  Skipped:   ${report.fields.skipped}  (already had registryFieldId)`);

  if (report.fields.unmatched > 0) {
    const unmatched = report.fields.results.filter(r => r.status === 'unmatched');
    console.log('\n  Unmatched fields:');
    for (const r of unmatched) console.log(`    - "${r.name}" (${r.id})`);
  }
  if (report.fields.ambiguous > 0) {
    const ambiguous = report.fields.results.filter(r => r.status === 'ambiguous');
    console.log('\n  Ambiguous fields:');
    for (const r of ambiguous) {
      const ids = r.candidates.map(c => `${c.fieldId} (${c.fieldName})`).join(', ');
      console.log(`    - "${r.name}" -> candidates: ${ids}`);
    }
  }

  console.log('');
  console.log('=== RENT SUMMARY ===');
  console.log(`  Total:     ${report.rent.total}`);
  console.log(`  Matched:   ${report.rent.matched}`);
  console.log(`  Unmatched: ${report.rent.unmatched}`);
  console.log(`  Ambiguous: ${report.rent.ambiguous}`);
  console.log(`  Skipped:   ${report.rent.skipped}  (already had registryFieldId)`);

  if (report.rent.unmatched > 0) {
    const unmatched = report.rent.results.filter(r => r.status === 'unmatched');
    console.log('\n  Unmatched rent records:');
    for (const r of unmatched) console.log(`    - "${r.fieldName || r.name}" (${r.id})`);
  }
  if (report.rent.ambiguous > 0) {
    const ambiguous = report.rent.results.filter(r => r.status === 'ambiguous');
    console.log('\n  Ambiguous rent records:');
    for (const r of ambiguous) {
      const ids = r.candidates.map(c => `${c.fieldId} (${c.fieldName})`).join(', ');
      console.log(`    - "${r.fieldName || r.name}" -> candidates: ${ids}`);
    }
  }

  console.log('');
  const totalUnmatched = report.fields.unmatched + report.rent.unmatched;
  const totalAmbiguous = report.fields.ambiguous + report.rent.ambiguous;
  if (totalUnmatched === 0 && totalAmbiguous === 0) {
    console.log('Coverage: 100% - all records matched!');
  } else {
    console.log(`Coverage: ${totalUnmatched} unmatched, ${totalAmbiguous} ambiguous`);
    console.log('Fix workflow: add missing aliases to farm-registry, then re-run this script');
  }
  console.log('');
  console.log(`Report written to: ${REPORT_FILE}`);

  if (!COMMIT && (report.fields.matched > 0 || report.rent.matched > 0)) {
    const total = report.fields.matched + report.rent.matched;
    console.log(`\nDry-run: ${total} records would be updated. Run with --commit to apply.`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
