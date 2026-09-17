#!/usr/bin/env node
'use strict';

// Phase 0 data corrections, approved 2026-09-16. Dry-run by default.
//
//   node scripts/phase0-writes-2026-09-16.js --data <path> [--data2027 <path>] [--write]
//
// Six independent groups of change. Each prints what it will do and why, and
// nothing is written without --write. Stop the farm-budget process before
// writing: the server holds data.json in memory and would overwrite an
// out-of-band edit on its next save.
//
//   1. seedTrait on 22 soybean enterprises
//   2. the 14 re-homed bean rows keep the corn enterprise's acres and carry
//      acreage in place of product quantity
//   3. Wes's parcel acres, and the double crop's planted acres
//   4. Townline 8004732 — a post-harvest burndown filed as an in-crop pass
//   5. Wes's fungicide: Buchanon's invoice off, Wes's own on, plus two
//      unattached passes
//   6. data-2027.json — Brad Inman's still points at Inman's registry field

const fs = require('fs');
const path = require('path');
// Same helper apply.js uses, so a row written here is indistinguishable from a
// row written by the confirm popover. actualQuantity is in the PRODUCT's
// application unit, not the invoice's — 2.72 gal of Buccaneer over 11 ac is
// 0.99 QUART/ac, not 0.25 — so it cannot be derived by dividing.
const Calc = require('../public/calc.js');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const DATA = arg('data', path.join(__dirname, '..', 'data', 'data.json'));
const DATA2027 = arg('data2027', path.join(__dirname, '..', 'data', 'data-2027.json'));
const WRITE = argv.includes('--write');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = {};
(data.fields || []).forEach(f => byId[f.id] = f);
const productByName = {};
(data.products || []).forEach(p => productByName[p.name] = p);
function product(name) {
  const p = productByName[name];
  if (!p) fail('no product named "' + name + '" in the catalog');
  return p;
}

const log = [];
function note(s) { log.push(s); console.log(s); }
function fail(s) { console.error('ABORT: ' + s); process.exit(1); }
function field(id, expectCrop) {
  const f = byId[id];
  if (!f) fail('no field row ' + id);
  if (expectCrop && f.crop !== expectCrop) fail(id + ' crop is "' + f.crop + '", expected "' + expectCrop + '"');
  return f;
}
const money = n => '$' + Number(n || 0).toFixed(2);

let changes = 0;
function set(obj, key, value, label) {
  const before = obj[key];
  if (JSON.stringify(before) === JSON.stringify(value)) return;
  note('    ' + label + ': ' + JSON.stringify(before) + ' -> ' + JSON.stringify(value));
  if (WRITE) obj[key] = value;
  changes++;
}

// ── 1. seed trait ───────────────────────────────────────────────
// Enlist from the crop name and the E3 varieties; ORGANIC from the crop name;
// CONVENTIONAL for DF 262 and DF 214, which the operator confirmed are
// non-GMO food beans (2026-09-16), and for Hoff's SG seed-grade beans.
note('\n══ 1. seedTrait on the soybean enterprises ══');
const TRAITS = {
  'fld_1305': 'ENLIST_E3',          // Airport
  'fld_1462': 'ENLIST_E3',          // Brad Inman's
  'fld_1652': 'ENLIST_E3',          // Torkelson East
  'fld_1765': 'ENLIST_E3',          // suiter
  'fld_1801': 'ENLIST_E3',          // Daun
  'fld_1836': 'ENLIST_E3',          // Inman
  'fld_1874': 'ENLIST_E3',          // Bakke
  'fld_mtam6v2c_izkh': 'ENLIST_E3', // Wes's double crop
  'fld_mu4cuu70_jrww': 'ENLIST_E3', // Carrol beans
  'fld_mu4cuu70_s2wy': 'ENLIST_E3', // Christopherson beans
  'fld_1343': 'CONVENTIONAL',       // Delong-Meyer   DF 262
  'fld_1384': 'CONVENTIONAL',       // Gessert        DF 214
  'fld_1427': 'CONVENTIONAL',       // Hoff           SG1499H
  'fld_1542': 'CONVENTIONAL',       // Klug Davis     DF 262
  'fld_1581': 'CONVENTIONAL',       // Lake           DF 262
  'fld_1619': 'CONVENTIONAL',       // Murray         DF 262
  'fld_1691': 'CONVENTIONAL',       // Twist Farm     DF 262
  'fld_moblero3_b3gb': 'CONVENTIONAL', // Wes's       DF 262
  'fld_2204': 'ORGANIC',            // OMNI BIG SOUTH
  'fld_2244': 'ORGANIC',            // Goat pasture
  'fld_mnjbla6z_4e0a': 'ORGANIC',   // Simpsons
  'fld_mo1mgsa0_egd7': 'ORGANIC'    // Kopp
};
Object.keys(TRAITS).forEach(id => {
  const f = field(id);
  note('  ' + String(f.name).padEnd(24) + String(f.crop).padEnd(28) +
    ((f.seeds || []).map(s => s.variety || s.name).join('/') || '—'));
  set(f, 'seedTrait', TRAITS[id], 'seedTrait');
});

