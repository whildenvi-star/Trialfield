#!/usr/bin/env node
'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '..', 'Hughes Farm acres 2026.xlsx');
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

// --- Utilities ---
function cellVal(ws, addr) {
  const c = ws[addr];
  return c ? c.v : undefined;
}

function cellStr(ws, addr) {
  const v = cellVal(ws, addr);
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function cellNum(ws, addr) {
  const v = cellVal(ws, addr);
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

let idCounter = 1;
function generateId(prefix) {
  return prefix + '_' + (idCounter++).toString().padStart(3, '0');
}

// --- Known cross-app aliases ---
// Maps the canonical name (from Hughes spreadsheet) to known alternate spellings
// found in farm-budget, grain-tickets, fsa-acres, etc.
const KNOWN_ALIASES = {
  "Blue's": ["Blues", "Blue's"],
  "Elwood's": ["Elwoods", "Elwood's"],
  "Wes's": ["Wes", "Wess", "Wes's"],
  "Kopp": ["Kopp", "Kopp East", "Kopp west", "Kopps"],
  "Gessert": ["Gessert", "Gessert East", "Gessert west"],
  "Delong- Christpherson": ["Delong-Christpherson", "Delong- Christpherson", "Delong Christpherson"],
  "Noss, Jeff": ["Noss Jeff", "Noss, Jeff"],
  "Noss, Sid": ["Noss Sid", "Noss, Sid"],
  "Noss, Torkelson East a.k.a. Noss Pond": ["Noss Pond", "Noss Torkelson East", "Noss, Torkelson East a.k.a. Noss Pond"],
  "Noss Torkelson West, a.k.a. Jessie Noss": ["Jessie Noss", "Noss Torkelson West", "Noss Torkelson West, a.k.a. Jessie Noss"],
  "Brad Inman's": ["Brad Inmans", "Brad Inman's", "Brad Inman"],
  "Phillhower East": ["Phillhower East", "Philhower East"],
  "Phillhower West": ["Phillhower West", "Philhower West"],
  "Simpson South": ["Simpson South", "Simpson S"],
  "Simpson North": ["Simpson North", "Simpson N"],
  "Klug/Davis": ["Klug Davis", "Klug/Davis"],
  "Fox-Kettle": ["Fox Kettle", "Fox-Kettle"],
  "Fox-Lemans": ["Fox Lemans", "Fox-Lemans"],
  "Fox Den": ["Fox Den", "FoxDen"],
  "Fletcher-Cribben": ["Fletcher Cribben", "Fletcher-Cribben"],
  "Delong-Avon": ["Delong Avon", "Delong-Avon"],
  "Delong-Meyer": ["Delong Meyer", "Delong-Meyer"],
  "Avalon Rd South": ["Avalon Rd South", "Avalon Road South"],
  "Avalon Rd. Kernza": ["Avalon Rd Kernza", "Avalon Rd. Kernza", "Avalon Road Kernza"],
  "Goat pasture": ["Goat Pasture", "Goat pasture"],
  "Townline North": ["Townline North", "Townline N"],
  "Townline South": ["Townline South", "Townline S"]
};

// --- Parse spreadsheet ---
console.log('Reading workbook:', EXCEL_FILE);
const wb = XLSX.readFile(EXCEL_FILE, { cellFormula: false });
const ws = wb.Sheets[wb.SheetNames[0]];
console.log('Sheet:', wb.SheetNames[0]);

// Column layout (row 2 = headers):
// A = Farm name
// B = (spacer)
// C = Total Acres
// D = (spacer)
// E = Rented/tillable
// F = Owned/tillable
// G = Non-tillable / not farmed
// H = Organic acres
// I = Transition Acres
// J = Rented (flag)
// K = $/AC (rent rate)
// L = Landlord
// Data rows: 4, 6, 8, ... (every other row)

const grower = {
  id: generateId('grw'),
  name: 'W. Hughes Farms, G.P.',
  operators: ['Randy Hughes', 'Whilden Hughes'],
  county: 'LaSalle',
  state: 'IL'
};

const fields = [];
for (let r = 4; r <= 200; r += 2) {
  const name = cellStr(ws, 'A' + r);
  if (!name) continue;

  const totalAcres = cellNum(ws, 'C' + r);
  const rentedAcres = cellNum(ws, 'E' + r);
  const ownedAcres = cellNum(ws, 'F' + r);
  const nonTillable = cellNum(ws, 'G' + r);
  const organicAcres = cellNum(ws, 'H' + r);
  const transitionAcres = cellNum(ws, 'I' + r);
  const rentRate = cellNum(ws, 'K' + r);
  const landlord = cellStr(ws, 'L' + r);

  // Determine ownership type
  let ownership = 'unknown';
  if (rentedAcres > 0 && ownedAcres > 0) {
    ownership = 'mixed';
  } else if (rentedAcres > 0) {
    ownership = 'rented';
  } else if (ownedAcres > 0) {
    ownership = 'owned';
  }

  // Build acre records
  const acreRecords = [];
  if (totalAcres > 0) {
    acreRecords.push({ type: 'total', value: totalAcres, source: 'hughes-xlsx-2026', year: 2026 });
  }
  if (rentedAcres > 0) {
    acreRecords.push({ type: 'rented', value: rentedAcres, source: 'hughes-xlsx-2026', year: 2026 });
  }
  if (ownedAcres > 0) {
    acreRecords.push({ type: 'owned', value: ownedAcres, source: 'hughes-xlsx-2026', year: 2026 });
  }
  if (nonTillable > 0) {
    acreRecords.push({ type: 'non-tillable', value: nonTillable, source: 'hughes-xlsx-2026', year: 2026 });
  }
  if (organicAcres > 0) {
    acreRecords.push({ type: 'organic', value: organicAcres, source: 'hughes-xlsx-2026', year: 2026 });
  }
  if (transitionAcres > 0) {
    acreRecords.push({ type: 'transition', value: transitionAcres, source: 'hughes-xlsx-2026', year: 2026 });
  }

  // Build aliases
  const aliases = KNOWN_ALIASES[name] || [name];
  if (!aliases.includes(name)) aliases.unshift(name);

  const field = {
    id: generateId('fld'),
    growerId: grower.id,
    name: name,
    aliases: aliases,
    reportingAcres: totalAcres,
    organicAcres: organicAcres,
    transitionAcres: transitionAcres,
    nonTillableAcres: nonTillable,
    ownership: ownership,
    active: true,
    fsaFarmNumber: null,
    fsaTractNumber: null,
    fsaCluNumber: null,
    geometry: null,
    notes: landlord ? 'Landlord: ' + landlord : '',
    rentRate: rentRate || null,
    // totalRentDollars is the canonical rent field used by sync and display paths.
    // Compute it from the per-acre rate × total acres at import time.
    totalRentDollars: (rentRate > 0 && totalAcres > 0) ? Math.round(rentRate * totalAcres * 100) / 100 : 0,
    acreRecords: acreRecords,
    crossRefs: {
      farmBudget: null,
      fsaAcres: null,
      grainTickets: null,
      organicCert: null
    }
  };

  fields.push(field);
}

console.log(`\nParsed ${fields.length} fields for grower: ${grower.name}`);

// --- Summary ---
let totalAcres = 0, totalOrganic = 0, totalRented = 0, totalOwned = 0;
fields.forEach(f => {
  totalAcres += f.reportingAcres;
  totalOrganic += f.organicAcres;
  const rented = f.acreRecords.find(r => r.type === 'rented');
  const owned = f.acreRecords.find(r => r.type === 'owned');
  totalRented += rented ? rented.value : 0;
  totalOwned += owned ? owned.value : 0;
});

console.log(`\n--- Summary ---`);
console.log(`  Total reporting acres: ${totalAcres.toFixed(2)}`);
console.log(`  Organic acres: ${totalOrganic.toFixed(2)}`);
console.log(`  Rented acres: ${totalRented.toFixed(2)}`);
console.log(`  Owned acres: ${totalOwned.toFixed(2)}`);
console.log(`  Ownership breakdown: ${fields.filter(f=>f.ownership==='rented').length} rented, ${fields.filter(f=>f.ownership==='owned').length} owned, ${fields.filter(f=>f.ownership==='mixed').length} mixed`);

// --- Print each field ---
console.log(`\n--- Fields ---`);
fields.forEach((f, i) => {
  console.log(`  ${i+1}. ${f.name}: ${f.reportingAcres} ac (${f.ownership}) ${f.organicAcres > 0 ? '[organic: ' + f.organicAcres + ']' : ''}`);
});

// --- Write data.json ---
const store = {
  growers: [grower],
  fields: fields,
  config: {
    defaultReportingAcreType: 'total',
    acreTypes: ['total', 'rented', 'owned', 'fsa', 'gis', 'planted', 'harvested', 'insured', 'organic', 'transition', 'non-tillable']
  }
};

const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log(`\nWrote ${DATA_FILE}`);
console.log(`  ${store.fields.length} fields`);
console.log(`  ${store.growers.length} growers`);
console.log(`\nStart the server with: node server.js`);
