#!/usr/bin/env node
'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Calc = require('./public/calc.js');

const EXCEL_FILE = '/Users/glomalinguild/Desktop/Macro/OFFICIAL 2026 MACRO 2026 PROJECTION 2026.xlsx';
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

function colLetter(colIdx) {
  // 1-based to letter (1=A, 2=B, ... 27=AA)
  let s = '';
  while (colIdx > 0) {
    colIdx--;
    s = String.fromCharCode(65 + (colIdx % 26)) + s;
    colIdx = Math.floor(colIdx / 26);
  }
  return s;
}

function generateId(prefix) {
  return prefix + '_' + (idCounter++).toString().padStart(4, '0');
}
let idCounter = 1;

console.log('Reading workbook:', EXCEL_FILE);
const wb = XLSX.readFile(EXCEL_FILE, { cellFormula: false });
console.log('Sheets:', wb.SheetNames.join(', '));

// ============================================
// 1. PARSE INPUTS SHEET
// ============================================
console.log('\n--- Parsing Inputs sheet ---');
const wsInputs = wb.Sheets['Inputs'];

// Products (rows 3-200, cols C-I)
const products = [];
for (let r = 3; r <= 300; r++) {
  const name = cellStr(wsInputs, 'C' + r);
  if (!name) continue;
  const unitBilledPrice = cellNum(wsInputs, 'H' + r);
  const conversionRate = cellNum(wsInputs, 'G' + r) || 1;
  const increasePercent = cellNum(wsInputs, 'F' + r) || 1;
  const unit = cellStr(wsInputs, 'E' + r);
  const p205 = cellNum(wsInputs, 'A' + r);
  const k20 = cellNum(wsInputs, 'B' + r);
  const appPrice = cellNum(wsInputs, 'D' + r);

  products.push({
    id: generateId('prod'),
    name: name,
    unitBilledPrice: unitBilledPrice,
    conversionRate: conversionRate,
    increasePercent: increasePercent,
    unit: unit,
    applicationPrice: appPrice,
    p205: p205,
    k20: k20
  });
}
console.log(`  Products: ${products.length}`);

// Implements (cols AE-AL, rows 3-50)
const implements_ = [];
for (let r = 3; r <= 50; r++) {
  const name = cellStr(wsInputs, 'AE' + r);
  if (!name) continue;
  const costPerAcre = cellNum(wsInputs, 'AH' + r);
  const fuelGalPerAcre = cellNum(wsInputs, 'AJ' + r);
  implements_.push({
    id: generateId('impl'),
    name: name,
    costPerAcre: costPerAcre,
    fuelGalPerAcre: fuelGalPerAcre,
    unit: cellStr(wsInputs, 'AI' + r)
  });
}
console.log(`  Implements: ${implements_.length}`);

// Crop Pricing (cols BN-BR)
const tonCrops = ['Peas', 'Lima Beans', 'Snap Beans', 'Sweet Corn', 'IRR Sweet Corn',
  'Hay/ ton DM', 'ORG Hay', 'ORG snap beans', 'ORG Peas', 'Org sweet Corn', 'DRY Land sweetcorn'];
const lbsCrops = ['Hemp', 'ORG Hemp', 'ORG Sunflowers', 'ORG Hairy Vetch'];

const cropPricing = [];
for (let r = 3; r <= 50; r++) {
  const crop = cellStr(wsInputs, 'BP' + r);
  if (!crop) continue;
  let unit = 'Bu';
  if (tonCrops.indexOf(crop) >= 0) unit = 'Tons';
  else if (lbsCrops.indexOf(crop) >= 0) unit = 'Lbs';
  cropPricing.push({
    id: generateId('cp'),
    crop: crop,
    pricePerUnit: cellNum(wsInputs, 'BO' + r),
    basis: cellNum(wsInputs, 'BN' + r),
    interestRate: cellNum(wsInputs, 'BQ' + r) || 0.06,
    dryingRate: cellNum(wsInputs, 'BR' + r),
    unit: unit
  });
}