// ── 2. the re-homed bean rows ───────────────────────────────────
// Moved off the corn rows on 2026-09-16, but they kept the corn enterprise's
// invoiceAcres and carry the acreage where the product quantity belongs — so
// every per-acre figure on both enterprises is out by the ratio of the two
// acreages. Quantities and costs below are the DeLong book's own lines.
note('\n══ 2. the 14 re-homed bean rows — acres and quantities from the book ══');
const BEAN_LINES = {
  'fld_mu4cuu70_jrww': {   // Carrol, invoice 8004409, sprayed 15 ac
    acres: 15,
    lines: {
      'Water': { qty: 225, unit: 'Gal' },
      'Interline (250 Gal)': { qty: 3.75, unit: 'Gal', cost: 109.88 },
      'Enlist': { qty: 3.75, unit: 'Gal', cost: 283.16 },
      'Volunteer (2x2.5 Gal)': { qty: 0.94, unit: 'Gal', cost: 54.21 },
      'Crop Oil, Insource (2x2.5 Gal)': { qty: 2.25, unit: 'Gal', cost: 51.86 },
      'Premium Ams (51 Lb)': { qty: 30, unit: 'Lbs', cost: 27.90 },
      'Application - Post': { qty: 15, unit: 'Acre', cost: 172.50 }
    }
  },
  'fld_mu4cuu70_s2wy': {   // Christopherson, invoice 8004410, sprayed 17 ac
    acres: 17,
    lines: {
      'Water': { qty: 255, unit: 'Gal' },
      'Interline (250 Gal)': { qty: 4.25, unit: 'Gal', cost: 124.53 },
      // stored at 75.51 — the per-gallon RATE, not the extended line
      'Enlist': { qty: 4.25, unit: 'Gal', cost: 320.92 },
      'Volunteer (2x2.5 Gal)': { qty: 1.06, unit: 'Gal', cost: 61.13 },
      'Meth Oil, Insource (2.25 Gal)': { qty: 2.55, unit: 'Gal', cost: 58.78 },
      'Premium Ams (51 Lb)': { qty: 34, unit: 'Lbs', cost: 31.62 },
      'Application - Post': { qty: 17, unit: 'Acre', cost: 195.50 }
    }
  }
};
Object.keys(BEAN_LINES).forEach(id => {
  const f = field(id, 'Enlist Soybeans');
  const spec = BEAN_LINES[id];
  note('  ' + f.name + ' — invoice acres ' + spec.acres);
  (f.inputs || []).forEach(r => {
    const L = spec.lines[r.productName];
    if (!L) { note('    ?? no book line for "' + r.productName + '" — left alone'); return; }
    note('  ' + r.productName);
    set(r, 'invoiceAcres', spec.acres, 'invoiceAcres');
    set(r, 'invoiceQtyTotal', L.qty, 'invoiceQtyTotal');
    if (L.cost != null) set(r, 'invoiceCostTotal', L.cost, 'invoiceCostTotal');
    // `quantity` is the PLANNED rate and is left alone — these rows were
    // created by the move, so their plan is whatever the operator set.
    const p = productByName[r.productName];
    const rate = Calc.invoiceRatePerAcre(p, L.qty, spec.acres, L.unit);
    if (rate != null) set(r, 'actualQuantity', rate, 'actualQuantity (' + ((p && p.unit) || '?') + '/ac)');
  });
});

