#!/usr/bin/env node
'use strict';

// Read-only: reconcile every invoice-sourced input row against the DeLong book.
//
// Writes nothing. Opens data.json and the recon bundle's CSVs, prints a report.
//
//   node scripts/audit-invoice-book-reconcile.js --recon <dir> [--data path] [--json]
//
// The bundle (delong-recon-bundle/) holds invoices.csv and invoice_lines.csv,
// parsed from the PDFs — 210 invoices, 847 lines. That IS the paperwork, so the
// three defect classes below can be settled from it without finding the paper:
//
//   TYPO      the stored invoice number is not in the book, but exactly one
//             book number is one digit away, or contains it
//   RATE      the stored cost equals the line's UNIT PRICE, not its extended
//             amount — "$218.53" for 3.05 gal of Huskie that billed $666.52
//   QTY       the stored quantity disagrees with the book's
//   ACRES     the stored invoiceAcres disagrees with the invoice header
//
// A row is matched to its book line by invoice number plus product, with pack
// size stripped ("Ester 2,4-D LV6 (265 Gal)" is our "Ester 2,4-D LV (2x2.5
// Gal)"), reusing the matcher's own name normalising so this agrees with what
// intake would do.

const fs = require('fs');
const path = require('path');
const match = require('../lib/docintake/match');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const DATA = path.resolve(arg('data', path.join(__dirname, '..', 'data', 'data.json')));
const RECON = arg('recon', null);
const AS_JSON = argv.includes('--json');
if (!RECON) { console.error('--recon <delong-recon-bundle dir> is required'); process.exit(1); }

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

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const invoices = readCsv(path.join(path.resolve(RECON), 'invoices.csv'));
const lines = readCsv(path.join(path.resolve(RECON), 'invoice_lines.csv'));

const bookInv = {}; invoices.forEach(v => bookInv[v.invoice_no] = v);
const bookLines = {};
lines.forEach(l => (bookLines[l.invoice_no] = bookLines[l.invoice_no] || []).push(l));

const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; };
const money = n => (n == null ? '—' : '$' + Number(n).toFixed(2));

// Which real invoice number is this stored one a typo of? Only answers when
// exactly one candidate fits, so an ambiguous stray stays unresolved rather
// than being "corrected" to a guess.
function typoTarget(stored) {
  if (bookInv[stored]) return null;
  const hits = Object.keys(bookInv).filter(real => {
    if (stored.length > real.length && stored.indexOf(real) >= 0) return true;  // 10061713 -> 1061713
    for (let i = 0; i < real.length; i++) {
      if (real.slice(0, i) + real.slice(i + 1) === stored) return true;         // 8004593 -> 800593
    }
    return false;
  });
  return hits.length === 1 ? hits[0] : null;
}

const typos = [], rates = [], qtys = [], acres = [], unmatched = [];

(data.fields || []).forEach((f, fi) => {
  (f.inputs || []).forEach((r, ri) => {
    if (!r.invoiceNumber) return;
    const stored = String(r.invoiceNumber);
    const where = { fieldIndex: fi, fieldId: f.id, fieldName: f.name, crop: f.crop, rowIndex: ri, inputId: r.id, productName: r.productName };

    if (!bookInv[stored]) {
      const target = typoTarget(stored);
      typos.push(Object.assign({ stored, target, cost: num(r.invoiceCostTotal) }, where));
      if (!target) return;
    }
    const invNo = bookInv[stored] ? stored : typoTarget(stored);
    if (!invNo) return;

    // header acres
    const hdr = num(bookInv[invNo].header_acres);
    const stAc = num(r.invoiceAcres);
    if (hdr != null && stAc != null && Math.abs(hdr - stAc) > 0.05) {
      acres.push(Object.assign({ invoice: invNo, stored: stAc, book: hdr }, where));
    }

    // the line itself
    // Exact core-name equality is too strict for this paperwork: the book says
    // "Enlist One (250 Gal)" where we say "Enlist", and "Crop Oil (Tote)" where
    // we say "Crop Oil, Insource (2x2.5 Gal)". Use the matcher's own ranking so
    // this agrees with what intake would pair up, instead of inventing a second
    // and stricter opinion.
    const pool = (bookLines[invNo] || []).map(l => ({ name: l.description, _line: l }));
    let cands = pool.filter(p => match.coreName(p.name) === match.coreName(r.productName)).map(p => p._line);
    if (!cands.length) {
      cands = match.matchProducts(pool, r.productName).map(c => c.item._line);
    }
    if (!cands.length) { unmatched.push(Object.assign({ invoice: invNo }, where)); return; }
    // when an invoice bills one product twice, prefer the line whose quantity agrees
    const stQty = num(r.invoiceQtyTotal);
    let L = cands[0];
    if (cands.length > 1 && stQty != null) {
      L = cands.reduce((best, c) =>
        Math.abs(num(c.qty) - stQty) < Math.abs(num(best.qty) - stQty) ? c : best, cands[0]);
    }

    const ext = num(L.extended), unit = num(L.unit_price), stCost = num(r.invoiceCostTotal);
    if (stCost != null && ext != null && Math.abs(stCost - ext) > 0.01) {
      const isRate = unit != null && Math.abs(stCost - unit) <= 0.01 && Math.abs(unit - ext) > 0.01;
      rates.push(Object.assign({
        invoice: invNo, stored: stCost, book: ext, unitPrice: unit,
        kind: isRate ? 'rate-as-total' : 'differs', gap: ext - stCost
      }, where));
    }
    const bQty = num(L.qty);
    if (stQty != null && bQty != null && Math.abs(stQty - bQty) > 0.005) {
      qtys.push(Object.assign({ invoice: invNo, stored: stQty, book: bQty, unit: L.unit }, where));
    }
  });
});

