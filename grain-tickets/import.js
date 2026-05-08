#!/usr/bin/env node
'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Calc = require('./public/calc.js');

const args = process.argv.slice(2);
const dryRun = args.indexOf('--dry-run') !== -1;
const xlsxPath = args.filter(a => a !== '--dry-run')[0] || path.join(__dirname, '..', "Randy's 2025 Grain Ticket Entry.xlsx");
if (!fs.existsSync(xlsxPath)) {
  console.error('Excel file not found:', xlsxPath);
  process.exit(1);
}

console.log('Reading:', xlsxPath);
const wb = XLSX.readFile(xlsxPath);

// --- Extract Crop Config from Farms sheet rows 68-104 ---
const farmsSheet = wb.Sheets['Farms'];
const cropConfig = {};

for (let r = 68; r <= 104; r++) {
  const cropCell = farmsSheet['C' + r];
  if (!cropCell || !cropCell.v) continue;

  const cropName = String(cropCell.v).trim();
  const discount = numVal(farmsSheet['D' + r]);
  const testWeight = numVal(farmsSheet['F' + r]);
  const moistureShrink = numVal(farmsSheet['G' + r]);

  cropConfig[cropName] = { discount, testWeight, moistureShrink };
}

console.log('Crop configs extracted:', Object.keys(cropConfig).length);

// --- Extract Farm metadata from Farms sheet rows 2-64 ---
const farms = [];
for (let r = 2; r <= 64; r++) {
  const farmCell = farmsSheet['C' + r];
  if (!farmCell || !farmCell.v) continue;

  farms.push({
    id: 'f_' + String(farms.length + 1).padStart(3, '0'),
    acres: numVal(farmsSheet['A' + r]),
    crop: strVal(farmsSheet['B' + r]).trim(),
    farm: strVal(farmsSheet['C' + r]).trim(),
    unit: strVal(farmsSheet['E' + r]) || 'BU',
    type: strVal(farmsSheet['G' + r]) || 'Conventional',
    guarantee: numVal(farmsSheet['H' + r]),
    coverage: numVal(farmsSheet['I' + r]),
    claimThreshold: numVal(farmsSheet['J' + r]),
    discount: numVal(farmsSheet['K' + r]),
    testWeight: numVal(farmsSheet['L' + r]),
    driver: strVal(farmsSheet['O' + r]) || '',
    truck: numVal(farmsSheet['P' + r])
  });
}

console.log('Farms extracted:', farms.length);

// --- Extract Tickets from Data sheet ---
const dataSheet = wb.Sheets['Data'];
const tickets = [];

for (let r = 2; r <= 1100; r++) {
  const farmCell = dataSheet['B' + r];
  if (!farmCell || !farmCell.v) continue;

  const dateCell = dataSheet['A' + r];
  let dateStr = '';
  if (dateCell) {
    if (dateCell.t === 'n') {
      // Excel date serial number
      const dt = XLSX.SSF.parse_date_code(dateCell.v);
      dateStr = `${dt.y}-${String(dt.m).padStart(2, '0')}-${String(dt.d).padStart(2, '0')}`;
    } else if (dateCell.t === 'd') {
      dateStr = dateCell.v.toISOString().split('T')[0];
    } else {
      dateStr = String(dateCell.v);
    }
  }

  tickets.push({
    id: 't_' + String(tickets.length + 1).padStart(6, '0'),
    date: dateStr,
    farm: strVal(dataSheet['B' + r]).trim(),
    netWeight: numVal(dataSheet['C' + r]),
    moisture: numVal(dataSheet['D' + r]),
    crop: strVal(dataSheet['E' + r]).trim(),
    ticketNo: strVal(dataSheet['F' + r]).trim(),
    notes: (strVal(dataSheet['G' + r]) || '').trim(),
    fm: numVal(dataSheet['H' + r])
  });
}

console.log('Tickets extracted:', tickets.length);

// --- Write data.json ---
const data = { tickets, farms, cropConfig };
const outPath = path.join(__dirname, 'data', 'data.json');

// Deduplication check against existing data
if (fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const existingNos = {};
  (existing.tickets || []).forEach(t => {
    if (t.ticketNo) existingNos[t.ticketNo.trim()] = true;
  });
  const dupes = tickets.filter(t => existingNos[t.ticketNo.trim()]);
  if (dupes.length > 0) {
    console.log('\nWARNING: ' + dupes.length + ' duplicate ticket numbers found in existing data:');
    dupes.slice(0, 10).forEach(t => console.log('  ' + t.ticketNo + ' (' + t.date + ', ' + t.farm + ')'));
    if (dupes.length > 10) console.log('  ... and ' + (dupes.length - 10) + ' more');
  }
}

if (dryRun) {
  console.log('\n--- DRY RUN: would write ' + tickets.length + ' tickets, ' + farms.length + ' farms ---');
  console.log('Sample ticket:', JSON.stringify(tickets[0], null, 2));
  console.log('No changes made to data.json');
} else {
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log('Written to:', outPath);
}

// --- Validation: spot-check computed values against Data2 sheet ---
const data2Sheet = wb.Sheets['Data2'];
console.log('\n--- Validation: spot-checking computed values ---');
let mismatches = 0;

for (let r = 2; r <= Math.min(tickets.length + 1, 50); r++) {
  const ticket = tickets[r - 2];
  const computed = Calc.computeTicket(ticket, cropConfig);

  const expectedGrossBU = numVal(data2Sheet['J' + r]);
  const expectedNetBU = numVal(data2Sheet['K' + r]);

  if (expectedGrossBU > 0) {
    const grossDiff = Math.abs(computed.grossBU - expectedGrossBU);
    const netDiff = Math.abs(computed.netBU - expectedNetBU);

    if (grossDiff > 0.01 || netDiff > 0.01) {
      mismatches++;
      console.log(`  MISMATCH row ${r}: ${ticket.farm} / ${ticket.crop}`);
      console.log(`    Gross BU: expected ${expectedGrossBU}, got ${computed.grossBU} (diff: ${grossDiff.toFixed(4)})`);
      console.log(`    Net BU:   expected ${expectedNetBU}, got ${computed.netBU} (diff: ${netDiff.toFixed(4)})`);
      console.log(`    ticket:`, JSON.stringify(ticket));
      console.log(`    config:`, JSON.stringify(cropConfig[ticket.crop]));
    }
  }
}

if (mismatches === 0) {
  console.log('  All spot-checked rows match!');
} else {
  console.log(`  ${mismatches} mismatches found in first 49 rows.`);
}

// --- Helpers ---
function numVal(cell) {
  if (!cell) return 0;
  const v = parseFloat(cell.v);
  return isNaN(v) ? 0 : v;
}

function strVal(cell) {
  if (!cell) return '';
  return String(cell.v);
}
