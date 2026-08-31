#!/usr/bin/env node
// Placeholder P2O5 / K2O analysis for manure, litter and compost products.
//
// These carry no analysis at all, which leaves organic ground with no approved
// source to price straw nutrient removal against. Book mid-range values on an
// as-is (wet) basis, expressed as the fraction by weight the products table
// stores — 0.03 = 3% = 60 lb per ton.
//
// Every row written is tagged analysisPlaceholder:true so it shows as
// provisional in the UI and is trivial to find and replace with real numbers
// off a manure test or a supplier tag. Manure varies enormously by source,
// bedding and storage: treat these as scaffolding, not measurements.
//
//   node scripts/seed-placeholder-manure-analysis.js          # apply
//   node scripts/seed-placeholder-manure-analysis.js --dry     # preview
//   node scripts/seed-placeholder-manure-analysis.js --clear   # remove placeholders

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

// name → { p205, k20, basis }
const PLACEHOLDERS = {
  'Chicken Litter':             { p205: 0.030, k20: 0.025, basis: 'raw poultry litter, ~60-60-50 lb/ton' },
  'Fall 22 Kutz Litter':        { p205: 0.030, k20: 0.025, basis: 'raw poultry litter, ~60-60-50 lb/ton' },
  'Jason litter/compost mix':   { p205: 0.020, k20: 0.018, basis: 'litter/compost blend, between the two' },
  'Chick Magic Pellets':        { p205: 0.030, k20: 0.020, basis: 'pelleted poultry, dried' },
  'chicken crumbles OMRI':      { p205: 0.030, k20: 0.020, basis: 'pelleted poultry, dried' },
  'Chicken crumbles':           { p205: 0.030, k20: 0.020, basis: 'pelleted poultry, dried' },
  'gold oaks compost':          { p205: 0.005, k20: 0.008, basis: 'finished compost, ~10-16 lb/ton' },
  'Janesville complete compost':{ p205: 0.005, k20: 0.008, basis: 'finished compost, ~10-16 lb/ton' },
  'Purple Cow Classic Compost': { p205: 0.005, k20: 0.008, basis: 'finished compost, ~10-16 lb/ton' },
  'Mint castings':              { p205: 0.005, k20: 0.008, basis: 'compost-equivalent' },
  'Tulls manure':               { p205: 0.002, k20: 0.004, basis: 'solid dairy manure, ~4-8 lb/ton' }
};

// Deliberately skipped, and why:
//   custom compost hauling  — a hauling service, not a nutrient product
//   Daluge Manure, compost tea LLC — billed by the gallon; a weight percent
//     against a volume unit needs a density we don't carry, so removal
//     pricing skips them regardless
//   feathermeal, Sustane   — N products / unknown analysis

const dry = process.argv.includes('--dry');
const clear = process.argv.includes('--clear');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let touched = 0;

(data.products || []).forEach(p => {
  const spec = PLACEHOLDERS[(p.name || '').trim()];
  if (!spec) return;

  if (clear) {
    if (!p.analysisPlaceholder) return;
    console.log('  clear  ' + (p.name || '').trim());
    delete p.analysisPlaceholder;
    p.p205 = 0;
    p.k20 = 0;
    touched++;
    return;
  }

  // Never overwrite a real measured value someone has entered.
  const hasReal = ((Number(p.p205) || 0) > 0 || (Number(p.k20) || 0) > 0) && !p.analysisPlaceholder;
  if (hasReal) {
    console.log('  skip   ' + (p.name || '').trim() + ' — already has analysis (P ' + p.p205 + ' K ' + p.k20 + ')');
    return;
  }

  console.log('  set    ' + (p.name || '').trim().padEnd(30) +
    ' P₂O₅ ' + (spec.p205 * 100).toFixed(1) + '%  K₂O ' + (spec.k20 * 100).toFixed(1) + '%   (' + spec.basis + ')');
  p.p205 = spec.p205;
  p.k20 = spec.k20;
  p.analysisPlaceholder = true;
  touched++;
});

if (dry) {
  console.log('\n--dry: ' + touched + ' product(s) would change, nothing written');
} else if (touched) {
  const backup = DATA_FILE + '.bak-placeholder-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, backup);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('\n' + touched + ' product(s) updated. Backup: ' + path.basename(backup));
  console.log('Restart the app to pick it up:  pm2 restart farm-budget');
} else {
  console.log('\nNothing to change.');
}