if (AS_JSON) {
  console.log(JSON.stringify({ data: DATA, typos, rates, qtys, acres, unmatched }, null, 2));
  process.exit(0);
}

console.log('Invoice rows against the DeLong book');
console.log('  data: ' + DATA);
console.log('  book: ' + invoices.length + ' invoices, ' + lines.length + ' lines\n');

const rateOnly = rates.filter(r => r.kind === 'rate-as-total');
const differs = rates.filter(r => r.kind !== 'rate-as-total');

console.log('── invoice numbers not in the book — ' + typos.length + ' rows ──────────');
typos.forEach(t => console.log('  ' + String(t.stored).padEnd(12) + String(t.fieldName).slice(0, 22).padEnd(24) +
  String(t.productName).slice(0, 30).padEnd(32) + (t.target ? '-> ' + t.target : '** no single candidate **')));
console.log('  ' + typos.filter(t => t.target).length + ' resolve to exactly one book invoice, ' +
  typos.filter(t => !t.target).length + ' do not.\n');

console.log('── cost stored as the UNIT PRICE — ' + rateOnly.length + ' rows, ' +
  money(rateOnly.reduce((s, r) => s + r.gap, 0)) + ' understated ──────────');
rateOnly.forEach(r => console.log('  ' + String(r.invoice).padEnd(10) + String(r.fieldName).slice(0, 20).padEnd(22) +
  String(r.productName).slice(0, 28).padEnd(30) + money(r.stored).padStart(11) + ' -> ' + money(r.book).padStart(11)));

console.log('\n── cost disagrees for another reason — ' + differs.length + ' rows, ' +
  money(differs.reduce((s, r) => s + r.gap, 0)) + ' net ──────────');
differs.forEach(r => console.log('  ' + String(r.invoice).padEnd(10) + String(r.fieldName).slice(0, 20).padEnd(22) +
  String(r.productName).slice(0, 28).padEnd(30) + money(r.stored).padStart(11) + ' -> ' + money(r.book).padStart(11)));

console.log('\n── quantity disagrees — ' + qtys.length + ' rows ──────────');
qtys.forEach(q => console.log('  ' + String(q.invoice).padEnd(10) + String(q.fieldName).slice(0, 20).padEnd(22) +
  String(q.productName).slice(0, 28).padEnd(30) + String(q.stored).padStart(10) + ' -> ' + String(q.book).padStart(10) + ' ' + (q.unit || '')));

// A stored acreage that is ten or a hundred times the header is a decimal
// slipped in typing — 1299 for 129.9. Anything else is the ordinary disagreement
// between what the sprayer billed and what the enterprise measures, which is
// not a defect and must not be "corrected" into one.
function scaleOf(a) {
  if (!(a.stored > 0) || !(a.book > 0)) return null;
  const r = a.stored / a.book;
  for (const f of [100, 10, 0.1, 0.01]) if (Math.abs(r - f) / f < 0.02) return f;
  return null;
}
const acreScale = acres.filter(a => scaleOf(a));
const acreDrift = acres.filter(a => !scaleOf(a));

console.log('\n── invoiceAcres off by a factor of ten — ' + acreScale.length + ' rows ──────────');
acreScale.forEach(a => console.log('  ' + String(a.invoice).padEnd(10) + String(a.fieldName).slice(0, 20).padEnd(22) +
  String(a.productName).slice(0, 28).padEnd(30) + String(a.stored).padStart(9) + ' -> ' + String(a.book).padStart(9) +
  '   (×' + scaleOf(a) + ')'));

console.log('\n── invoiceAcres drifts from the header — ' + acreDrift.length + ' rows ──────────');
console.log('  Billed acres and enterprise acres legitimately differ; listed for');
console.log('  completeness, not proposed as corrections.');
const driftBy = {};
acreDrift.forEach(a => { const k = a.invoice + ' ' + a.fieldName; (driftBy[k] = driftBy[k] || []).push(a); });
Object.keys(driftBy).slice(0, 20).forEach(k => {
  const g = driftBy[k];
  console.log('  ' + k.slice(0, 32).padEnd(34) + g.length + ' rows   ' + g[0].stored + ' vs ' + g[0].book);
});
if (Object.keys(driftBy).length > 20) console.log('  … ' + (Object.keys(driftBy).length - 20) + ' more invoices');

console.log('\n── row has no matching line on its invoice — ' + unmatched.length + ' rows ──────────');
unmatched.forEach(u => console.log('  ' + String(u.invoice).padEnd(10) + String(u.fieldName).slice(0, 20).padEnd(22) +
  String(u.productName).slice(0, 34)));

console.log('\nTotals: ' + typos.length + ' bad invoice numbers, ' + rateOnly.length + ' rate-as-total (' +
  money(rateOnly.reduce((s, r) => s + r.gap, 0)) + ' missing), ' + differs.length + ' other cost gaps, ' +
  qtys.length + ' quantity gaps, ' + acreScale.length + ' acreage typos, ' + unmatched.length + ' unmatched.');
