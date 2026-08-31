#!/usr/bin/env node
// Correct fertilizer analyses that contradict the product's own name.
//
// A name like "18-46-0 DAP" states its analysis outright, so a stored P2O5 of
// zero on that row is a typo, not data. These skew anything that prices by
// nutrient — straw removal was picking 21-0-0 AMS as its phosphorus source
// because DAP's 46% had been typed onto the AMS row.
//
// Only rows whose name carries an explicit N-P-K triple are touched, and only
// where the stored value disagrees by more than 2 points.
//
//   node scripts/fix-analysis-typos.js --dry   # preview
//   node scripts/fix-analysis-typos.js         # apply

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');
const NPK_IN_NAME = /^\s*(\d{1,2})-(\d{1,2})-(\d{1,2})/;
const TOLERANCE = 0.02;

const dry = process.argv.includes('--dry');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let touched = 0;

(data.products || []).forEach(p => {
  const m = NPK_IN_NAME.exec(p.name || '');
  if (!m) return;
  [['p205', Number(m[2]) / 100, 'P₂O₅'], ['k20', Number(m[3]) / 100, 'K₂O']].forEach(([key, expected, label]) => {
    const stored = Number(p[key]) || 0;
    if (Math.abs(expected - stored) <= TOLERANCE) return;
    console.log('  ' + (p.name || '').trim().padEnd(30) + label + '  ' +
      (stored * 100).toFixed(0) + '% → ' + (expected * 100).toFixed(0) + '%');
    p[key] = expected;
    touched++;
  });
});

if (dry) {
  console.log('\n--dry: ' + touched + ' correction(s) would be written, nothing changed');
} else if (touched) {
  const backup = DATA_FILE + '.bak-analysis-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, backup);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('\n' + touched + ' correction(s) written. Backup: ' + path.basename(backup));
  console.log('Restart the app to pick it up:  pm2 restart farm-budget');
} else {
  console.log('\nNothing to correct — every named analysis matches its product.');
}
