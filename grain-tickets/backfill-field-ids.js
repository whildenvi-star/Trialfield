#!/usr/bin/env node
/**
 * Grain Tickets - Backfill Registry Field IDs
 *
 * Maps existing Farm.name strings in the grain-tickets PostgreSQL database
 * to farm-registry IDs using case-insensitive, whitespace-normalized alias matching.
 *
 * Writes to Farm.registryId (the existing canonical field ID column).
 *
 * Usage:
 *   node backfill-field-ids.js           # dry-run (shows matches, writes report, no DB changes)
 *   node backfill-field-ids.js --commit  # update Farm.registryId for matched records in DB
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *   - DATABASE_URL must be set in .env or environment
 *
 * Output:
 *   - Console summary table (matched/unmatched/ambiguous/skipped counts)
 *   - grain-tickets/backfill-report.json with detailed match results
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load .env from grain-tickets directory
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].replace(/^["']|["']$/g, ''); // strip surrounding quotes
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const REGISTRY_URL = 'http://localhost:3005/api/fields';
const REPORT_FILE = path.join(__dirname, 'backfill-report.json');
const COMMIT = process.argv.includes('--commit');

// Normalize a string for comparison: trim, collapse multiple whitespace to single space, lowercase
function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Build lookup map: normalized string -> { fieldId, fieldName }[]
function buildLookupMap(registryFields) {
  const map = new Map();

  for (const field of registryFields) {
    const keys = new Set();
    keys.add(normalize(field.name));

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

// Match a farm name against the lookup map
function matchFarm(name, lookupMap) {
  const key = normalize(name);
  if (!key) return { status: 'unmatched', name: name || '' };

  const candidates = lookupMap.get(key);
  if (!candidates || candidates.length === 0) {
    return { status: 'unmatched', name };
  }
  if (candidates.length === 1) {
    return { status: 'matched', name, registryFieldId: candidates[0].fieldId, registryFieldName: candidates[0].fieldName };
  }
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
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.fields)) return body.fields;
  console.error('ERROR: Unexpected response from farm-registry /api/fields');
  process.exit(1);
}

async function main() {
  console.log('grain-tickets backfill-field-ids.js');
  console.log(`Mode: ${COMMIT ? '--commit (WILL UPDATE DATABASE)' : 'dry-run (no changes)'}`);
  console.log('');

  // Fetch registry fields
  console.log(`Fetching fields from ${REGISTRY_URL}...`);
  const registryFields = await fetchRegistryFields();
  console.log(`  Found ${registryFields.length} registry fields`);
  const lookupMap = buildLookupMap(registryFields);
  console.log('');

  // Connect Prisma
  const prisma = new PrismaClient();

  try {
    // Query all Farm records where registryId is null
    const farms = await prisma.farm.findMany({
      where: { registryId: null },
      select: { id: true, name: true, registryId: true },
    });

    // Count skipped (already have registryId)
    const totalFarms = await prisma.farm.count();
    const skippedCount = totalFarms - farms.length;

    const report = {
      generatedAt: new Date().toISOString(),
      mode: COMMIT ? 'commit' : 'dry-run',
      farms: {
        total: totalFarms,
        matched: 0,
        unmatched: 0,
        ambiguous: 0,
        skipped: skippedCount,
        results: [],
      },
    };

    // Match each farm
    for (const farm of farms) {
      const result = matchFarm(farm.name, lookupMap);
      result.id = farm.id;
      report.farms.results.push(result);

      if (result.status === 'matched') {
        report.farms.matched++;
      } else if (result.status === 'unmatched') {
        report.farms.unmatched++;
      } else if (result.status === 'ambiguous') {
        report.farms.ambiguous++;
      }
    }

    // Write updates if --commit
    if (COMMIT) {
      const toUpdate = report.farms.results.filter(r => r.status === 'matched');
      if (toUpdate.length > 0) {
        console.log(`Updating ${toUpdate.length} Farm records in database...`);
        for (const match of toUpdate) {
          await prisma.farm.update({
            where: { id: match.id },
            data: { registryId: match.registryFieldId },
          });
        }
        console.log(`Done. Updated ${toUpdate.length} records.`);
      } else {
        console.log('No new matches to update.');
      }
      console.log('');
    }

    // Write report file
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    // Print summary
    console.log('=== FARMS SUMMARY ===');
    console.log(`  Total:     ${report.farms.total}`);
    console.log(`  Matched:   ${report.farms.matched}`);
    console.log(`  Unmatched: ${report.farms.unmatched}`);
    console.log(`  Ambiguous: ${report.farms.ambiguous}`);
    console.log(`  Skipped:   ${report.farms.skipped}  (already had registryId)`);

    if (report.farms.unmatched > 0) {
      const unmatched = report.farms.results.filter(r => r.status === 'unmatched');
      console.log('\n  Unmatched farms:');
      for (const r of unmatched) console.log(`    - "${r.name}" (id: ${r.id})`);
    }
    if (report.farms.ambiguous > 0) {
      const ambiguous = report.farms.results.filter(r => r.status === 'ambiguous');
      console.log('\n  Ambiguous farms:');
      for (const r of ambiguous) {
        const ids = r.candidates.map(c => `${c.fieldId} (${c.fieldName})`).join(', ');
        console.log(`    - "${r.name}" (id: ${r.id}) -> candidates: ${ids}`);
      }
    }

    console.log('');
    const totalUnmatched = report.farms.unmatched;
    const totalAmbiguous = report.farms.ambiguous;
    if (totalUnmatched === 0 && totalAmbiguous === 0) {
      console.log('Coverage: 100% - all Farm records matched!');
    } else {
      console.log(`Coverage: ${totalUnmatched} unmatched, ${totalAmbiguous} ambiguous`);
      console.log('Fix workflow: add missing aliases to farm-registry, then re-run this script');
    }
    console.log('');
    console.log(`Report written to: ${REPORT_FILE}`);

    if (!COMMIT && report.farms.matched > 0) {
      console.log(`\nDry-run: ${report.farms.matched} Farm records would be updated. Run with --commit to apply.`);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
