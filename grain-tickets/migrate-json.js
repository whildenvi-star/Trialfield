#!/usr/bin/env node
'use strict';

// One-time migration script: JSON flat-file -> PostgreSQL via Prisma
// Run ONCE during cutover window with server stopped.
//
// Usage:
//   node migrate-json.js            -- full migration
//   node migrate-json.js --dry-run  -- preview counts and extractions, no DB writes

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const Calc = require('./public/calc.js');

// Create a fresh PrismaClient — NOT the singleton from lib/db.js.
// This script runs outside the server process and manages its own connection lifecycle.
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract Hughes Blue Ticket bin number from notes field.
 * Patterns: "HBT# 5652", "HBT #5652", "blue ticket 5652"
 */
function extractHbtBinNo(notes) {
  if (!notes) return null;
  const hbtMatch = notes.match(/HBT\s*#\s*(\d+)/i);
  if (hbtMatch) return hbtMatch[1];
  const blueMatch = notes.match(/blue\s+ticket\s+(\d+)/i);
  if (blueMatch) return blueMatch[1];
  return null;
}

/**
 * Extract truck identifier from notes field.
 * Patterns: "Trk# 41", "Truck #41", "Trk#63"
 */
function extractTruckId(notes) {
  if (!notes) return null;
  const m = notes.match(/(?:Trk|Truck)\s*#?\s*(\w+)/i);
  if (m) return m[1];
  return null;
}

/**
 * Derive crop year from a YYYY-MM-DD date string.
 * Falls back to 2025 if date is missing or unparseable.
 */
function getCropYear(dateStr) {
  if (!dateStr) return 2025;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return isNaN(year) ? 2025 : year;
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function run() {
  // --- Load source data ---
  if (!fs.existsSync(DATA_FILE)) {
    console.error('ERROR: data.json not found at', DATA_FILE);
    console.error('If already archived, migration has already run.');
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const { tickets, farms, cropConfig } = store;

  console.log('='.repeat(60));
  console.log('Grain Tickets JSON -> PostgreSQL Migration');
  console.log('='.repeat(60));
  console.log(`Source: ${tickets.length} tickets, ${farms.length} farms, ${Object.keys(cropConfig).length} crop configs`);
  console.log('');

  // --- Dry-run gate ---
  if (DRY_RUN) {
    console.log('DRY RUN mode — no database writes will occur');
    console.log('');
    console.log(`Would migrate:`);
    console.log(`  - ${Object.keys(cropConfig).length} crop configs (cropYear=2025)`);
    console.log(`  - ${farms.length} farms`);
    console.log(`  - ${tickets.length} tickets`);
    console.log('');

    // Sample HBT extractions on first 5 tickets
    console.log('Sample HBT bin extractions (first 5 tickets with notes):');
    let shown = 0;
    for (const t of tickets) {
      if (!t.notes) continue;
      const hbt = extractHbtBinNo(t.notes);
      const trk = extractTruckId(t.notes);
      if (hbt || trk) {
        console.log(`  [${t.id}] notes="${t.notes}" -> hbtBinNo=${hbt}, truckId=${trk}`);
        shown++;
        if (shown >= 5) break;
      }
    }

    // Count expected extractions
    let hbtCount = 0;
    let trkCount = 0;
    for (const t of tickets) {
      if (extractHbtBinNo(t.notes)) hbtCount++;
      if (extractTruckId(t.notes)) trkCount++;
    }
    console.log('');
    console.log(`Expected extractions: ${hbtCount} HBT bins, ${trkCount} truck IDs`);
    console.log('');
    console.log('DRY RUN complete — no changes made.');

    await prisma.$disconnect();
    return;
  }

  // --- Full migration ---
  console.log('Starting migration...');
  console.log('');

  const warnings = [];

  // =========================================================================
  // Step 1: Migrate CropConfigs
  // =========================================================================
  console.log('Step 1: Migrating crop configs...');

  const cropRows = Object.entries(cropConfig).map(([cropName, cfg]) => ({
    cropYear: 2025,
    cropName: cropName,
    testWeight: typeof cfg.testWeight === 'number' ? cfg.testWeight : 56,
    moistureShrink: typeof cfg.moistureShrink === 'number' ? cfg.moistureShrink : 0,
    discount: typeof cfg.discount === 'number' ? cfg.discount : 0
  }));

  const cropResult = await prisma.cropConfig.createMany({ data: cropRows });

  if (cropResult.count !== cropRows.length) {
    console.error(`ABORT: CropConfig count mismatch. Expected ${cropRows.length}, got ${cropResult.count}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`  CropConfigs: ${cropResult.count} migrated`);

  // =========================================================================
  // Step 2: Migrate Farms
  // =========================================================================
  console.log('Step 2: Migrating farms...');

  // Check for duplicate farm names — warn and keep first occurrence
  const seenFarmNames = new Map();
  const farmRows = [];

  for (const f of farms) {
    const name = (f.farm || '').trim();
    if (!name) {
      warnings.push(`Farm ${f.id} has empty name — migrating with empty string`);
    }
    if (seenFarmNames.has(name)) {
      warnings.push(`Duplicate farm name "${name}" (${f.id} vs ${seenFarmNames.get(name)}) — keeping first occurrence`);
      continue;
    }
    seenFarmNames.set(name, f.id);

    farmRows.push({
      legacyId: f.id,
      name: name,
      crop: (f.crop || '').trim() || null,
      acres: parseFloat(f.acres) || 0,
      unit: f.unit || 'BU',
      type: f.type || 'Conventional',
      guarantee: parseFloat(f.guarantee) || 0,
      coverage: parseFloat(f.coverage) || 0,
      claimThreshold: parseFloat(f.claimThreshold) || 0,
      discount: parseFloat(f.discount) || 0,
      testWeight: parseFloat(f.testWeight) || 56,
      driver: f.driver || null,
      truck: parseFloat(f.truck) || 0
    });
  }

  const farmResult = await prisma.farm.createMany({ data: farmRows });

  if (farmResult.count !== farmRows.length) {
    console.error(`ABORT: Farm count mismatch. Expected ${farmRows.length}, got ${farmResult.count}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`  Farms: ${farmResult.count} migrated`);

  // =========================================================================
  // Step 3: Migrate Tickets
  // =========================================================================
  console.log('Step 3: Migrating tickets...');

  let hbtExtracted = 0;
  let trkExtracted = 0;
  let anomalies = 0;

  const ticketRows = tickets.map((t, idx) => {
    // Data anomaly detection — warn but migrate everything
    if (!t.date) {
      warnings.push(`Ticket ${t.id} (index ${idx}) has no date — defaulting to 2025-01-01`);
      anomalies++;
    }
    if (!t.netWeight || parseFloat(t.netWeight) <= 0) {
      warnings.push(`Ticket ${t.id} has zero/missing netWeight`);
      anomalies++;
    }
    if (!t.farm || !(t.farm + '').trim()) {
      warnings.push(`Ticket ${t.id} has empty farm name`);
      anomalies++;
    }

    const hbt = extractHbtBinNo(t.notes);
    const trk = extractTruckId(t.notes);
    if (hbt) hbtExtracted++;
    if (trk) trkExtracted++;

    // Use noon UTC to avoid timezone shift (date-only strings with new Date() give midnight UTC
    // which can shift to previous day in negative-offset timezones — noon UTC is always same date)
    const dateStr = t.date || '2025-01-01';
    const date = new Date(dateStr + 'T12:00:00.000Z');

    return {
      legacyId: t.id,
      date: date,
      cropYear: getCropYear(t.date),
      farm: (t.farm || '').trim(),
      netWeight: parseFloat(t.netWeight) || 0,
      moisture: parseFloat(t.moisture) || 0,
      fm: parseFloat(t.fm) || 0,
      crop: (t.crop || '').trim(),
      ticketNo: (t.ticketNo || '').trim() || null,
      hbtBinNo: hbt,
      truckId: trk,
      notes: (t.notes || '').trim() || null
    };
  });

  const ticketResult = await prisma.ticket.createMany({ data: ticketRows });

  if (ticketResult.count !== ticketRows.length) {
    console.error(`ABORT: Ticket count mismatch. Expected ${ticketRows.length}, got ${ticketResult.count}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`  Tickets: ${ticketResult.count} migrated`);
  console.log(`  HBT bins extracted: ${hbtExtracted}`);
  console.log(`  Truck IDs extracted: ${trkExtracted}`);
  if (anomalies > 0) {
    console.log(`  Data anomalies (migrated as-is): ${anomalies}`);
  }

  // =========================================================================
  // Step 4: Verify calc.js parity on 10 random tickets
  // =========================================================================
  console.log('');
  console.log('Step 4: Verifying calc.js parity on 10 random tickets...');

  // Build cropConfig object from DB (matches shape expected by calc.js)
  const dbCropRows = await prisma.cropConfig.findMany({ where: { cropYear: 2025 } });
  const dbCropConfig = {};
  for (const row of dbCropRows) {
    dbCropConfig[row.cropName] = {
      discount: row.discount,
      testWeight: row.testWeight,
      moistureShrink: row.moistureShrink
    };
  }

  // Pick 10 unique random indices from source tickets array
  const indices = new Set();
  while (indices.size < 10 && indices.size < tickets.length) {
    indices.add(Math.floor(Math.random() * tickets.length));
  }

  let parityPassed = 0;
  let parityFailed = 0;

  for (const idx of indices) {
    const srcTicket = tickets[idx];

    // Look up DB ticket by legacyId
    const dbTicket = await prisma.ticket.findFirst({ where: { legacyId: srcTicket.id } });

    if (!dbTicket) {
      console.error(`  FAIL: Could not find DB ticket for legacyId=${srcTicket.id}`);
      parityFailed++;
      continue;
    }

    // Compute from JSON source ticket using JSON cropConfig
    const jsonShape = {
      netWeight: parseFloat(srcTicket.netWeight) || 0,
      moisture: parseFloat(srcTicket.moisture) || 0,
      fm: parseFloat(srcTicket.fm) || 0,
      crop: (srcTicket.crop || '').trim()
    };
    const jsonResult = Calc.computeTicket(jsonShape, cropConfig);

    // Compute from DB ticket using DB-derived cropConfig
    const dbShape = {
      netWeight: dbTicket.netWeight,
      moisture: dbTicket.moisture,
      fm: dbTicket.fm,
      crop: dbTicket.crop
    };
    const dbResult = Calc.computeTicket(dbShape, dbCropConfig);

    // Compare via JSON.stringify — must be identical
    if (JSON.stringify(jsonResult) !== JSON.stringify(dbResult)) {
      console.error(`  FAIL: Parity mismatch for ticket ${srcTicket.id} (${srcTicket.crop})`);
      console.error(`    JSON result: ${JSON.stringify(jsonResult)}`);
      console.error(`    DB result:   ${JSON.stringify(dbResult)}`);
      parityFailed++;
    } else {
      parityPassed++;
    }
  }

  if (parityFailed > 0) {
    console.error(`\nABORT: calc.js parity FAILED on ${parityFailed}/${indices.size} tickets.`);
    console.error('Data has been migrated but is inconsistent — investigate before archiving.');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`  calc.js parity: ${parityPassed}/${indices.size} tickets match`);

  // =========================================================================
  // Step 5: Archive data.json and delete .bak files
  // =========================================================================
  console.log('');
  console.log('Step 5: Archiving data.json...');

  // Atomic rename — data.json -> data.json.archive
  fs.renameSync(DATA_FILE, DATA_FILE + '.archive');
  console.log(`  Renamed: data.json -> data.json.archive`);

  // Delete backup files if they exist
  for (let i = 1; i <= 5; i++) {
    const bakPath = DATA_FILE + '.bak.' + i;
    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
      console.log(`  Deleted: data.json.bak.${i}`);
    }
  }

  // =========================================================================
  // Step 6: Print summary
  // =========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Complete');
  console.log('='.repeat(60));
  console.log(`  Tickets migrated:    ${ticketResult.count}`);
  console.log(`  Farms migrated:      ${farmResult.count}`);
  console.log(`  Crop configs:        ${cropResult.count}`);
  console.log(`  HBT bins extracted:  ${hbtExtracted}`);
  console.log(`  Truck IDs extracted: ${trkExtracted}`);
  console.log(`  calc.js parity:      ${parityPassed}/${indices.size} tickets match`);

  if (warnings.length > 0) {
    console.log('');
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Entry point with top-level error handling
// ---------------------------------------------------------------------------

run().catch(async (err) => {
  console.error('');
  console.error('MIGRATION FAILED:', err.message);
  console.error(err.stack);
  await prisma.$disconnect();
  process.exit(1);
});