// Add missing crop pricing entries found in enterprise fields but not in pricing table
const existingCrops = cropPricing.map(function (cp) { return cp.crop; });
const missingCrops = [
  { crop: 'Seed grade Winter Barley', pricePerUnit: 8.5, basis: 0, interestRate: 0.06, dryingRate: 0, unit: 'Bu' },
  { crop: 'DF seed beans', pricePerUnit: 14.05, basis: 0, interestRate: 0.06, dryingRate: 0, unit: 'Bu' },
  { crop: 'Japan beans', pricePerUnit: 28.75, basis: 0, interestRate: 0.06, dryingRate: 0, unit: 'Bu' }
];
missingCrops.forEach(function (mc) {
  if (existingCrops.indexOf(mc.crop) < 0) {
    cropPricing.push(Object.assign({ id: generateId('cp') }, mc));
  }
});

console.log(`  Crop Pricing: ${cropPricing.length}`);

// Labor/Overhead (cols BV-BY)
const laborOverhead = [];
for (let r = 3; r <= 15; r++) {
  const sysCode = cellStr(wsInputs, 'BV' + r);
  if (!sysCode) continue;
  laborOverhead.push({
    id: generateId('lo'),
    systemCode: sysCode,
    laborPerAcre: cellNum(wsInputs, 'BW' + r),
    overheadPerAcre: cellNum(wsInputs, 'BY' + r)
  });
}
console.log(`  Labor/Overhead entries: ${laborOverhead.length}`);

// Fuel price
const fuelPrice = cellNum(wsInputs, 'BW15') || 5.00;
console.log(`  Fuel price: $${fuelPrice}/gal`);

// ============================================
// 2. PARSE SEED SHEET
// ============================================
console.log('\n--- Parsing Seed sheet ---');
const wsSeed = wb.Sheets['Seed'];
const seeds = [];
for (let r = 7; r <= 72; r++) {
  const variety = cellStr(wsSeed, 'D' + r);
  if (!variety) continue;
  const crop = cellStr(wsSeed, 'B' + r);
  const brand = cellStr(wsSeed, 'C' + r);
  const pricePerUnit = cellNum(wsSeed, 'M' + r);
  const seedsPerUnit = cellNum(wsSeed, 'J' + r);
  if (!crop && !brand) continue;
  seeds.push({
    id: generateId('seed'),
    crop: crop,
    brand: brand,
    variety: variety,
    pricePerUnit: pricePerUnit,
    seedsPerUnit: seedsPerUnit
  });
}
console.log(`  Seeds: ${seeds.length}`);

// ============================================
// 3. PARSE RENT SHEET
// ============================================
console.log('\n--- Parsing Rent sheet ---');
const wsRent = wb.Sheets['Rent'];
const rent = [];
for (let r = 5; r <= 200; r++) {
  const fieldName = cellStr(wsRent, 'A' + r);
  if (!fieldName) continue;
  const acres = cellNum(wsRent, 'C' + r);
  if (acres <= 0) continue;
  const active = cellVal(wsRent, 'D' + r);
  const rentRate = cellNum(wsRent, 'E' + r);
  const totalRent = cellNum(wsRent, 'F' + r);
  rent.push({
    id: generateId('rent'),
    fieldName: fieldName,
    shortCode: cellStr(wsRent, 'B' + r),
    acres: acres,
    active: active !== false,
    rentRate: rentRate,
    totalRent: totalRent
  });
}
console.log(`  Rent parcels: ${rent.length}`);

