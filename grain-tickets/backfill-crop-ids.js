#!/usr/bin/env node
/**
 * Grain Tickets - Backfill Registry Crop IDs
 *
 * Maps existing crop name strings in the grain-tickets PostgreSQL database
 * to farm-registry crop IDs using case-insensitive, whitespace-normalized alias matching.
 *
 * Processes:
 *   - CropConfig.cropName -> writes CropConfig.registryCropId
 *   - Ticket.crop -> writes Ticket.registryCropId (batch update per matched CropConfig)
 *
 * Prerequisites:
 *   - Run `npx prisma db push` in grain-tickets/ to apply the schema changes
 *     that added registryCropId to CropConfig and Ticket (Phase 50 Plan 02)
 *
 * Usage:
 *   node backfill-crop-ids.js           # dry-run (shows matches, writes report, no DB changes)
 *   node backfill-crop-ids.js --commit  # update registryCropId for matched records in DB
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *   - DATABASE_URL must be set in .env or environment
 *
 * Output:
 *   - Console summary table (matched/unmatched/ambiguous/skipped counts)
 *   - grain-tickets/backfill-crop-report.json with detailed match results
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Load .env from grain-tickets directory (no dotenv dependency — matches field backfill pattern)
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
const REGISTRY_URL = 'http://localhost:3005/api/crops';
const REPORT_FILE = path.join(__dirname, 'backfill-crop-report.json');
const COMMIT = process.argv.includes('--commit');

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
    keys.add(normalize(crop.name));

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

// Match a crop name against the lookup map
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
  console.log('grain-tickets backfill-crop-ids.js');
  console.log(`Mode: ${COMMIT ? '--commit (WILL UPDATE DATABASE)' : 'dry-run (no changes)'}`);
  console.log('');

  // Fetch registry crops
  console.log(`Fetching crops from ${REGISTRY_URL}...`);
  const registryCrops = await fetchRegistryCrops();
  console.log(`  Found ${registryCrops.length} registry crops`);
  const lookupMap = buildLookupMap(registryCrops);
  console.log('');

  // Connect Prisma
  const prisma = new PrismaClient();

  try {
    // --- Process CropConfig records ---
    const allCropConfigs = await prisma.cropConfig.findMany({
      select: { id: true, cropYear: true, cropName: true, registryCropId: true },
    });

    const skippedConfigs = allCropConfigs.filter(c => c.registryCropId);
    const toMatchConfigs = allCropConfigs.filter(c => !c.registryCropId);

    const report = {
      generatedAt: new Date().toISOString(),
      mode: COMMIT ? 'commit' : 'dry-run',
      cropConfigs: {
        total: allCropConfigs.length,
        matched: 0,
        unmatched: 0,
        ambiguous: 0,
        skipped: skippedConfigs.length,
        results: [],
      },
      tickets: {
        total: 0,
        matched: 0,
        unmatched: 0,
        skipped: 0,
        note: 'Ticket.registryCropId is derived from CropConfig matches — updated in batch by crop name',
      },
    };

    // Match each CropConfig
    for (const config of toMatchConfigs) {
      const result = matchCrop(config.cropName, lookupMap);
      result.id = config.id;
      result.cropYear = config.cropYear;
      report.cropConfigs.results.push(result);

      if (result.status === 'matched') report.cropConfigs.matched++;
      else if (result.status === 'unmatched') report.cropConfigs.unmatched++;
      else if (result.status === 'ambiguous') report.cropConfigs.ambiguous++;
    }

    // --- Count Ticket records ---
    const totalTickets = await prisma.ticket.count();
    const skippedTickets = await prisma.ticket.count({ where: { registryCropId: { not: null } } });
    report.tickets.total = totalTickets;
    report.tickets.skipped = skippedTickets;

    // --- Apply DB updates if --commit ---
    if (COMMIT) {
      const configMatches = report.cropConfigs.results.filter(r => r.status === 'matched');
      if (configMatches.length > 0) {
        console.log(`Updating ${configMatches.length} CropConfig records...`);
        for (const match of configMatches) {
          await prisma.cropConfig.update({
            where: { id: match.id },
            data: { registryCropId: match.registryCropId },
          });
        }
        console.log(`  Done. Updated ${configMatches.length} CropConfig records.`);

        // Now bulk-update Ticket records by matching crop name string
        console.log('\nUpdating Ticket records by crop name match...');
        let ticketUpdated = 0;
        for (const match of configMatches) {
          const result = await prisma.ticket.updateMany({
            where: {
              crop: match.name,
              registryCropId: null,
            },
            data: { registryCropId: match.registryCropId },
          });
          ticketUpdated += result.count;
          if (result.count > 0) {
            console.log(`  "${match.name}" -> ${match.registryCropId}: ${result.count} ticket(s) updated`);
          }
        }
        report.tickets.matched = ticketUpdated;
        console.log(`  Done. Updated ${ticketUpdated} Ticket records.`);
      } else {
        console.log('No new CropConfig matches to write.');
      }
      console.log('');
    } else {
      // Dry-run: estimate ticket updates by summing ticket counts per crop name
      for (const match of report.cropConfigs.results.filter(r => r.status === 'matched')) {
        const count = await prisma.ticket.count({
          where: { crop: match.name, registryCropId: null },
        });
        report.tickets.matched += count;
        match.estimatedTicketUpdates = count;
      }
    }

    // Write report file
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    // Print summary
    console.log('=== CROP CONFIG SUMMARY ===');
    console.log(`  Total:     ${report.cropConfigs.total}`);
    console.log(`  Matched:   ${report.cropConfigs.matched}`);
    console.log(`  Unmatched: ${report.cropConfigs.unmatched}`);
    console.log(`  Ambiguous: ${report.cropConfigs.ambiguous}`);
    console.log(`  Skipped:   ${report.cropConfigs.skipped}  (already had registryCropId)`);

    if (report.cropConfigs.unmatched > 0) {
      const unmatched = report.cropConfigs.results.filter(r => r.status === 'unmatched');
      console.log('\n  Unmatched crop names:');
      for (const r of unmatched) {
        console.log(`    - "${r.name}" (cropYear: ${r.cropYear}, id: ${r.id})`);
      }
    }
    if (report.cropConfigs.ambiguous > 0) {
      const ambiguous = report.cropConfigs.results.filter(r => r.status === 'ambiguous');
      console.log('\n  Ambiguous crop names:');
      for (const r of ambiguous) {
        const ids = r.candidates.map(c => `${c.cropId} (${c.cropName})`).join(', ');
        console.log(`    - "${r.name}" (id: ${r.id}) -> candidates: ${ids}`);
      }
    }

    console.log('');
    console.log('=== TICKETS SUMMARY ===');
    console.log(`  Total:     ${report.tickets.total}`);
    if (COMMIT) {
      console.log(`  Updated:   ${report.tickets.matched}  (registryCropId written)`);
      console.log(`  Skipped:   ${report.tickets.skipped}  (already had registryCropId)`);
    } else {
      console.log(`  Would update: ${report.tickets.matched}  (dry-run estimate)`);
      console.log(`  Skipped:      ${report.tickets.skipped}  (already had registryCropId)`);
    }

    console.log('');
    if (report.cropConfigs.unmatched === 0 && report.cropConfigs.ambiguous === 0) {
      console.log('Coverage: 100% - all CropConfig records matched!');
    } else {
      console.log(`Coverage: ${report.cropConfigs.unmatched} unmatched, ${report.cropConfigs.ambiguous} ambiguous`);
      console.log('Fix workflow: add missing aliases to farm-registry /api/crops, then re-run this script');
    }
    console.log('');
    console.log(`Report written to: ${REPORT_FILE}`);

    if (!COMMIT && (report.cropConfigs.matched > 0 || report.tickets.matched > 0)) {
      console.log(`\nDry-run: ${report.cropConfigs.matched} CropConfig + ~${report.tickets.matched} Ticket records would be updated.`);
      console.log('Run with --commit to apply.');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
