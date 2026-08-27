#!/usr/bin/env node
// One-off migration: convert 2026 double-crop farms from the symmetric
// both-entries-DBL convention to the pairing convention:
//   - the BASE crop (first crop on the ground) is SINGLE CROP and carries
//     dblSharedAcres (denormalized, recomputed here and on every server save)
//   - the SECOND crop stays DBL CROP and points at its base via dblPartnerFieldId
// Also opts Wes's into rentBasis 'farmed' (lump spread over farmed acres) and
// creates the missing RR soybeans double-crop entry on the barley ground.
//
// Dollar-neutral by design for Omni / Phillhower East / Gessert (full-overlap
// pairs); Wes's changes intentionally. Run once: node scripts/migrate-dbl-pairs.js

'use strict';
const fs = require('fs');
const path = require('path');

// DATA_FILE env override supports dry-running against a copy
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'data.json');
const stamp = new Date().toISOString().slice(0, 10);
const BACKUP = DATA_FILE + '.bak-dblpairs-' + stamp;

const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const byId = {};
store.fields.forEach(f => { byId[f.id] = f; });

function effAcres(f) {
  return (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
}

function must(id, why) {
  const f = byId[id];
  if (!f) throw new Error('Expected field ' + id + ' (' + why + ') not found — aborting, nothing written');
  return f;
}

// --- Preflight: verify the entries look like we expect ---
const omniPeas = must('fld_mnjqcuum_9ghz', 'Omni ORG Peas');
const omniSweet = must('fld_mnjqhr9y_wkgu', 'Omni Org sweet Corn');
const philPeas = must('fld_2018', 'phillhower east Peas');
const philSnap = must('fld_2055', 'phillhower east Snap Beans');
const gesPeas = must('fld_1900', 'Gessert west 111 Peas');
const gesSnap = must('fld_1937', 'Gessert Snap Beans');
const wesBarley = must('fld_1156', "Wes's winter barley");

[omniPeas, omniSweet, philPeas, philSnap, gesPeas, gesSnap, wesBarley].forEach(f => {
  if ((f.cropType || '').toUpperCase() !== 'DBL CROP') {
    throw new Error(f.id + ' (' + f.crop + ') is ' + f.cropType + ', expected DBL CROP — data changed since this script was written; aborting');
  }
});
if (store.fields.some(f => f.id === 'fld_wes_rrsoy26')) {
  throw new Error('fld_wes_rrsoy26 already exists — migration already ran; aborting');
}

fs.copyFileSync(DATA_FILE, BACKUP);
console.log('Backup: ' + BACKUP);

// --- Pairs: base crop -> SINGLE, second crop -> DBL + partner ---
function pair(base, second) {
  base.cropType = 'SINGLE CROP';
  delete base.dblPartnerFieldId;
  second.cropType = 'DBL CROP';
  second.dblPartnerFieldId = base.id;
  console.log('Paired: ' + (second.crop || second.id) + ' rides on ' + (base.crop || base.id) +
    ' (' + base.name + ', overlap ' + Math.min(effAcres(second), effAcres(base)) + ' ac)');
}

pair(omniPeas, omniSweet);   // ORG Peas -> Org sweet Corn, 267 ac
pair(philPeas, philSnap);    // Peas -> Snap Beans, 135.2 ac (full farm)
pair(gesPeas, gesSnap);      // Peas (111) -> Snap Beans (114.8; 111 overlap, 3.8 surfaced in recon)

// --- Wes's: barley is the base crop; RR soybeans (25 ac) ride on it ---
wesBarley.cropType = 'SINGLE CROP';
delete wesBarley.dblPartnerFieldId;
wesBarley.rentBasis = 'farmed'; // opt the farm into full lump recovery

const rrBeans = {
  id: 'fld_wes_rrsoy26',
  name: wesBarley.name,
  crop: 'Soybeans',
  cropType: 'DBL CROP',
  dblPartnerFieldId: wesBarley.id,
  systemCode: 'CON',
  enterpriseId: 'ent_1272',
  acres: wesBarley.acres,
  plantedAcres: 25,
  rentPerAcre: wesBarley.rentPerAcre, // group rate set below
  yieldPerAcre: 0,
  yieldUnit: 'Bu',
  cropInsurancePerAcre: 0,
  insuranceIncomePerAcre: 0,
  inputs: [],
  machinery: [],
  seeds: [],
  registryFieldId: wesBarley.registryFieldId || null,
  splitGroupId: null,
  tillage: 'No-Till',
  notes: 'RR soybeans double-cropped on winter barley ground (25 ac). Created by dbl-pair migration ' + stamp + ' — add seed, inputs, and yield.'
};
store.fields.push(rrBeans);
byId[rrBeans.id] = rrBeans;
console.log('Created: ' + rrBeans.id + ' (RR Soybeans, 25 ac DBL on barley)');

// --- Wes's farmed-basis rent rate: lump / farmed acres ---
const wesGroup = store.fields.filter(f =>
  (f.name || '').trim().toLowerCase() === (wesBarley.name || '').trim().toLowerCase()
);
const wesLump = Math.round(wesBarley.rentPerAcre * wesBarley.acres * 100) / 100;
const wesFarmed = wesGroup
  .filter(f => (f.cropType || '').toUpperCase().indexOf('DBL') < 0)
  .reduce((s, f) => s + effAcres(f), 0);
const wesRate = Math.round((wesLump / wesFarmed) * 100) / 100;
wesGroup.forEach(f => { f.rentPerAcre = wesRate; });
console.log("Wes's: lump $" + wesLump + ' / ' + wesFarmed + ' farmed ac = $' + wesRate +
  '/ac on ' + wesGroup.length + ' entries (rentBasis farmed)');

// --- Recompute denormalized dblSharedAcres (same logic as server.js) ---
const sharedByPartner = {};
store.fields.forEach(f => {
  if ((f.cropType || '').toUpperCase().indexOf('DBL') >= 0 && f.dblPartnerFieldId) {
    sharedByPartner[f.dblPartnerFieldId] = (sharedByPartner[f.dblPartnerFieldId] || 0) + effAcres(f);
  }
});
store.fields.forEach(f => {
  const shared = sharedByPartner[f.id]
    ? Math.round(Math.min(sharedByPartner[f.id], effAcres(f)) * 100) / 100
    : 0;
  if (shared > 0) f.dblSharedAcres = shared; else delete f.dblSharedAcres;
});
Object.keys(sharedByPartner).forEach(id => {
  console.log('Shared acres: ' + (byId[id].crop || id) + ' (' + byId[id].name + ') = ' + byId[id].dblSharedAcres);
});

fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log('Written: ' + DATA_FILE);
