#!/usr/bin/env node
'use strict';

var XLSX = require('xlsx');
var fs = require('fs');
var path = require('path');

var SRC = path.resolve(__dirname, '..', '2026 FSA acre  and Crop insurance.xlsx');
var OUT = path.join(__dirname, 'data', 'data.json');

if (!fs.existsSync(SRC)) {
  console.error('Source not found: ' + SRC);
  process.exit(1);
}

var wb = XLSX.readFile(SRC);
var idCounter = 0;
function genId(prefix) {
  idCounter++;
  return prefix + '_' + idCounter;
}

function toStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function toNum(v) {
  if (v === null || v === undefined) return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}
function toBool(v) {
  if (v === true || v === 'TRUE' || v === 'True' || v === 'true') return true;
  return false;
}
function toDate(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    // Excel serial date or just a year
    if (v < 3000) return String(Math.round(v)); // Just a year like 2010
    var d = XLSX.SSF.parse_date_code(v);
    if (d) {
      var mm = String(d.m).padStart(2, '0');
      var dd = String(d.d).padStart(2, '0');
      return d.y + '-' + mm + '-' + dd;
    }
    return String(v);
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  var s = String(v).trim();
  // Handle "TBD" or other text
  return s;
}

// ===== Parse FSA Sheet =====
console.log('Parsing FSA sheet...');
var fsaSheet = wb.Sheets['FSA'];
var fsaData = XLSX.utils.sheet_to_json(fsaSheet, { header: 1, defval: null });

var cluRecords = [];
var farmSet = {};

// Row 0 = header, data starts at row 1
// Columns: A(0)=Reported B(1)=FarmName C(2)=LineNumber D(3)=PolicyNumber E(4)=FieldName
//   F(5)=FarmNumber G(6)=TractNumber H(7)=CLU I(8)=Crop J(9)=FSA Acres
//   K(10)=IRR L(11)=ORG M(12)=DoubleCrop N(13)=CoverCrop
//   O(14)=23 CC species P(15)=23 CC plant date Q(16)=grain plant date R(17)=use
//   S(18)=2024 tillage ID T(19)=24 Cover crop U(20)=24 CC plant date
//   V(21)=NO-TILL adoption W(22)=CC adoption
//   X(23)=2025 tillage ID Y(24)=25 Cover crop Z(25)=25 CC plant date
//   AA(26)=NO-TILL adoption AB(27)=CC adoption
//   AC(28)=UNIT # AD(29)=APH

for (var r = 1; r < fsaData.length; r++) {
  var row = fsaData[r];
  if (!row) continue;
  var farmNum = row[5];
  if (farmNum === null || farmNum === undefined || farmNum === '') continue;

  var farmNumStr = String(farmNum).replace(/\.0$/, '');
  var tractStr = toStr(row[6]).replace(/\.0$/, '');
  var cluStr = toStr(row[7]).replace(/\.0$/, '');
  var fieldName = toStr(row[4]);

  // Track farms
  if (farmNumStr && !farmSet[farmNumStr]) {
    farmSet[farmNumStr] = toStr(row[1]) || fieldName || '';
  }
  // Fill in farm name if we see it (it's only on some rows)
  if (toStr(row[1])) {
    farmSet[farmNumStr] = toStr(row[1]);
  }

  var rec = {
    id: genId('clu'),
    reported: toBool(row[0]),
    farmName: toStr(row[1]),
    lineNumber: toStr(row[2]),
    policyNumber: toStr(row[3]),
    fieldName: fieldName,
    farmNumber: farmNumStr,
    tractNumber: tractStr,
    clu: cluStr,
    crop: toStr(row[8]),
    fsaAcres: toNum(row[9]),
    irrigated: toBool(row[10]),
    organic: toBool(row[11]),
    doubleCrop: toBool(row[12]),
    coverCrop: toBool(row[13]),
    grainPlantDate: toDate(row[16]),
    use: toStr(row[17]),
    cc2023Species: toStr(row[14]),
    cc2023PlantDate: toDate(row[15]),
    tillage2024: toStr(row[18]),
    cc2024: toStr(row[19]),
    cc2024PlantDate: toDate(row[20]),
    ntAdoption2024: toStr(row[21]),
    ccAdoption2024: toStr(row[22]),
    tillage2025: toStr(row[23]),
    cc2025: toStr(row[24]),
    cc2025PlantDate: toDate(row[25]),
    ntAdoption2025: toStr(row[26]),
    ccAdoption2025: toStr(row[27]),
    unitNumber: toStr(row[28]),
    aph: toNum(row[29])
  };
  cluRecords.push(rec);
}

console.log('  CLU records: ' + cluRecords.length);

// Build farms array
var farms = [];
Object.keys(farmSet).sort().forEach(function (fn) {
  farms.push({ id: genId('farm'), farmNumber: fn, farmName: farmSet[fn] });
});
console.log('  Farms: ' + farms.length);

// ===== Parse Pricing Sheet =====
console.log('Parsing Pricing sheet...');
var priceSheet = wb.Sheets['Pricing'];
var priceData = XLSX.utils.sheet_to_json(priceSheet, { header: 1, defval: null });