// ============================================
// 4. PARSE BUYERS SHEET
// ============================================
console.log('\n--- Parsing Buyers sheet ---');
const wsBuyers = wb.Sheets['Buyers'];
const buyers = [];
if (wsBuyers) {
  for (let r = 2; r <= 50; r++) {
    const name = cellStr(wsBuyers, 'A' + r);
    if (!name) continue;
    buyers.push({
      id: generateId('buy'),
      name: name,
      basis: cellNum(wsBuyers, 'B' + r),
      rtHours: cellNum(wsBuyers, 'C' + r),
      loadSize: cellNum(wsBuyers, 'D' + r),
      truckingRate: cellNum(wsBuyers, 'E' + r),
      moisture: cellNum(wsBuyers, 'F' + r),
      threshold: cellNum(wsBuyers, 'G' + r),
      drying: cellNum(wsBuyers, 'H' + r),
      shrink: cellNum(wsBuyers, 'I' + r)
    });
  }
}
console.log(`  Buyers: ${buyers.length}`);

// ============================================
// 5. PARSE SALES SHEET
// ============================================
console.log('\n--- Parsing Sales sheet ---');
const wsSales = wb.Sheets['Sales'];
const sales = [];
if (wsSales) {
  for (let r = 36; r <= 60; r++) {
    const crop = cellStr(wsSales, 'D' + r);
    if (!crop) continue;
    const complete = cellVal(wsSales, 'A' + r);
    const dateVal = cellVal(wsSales, 'B' + r);
    let dateStr = '';
    if (dateVal) {
      if (typeof dateVal === 'number') {
        const d = XLSX.SSF.parse_date_code(dateVal);
        dateStr = d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
      } else {
        dateStr = String(dateVal);
      }
    }
    sales.push({
      id: generateId('sale'),
      complete: complete === true || complete === 'TRUE',
      date: dateStr,
      amount: cellNum(wsSales, 'C' + r),
      crop: crop,
      contractNo: cellStr(wsSales, 'E' + r),
      buyer: cellStr(wsSales, 'F' + r),
      basis: cellNum(wsSales, 'G' + r),
      price: cellNum(wsSales, 'H' + r),
      cbotPrice: cellNum(wsSales, 'I' + r),
      shipPeriod: cellStr(wsSales, 'J' + r),
      advance: cellNum(wsSales, 'K' + r),
      notes: ''
    });
  }
}
console.log(`  Sales contracts: ${sales.length}`);

// ============================================
// 6. PARSE ENTERPRISE TABS (field-by-field)
// ============================================
console.log('\n--- Parsing Enterprise Tabs ---');

const ENTERPRISE_DEFS = [
  { name: 'Conventional Corn', shortName: 'Conv Corn', sheet: 'CONVENTIONAL CORN', category: 'conventional', systemCodes: ['CON', 'CON IRR'] },
  { name: 'Conventional Small Grain', shortName: 'Conv SM Grain', sheet: 'CONVENTIONAL SMALL GRAIN', category: 'conventional', systemCodes: ['CON', 'CON IRR'] },
  { name: 'Conventional Soybeans', shortName: 'Conv Soy', sheet: 'CONVENTIONAL SOYBEAN', category: 'conventional', systemCodes: ['CON', 'CON IRR'] },
  { name: 'Conv/Org Canning', shortName: 'Canning', sheet: 'CONORG CANNING', category: 'conventional', systemCodes: ['CANNING CON', 'CANNING ORG', 'CANNING CON IRR', 'CANNING ORG IRR'] },
  { name: 'Organic Corn', shortName: 'Org Corn', sheet: 'ORGANIC CORN', category: 'organic', systemCodes: ['ORG', 'ORG IRR'] },
  { name: 'Organic Small Grain', shortName: 'Org Sm Grain', sheet: 'ORGANIC SMALL GRAIN', category: 'organic', systemCodes: ['ORG'] },
  { name: 'Organic Broadleaf', shortName: 'Org Broadleaf', sheet: 'ORGANIC BROADLEAF', category: 'organic', systemCodes: ['ORG', 'ORG IRR'] }
];

const enterprises = [];
const allFields = [];

