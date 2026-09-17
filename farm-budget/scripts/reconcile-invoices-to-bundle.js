#!/usr/bin/env node
/**
 * Reconcile invoiceQtyTotal / invoiceCostTotal against the DeLong invoice PDFs.
 *
 * Source of truth: ~/delong-recon-bundle/invoice_lines.csv — 847 lines parsed
 * from 210 PDFs, tie-out verified. Every one of the 585 invoiced input rows in
 * data.json was compared against it; 437 already agreed.
 *
 * Three kinds of correction, all self-validating:
 *   kind "cost" — quantity already matches the invoice exactly, cost did not.
 *   kind "qty"  — cost already matches exactly, quantity did not.
 *   kind "both" — the invoice QUANTITY had been keyed into the cost field
 *                 (Phillhower cost 13.3 = invoice qty 13.3; Wes's Zidua cost
 *                 0.533 = invoice qty 0.533). Only the five unmistakable cases.
 *
 * NOT included, deliberately — two rows where the disagreement has no clean
 * reading and a person should look:
 *   Brad Inman's "Water" #8003351 — our cost 351.01 is the Interline line's
 *     total; the rows appear shifted against each other.
 *   Larson "Premium Ams" #8003267 — invoice qty is exactly 2x ours and the
 *     invoice total is LOWER than ours by exactly $30.
 *
 * Each row is guarded on BOTH its stored quantity and cost; anything that has
 * changed since the analysis is skipped and reported, never overwritten.
 *
 *   node scripts/reconcile-invoices-to-bundle.js            # dry run + P&L
 *   node scripts/reconcile-invoices-to-bundle.js --apply
 *
 * Run with the server STOPPED (pm2 stop farm-budget), then start it after.
 */
const fs = require('fs');
const path = require('path');
const Calc = require('../public/calc.js');