// ── 3. Wes's acres ──────────────────────────────────────────────
// Three rows carry acres 143 and the double crop carries 25; the registry
// says the parcel is 90. Everywhere else on a shared parcel every enterprise
// carries the parcel figure (Gessert 364.8 on all three, Buchanon 48 on both).
note('\n══ 3. Wes — parcel acres 90 on all four, double crop planted 39 ══');
[['fld_1156', 'Seed grade Winter Barley', 55],
 ['fld_moblero3_b3gb', 'High Oil Soybeans', 34.7],
 ['fld_mq71nmdz_35ah', 'Yellow Corn', 1],
 ['fld_mtam6v2c_izkh', 'Enlist Soybeans', 39]].forEach(([id, crop, planted]) => {
  const f = field(id, crop);
  note('  ' + String(f.crop).padEnd(28));
  set(f, 'acres', 90, 'acres (parcel, from registry fld_056)');
  set(f, 'plantedAcres', planted, 'plantedAcres');
});

// ── 4. Townline 8004732 ─────────────────────────────────────────
// "Post Harvest Burndown" on rye stubble, correctly on the rye enterprise but
// all six rows filed Post-emerge, so it reads as glyphosate and glufosinate
// sprayed over a standing rye crop. Pre-emerge is where this book files a
// burndown ("Application - Burndown" classifies there).
note('\n══ 4. Townline 8004732 — a burndown filed as an in-crop pass ══');
const town = field('fld_1128', 'Hybrid Seed Rye');
(town.inputs || []).forEach((r, j) => {
  const isThis = String(r.invoiceNumber) === '8004732' || String(r.invoiceNumber) === '2.470';
  if (!isThis) return;
  note('  in[' + j + '] ' + r.productName);
  set(r, 'operationGroup', 'Pre-emerge', 'operationGroup');
  // the DeLco line carries its own QUANTITY in the invoice-number field
  if (String(r.invoiceNumber) === '2.470') set(r, 'invoiceNumber', '8004732', 'invoiceNumber (was the quantity)');
  if (r.productName === 'Ester 2,4-D LV (2x2.5 Gal)') set(r, 'invoiceQtyTotal', 16.71, 'invoiceQtyTotal (book says 16.710)');
});

// ── 5. Wes's fungicide and the two unattached passes ────────────
// 8003075 is BUCHANON's rye fungicide (40 ac, "Fungicide on Rye at Flagleaf").
// It is confirmed on Buchanon's rye row AND on Wes's barley row with
// Buchanon's own quantities — the same $1,576.62 counted twice. Wes's own
// fungicide invoice, 8002350, is attached nowhere.
note('\n══ 5. Wes — fungicide swap, and two passes that were never attached ══');
const barley = field('fld_1156', 'Seed grade Winter Barley');
const dbl = field('fld_mtam6v2c_izkh', 'Enlist Soybeans');

const removing = (barley.inputs || []).filter(r => String(r.invoiceNumber) === '8003075');
note('  removing Buchanon\'s 8003075 from the barley row (' + removing.length + ' rows, ' +
  money(removing.reduce((s, r) => s + Number(r.invoiceCostTotal || 0), 0)) + '):');
removing.forEach(r => note('    - ' + String(r.productName).padEnd(32) + money(r.invoiceCostTotal)));
if (removing.length !== 3) fail('expected 3 rows on 8003075, found ' + removing.length);
if (WRITE) barley.inputs = (barley.inputs || []).filter(r => String(r.invoiceNumber) !== '8003075');
changes += removing.length;

function newId() {
  return 'inp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function addPass(target, spec) {
  note('  adding invoice ' + spec.invoiceNumber + ' (' + spec.comments + ', ' + spec.acres +
    ' ac) to ' + target.name + ' / ' + target.crop + ':');
  let sum = 0;
  spec.lines.forEach((L, i) => {
    sum += Number(L.cost || 0);
    const p = product(L.product);   // aborts if the name is not in the catalog
    const rate = Calc.invoiceRatePerAcre(p, L.qty, spec.acres, L.unit);
    note('    + ' + String(L.product).padEnd(32) + String(L.qty).padStart(8) + ' ' +
      String(L.unit).padEnd(5) + money(L.cost).padStart(10) +
      '   = ' + (rate == null ? '—' : rate + ' ' + (p.unit || '') + '/ac'));
    const row = {
      id: newId(),
      productName: L.product,
      // an unplanned pass has no planned rate — apply.js writes 0 here too
      quantity: 0,
      season: spec.season,
      operationGroup: spec.group,
      passStatus: 'confirmed',
      confirmedDate: spec.date,
      statusNote: spec.comments,
      confirmedBy: null,
      invoiceNumber: spec.invoiceNumber,
      invoiceVendor: 'Delongs',
      invoiceDate: spec.date,
      invoiceAcres: spec.acres,
      invoiceQtyTotal: Calc.round4(L.qty),
      invoiceCostTotal: L.cost == null ? null : Calc.round2(L.cost),
      invoiceUnit: L.unit,
      // the key that makes a later re-apply of this invoice idempotent
      invoiceLineIndex: i,
      actualQuantity: rate != null ? rate : 0
    };
    if (WRITE) (target.inputs = target.inputs || []).push(row);
    changes++;
  });
  note('    = ' + money(sum) + ' (book subtotal ' + money(spec.subtotal) + ')');
  if (Math.abs(sum - spec.subtotal) > 0.01) fail('lines do not sum to the invoice subtotal');
}

