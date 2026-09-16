#!/usr/bin/env node
/**
 * Repair invoiceCostTotal on rows where the per-unit PRICE was keyed into the
 * Total $ field instead of the line total.
 *
 * Source of truth: ~/delong-recon-bundle/invoice_lines.csv — 847 lines parsed
 * from 210 DeLong invoice PDFs, tie-out verified (0 failures). Every row below
 * matched on invoice number AND product name AND exact quantity; rows that
 * matched on name but disagreed on quantity were deliberately EXCLUDED and
 * left for a human.
 *
 * Each row is guarded: if the stored cost is no longer the value we expect,
 * that row is skipped and reported rather than overwritten.
 *
 *   node scripts/fix-invoice-rate-as-total.js            # dry run + P&L impact
 *   node scripts/fix-invoice-rate-as-total.js --apply    # write data.json
 *
 * Run with the server STOPPED (pm2 stop farm-budget), then start it after —
 * the server holds data in memory and flushes on SIGTERM.
 */
const fs = require('fs');
const path = require('path');
const Calc = require('../public/calc.js');

const APPLY = process.argv.includes('--apply');
const DATA = path.join(__dirname, '..', 'data', 'data.json');
const store = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const FIXES = [
  { id: "inp_1142", field: "Wes's", product: "Huskie (2x2.5 Gal)", invoice: "1061713", qty: 3.05, was: 218.53, correct: 666.52 },
  { id: "inp_mpptyv1m_wszt", field: "Delong-Meyer", product: "Wi Tonnage Tax", invoice: "1062122", qty: 10.2, was: 0.67, correct: 6.83 },
  { id: "inp_1559", field: "Lake", product: "Application - Liquid Pre", invoice: "8001857", qty: 18.4, was: 9.75, correct: 179.4 },
  { id: "inp_1561", field: "Lake", product: "Sonic (2x7.5 Lb)", invoice: "8001857", qty: 5.75, was: 51, correct: 293.25 },
  { id: "inp_moui0l8n_22mq", field: "Lake", product: "Buccaneer 5 Extra", invoice: "8001857", qty: 4.6, was: 23, correct: 105.8 },
  { id: "inp_1403", field: "Hoff", product: "Application - Liquid Pre", invoice: "8001932", qty: 74, was: 9.75, correct: 721.5 },
  { id: "inp_1405", field: "Hoff", product: "Sonic (2x7.5 Lb)", invoice: "8001932", qty: 23.13, was: 51, correct: 1179.63 },
  { id: "inp_moudnurx_71vx", field: "Hoff", product: "Buccaneer 5 Extra", invoice: "8001932", qty: 20.81, was: 23, correct: 478.63 },
  { id: "inp_moudoytd_qhkn", field: "Hoff", product: "Ester 2,4-D LV (2x2.5 Gal)", invoice: "8001932", qty: 6.94, was: 36, correct: 249.84 },
  { id: "inp_moudqgca_lmjj", field: "Hoff", product: "Veracity Elite II", invoice: "8001932", qty: 3.7, was: 39.31, correct: 145.45 },
  { id: "inp_moudrqga_havy", field: "Hoff", product: "Premium Ams (51 Lb)", invoice: "8001932", qty: 148, was: 0.55, correct: 81.4 },
  { id: "inp_mo948h3j_oroj", field: "Daun", product: "Buccaneer 5 Extra", invoice: "8001933", qty: 2.72, was: 23, correct: 62.79 },
  { id: "inp_1782", field: "Daun", product: "Sonic (2x7.5 Lb)", invoice: "8001933", qty: 3.41, was: 51, correct: 173.91 },
  { id: "inp_mo94f1c2_j8nq", field: "Daun", product: "Premium Ams (51 Lb)", invoice: "8001933", qty: 21.8, was: 0.55, correct: 11.99 },
  { id: "inp_mok4d4be_25w6", field: "Wes's", product: "Sonic (2x7.5 Lb)", invoice: "8002274", qty: 10.63, was: 51, correct: 542.13 },
  { id: "inp_1669", field: "Twist Farm", product: "Application - Liquid Pre", invoice: "8002275", qty: 28.89, was: 9.75, correct: 281.68 },
  { id: "inp_1671", field: "Twist Farm", product: "Sonic (2x7.5 Lb)", invoice: "8002275", qty: 9.03, was: 51, correct: 460.53 },
  { id: "inp_mp5tpbr1_e4wr", field: "Buchanon", product: "Dicamba DMA", invoice: "8002282", qty: 5.7, was: 50.28, correct: 286.6 },
  { id: "inp_mobovwuu_offa", field: "Jehovah", product: "Application - Liquid Pre", invoice: "8002283", qty: 22.75, was: 9.75, correct: 221.81 },
  { id: "inp_mobovwuu_lvlj", field: "Jehovah", product: "Verdict (Bulk)", invoice: "8002283", qty: 2.31, was: 185, correct: 427.35 },
  { id: "inp_1598", field: "Murray", product: "Application - Liquid Pre", invoice: "8002347", qty: 129, was: 9.75, correct: 1257.75 },
  { id: "inp_1600", field: "Murray", product: "Sonic (2x7.5 Lb)", invoice: "8002347", qty: 40.31, was: 51, correct: 2055.81 },
  { id: "inp_1324", field: "Delong-Meyer", product: "Sonic (2x7.5 Lb)", invoice: "8002472", qty: 20.19, was: 51, correct: 1029.69 },
  { id: "inp_mo94oixk_tdvc", field: "Delong-Meyer", product: "Mauler (2x2.5 Gal)", invoice: "8002472", qty: 3.03, was: 62, correct: 187.86 },
  { id: "inp_1322", field: "Delong-Meyer", product: "Application - Liquid Pre", invoice: "8002472", qty: 64.6, was: 9.75, correct: 629.85 },
  { id: "inp_mobovwuu_iar4", field: "Jehovah", product: "Armezon (6x32 Oz)", invoice: "8003210", qty: 17.06, was: 21, correct: 358.26 },
  { id: "inp_mo94fia0_0lbt", field: "Daun", product: "Interline (250 Gal)", invoice: "8003352", qty: 2.73, was: 29.3, correct: 79.99 },
  { id: "inp_mqb5srz2_4v92", field: "Bakke", product: "Enlist", invoice: "8003437", qty: 5.42, was: 75.51, correct: 409.26 },
  { id: "inp_1748", field: "suiter", product: "Application - Post", invoice: "8003438", qty: 15.1, was: 11.5, correct: 173.65 },
  { id: "inp_1640", field: "Noss, Torkelson East a.k.a. Noss Pond", product: "Crop Oil, Insource (2x2.5 Gal)", invoice: "8003439", qty: 7.05, was: 23.05, correct: 162.5 },
];

