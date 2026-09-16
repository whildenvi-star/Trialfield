#!/usr/bin/env node
'use strict';

// Create the two missing Enlist Soybeans enterprises and re-home the bean
// passes that landed on corn rows because those enterprises did not exist.
//
// Background: invoices 8004409 (Carrol) and 8004410 (Delong- Christpherson)
// are post-emerge bean passes — Enlist One plus Interline, which would kill
// corn — and both were confirmed onto the corn enterprise, because the parcel
// had no bean row for the matcher to find. Recorded in recon/00-enterprise-gaps.md.
//
// Planted acres are the operator's official figures (2026-09-16), not derived:
// Carrol white corn 135.6, Christopherson corn 47.1. They exceed the parcel
// `acres` once beans are added; that is normal — FSA planted, GIS and parcel
// acres never agree, and parcel acres are deliberately left alone.
//
// Usage:
//   node scripts/create-bean-enterprises-2026-09-16.js --data <path> [--write]
// Without --write it prints the plan and changes nothing.

const fs = require('fs');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }
const DATA = arg('data', require('path').join(__dirname, '..', 'data', 'data.json'));
const WRITE = argv.includes('--write');

// Defaults taken from the Enlist peer rows (yield 60 on 5 of 8, gov 70 on 5 of
// 8, insurance 25 on the closest two) — NOT from the program template, whose
// 70 bu came off Inman specifically. Correct these in the editor if wrong.
const TARGETS = [
  {
    cornFieldId: 'fld_0642', cornName: 'Carrol', cornCropExpect: 'White corn',
    cornPlantedAcres: 135.6, beanPlantedAcres: 16.5,
    variety: 'P23Z82E', invoiceNumber: '8004409'
  },
  {
    cornFieldId: 'fld_1195', cornName: 'Delong- Christpherson', cornCropExpect: 'Yellow Corn',
    cornPlantedAcres: 47.1, beanPlantedAcres: 25.4,
    variety: '16Z25E', invoiceNumber: '8004410'
  }
];

const CROP = 'Enlist Soybeans';
const BEAN_ENTERPRISE_ID = 'ent_1272'; // conventional soybean enterprise
const DEFAULTS = {
  systemCode: 'CON',          // every existing Enlist row is CON, not CON IRR
  cropType: 'SINGLE CROP',
  yieldPerAcre: 60, yieldUnit: 'Bu', projectedYieldPerAcre: 60, yieldMode: 'projected',
  cropInsurancePerAcre: 25, insuranceIncomePerAcre: 0,
  govPaymentLabel: 'Delong GCS', govPaymentsPerAcre: 70,
  tariffsPerAcre: 0, harvestMoisture: 0, buyerId: '',
  seedPopulation: 143000
};

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const plan = [];