const APPLY = process.argv.includes('--apply');
const DATA = path.join(__dirname, '..', 'data', 'data.json');
const store = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const FIXES = [
  { id: "inp_mm06qhk5_ktwu", field: "Buchanon", product: "12-0-0-26 Amm Thio", invoice: "8002282", kind: "cost", wasQty: 0.314, wasCost: 385, qty: 0.314, cost: 124.03 },
  { id: "inp_mm06qhk5_v6dd", field: "Carrol", product: "Armezon (6x32 Oz)", invoice: "8003156", kind: "cost", wasQty: 102.3, wasCost: 2148.04, qty: 102.3, cost: 2148.3 },
  { id: "inp_0671", field: "Cuffs", product: "0-0-60 Potash", invoice: "1062267", kind: "cost", wasQty: 11.0801, wasCost: 4960.6, qty: 11.08, cost: 4930.6 },
  { id: "inp_0843", field: "Fox-Kettle", product: "Application - Liquid Pre", invoice: "8002787", kind: "cost", wasQty: 44, wasCost: 429.3, qty: 44.0, cost: 429.0 },
  { id: "inp_0885", field: "Fox-Lemans", product: "Application - Liquid Pre", invoice: "8002286", kind: "cost", wasQty: 14.3, wasCost: 0.26, qty: 14.3, cost: 139.43 },
  { id: "inp_0886", field: "Fox-Lemans", product: "12-0-0-26 Amm Thio", invoice: "8002286", kind: "cost", wasQty: 0.393, wasCost: 395, qty: 0.393, cost: 155.24 },
  { id: "inp_mp7dmc0k_4fv0", field: "Fox-Lemans", product: "Buccaneer 5 Extra", invoice: "8002286", kind: "cost", wasQty: 1.79, wasCost: 41.07, qty: 1.79, cost: 41.17 },
  { id: "inp_0967", field: "Noss, Jeff", product: "Meth Oil, Insource (2.25 Gal)", invoice: "8003207", kind: "cost", wasQty: 3.4, wasCost: 76.5, qty: 3.4, cost: 68.0 },
  { id: "inp_1088", field: "Schultz", product: "0-46-0 Triple Super 15C", invoice: "1061998", kind: "cost", wasQty: 5.694, wasCost: 4626.73, qty: 5.694, cost: 4526.73 },
  { id: "inp_mstdx46u_e70l", field: "Townline", product: "18-46-0", invoice: "1061670", kind: "cost", wasQty: 16.068, wasCost: 13175.73, qty: 16.068, cost: 13175.76 },
  { id: "inp_1327", field: "Delong-Meyer", product: "Forsyte 1.88 SL (2x2.5 Gal)", invoice: "8003346", kind: "cost", wasQty: 10.0905, wasCost: 624.68, qty: 10.09, cost: 524.68 },
  { id: "inp_1330", field: "Delong-Meyer", product: "Premium Ams (51 Lb)", invoice: "8003346", kind: "cost", wasQty: 129.2, wasCost: 742.9, qty: 129.2, cost: 71.06 },
  { id: "inp_mq9umg4s_sjq2", field: "Hoff", product: "Cobra (2x2.5 Gal)", invoice: "8003349", kind: "cost", wasQty: 7.23, wasCost: 54.55, qty: 7.23, cost: 395.12 },
  { id: "inp_mnxjir85_k3aq", field: "Brad Inman's", product: "Interline (250 Gal)", invoice: "8003351", kind: "cost", wasQty: 11.98, wasCost: 778.7, qty: 11.98, cost: 351.01 },
  { id: "inp_1520", field: "Klug Davis", product: "Mauler (2x2.5 Gal)", invoice: "8002674", kind: "cost", wasQty: 3.68, wasCost: 226.16, qty: 3.68, cost: 228.16 },
  { id: "inp_moui216o_kzas", field: "Lake", product: "Ester 2,4-D LV (2x2.5 Gal)", invoice: "8001857", kind: "cost", wasQty: 1.73, wasCost: 36, qty: 1.73, cost: 62.28 },
  { id: "inp_moui3g1f_bk7u", field: "Lake", product: "Veracity Elite II", invoice: "8001857", kind: "cost", wasQty: 0.92, wasCost: 39.31, qty: 0.92, cost: 36.17 },
  { id: "inp_1637", field: "Noss, Torkelson East a.k.a. Noss Pond", product: "Application - Post", invoice: "8003439", kind: "cost", wasQty: 47, wasCost: 540, qty: 47.0, cost: 540.5 },
  { id: "inp_1670", field: "Twist Farm", product: "Mauler (2x2.5 Gal)", invoice: "8002275", kind: "cost", wasQty: 1.35, wasCost: 164.42, qty: 1.35, cost: 221.97 },
  { id: "inp_mpokriao_gsxf", field: "suiter", product: "Sonic", invoice: "8002977", kind: "cost", wasQty: 4.26, wasCost: 64.63, qty: 4.26, cost: 275.32 },
  { id: "inp_mo94c52j_5aab", field: "Daun", product: "Ester 2,4-D LV (2x2.5 Gal)", invoice: "8001933", kind: "cost", wasQty: 1.02, wasCost: 36, qty: 1.02, cost: 36.72 },
  { id: "inp_mo92obf9_k7h1", field: "Daun", product: "Veracity Elite II", invoice: "8001933", kind: "cost", wasQty: 0.55, wasCost: 39.31, qty: 0.55, cost: 21.62 },
  { id: "inp_mo94egl8_158t", field: "Daun", product: "Crop Oil, Insource (2x2.5 Gal)", invoice: "8003352", kind: "cost", wasQty: 1.64, wasCost: 23.05, qty: 1.64, cost: 37.8 },
  { id: "inp_mnxa7njm_otia", field: "Bakke", product: "Veracity Elite II", invoice: "8001856", kind: "cost", wasQty: 1.35, wasCost: 53, qty: 1.35, cost: 53.07 },
  { id: "inp_mpokoc3r_9s14", field: "phillhower east", product: "Wi Tonnage Tax", invoice: "8002974", kind: "cost", wasQty: 3.705, wasCost: 2.46, qty: 3.705, cost: 2.48 },
  { id: "inp_mobovwuu_etqi", field: "Jehovah", product: "Outlook (Bulk)", invoice: "8002283", kind: "cost", wasQty: 1.78, wasCost: 125, qty: 1.78, cost: 222.5 },
  { id: "inp_movynptu_iovq", field: "Jehovah", product: "Dicamba DMA", invoice: "8002283", kind: "cost", wasQty: 0.71, wasCost: 50.28, qty: 0.71, cost: 35.7 },
  { id: "inp_movypywb_2lcz", field: "Jehovah", product: "Wi Tonnage Tax", invoice: "8002283", kind: "cost", wasQty: 0.628, wasCost: 0.67, qty: 0.626, cost: 0.42 },
  { id: "inp_mok4d4be_t2c6", field: "Wes's", product: "Mauler (2x2.5 Gal)", invoice: "8002274", kind: "cost", wasQty: 1.59, wasCost: 164.42, qty: 1.59, cost: 261.43 },
  { id: "inp_mq71lgrw_83bh", field: "Wes's", product: "Application - Liquid Pre", invoice: "8002281", kind: "cost", wasQty: 1, wasCost: 11.06, qty: 1.0, cost: 9.75 },
  { id: "inp_mq71lgrw_md8y", field: "Wes's", product: "12-0-0-26 Amm Thio", invoice: "8002281", kind: "cost", wasQty: 0.028, wasCost: 11.6, qty: 0.028, cost: 11.06 },
  { id: "inp_mq9ymz93_w8bw", field: "Wes's", product: "Dicamba DMA", invoice: "8002281", kind: "cost", wasQty: 0.03, wasCost: 50.28, qty: 0.03, cost: 1.51 },
  { id: "inp_0519", field: "Blue's", product: "Atrazine 4L", invoice: "8003260", kind: "qty", wasQty: 16.68, wasCost: 303.84, qty: 16.88, cost: 303.84 },
  { id: "inp_mm89sw6j_d4gp", field: "Buchanon", product: "Miravis ace (2x2.5 gal)", invoice: "8003075", kind: "qty", wasQty: 4.6, wasCost: 1096.2, qty: 4.06, cost: 1096.2 },
  { id: "inp_mm06qhk5_dkrx", field: "Carrol", product: "Atrazine 4L", invoice: "8003156", kind: "qty", wasQty: 17.5, wasCost: 306.9, qty: 17.05, cost: 306.9 },
  { id: "inp_0767", field: "Fagan", product: "Application - Liquid Pre", invoice: "8002284", kind: "qty", wasQty: 11.3, wasCost: 108.52, qty: 11.13, cost: 108.52 },
  { id: "inp_mppvuvfn_1ims", field: "Fox-Kettle", product: "Wi Tonnage Tax", invoice: "1062000", kind: "qty", wasQty: 490, wasCost: 3.28, qty: 4.9, cost: 3.28 },
  { id: "inp_1187", field: "Delong- Christpherson", product: "0-0-60 Potash", invoice: "1062124", kind: "qty", wasQty: 3.59, wasCost: 1642.05, qty: 3.69, cost: 1642.05 },
  { id: "inp_1216", field: "Gessley", product: "Verdict (Bulk)", invoice: "8002473", kind: "qty", wasQty: 19.9, wasCost: 3531.65, qty: 19.09, cost: 3531.65 },
  { id: "inp_1299", field: "Airport", product: "0-0-60 Potash", invoice: "1061814", kind: "qty", wasQty: 15.397, wasCost: 4560.36, qty: 10.248, cost: 4560.36 },
  { id: "inp_mqb8x186_kgb4", field: "Noss, Torkelson East a.k.a. Noss Pond", product: "Interline (250 Gal)", invoice: "8003439", kind: "qty", wasQty: 11.7, wasCost: 344.28, qty: 11.75, cost: 344.28 },
  { id: "inp_mok4d4be_g0y0", field: "Wes's", product: "Crop Oil, Insource (2x2.5 Gal)", invoice: "8003275", kind: "qty", wasQty: 5.461, wasCost: 68.85, qty: 5.1, cost: 68.85 },
  { id: "inp_mq71lgrw_ipyx", field: "Wes's", product: "Verdict (Bulk)", invoice: "8002281", kind: "qty", wasQty: 1, wasCost: 18.5, qty: 0.1, cost: 18.5 },
  { id: "inp_mppzskba_s4yu", field: "Phillhower West", product: "0-46-0 Triple Super 15C", invoice: "1062226", kind: "both", wasQty: 0.077, wasCost: 13.3, qty: 13.3, cost: 10573.5 },
  { id: "inp_1521", field: "Klug Davis", product: "Sonic (2x7.5 Lb)", invoice: "8002674", kind: "both", wasQty: 5.31, wasCost: 51, qty: 24.55, cost: 1252.05 },
  { id: "inp_mok4d4be_ze5e", field: "Wes's", product: "Application - Liquid Pre", invoice: "8002274", kind: "both", wasQty: 14334, wasCost: 9.75, qty: 34.0, cost: 331.5 },
  { id: "inp_mrjob34b_7txh", field: "Wes's", product: "Zidua sc", invoice: "8003275", kind: "both", wasQty: 34, wasCost: 0.533, qty: 0.533, cost: 303.81 },
  { id: "inp_1780", field: "Daun", product: "Application - Liquid Pre", invoice: "8001933", kind: "both", wasQty: 11, wasCost: 9.75, qty: 10.9, cost: 106.28 },
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
for (const f of store.fields || []) for (const inp of f.inputs || []) if (inp.id) byId.set(inp.id, inp);

const before = (store.fields || []).map(fieldCost);
const applied = [], skipped = [];
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.02;
for (const fx of FIXES) {
  const inp = byId.get(fx.id);
  if (!inp) { skipped.push({ ...fx, why: 'input id not found' }); continue; }
  if (!near(inp.invoiceQtyTotal, fx.wasQty) || !near(inp.invoiceCostTotal, fx.wasCost)) {
    skipped.push({ ...fx, why: `now qty=${inp.invoiceQtyTotal} cost=${inp.invoiceCostTotal} — changed since analysis` });
    continue;
  }
  inp.invoiceQtyTotal = fx.qty;
  inp.invoiceCostTotal = fx.cost;
  applied.push(fx);
}
const after = (store.fields || []).map(fieldCost);

const pad = (v, n) => String(v == null ? '' : v).slice(0, n).padEnd(n);
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${applied.length} rows, ${skipped.length} skipped\n`);
console.log(pad('field', 14) + pad('product', 26) + 'invoice'.padStart(9) + 'qty'.padStart(10) + 'cost'.padStart(11) + '  kind');
let delta = 0;
for (const f of applied) {
  delta += f.cost - f.wasCost;
  const q = f.qty === f.wasQty ? String(f.qty) : `${f.wasQty}->${f.qty}`;
  const c = f.cost === f.wasCost ? String(f.cost) : `${f.wasCost}->${f.cost}`;
  console.log(pad(f.field, 14) + pad(f.product, 26) + String(f.invoice).padStart(9) + q.padStart(10) + c.padStart(11) + '  ' + f.kind);
}
console.log(`\nnet cost change: $${delta.toFixed(2)}`);
if (skipped.length) {
  console.log('\n-- skipped --');
  for (const s of skipped) console.log('  ' + pad(s.field, 14) + pad(s.product, 24) + s.why);
}
console.log('\nP&L impact by field:');
let tb = 0, ta = 0;
(store.fields || []).forEach((f, i) => {
  tb += before[i]; ta += after[i];
  if (Math.abs(after[i] - before[i]) > 0.5)
    console.log('  ' + pad(f.name, 26) + before[i].toFixed(2).padStart(13) + after[i].toFixed(2).padStart(13) + (after[i] - before[i]).toFixed(2).padStart(12));
});
console.log('  ' + pad('ALL FIELDS', 26) + tb.toFixed(2).padStart(13) + ta.toFixed(2).padStart(13) + (ta - tb).toFixed(2).padStart(12));

if (APPLY) {
  const backup = DATA + '.bak.' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA, backup);
  fs.writeFileSync(DATA, JSON.stringify(store, null, 2));
  console.log(`\nWrote ${DATA}\nBackup: ${backup}`);
} else {
  console.log('\nNo changes written. Re-run with --apply to write.');
}