const refs = () => ({
  products: store.products, implements: store.implements, cropPricing: store.cropPricing,
  cropTypes: store.cropTypes, laborOverhead: store.laborOverhead,
  overheadPools: store.overheadPools || [],
  overheadRates: Calc.computeOverheadRates ? Calc.computeOverheadRates(store.fields, store.overheadPools || []) : undefined,
  seeds: store.seeds, buyers: store.buyers,
});
const fieldCost = (f) => { const b = Calc.computeFieldBudget(f, refs(), store.settings); return b.totalFertCost || 0; };

const byId = new Map();
for (const f of store.fields || []) for (const inp of f.inputs || []) if (inp.id) byId.set(inp.id, { f, inp });

const before = (store.fields || []).map(fieldCost);
const applied = [], skipped = [];
for (const fx of FIXES) {
  const hit = byId.get(fx.id);
  if (!hit) { skipped.push({ ...fx, why: 'input id not found' }); continue; }
  const cur = hit.inp.invoiceCostTotal;
  if (cur == null || Math.abs(cur - fx.was) > 0.005) {
    skipped.push({ ...fx, why: `stored cost is ${cur}, expected ${fx.was} — changed since analysis` });
    continue;
  }
  hit.inp.invoiceCostTotal = fx.correct;
  applied.push(fx);
}
const after = (store.fields || []).map(fieldCost);

const pad = (v, n) => String(v == null ? '' : v).slice(0, n).padEnd(n);
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${applied.length} rows to correct, ${skipped.length} skipped\n`);
console.log(pad('field', 14) + pad('product', 26) + 'invoice'.padStart(10) + 'was'.padStart(10) + 'correct'.padStart(11));
let delta = 0;
for (const f of applied) {
  delta += f.correct - f.was;
  console.log(pad(f.field, 14) + pad(f.product, 26) + String(f.invoice).padStart(10) + String(f.was).padStart(10) + String(f.correct).padStart(11));
}
console.log(`\ncost recovered: $${delta.toFixed(2)}`);

if (skipped.length) {
  console.log('\n-- skipped --');
  for (const s of skipped) console.log('  ' + pad(s.field, 14) + pad(s.product, 24) + s.why);
}

console.log('\nP&L impact by field:');
console.log(pad('field', 26) + 'before'.padStart(14) + 'after'.padStart(14) + 'delta'.padStart(13));
let tb = 0, ta = 0;
(store.fields || []).forEach((f, i) => {
  tb += before[i]; ta += after[i];
  if (Math.abs(after[i] - before[i]) > 0.5)
    console.log(pad(f.name, 26) + before[i].toFixed(2).padStart(14) + after[i].toFixed(2).padStart(14) + (after[i] - before[i]).toFixed(2).padStart(13));
});
console.log(pad('ALL FIELDS', 26) + tb.toFixed(2).padStart(14) + ta.toFixed(2).padStart(14) + (ta - tb).toFixed(2).padStart(13));

if (APPLY) {
  const backup = DATA + '.bak.' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA, backup);
  fs.writeFileSync(DATA, JSON.stringify(store, null, 2));
  console.log(`\nWrote ${DATA}\nBackup: ${backup}`);
} else {
  console.log('\nNo changes written. Re-run with --apply to write.');
}
