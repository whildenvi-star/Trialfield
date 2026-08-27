#!/usr/bin/env node
// One-off: trim the Wes's RR soybeans double-crop entry (fld_mtam6v2c_izkh) to
// match "same seed as Airport and a post pass only, 35 Bu yield":
//   - seed population 180,000 -> 143,757 (Airport's P26Z86E rate)
//   - inputs cut to the post pass only (drops Mauler pre-emerge, seed treatment,
//     inoculant, seed treatment application, WI tonnage tax)
//   - yield already 35 Bu; Planter/Combine/Trucking passes kept (field ops, not spray)
// Idempotent; backs up data.json first. Restart farm-budget after (in-memory store).

'use strict';
const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'data.json');
const stamp = new Date().toISOString().slice(0, 10);

const POST_PASS = ['Application - Post', 'PowerMax', 'Enlist',
  'Crop Oil, Insource (2x2.5 Gal)', 'Premium Ams (51 Lb)'];

const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const f = store.fields.find(x => x.id === 'fld_mtam6v2c_izkh');
if (!f) throw new Error('fld_mtam6v2c_izkh (Wes RR Soybeans) not found — aborting');

// Preflight: the post-pass items must already be present (they came from the
// RR Soybeans Program template) — otherwise the data has drifted; do not guess.
const names = (f.inputs || []).map(i => i.productName);
const missing = POST_PASS.filter(n => !names.includes(n));
if (missing.length) throw new Error('Expected post-pass inputs missing (' + missing.join(', ') + ') — aborting, nothing written');

const BACKUP = DATA_FILE + '.bak-rrsoy-' + stamp;
fs.copyFileSync(DATA_FILE, BACKUP);
console.log('Backup: ' + BACKUP);

(f.seeds || []).forEach(s => { if (s.variety === 'P26Z86E') s.population = 143757; });
if (f.seed && f.seed.variety === 'P26Z86E') f.seed.population = 143757;
f.yieldPerAcre = 35;
f.yieldUnit = 'Bu';

const dropped = (f.inputs || []).filter(i => !POST_PASS.includes(i.productName)).map(i => i.productName);
f.inputs = (f.inputs || []).filter(i => POST_PASS.includes(i.productName));

fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log('Seed: P26Z86E @ 143,757 | yield 35 Bu');
console.log('Kept inputs: ' + f.inputs.map(i => i.productName + ':' + i.quantity).join(', '));
console.log('Dropped: ' + (dropped.join(', ') || '(none — already applied)'));
console.log('Written: ' + DATA_FILE);
