#!/usr/bin/env node
'use strict';

// Builds data/data-2027.json — the 2027 plan — from the live 2026 data.
//
// Rotation (owner's rules, 2026-09-09):
//   Conventional: canning + soybean fields -> Yellow Corn; corn -> Enlist Soybeans.
//   Organic: one step around corn -> soy -> wheat -> corn.
//   Crops outside those rules CARRY FORWARD and are flagged in the report —
//   perennials (Peppermint), small grains (Seed Rye, Kernza, Barley), ORG Peas.
//
// Inputs/passes for the new crop come from a DONOR: the 2026 field growing the
// target crop with the most input lines. Per-acre rates transfer between
// fields; the empty program templates do not. Every 2026 confirmation,
// invoice, and actual is stripped — the plan starts clean.
//
// Refuses to overwrite an existing data-2027.json without --force, because
// once planning starts, that file is the owner's work.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'data.json');
const DST = path.join(__dirname, '..', 'data', 'data-2027.json');

const ROTATION = {
  // conventional: canning + beans -> corn
  'Peas': 'Yellow Corn',
  'Snap Beans': 'Yellow Corn',
  'Lima Beans': 'Yellow Corn',
  'Enlist Soybeans': 'Yellow Corn',
  'High Oil Soybeans': 'Yellow Corn',
  'Non-GMO Seed Grade Beans': 'Yellow Corn',
  'Soybeans': 'Yellow Corn',
  // conventional: corn -> beans
  'Yellow Corn': 'Enlist Soybeans',
  'White corn': 'Enlist Soybeans',
  // organic wheel: corn -> soy -> wheat -> corn
  'ORG Blue Corn': 'ORG Soybeans',
  'ORG Seed Corn': 'ORG Soybeans',
  'Org sweet Corn': 'ORG Soybeans',
  'ORG Soybeans': 'ORG Wheat',
  'ORG Natto Beans': 'ORG Wheat',
  'ORG Wheat': 'ORG Blue Corn',
  'ORG seed wheat': 'ORG Blue Corn'
};

// Fields copied from the donor: the agronomy of growing that crop.
const DONOR_FIELDS = ['yieldPerAcre', 'yieldUnit', 'harvestMoisture', 'cropType', 'buyerId'];
// Confirmation/actual keys stripped from every input/machinery row.
const STRIP = ['passStatus', 'confirmedDate', 'confirmedBy', 'statusNote', 'invoiceNumber',
  'invoiceVendor', 'invoiceDate', 'invoiceAcres', 'invoiceQtyTotal', 'invoiceCostTotal',
  'invoiceUnit', 'invoiceLineIndex', 'actualQuantity'];

function cleanRows(rows) {
  return (rows || []).map(r => {
    const c = Object.assign({}, r);
    STRIP.forEach(k => delete c[k]);
    c.id = c.id ? c.id + '_27' : undefined;
    return c;
  });
}

function main() {
  const force = process.argv.includes('--force');
  if (fs.existsSync(DST) && !force) {
    console.error('REFUSING: ' + DST + ' already exists — it may hold 2027 planning work.');
    console.error('Re-run with --force only if you mean to rebuild the plan from scratch.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  // Donor per crop: the 2026 field of that crop with the most input lines.
  const donorByCrop = {};
  data.fields.forEach(f => {
    const crop = f.crop || '';
    if (!crop) return;
    const cur = donorByCrop[crop];
    if (!cur || (f.inputs || []).length > (cur.inputs || []).length) donorByCrop[crop] = f;
  });

  const report = { rotated: [], carried: [], flagged: [], noDonor: [] };

  data.fields.forEach(f => {
    const from = f.crop || '';
    const to = ROTATION[from];

    if (!to) {
      report.carried.push({ field: f.name, crop: from || '(none)' });
      if (from && !/kernza/i.test(from)) report.flagged.push(f.name + ' stays ' + (from || '(none)') + ' — not covered by the rotation rules');
      // strip actuals but keep the plan rows for carried fields too
      f.inputs = cleanRows(f.inputs);
      f.machinery = cleanRows(f.machinery);
      return;
    }

    const donor = donorByCrop[to];
    if (!donor) {
      report.noDonor.push(f.name + ': no 2026 field grows ' + to);
      return;
    }

    report.rotated.push({ field: f.name, from: from, to: to, donor: donor.name });
    f.crop = to;
    DONOR_FIELDS.forEach(k => { f[k] = donor[k] !== undefined ? donor[k] : f[k]; });
    f.enterpriseId = donor.enterpriseId; // enterprise follows the crop
    f.templateId = null;
    f.inputs = cleanRows(donor.inputs);
    f.machinery = cleanRows(donor.machinery);
    f.seeds = cleanRows(donor.seeds);
    f.seed = donor.seed !== undefined ? donor.seed : f.seed;
  });

  // Year + transactional resets. Reference lists (products, implements,
  // cropPricing, rent, suppliers, programs...) carry forward untouched.
  data.settings.year = 2027;
  data.deliveries = [];
  data.orders = [];
  data.sales = [];
  data.strawSales = [];
  data.inputQuotes = [];

  fs.writeFileSync(DST, JSON.stringify(data, null, 2));

  console.log('WROTE ' + DST);
  console.log('');
  console.log('ROTATED (' + report.rotated.length + '):');
  report.rotated.forEach(r => console.log('  ' + (r.field + '                          ').slice(0, 26) +
    (r.from + ' -> ' + r.to + '                                   ').slice(0, 42) + ' inputs from ' + r.donor));
  console.log('');
  console.log('CARRIED AS-IS (' + report.carried.length + '):');
  report.carried.forEach(r => console.log('  ' + r.field + ' — ' + r.crop));
  if (report.flagged.length) {
    console.log('');
    console.log('NEEDS YOUR EYE:');
    report.flagged.forEach(x => console.log('  ! ' + x));
  }
  if (report.noDonor.length) {
    console.log('');
    console.log('NO DONOR:');
    report.noDonor.forEach(x => console.log('  !! ' + x));
  }
}

main();
