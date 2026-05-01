#!/usr/bin/env node
/**
 * One-time backfill: populate farm-registry totalRentDollars from farm-budget rent[] data.
 *
 * Usage:
 *   node scripts/backfill-registry-rent.js --dry-run   # preview without writing
 *   node scripts/backfill-registry-rent.js              # execute
 */
'use strict';
var fs = require('fs');
var path = require('path');

var DRY_RUN = process.argv.includes('--dry-run');
var REGISTRY_URL = process.env.FARM_REGISTRY_URL || 'http://localhost:3005';

// --- Manual mapping for rent parcels that don't match by name/alias ---
// Keys are lowercased rent parcel fieldName → registry field name (lowercased)
var MANUAL_MAP = {
  'buchanon little': 'buchanon',
  'gessert total': 'gessert',
  "inman brad's": "brad inman's",
  'klug/davis south': 'klug davis',
  'noss, jessie': 'noss torkelson west, a.k.a. jessie noss',
  'noss. torkelson': 'noss, torkelson east a.k.a. noss pond',
  'omni big south': 'omni',
  'omni grassy knoll': 'omni',
};

// Skip these — they're subsets of another parcel that already covers the same field
var SKIP = [
  'gessert high oil beans', // subset of "Gessert total"
];

async function main() {
  // 1. Load budget rent data
  var budgetData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'data.json'), 'utf8')
  );
  var activeRent = budgetData.rent.filter(function(r) { return r.active !== false; });
  console.log('Active rent parcels: ' + activeRent.length);

  // 2. Load registry fields for matching
  var regData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'farm-registry', 'data', 'data.json'), 'utf8')
  );
  var regFields = regData.fields.filter(function(f) { return f.active !== false; });

  // Build lookup: lowercased name/alias → registry field
  var regLookup = {};
  regFields.forEach(function(f) {
    regLookup[f.name.toLowerCase()] = f;
    (f.aliases || []).forEach(function(a) {
      regLookup[a.toLowerCase()] = f;
    });
  });

  // 3. Match each rent parcel to a registry field, group by registry field ID
  var grouped = {};   // registry field id → { name, totalRent }
  var unmatched = [];
  var skipped = [];

  activeRent.forEach(function(r) {
    var parcelName = (r.fieldName || '').trim().toLowerCase();

    // Check skip list
    if (SKIP.indexOf(parcelName) >= 0) {
      skipped.push(r.fieldName + ' ($' + Math.round(r.totalRent || (r.acres * r.rentRate) || 0) + ')');
      return;
    }

    var totalRent = r.totalRent || (r.acres * r.rentRate) || 0;

    // Try auto-match first, then manual mapping
    var regField = regLookup[parcelName];
    if (!regField && MANUAL_MAP[parcelName]) {
      regField = regLookup[MANUAL_MAP[parcelName]];
    }

    if (!regField) {
      unmatched.push({ fieldName: r.fieldName, totalRent: Math.round(totalRent) });
      return;
    }

    if (!grouped[regField.id]) {
      grouped[regField.id] = { name: regField.name, totalRent: 0, parcels: [] };
    }
    grouped[regField.id].totalRent += totalRent;
    grouped[regField.id].parcels.push(r.fieldName);
  });

  // 4. Build entries for the backfill API
  var entries = [];
  Object.keys(grouped).forEach(function(id) {
    var g = grouped[id];
    var rounded = Math.round(g.totalRent * 100) / 100;
    entries.push({
      fieldName: g.name,
      totalRentDollars: rounded,
      overwrite: true,
    });
  });

  // 5. Report
  console.log('\n=== BACKFILL SUMMARY ===');
  console.log('Fields to update: ' + entries.length);
  console.log('Skipped (subset parcels): ' + skipped.length);
  console.log('Unmatched: ' + unmatched.length);

  console.log('\n--- Updates ---');
  entries.sort(function(a, b) { return a.fieldName.localeCompare(b.fieldName); });
  var grandTotal = 0;
  entries.forEach(function(e) {
    var g = grouped[Object.keys(grouped).find(function(id) { return grouped[id].name === e.fieldName; })];
    var parcelNote = g.parcels.length > 1 ? ' (sum of: ' + g.parcels.join(' + ') + ')' : '';
    console.log('  ' + e.fieldName + ': $' + e.totalRentDollars.toLocaleString() + parcelNote);
    grandTotal += e.totalRentDollars;
  });
  console.log('\nGrand total: $' + Math.round(grandTotal).toLocaleString());

  if (skipped.length) {
    console.log('\n--- Skipped ---');
    skipped.forEach(function(s) { console.log('  ' + s); });
  }

  if (unmatched.length) {
    console.log('\n--- Unmatched (need manual resolution) ---');
    unmatched.forEach(function(u) { console.log('  ' + u.fieldName + ': $' + u.totalRent); });
  }

  // 6. Execute (unless dry-run)
  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written. Remove --dry-run to execute.');
    return;
  }

  console.log('\nPosting to ' + REGISTRY_URL + '/api/fields/backfill-rent ...');
  try {
    var resp = await fetch(REGISTRY_URL + '/api/fields/backfill-rent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: entries }),
    });
    var result = await resp.json();
    console.log('\nResult:');
    console.log('  Updated: ' + result.updated.length);
    console.log('  Skipped (already had rent): ' + result.skipped.length);
    console.log('  Unmatched by API: ' + result.unmatched.length);
    if (result.unmatched.length) {
      result.unmatched.forEach(function(n) { console.log('    - ' + n); });
    }
  } catch (err) {
    console.error('Error: ' + err.message);
    console.error('Is farm-registry running on ' + REGISTRY_URL + '?');
    process.exit(1);
  }
}

main();