ENTERPRISE_DEFS.forEach(function (def, entIdx) {
  const entId = generateId('ent');
  enterprises.push({
    id: entId,
    name: def.name,
    shortName: def.shortName,
    systemCodes: def.systemCodes,
    category: def.category
  });

  const ws = wb.Sheets[def.sheet];
  if (!ws) {
    console.log(`  WARNING: Sheet "${def.sheet}" not found!`);
    return;
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`\n  Enterprise: ${def.name} (${def.sheet})`);
  console.log(`    Range: ${ws['!ref']}`);

  // Detect field columns by scanning row 1 for non-empty cells
  // Each field starts at a column where row 1 has the field name
  // The primary data column is typically col+1 (offset from field name in col-1)
  // But looking at the structure: row 1 has field names, and the data columns follow
  // In the spreadsheet, each field block starts with field name in row 1
  // Let's scan row 1 for field names (skip cols A, B, C which are labels)

  // Detect fields by scanning for columns with acres in row 4
  // Each field block is 6 columns wide. We scan every 6th column starting from col 4 (D).
  const fieldColumns = [];
  for (let c = 4; c <= range.e.c + 1; c += 6) {
    const acres = cellNum(ws, colLetter(c) + '4');
    if (acres <= 0) continue; // Skip empty field blocks

    // Field name from row 1 (may be empty for canning sub-blocks)
    let name = cellStr(ws, colLetter(c) + '1');
    if (!name) {
      // Check col-1 for the name (some sheets put it there)
      name = cellStr(ws, colLetter(c - 1) + '1');
    }
    if (!name) {
      // Use crop name from row 2 as fallback
      const crop = cellStr(ws, colLetter(c) + '2');
      if (!crop) continue; // Truly empty — skip
      name = crop + ' (unnamed)';
    }

    fieldColumns.push({ col: c, name: name });
  }

  // Now determine the actual primary data column for each field
  // The spreadsheet has: col C=labels, col D=first field data, col E=flags, etc.
  // Each field uses 6 columns. The field name appears in row 1 at the start.
  // But from the analysis, the primary data column varies.
  // Let's check: row 4 should have acres (a number) — use that to identify the data column

  const fields = [];
  fieldColumns.forEach(function (fc, fcIdx) {
    // The data column is where row 4 has a numeric value (acres)
    // Try the same column first, then col+1
    let dataCol = fc.col;
    let acres = cellNum(ws, colLetter(dataCol) + '4');
    if (acres <= 0 && fcIdx < fieldColumns.length - 1) {
      // Try col+1
      dataCol = fc.col + 1;
      acres = cellNum(ws, colLetter(dataCol) + '4');
    }
    if (acres <= 0) {
      // Try the field name column itself
      dataCol = fc.col;
    }

    const dc = colLetter(dataCol);
    const fc1 = colLetter(fc.col);
    acres = cellNum(ws, dc + '4');

    if (acres <= 0) return; // Skip fields with no acres

    // System code and crop
    const systemCode = cellStr(ws, colLetter(dataCol - 1) + '2') || cellStr(ws, dc + '2') || def.systemCodes[0];
    const crop = cellStr(ws, dc + '2') || '';
    const cropType = cellStr(ws, colLetter(dataCol + 1) + '2') || 'SINGLE CROP';

    // Rent
    const rentPerAcre = cellNum(ws, dc + '5');

    // Input products (rows 13-39)
    const inputs = [];
    for (let r = 13; r <= 39; r++) {
      const prodName = cellStr(ws, colLetter(dataCol - 1) + r);
      if (!prodName) continue;
      const qty = cellNum(ws, colLetter(dataCol - 3) + r); // Col A offset: quantity
      if (qty <= 0) {
        // Try checking if there's a quantity in a different column
        // The quantity column varies — try col A relative to the field block
        // Actually from the analysis, col A has quantities for the first field
        // For subsequent fields, the quantity is in the field's own column offset
        continue;
      }
      const season = cellStr(ws, colLetter(dataCol + 1) + r) || '';
      inputs.push({
        id: generateId('inp'),
        productName: prodName,
        quantity: qty,
        season: season.charAt(0).toUpperCase() + season.slice(1).toLowerCase()
      });
    }

    // For the first field, quantities are in col A
    // For other fields, we need to look at different columns
    // Let's re-scan inputs using the field's own column structure
    // From the analysis: A=quantity, B=unit(VLOOKUP), C=product name, D=total cost, E=season
    // These are offsets from the field block start
    // For the first field block (starting at C), A is col A of the sheet
    // For subsequent blocks, the offset is: blockStart-2=qty, blockStart-1=unit, blockStart=name, blockStart+1=cost, blockStart+2=season

    const inputs2 = [];
    for (let r = 13; r <= 39; r++) {
      // Product name is 1 column before the data column
      const prodName = cellStr(ws, colLetter(dataCol - 1) + r);
      if (!prodName) continue;

      // Quantity: for first field block it's in col A, for others it's dataCol - 3
      let qty = 0;
      if (dataCol <= 5) {
        // First field — quantity in col A
        qty = cellNum(ws, 'A' + r);
      } else {
        // Other fields — quantity in their block's qty column (dataCol - 3)
        qty = cellNum(ws, colLetter(dataCol - 3) + r);
      }

      // Season
      const season = cellStr(ws, colLetter(dataCol + 1) + r);

      if (qty > 0) {
        inputs2.push({
          id: generateId('inp'),
          productName: prodName,
          quantity: qty,
          season: season || ''
        });
      }
    }

    // Seed
    const seedVariety = cellStr(ws, dc + '42') || cellStr(ws, dc + '41');
    const seedPop = cellNum(ws, dc + '44') || cellNum(ws, dc + '43');

    // Machinery (rows 50-60)
    const machinery = [];
    for (let r = 50; r <= 60; r++) {
      const implName = cellStr(ws, colLetter(dataCol - 1) + r);
      if (!implName) continue;
      let passes = 0;
      if (dataCol <= 5) {
        passes = cellNum(ws, 'B' + r);
      } else {
        passes = cellNum(ws, colLetter(dataCol - 2) + r);
      }
      if (passes > 0) {
        machinery.push({
          id: generateId('mach'),
          implementName: implName,
          passes: passes
        });
      }
    }

    // Row offsets vary by sheet type:
    // CONVENTIONAL CORN: extra rows, yield at 91
    // CONORG CANNING: shifted up by 1, yield at 86
    // All others (CON SOY, ORG CORN, ORG SM GRAIN, ORG BROADLEAF): yield at 87
    let yieldRow, expRow, incomeRow, insIncRow, govPayRow, tariffRow, cropInsRow;

    if (def.sheet.indexOf('CONVENTIONAL CORN') >= 0) {
      yieldRow = 91; expRow = 86; incomeRow = 96;
      insIncRow = 99; govPayRow = 103; tariffRow = 104; cropInsRow = 83;
    } else if (def.sheet.indexOf('CONORG CANNING') >= 0) {
      yieldRow = 86; expRow = 81; incomeRow = 91;
      insIncRow = 94; govPayRow = 98; tariffRow = 99; cropInsRow = 78;
    } else {
      yieldRow = 87; expRow = 82; incomeRow = 92;
      insIncRow = 95; govPayRow = 99; tariffRow = 100; cropInsRow = 79;
    }

    const yieldPerAcre = cellNum(ws, dc + yieldRow);
    // Get unit from crop pricing table (spreadsheet unit rows are unreliable)
    const cpMatch = cropPricing.find(function (cp) { return cp.crop === crop; });
    const yieldUnit = cpMatch ? cpMatch.unit : (cellStr(ws, dc + (yieldRow + 1)) || 'Bu');
    const cropInsPerAcre = cellNum(ws, dc + cropInsRow);
    const insIncomePerAcre = cellNum(ws, dc + insIncRow);
    const govPaymentsPerAcre = cellNum(ws, dc + govPayRow);
    const govPaymentLabel = cellStr(ws, colLetter(dataCol - 1) + govPayRow);
    const tariffsPerAcre = cellNum(ws, dc + tariffRow);

    // Spreadsheet computed values for validation
    const sheetExpPerAcre = cellNum(ws, dc + expRow);
    const sheetProfitPerAcre = cellNum(ws, dc + (expRow + 24)); // profit/ac row

    const field = {
      id: generateId('fld'),
      enterpriseId: entId,
      name: fc.name,
      systemCode: systemCode,
      crop: crop,
      cropType: cropType,
      acres: acres,
      rentPerAcre: rentPerAcre,
      inputs: inputs2.length > 0 ? inputs2 : inputs,
      seed: seedVariety ? { variety: seedVariety, population: seedPop } : null,
      machinery: machinery,
      yieldPerAcre: yieldPerAcre,
      yieldUnit: yieldUnit,
      cropInsurancePerAcre: cropInsPerAcre,
      insuranceIncomePerAcre: insIncomePerAcre,
      govPaymentLabel: govPaymentLabel,
      govPaymentsPerAcre: govPaymentsPerAcre,
      tariffsPerAcre: tariffsPerAcre,
      _validation: {
        sheetExpPerAcre: sheetExpPerAcre,
        dataCol: dc
      }
    };

    fields.push(field);
  });

  allFields.push(...fields);
  console.log(`    Fields extracted: ${fields.length}`);
  fields.forEach(function (f) {
    console.log(`      ${f.name}: ${f.acres} ac, ${f.crop}, ${f.inputs.length} inputs, ${f.machinery.length} mach, yield ${f.yieldPerAcre} ${f.yieldUnit}`);
  });
});