addPass(barley, {
  invoiceNumber: '8002350', date: '2026-05-06', acres: 56, subtotal: 2208.89,
  comments: 'Fungicde on Barley', season: 'Spring', group: 'Fungicide',
  lines: [
    { product: 'Miravis ace (2x2.5 gal)', qty: 5.69, unit: 'Gal', cost: 1536.30 },
    { product: 'Surfactant, Insource', qty: 1.40, unit: 'Gal', cost: 28.59 },
    { product: 'Application - Post', qty: 56, unit: 'Acre', cost: 644.00 }
  ]
});

addPass(dbl, {
  invoiceNumber: '8004257', date: '2026-07-08', acres: 25, subtotal: 1021.99,
  comments: '2nd Post Trip', season: 'Spring', group: 'Post-emerge',
  lines: [
    { product: 'Water', qty: 375, unit: 'Gal', cost: 0 },
    { product: 'Buccaneer 5 Extra', qty: 6.25, unit: 'Gal', cost: 143.75 },
    { product: 'Enlist', qty: 6.25, unit: 'Gal', cost: 471.94 },
    { product: 'Veracity Elite II', qty: 1.88, unit: 'Gal', cost: 72.30 },
    { product: 'Premium Ams (51 Lb)', qty: 50, unit: 'Lbs', cost: 46.50 },
    { product: 'Application - Post', qty: 25, unit: 'Acre', cost: 287.50 }
  ]
});

addPass(barley, {
  invoiceNumber: '8004735', date: '2026-08-10', acres: 31, subtotal: 839.53,
  comments: 'Post Harvest Burndown', season: 'Spring', group: 'Pre-emerge',
  lines: [
    { product: 'Durango DMA (Bulk)', qty: 3.88, unit: 'Gal', cost: 106.27 },
    { product: 'Interline (250 Gal)', qty: 7.75, unit: 'Gal', cost: 227.08 },
    { product: 'Ester 2,4-D LV (2x2.5 Gal)', qty: 1.94, unit: 'Gal', cost: 69.84 },
    { product: 'Veracity Elite II', qty: 1.55, unit: 'Gal', cost: 60.93 },
    { product: 'Premium Ams (51 Lb)', qty: 62, unit: 'Lbs', cost: 57.66 },
    { product: 'Application - Liquid Pre', qty: 31, unit: 'Acre', cost: 317.75 }
  ]
});

// ── 6. the 2027 plan ────────────────────────────────────────────
note('\n══ 6. data-2027.json — Brad Inman\'s registry link ══');
let plan2027 = null, plan2027Changed = 0;
try {
  plan2027 = JSON.parse(fs.readFileSync(DATA2027, 'utf8'));
} catch (e) {
  note('  ' + DATA2027 + ' not readable here — skipped (' + e.code + ')');
}
if (plan2027) {
  (plan2027.fields || []).forEach(f => {
    if (/brad/i.test(f.name || '') && f.registryFieldId === 'fld_027') {
      note('  ' + f.name + ' / ' + f.crop);
      note('    registryFieldId: "fld_027" -> "fld_028"');
      if (WRITE) f.registryFieldId = 'fld_028';
      plan2027Changed++;
    }
  });
  if (!plan2027Changed) note('  nothing to change');
}

// ── write ───────────────────────────────────────────────────────
console.log('\n' + (WRITE ? 'WRITTEN' : 'DRY RUN') + ': ' + changes + ' changes to ' + DATA +
  (plan2027Changed ? ', ' + plan2027Changed + ' to ' + DATA2027 : ''));
if (!WRITE) { console.log('re-run with --write to apply'); process.exit(0); }

fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
if (plan2027Changed) fs.writeFileSync(DATA2027, JSON.stringify(plan2027, null, 2));
console.log('done');
