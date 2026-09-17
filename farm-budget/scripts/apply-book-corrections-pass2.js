#!/usr/bin/env node
'use strict';

// Second pass: the cost and quantity gaps the book settles, each behind a gate
// that an independent number has to agree with. Dry-run by default.
//
//   node scripts/audit-invoice-book-reconcile.js --recon <dir> --json > audit.json
//   node scripts/apply-book-corrections-pass2.js --audit audit.json --recon <dir> --data <path> [--write]
//
// The first pass taught the lesson these gates encode. Matching a stray invoice
// number on farm name, date and products looked airtight and was wrong twice:
// "Noss, Sid" fuzzy-matches "Jeff Noss", and both farms had a Post Corn pass
// the same day carrying the same five products. Only the ACREAGE disagreed —
// 98.92 against 34 — and acreage was the one signal not being consulted.
//
// So nothing here is applied on the say-so of the thing being corrected:
//
//   COST  is corrected only when doing so makes that invoice's stored rows sum
//         to the invoice's own SUBTOTAL. If the rows already sum correctly the
//         proposed fix is wrong, whatever the line comparison says — which is
//         how 1062812 was caught, where "fixing" it would have broken a total
//         that was right.
//
//   QTY   is corrected only on a row whose COST already agrees with the book,
//         and whose acreage is within 15% of the invoice header. A row that is
//         wrong in two ways at once is not safe to half-correct.
//
// Invoices spanning several fields are skipped outright: one subtotal cannot
// settle rows split across two enterprises.

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const AUDIT = arg('audit', null);
const RECON = arg('recon', null);
const DATA = arg('data', path.join(__dirname, '..', 'data', 'data.json'));
const WRITE = argv.includes('--write');
if (!AUDIT || !RECON) { console.error('--audit and --recon are required'); process.exit(1); }

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i]); return o; });
}

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const book = readCsv(path.join(path.resolve(RECON), 'invoices.csv'));
const subtotal = {}, headerAcres = {};
book.forEach(v => { subtotal[v.invoice_no] = parseFloat(v.subtotal); headerAcres[v.invoice_no] = parseFloat(v.header_acres); });

const rowById = {};
data.fields.forEach(f => (f.inputs || []).forEach(r => { rowById[r.id] = { row: r, field: f }; }));

const money = n => '$' + Number(n || 0).toFixed(2);
let changes = 0;

console.log(WRITE ? 'APPLYING' : 'DRY RUN — nothing will be written');
console.log('data: ' + DATA + '\n');

// ── costs, gated on the invoice subtotal ────────────────────────
const costFixes = (audit.rates || []).filter(r => r.kind !== 'rate-as-total');
const byInvoice = {};
costFixes.forEach(r => (byInvoice[r.invoice] = byInvoice[r.invoice] || []).push(r));

// stored totals per invoice, and how many enterprises carry it
const storedTotal = {}, fieldsOn = {};
data.fields.forEach(f => (f.inputs || []).forEach(r => {
  if (!r.invoiceNumber) return;
  const k = String(r.invoiceNumber);
  storedTotal[k] = (storedTotal[k] || 0) + Number(r.invoiceCostTotal || 0);
  (fieldsOn[k] = fieldsOn[k] || new Set()).add(f.name);
}));

console.log('══ costs — only where the fix makes the invoice sum to its subtotal ══');
const acceptedCost = [];
Object.keys(byInvoice).sort().forEach(inv => {
  const group = byInvoice[inv];
  const sub = subtotal[inv];
  const nFields = fieldsOn[inv] ? fieldsOn[inv].size : 0;
  const after = storedTotal[inv] + group.reduce((s, r) => s + (r.book - r.stored), 0);
  const matchesNow = sub != null && Math.abs(storedTotal[inv] - sub) < 0.02;
  const matchesAfter = sub != null && Math.abs(after - sub) < 0.02;

  let verdict;
  if (nFields > 1) verdict = 'SKIP — spans ' + nFields + ' enterprises, one subtotal cannot settle it';
  else if (matchesNow) verdict = 'SKIP — the stored rows ALREADY sum to the subtotal; the fix would break it';
  else if (matchesAfter) { verdict = 'apply'; acceptedCost.push.apply(acceptedCost, group); }
  else verdict = 'SKIP — still ' + money(Math.abs(after - sub)) + ' off after the fix; needs a look';

  console.log('  ' + inv.padEnd(10) + 'subtotal ' + money(sub).padStart(11) +
    '   now ' + money(storedTotal[inv]).padStart(11) + '   after ' + money(after).padStart(11) + '   ' + verdict);
});
console.log('');
acceptedCost.forEach(r => {
  const hit = rowById[r.inputId];
  if (!hit) { console.log('  !! ' + r.inputId + ' is gone — skipped'); return; }
  console.log('  ' + String(r.invoice).padEnd(10) + String(r.fieldName).slice(0, 20).padEnd(22) +
    String(r.productName).slice(0, 26).padEnd(28) + money(r.stored) + ' -> ' + money(r.book));
  if (WRITE) hit.row.invoiceCostTotal = Math.round(r.book * 100) / 100;
  changes++;
});

// ── quantities, gated on the row's cost and acreage ─────────────
console.log('\n══ quantities — only on rows already verified by cost and acreage ══');
const badCost = new Set((audit.rates || []).map(r => r.inputId));
(audit.qtys || []).forEach(q => {
  const hit = rowById[q.inputId];
  if (!hit) return;
  if (badCost.has(q.inputId)) {
    console.log('  skip ' + String(q.invoice).padEnd(9) + String(q.productName).slice(0, 26).padEnd(28) + 'cost disagrees too');
    return;
  }
  const hdr = headerAcres[q.invoice], ac = Number(hit.row.invoiceAcres);
  if (hdr > 0 && ac > 0 && Math.abs(ac - hdr) / hdr > 0.15) {
    console.log('  skip ' + String(q.invoice).padEnd(9) + String(q.productName).slice(0, 26).padEnd(28) +
      'acres ' + ac + ' vs header ' + hdr);
    return;
  }
  console.log('  ' + String(q.invoice).padEnd(10) + String(q.fieldName).slice(0, 20).padEnd(22) +
    String(q.productName).slice(0, 26).padEnd(28) + String(q.stored).padStart(9) + ' -> ' + String(q.book).padStart(9) + ' ' + (q.unit || ''));
  if (WRITE) hit.row.invoiceQtyTotal = q.book;
  changes++;
});

console.log('\n' + (WRITE ? 'WRITTEN' : 'DRY RUN') + ': ' + changes + ' changes');
if (!WRITE) { console.log('re-run with --write to apply'); process.exit(0); }
fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
console.log('done');