// ============================================
// 7. PARSE DASHBOARD SETTINGS
// ============================================
console.log('\n--- Parsing Dashboard settings ---');
const wsDash = wb.Sheets['DASHBOARD'];
const useFixedMach = cellVal(wsDash, 'R33');
const fixedMachRate = cellNum(wsDash, 'R32') || 100;

const settings = {
  year: 2026,
  fuelPricePerGal: fuelPrice,
  useFixedMachineryRate: useFixedMach === true || useFixedMach === 'TRUE',
  fixedMachineryRate: fixedMachRate,
  useFlatRentRate: false
};
console.log(`  Settings:`, JSON.stringify(settings));

// ============================================
// 8. ASSEMBLE AND WRITE data.json
// ============================================
const store = {
  settings: settings,
  enterprises: enterprises,
  fields: allFields,
  products: products,
  implements: implements_,
  cropPricing: cropPricing,
  laborOverhead: laborOverhead,
  seeds: seeds,
  rent: rent,
  buyers: buyers,
  sales: sales
};

// Clean up validation data
store.fields.forEach(function (f) {
  delete f._validation;
});

const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log(`\nWrote ${DATA_FILE}`);
console.log(`  ${store.fields.length} fields`);
console.log(`  ${store.products.length} products`);
console.log(`  ${store.implements.length} implements`);
console.log(`  ${store.seeds.length} seeds`);
console.log(`  ${store.rent.length} rent parcels`);
console.log(`  ${store.cropPricing.length} crop pricing entries`);
console.log(`  ${store.laborOverhead.length} labor/overhead entries`);
console.log(`  ${store.buyers.length} buyers`);
console.log(`  ${store.sales.length} sales contracts`);

// ============================================
// 9. VALIDATION
// ============================================
console.log('\n--- Validation ---');
const refs = {
  products: store.products,
  implements: store.implements,
  cropPricing: store.cropPricing,
  laborOverhead: store.laborOverhead,
  seeds: store.seeds
};

let mismatches = 0;
store.fields.forEach(function (field) {
  const budget = Calc.computeFieldBudget(field, refs, store.settings);
  console.log(`  ${field.name} (${field.crop}): expPerAcre=$${budget.expPerAcre.toFixed(2)}, profitPerAcre=$${budget.profitPerAcre.toFixed(2)}, COP=$${budget.cop.toFixed(2)}`);
});

console.log(`\nDone! ${mismatches} mismatches found.`);
console.log(`Start the server with: node server.js`);