TARGETS.forEach(function (t) {
  const corn = (data.fields || []).find(function (f) { return f.id === t.cornFieldId; });
  if (!corn) throw new Error('corn field ' + t.cornFieldId + ' not found — aborting');
  if (corn.crop !== t.cornCropExpect) {
    throw new Error(t.cornFieldId + ' crop is "' + corn.crop + '", expected "' +
      t.cornCropExpect + '" — the data has drifted, not guessing');
  }

  const moving = (corn.inputs || []).filter(function (i) {
    return String(i.invoiceNumber) === t.invoiceNumber;
  });
  if (!moving.length) throw new Error('no inputs on ' + t.cornName + ' for invoice ' + t.invoiceNumber);

  const bean = {
    id: newId('fld'),
    enterpriseId: BEAN_ENTERPRISE_ID,
    name: corn.name,
    systemCode: DEFAULTS.systemCode,
    crop: CROP,
    cropType: DEFAULTS.cropType,
    acres: corn.acres,                      // parcel figure, shared with the corn row
    plantedAcres: t.beanPlantedAcres,
    rentPerAcre: corn.rentPerAcre,          // same ground, same rent
    inputs: moving,
    seed: { variety: t.variety, population: DEFAULTS.seedPopulation },
    seeds: [{ variety: t.variety, population: DEFAULTS.seedPopulation, acres: 0 }],
    machinery: [],                          // left empty on purpose — apply the
                                            // Enlist Soybeans Program to populate
    tillage: corn.tillage || null,
    yieldPerAcre: DEFAULTS.yieldPerAcre,
    yieldUnit: DEFAULTS.yieldUnit,
    yieldMode: DEFAULTS.yieldMode,
    projectedYieldPerAcre: DEFAULTS.projectedYieldPerAcre,
    cropInsurancePerAcre: DEFAULTS.cropInsurancePerAcre,
    insuranceIncomePerAcre: DEFAULTS.insuranceIncomePerAcre,
    govPaymentLabel: DEFAULTS.govPaymentLabel,
    govPaymentsPerAcre: DEFAULTS.govPaymentsPerAcre,
    auxPayments: [{ label: DEFAULTS.govPaymentLabel, perAcre: DEFAULTS.govPaymentsPerAcre }],
    tariffsPerAcre: DEFAULTS.tariffsPerAcre,
    harvestMoisture: DEFAULTS.harvestMoisture,
    buyerId: DEFAULTS.buyerId,
    templateId: '',
    machineryProgramId: '',
    registryFieldId: corn.registryFieldId,
    registryFieldName: corn.registryFieldName || null,
    splitGroupId: null,
    dblPartnerFieldId: null,
    rentBasis: corn.rentBasis || 'reported',
    notes: 'Wet-bottom bean zone. Created 2026-09-16 from invoice ' + t.invoiceNumber +
           '; passes re-homed off the ' + corn.crop + ' row.'
  };

  plan.push({
    target: t, corn: corn, bean: bean, moving: moving,
    cornPlantedBefore: corn.plantedAcres, budgetInputIds: moving.map(function (i) { return i.id; })
  });
});

// ── report ──────────────────────────────────────────────────────
console.log('');
console.log(WRITE ? 'APPLYING' : 'DRY RUN — nothing will be written');
console.log('data: ' + DATA);
console.log('');
plan.forEach(function (p) {
  console.log('── ' + p.corn.name + '  [' + p.corn.registryFieldId + ']  parcel ' + p.corn.acres + ' ac');
  console.log('   ' + p.corn.crop + ' planted  ' + p.cornPlantedBefore + ' -> ' + p.target.cornPlantedAcres);
  console.log('   NEW ' + CROP + '  ' + p.bean.plantedAcres + ' ac  var ' + p.bean.seed.variety +
              '  id ' + p.bean.id);
  console.log('   moving ' + p.moving.length + ' input rows off invoice #' + p.target.invoiceNumber + ':');
  p.moving.forEach(function (i) {
    console.log('     - ' + String(i.productName).padEnd(34) +
                '$' + (i.invoiceCostTotal == null ? '0.00' : Number(i.invoiceCostTotal).toFixed(2)) +
                '   budgetInputId=' + i.id);
  });
  console.log('');
});
console.log('cert-side follow-up — these budgetInputIds must be repointed or the');
console.log('old MaterialUsage rows stay on the corn enterprise as duplicates:');
plan.forEach(function (p) {
  console.log('  ' + p.corn.name + ': ' + p.budgetInputIds.join(', '));
});
console.log('');

if (!WRITE) { console.log('re-run with --write to apply'); process.exit(0); }

// ── apply ───────────────────────────────────────────────────────
plan.forEach(function (p) {
  const keep = (p.corn.inputs || []).filter(function (i) {
    return String(i.invoiceNumber) !== p.target.invoiceNumber;
  });
  p.corn.inputs = keep;
  p.corn.plantedAcres = p.target.cornPlantedAcres;
  data.fields.push(p.bean);
});

fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
console.log('written: ' + plan.length + ' enterprises created, ' +
  plan.reduce(function (n, p) { return n + p.moving.length; }, 0) + ' input rows re-homed');
