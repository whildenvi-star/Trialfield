#!/usr/bin/env node
/**
 * Repair actualQuantity on inputs confirmed via invoice entry.
 *
 * Bug: the confirm forms accept a Field Qty in the product's PURCHASE unit
 * (Gal, Ton) but stored actualQuantity as qty/acres without multiplying by
 * conversionRate — so an as-applied rate meant to be 6.4 OZ/ac was stored as
 * 0.05. Fixed in calc.js (Calc.invoiceRatePerAcre) + the three write sites.
 *
 * This backfills rows written before that fix.
 *
 *   node scripts/fix-invoice-actual-units.js            # dry run (default)
 *   node scripts/fix-invoice-actual-units.js --apply    # write data.json
 *
 * Rows whose stored value does NOT match the buggy formula are left alone and
 * reported as SKIP — they were entered some other way and need a human look.
 */
const fs = require('fs');
const path = require('path');
const Calc = require('../public/calc.js');

const APPLY = process.argv.includes('--apply');
const DATA = path.join(__dirname, '..', 'data', 'data.json');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byName = new Map(
  (data.products || []).map((p) => [(p.name || '').trim().toLowerCase(), p])
);

const fixed = [];
const skipped = [];

for (const field of data.fields || []) {
  for (const inp of field.inputs || []) {
    if (inp.passStatus !== 'confirmed') continue;
    const qty = inp.invoiceQtyTotal;
    const acres = inp.invoiceAcres;
    if (!(qty > 0) || !(acres > 0) || inp.actualQuantity == null) continue;

    const prod = byName.get((inp.productName || '').trim().toLowerCase());
    const convRate = (prod && prod.conversionRate) || 1;
    if (convRate === 1) continue;

    // Only touch rows that still carry the buggy value (qty/acres, round2).
    const buggy = Math.round((qty / acres) * 100) / 100;
    const row = {
      field: field.name,
      product: inp.productName,
      unit: prod ? prod.unit : '',
      invoiceUnit: inp.invoiceUnit,
      stored: inp.actualQuantity,
      planned: inp.quantity,
    };
    if (Math.abs(inp.actualQuantity - buggy) > 0.005) {
      skipped.push({ ...row, reason: 'stored value is not the buggy qty/acres' });
      continue;
    }

    const rate = Calc.invoiceRatePerAcre(prod, qty, acres, inp.invoiceUnit);
    if (rate == null) {
      skipped.push({ ...row, reason: 'rate not computable' });
      continue;
    }
    // The script can't tell a correctly-entered purchase-unit total from one
    // typed in application units by mistake. Flag rows whose corrected rate
    // lands far off a real planned rate so they get eyeballed before trusting.
    const planned = inp.quantity;
    const suspect = planned > 1 && (rate > planned * 3 || rate < planned / 3);
    fixed.push({ ...row, corrected: rate, suspect });
    if (APPLY) inp.actualQuantity = rate;
  }
}

const pad = (v, n) => String(v == null ? '' : v).slice(0, n).padEnd(n);
const suspectCount = fixed.filter((r) => r.suspect).length;
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${fixed.length} rows to correct (${suspectCount} marked "check"), ${skipped.length} skipped\n`);
console.log(pad('field', 14) + pad('product', 30) + pad('unit', 7) + 'stored'.padStart(10) + 'corrected'.padStart(12) + 'planned'.padStart(12));
for (const r of fixed) {
  console.log(
    pad(r.field, 14) + pad(r.product, 30) + pad(r.unit, 7) +
    String(r.stored).padStart(10) + String(r.corrected).padStart(12) +
    String(r.planned == null ? '' : Math.round(r.planned * 100) / 100).padStart(12) +
    (r.suspect ? '  <- check' : '')
  );
}
if (skipped.length) {
  console.log('\n-- skipped (needs a human look) --');
  for (const r of skipped) {
    console.log(pad(r.field, 14) + pad(r.product, 30) + ' stored=' + r.stored + '  ' + r.reason);
  }
}

if (APPLY) {
  const backup = DATA + '.bak.' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA, backup);
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${DATA}\nBackup: ${backup}`);
} else {
  console.log('\nNo changes written. Re-run with --apply to write.');
}