var pricing = [];
// XLSX reads: col 0=crop, col 2=springPrice, col 4=fallPrice, starting row 2 (index 2)
for (var r = 2; r < priceData.length; r++) {
  var row = priceData[r];
  if (!row) continue;
  var crop = toStr(row[0]);
  if (!crop) continue;
  if (crop === 'EDIT' || crop === 'DO NOT EDIT') continue;

  var spring = toNum(row[2]);
  var fall = toNum(row[4]);
  pricing.push({
    id: genId('pr'),
    crop: crop,
    springPrice: spring,
    fallPrice: fall,
    manualOverride: false
  });
}
console.log('  Pricing entries: ' + pricing.length);

// ===== Parse Insurance Sheet =====
console.log('Parsing Insurance sheet...');
var insSheet = wb.Sheets['Copy of Scheduale Insurance'];
var insData = XLSX.utils.sheet_to_json(insSheet, { header: 1, defval: null });

var insurancePolicies = [];
// Row 2 (index 2) = headers: A=FARM NAME, B=LINE, C=CROP, D=Planted acres, E=FSA Acres
//   F=guarantee, G=actual, H=dollar guarantee, I=sprg price, J=Fall Price, K=Highest, L=indem, M=INDEM, N=Paid
// Data from row 3 (index 3)
for (var r = 3; r < insData.length; r++) {
  var row = insData[r];
  if (!row) continue;
  // Must have at least a crop or farm name or line number
  var farmName = toStr(row[0]);
  var line = toStr(row[1]);
  var crop = toStr(row[2]);
  var plantedAcres = toNum(row[3]);
  var guarantee = toNum(row[5]);
  var actual = toNum(row[6]);
  var paid = toBool(row[13]);

  // Skip completely empty rows and rows that are just template (#N/A)
  if (!farmName && !line && !crop && !plantedAcres && !guarantee && !actual) continue;

  insurancePolicies.push({
    id: genId('ins'),
    farmName: farmName,
    lineNumber: line,
    crop: crop,
    plantedAcres: plantedAcres,
    fsaAcresManual: toNum(row[4]),
    guarantee: guarantee,
    actual: actual,
    claimStatus: paid ? 'paid' : 'none',
    notes: ''
  });
}
console.log('  Insurance policies: ' + insurancePolicies.length);

// ===== Parse GCS Enrolled Sheet =====
console.log('Parsing GCS Enrolled sheet...');
var gcsSheet = wb.Sheets['GCS Enrolled'];
var gcsData = XLSX.utils.sheet_to_json(gcsSheet, { header: 1, defval: null });

var gcsEnrollments = [];
// Row 0 = header: Farm ID, Tract ID, Field ID, Commodity, 340 CC ac, 345 RT ac, 329 NT ac,
//   Default Yield Value, Irrigation, Tillage, State, County
for (var r = 1; r < gcsData.length; r++) {
  var row = gcsData[r];
  if (!row) continue;
  var farmId = toStr(row[0]).replace(/\.0$/, '');
  if (!farmId) continue;

  gcsEnrollments.push({
    id: genId('gcs'),
    farmNumber: farmId,
    tractNumber: toStr(row[1]).replace(/\.0$/, ''),
    fieldId: toStr(row[2]).replace(/\.0$/, ''),
    commodity: toStr(row[3]),
    cc340Acres: toNum(row[4]),
    rt345Acres: toNum(row[5]),
    nt329Acres: toNum(row[6]),
    defaultYield: toNum(row[7]),
    irrigation: toStr(row[8]),
    tillage: toStr(row[9]),
    state: toStr(row[10]) || 'WI',
    county: toStr(row[11]) || 'Rock'
  });
}
console.log('  GCS enrollments: ' + gcsEnrollments.length);

// ===== Build Store =====
var store = {
  settings: {
    year: 2026,
    county: 'Rock',
    state: 'WI',
    producerName: ''
  },
  cluRecords: cluRecords,
  farms: farms,
  pricing: pricing,
  insurancePolicies: insurancePolicies,
  gcsEnrollments: gcsEnrollments,
  tillageCodes: {
    'A': 'No Till',
    'B': 'Strip Till',
    'C': 'Fall Vertical',
    'D': 'Spring Vertical',
    'E': 'Fall Field Cultivation',
    'E2': 'Spring Field Cultivation',
    'F': 'Disk Ripper',
    'G': 'Reduced Till'
  }
};

// ===== Validate =====
var totalAcres = 0;
var organicAcres = 0;
var irrigatedAcres = 0;
cluRecords.forEach(function (rec) {
  totalAcres += rec.fsaAcres;
  if (rec.organic) organicAcres += rec.fsaAcres;
  if (rec.irrigated) irrigatedAcres += rec.fsaAcres;
});

console.log('\n=== VALIDATION ===');
console.log('Total acres:     ' + totalAcres.toFixed(2));
console.log('Organic acres:   ' + organicAcres.toFixed(2));
console.log('Irrigated acres: ' + irrigatedAcres.toFixed(2));
console.log('Farms:           ' + farms.length);
console.log('CLU records:     ' + cluRecords.length);
console.log('Pricing:         ' + pricing.length);
console.log('Insurance:       ' + insurancePolicies.length);
console.log('GCS:             ' + gcsEnrollments.length);

// ===== Write =====
var dataDir = path.dirname(OUT);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(store, null, 2));
console.log('\nWrote ' + OUT);
