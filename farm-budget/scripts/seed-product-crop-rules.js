#!/usr/bin/env node
'use strict';

// Seed store.productCropRules from the built-in table in lib/docintake/crop-fit.js.
//
// The rules are meant to be DATA the owner maintains from the product labels,
// not code. crop-fit.js falls back to its built-in seed while the store has no
// table, which is fine for reading but means an edit would have to be a code
// change. This writes the table into data.json once, after which the file is
// the authority and the built-in copy is never consulted again.
//
//   node scripts/seed-product-crop-rules.js --data <path> [--write] [--force]
//
// Refuses to overwrite an existing table unless --force, so re-running it can
// never discard the owner's edits.

const fs = require('fs');
const path = require('path');
const fit = require('../lib/docintake/crop-fit');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const DATA = arg('data', path.join(__dirname, '..', 'data', 'data.json'));
const WRITE = argv.includes('--write');
const FORCE = argv.includes('--force');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const existing = data.productCropRules;

if (Array.isArray(existing) && existing.length && !FORCE) {
  console.log('store.productCropRules already has ' + existing.length + ' rows — leaving it alone.');
  console.log('re-run with --force to replace it with the built-in seed.');
  process.exit(0);
}

console.log((WRITE ? 'WRITING' : 'DRY RUN') + ' — ' + fit.RULE_SEED.length + ' rules into ' + DATA + '\n');
fit.RULE_SEED.forEach(function (r) {
  console.log('  ' + r.id.padEnd(22) + r.ai.padEnd(20) +
    'crops: ' + (r.families.join(',') || '—'));
  console.log('    ' + (r.products || []).join(', '));
  console.log('    traits: ' + (r.traits === null ? 'any' : (r.traits.length ? r.traits.join(', ') : 'none')) +
    '   burndown ok: ' + (r.burndownOk ? 'yes' : 'no'));
  console.log('    ' + r.note);
});

if (!WRITE) { console.log('\nre-run with --write to apply'); process.exit(0); }

data.productCropRules = JSON.parse(JSON.stringify(fit.RULE_SEED));
fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
console.log('\nwritten: store.productCropRules = ' + data.productCropRules.length + ' rules');
