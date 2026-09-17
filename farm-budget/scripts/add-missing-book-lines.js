#!/usr/bin/env node
'use strict';

// Add the invoice lines DeLong billed that were never entered. Dry-run by default.
//
//   node scripts/add-missing-book-lines.js --recon <dir> [--data path] [--write]
//
// Only for invoices that sit on exactly ONE enterprise, because that is the only
// case where where-it-goes is not a judgement. And only when adding the missing
// lines makes the enterprise's rows for that invoice sum to the invoice's own
// SUBTOTAL, to the cent. If it does not close, nothing is added and the invoice
// is listed for a human — a partial add would turn a visible gap into an
// invisible one.
//
// The dominant case is Sparrow. DeLong's post-corn program bills Armezon AND
// Sparrow; only Armezon was ever entered, on six invoices.
//
// Rows are built the way apply.js builds them: quantity 0 (an unplanned pass has
// no planned rate), actualQuantity through Calc.invoiceRatePerAcre so the unit
// conversion is the app's own, and an invoiceLineIndex so a later re-apply of
// the same invoice is idempotent.

const fs = require('fs');
const path = require('path');
const match = require('../lib/docintake/match');
const Calc = require('../public/calc.js');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const RECON = arg('recon', null);
const DATA = arg('data', path.join(__dirname, '..', 'data', 'data.json'));
const WRITE = argv.includes('--write');
if (!RECON) { console.error('--recon is required'); process.exit(1); }

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
const bookLines = {}; lines.forEach(l => (bookLines[l.invoice_no] = bookLines[l.invoice_no] || []).push(l));
const productByName = {}; (data.products || []).forEach(p => productByName[p.name] = p);

// where each invoice currently sits
const placed = {};
data.fields.forEach(f => (f.inputs || []).forEach(r => {
  if (!r.invoiceNumber) return;
  const k = String(r.invoiceNumber);
  (placed[k] = placed[k] || []).push({ row: r, field: f });
}));

const money = n => '$' + Number(n || 0).toFixed(2);
function newId() { return 'inp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Our catalog's name for a billed description. The matcher's ranking, so this
// agrees with what intake would pick; null when nothing is close enough, which
// is a reason to skip the invoice rather than invent a product.
function ourProduct(desc) {
  if (productByName[desc]) return productByName[desc];
  const c = match.matchProducts(data.products || [], desc);
  return c.length && c[0].score >= 0.6 ? c[0].item : null;
}

console.log(WRITE ? 'APPLYING' : 'DRY RUN — nothing will be written');
console.log('data: ' + DATA + '\n');

let added = 0, closed = 0, skipped = 0;

Object.keys(placed).sort().forEach(invNo => {
  const v = bookInv[invNo];
  if (!v) return;
  const group = placed[invNo];
  const fieldNames = new Set(group.map(g => g.field.name));
  if (fieldNames.size > 1) return;                       // split across enterprises
  const field = group[0].field;
  const sub = parseFloat(v.subtotal);
  const storedTotal = group.reduce((s, g) => s + Number(g.row.invoiceCostTotal || 0), 0);
  if (!(sub > 0) || Math.abs(storedTotal - sub) < 0.02) return;   // already reconciles

  // which book lines have no row? exact name first, then the matcher's ranking
  const rows = group.slice();
  const used = new Set(), unpaired = [];
  (bookLines[invNo] || []).forEach((l, i) => {
    const h = rows.find(x => !used.has(x.row.id) && match.coreName(l.description) === match.coreName(x.row.productName));
    if (h) used.add(h.row.id); else unpaired.push({ line: l, index: i });
  });
  const stillMissing = [];
  unpaired.forEach(u => {
    const pool = rows.filter(x => !used.has(x.row.id)).map(x => ({ name: x.row.productName, _x: x }));
    const c = match.matchProducts(pool, u.line.description);
    if (c.length) used.add(c[0].item._x.row.id); else stillMissing.push(u);
  });

  const addSum = stillMissing.reduce((s, u) => s + (parseFloat(u.line.extended) || 0), 0);
  const after = storedTotal + addSum;
  const closes = Math.abs(after - sub) < 0.02;

  console.log('  ' + invNo.padEnd(9) + String(field.name).slice(0, 20).padEnd(22) +
    'stored ' + money(storedTotal).padStart(11) + '  + ' + money(addSum).padStart(10) +
    '  = ' + money(after).padStart(11) + '  vs ' + money(sub).padStart(11) +
    '   ' + (closes ? 'CLOSES' : 'still off — skipped'));

  if (!closes) { skipped++; return; }

  const acres = parseFloat(v.header_acres) || null;
  const date = (function (s) { const m = String(s).match(/(\d+)\/(\d+)\/(\d+)/); return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : null; })(v.invoice_date);
  let ok = true;
  const built = [];
  stillMissing.forEach(u => {
    const p = ourProduct(u.line.description);
    if (!p) { console.log('      !! no product in the catalog matches "' + u.line.description + '" — invoice skipped'); ok = false; return; }
    const qty = parseFloat(u.line.qty);
    const rate = Calc.invoiceRatePerAcre(p, qty, acres, u.line.unit);
    built.push({
      id: newId(),
      productName: p.name,
      quantity: 0,
      season: null,
      operationGroup: null,
      passStatus: 'confirmed',
      confirmedDate: date,
      statusNote: v.comments || null,
      confirmedBy: null,
      invoiceNumber: invNo,
      invoiceVendor: 'Delongs',
      invoiceDate: date,
      invoiceAcres: acres,
      invoiceQtyTotal: Calc.round4(qty),
      invoiceCostTotal: Calc.round2(parseFloat(u.line.extended) || 0),
      invoiceUnit: u.line.unit,
      invoiceLineIndex: u.index,
      actualQuantity: rate != null ? rate : 0
    });
    console.log('      + ' + String(p.name).slice(0, 30).padEnd(32) + String(qty).padStart(9) + ' ' +
      String(u.line.unit).padEnd(5) + money(u.line.extended).padStart(11) +
      (p.name !== u.line.description ? '   (billed as "' + u.line.description + '")' : ''));
  });
  if (!ok) { skipped++; return; }
  if (WRITE) built.forEach(b => field.inputs.push(b));
  added += built.length; closed++;
});

console.log('\n' + (WRITE ? 'WRITTEN' : 'DRY RUN') + ': ' + added + ' lines added across ' + closed +
  ' invoices that now close exactly; ' + skipped + ' invoices left alone.');
if (!WRITE) { console.log('re-run with --write to apply'); process.exit(0); }
fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
console.log('done');
