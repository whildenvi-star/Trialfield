#!/usr/bin/env node
'use strict';

// Apply the corrections the book settles. Dry-run by default.
//
//   node scripts/audit-invoice-book-reconcile.js --recon <dir> --json > audit.json
//   node scripts/apply-book-corrections-2026-09-17.js --audit audit.json --data <path> [--write]
//
// It consumes the AUDIT'S OWN OUTPUT rather than a transcribed list, so what is
// written is what was reviewed. Stop farm-budget before writing: the server
// holds data.json in memory and overwrites on its next save.
//
// Four classes, exactly the ones proposed in recon/02-book-reconcile.md. The
// other findings — 77 acreage drifts, the cent-level rounding, 31 quantity
// disagreements and the five unresolved strays — are deliberately NOT applied.
//
//   1. invoice numbers that resolve on content (the number only, never the date)
//   2. costs stored as the line's unit price
//   3. acreages and quantities off by a clean factor of ten
//   4. one named cost gap: Noss Sid's Resicore

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const AUDIT = arg('audit', null);
const DATA = arg('data', path.join(__dirname, '..', 'data', 'data.json'));
const WRITE = argv.includes('--write');
if (!AUDIT) { console.error('--audit <json from audit-invoice-book-reconcile.js --json> is required'); process.exit(1); }

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// Rows are addressed by their input id, never by index — the audit and the
// write may be minutes apart and the operator may have been editing.
const rowById = {};
(data.fields || []).forEach(f => (f.inputs || []).forEach(r => { rowById[r.id] = { row: r, field: f }; }));

let changes = 0, skipped = 0;
const money = n => '$' + Number(n || 0).toFixed(2);
function set(id, key, value, label) {
  const hit = rowById[id];
  if (!hit) { console.log('    !! input ' + id + ' is gone — skipped'); skipped++; return; }
  const before = hit.row[key];
  if (JSON.stringify(before) === JSON.stringify(value)) return;
  console.log('    ' + label + ': ' + JSON.stringify(before) + ' -> ' + JSON.stringify(value));
  if (WRITE) hit.row[key] = value;
  changes++;
}
// a clean factor of ten, the signature of a slipped decimal
function scaleFactor(stored, book) {
  if (!(stored > 0) || !(book > 0)) return null;
  const r = stored / book;
  for (const f of [100, 10, 0.1, 0.01]) if (Math.abs(r - f) / f < 0.02) return f;
  return null;
}

console.log(WRITE ? 'APPLYING' : 'DRY RUN — nothing will be written');
console.log('data:  ' + DATA);
console.log('audit: ' + AUDIT + '\n');

// ── 1. invoice numbers ──────────────────────────────────────────
console.log('══ 1. invoice numbers that resolve on content ══');
(audit.typos || []).filter(t => t.target).forEach(t => {
  console.log('  ' + t.stored + ' -> ' + t.target + '   ' + t.fieldName + ' / ' + t.crop +
    '   ' + t.rows + ' row' + (t.rows > 1 ? 's' : '') + '   (' + t.dayGap + 'd, "' + t.targetComments + '")');
  // The NUMBER only. The stored date is deliberately left alone: across the
  // book 161 rows sit one to six days before their invoice date, which is the
  // signature of the date being the APPLICATION date — DeLong bills a few days
  // after the sprayer runs. Overwriting it with the invoice date would trade a
  // figure that says when the pass happened for one that says when it was
  // billed, and the first is the one the agronomy needs.
  t.inputIds.forEach(id => set(id, 'invoiceNumber', t.target, 'invoiceNumber'));
});

// ── 2. cost stored as the unit price ────────────────────────────
console.log('\n══ 2. cost stored as the line\'s unit price ══');
const rateRows = (audit.rates || []).filter(r => r.kind === 'rate-as-total');
rateRows.forEach(r => {
  console.log('  ' + String(r.invoice).padEnd(10) + String(r.fieldName).slice(0, 20).padEnd(22) +
    String(r.productName).slice(0, 28).padEnd(30) + money(r.stored) + ' -> ' + money(r.book));
  set(r.inputId, 'invoiceCostTotal', Math.round(r.book * 100) / 100, 'invoiceCostTotal');
});
console.log('  net ' + money(rateRows.reduce((s, r) => s + r.gap, 0)));

// ── 3. slipped decimals ─────────────────────────────────────────
console.log('\n══ 3. acreage and quantity off by a clean factor of ten ══');
(audit.acres || []).forEach(a => {
  const f = scaleFactor(a.stored, a.book);
  if (!f) return;
  console.log('  ' + String(a.invoice).padEnd(10) + String(a.fieldName).slice(0, 20).padEnd(22) +
    String(a.productName).slice(0, 28).padEnd(30) + a.stored + ' -> ' + a.book + '  (×' + f + ')');
  set(a.inputId, 'invoiceAcres', a.book, 'invoiceAcres');
});
(audit.qtys || []).forEach(q => {
  const f = scaleFactor(q.stored, q.book);
  if (!f) return;
  console.log('  ' + String(q.invoice).padEnd(10) + String(q.fieldName).slice(0, 20).padEnd(22) +
    String(q.productName).slice(0, 28).padEnd(30) + q.stored + ' -> ' + q.book + '  (×' + f + ')');
  set(q.inputId, 'invoiceQtyTotal', q.book, 'invoiceQtyTotal');
});

// ── 4. the one named cost gap ───────────────────────────────────
// Whitelisted by invoice and product rather than by a rule, because it is the
// only member of its class that was reviewed. The other 23 cost gaps stay.
console.log('\n══ 4. Noss Sid\'s Resicore — the largest single gap ══');
(audit.rates || []).filter(r => r.kind !== 'rate-as-total')
  .filter(r => r.invoice === '8001984' && /resicore/i.test(r.productName))
  .forEach(r => {
    console.log('  ' + r.fieldName + ' / ' + r.crop + '  ' + r.productName + '  ' +
      money(r.stored) + ' -> ' + money(r.book));
    set(r.inputId, 'invoiceCostTotal', Math.round(r.book * 100) / 100, 'invoiceCostTotal');
  });

console.log('\n' + (WRITE ? 'WRITTEN' : 'DRY RUN') + ': ' + changes + ' changes' +
  (skipped ? ', ' + skipped + ' skipped (row no longer present)' : ''));
if (!WRITE) { console.log('re-run with --write to apply'); process.exit(0); }
fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
console.log('done');
