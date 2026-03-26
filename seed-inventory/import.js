#!/usr/bin/env node
'use strict';

/**
 * Import seed inventory data from "Archive of 2023 Seed inventory.xlsx"
 *
 * Usage:
 *   node import.js                                    # Uses default path
 *   node import.js "../Archive of 2023 Seed inventory.xlsx"
 *   node import.js --preview                          # Show what would be imported without saving
 *
 * Spreadsheet structure:
 *   SEED INVENTORY sheet — transaction log with seed deliveries, input deliveries, and returns
 *     Col A: Date              Col H: CROP           Col P: Input name
 *     Col B: Name              Col I: Variety         Col Q: Input Quantity
 *     Col C: LOT               Col K: Quantity        Col R: Input unit
 *     Col D: Ticket NUMBER     Col L: Unit type       Col S: Notes
 *     Col E: Product type      Col M: Pack quantity   Col T: Return QUANTITY (messy text)
 *     Col F: IN/OUT            Col N: Pack type       Col U: Return TYPE
 *     Col G: BRAND                                    Col V: Return Notes
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const previewOnly = args.includes('--preview');
const xlsxPath = args.find(function (a) { return !a.startsWith('--'); })
  || path.join(__dirname, '..', 'Archive of 2023 Seed inventory.xlsx');
const DATA_FILE = path.join(__dirname, 'data', 'data.json');

if (!fs.existsSync(xlsxPath)) {
  console.error('File not found: ' + xlsxPath);
  process.exit(1);
}

console.log('Reading: ' + xlsxPath);
var wb = XLSX.readFile(xlsxPath);

// --- Generate IDs ---
var idCounter = 0;
function generateId(prefix) {
  idCounter++;
  return prefix + '_imp_' + Date.now().toString(36) + '_' + idCounter.toString(36);
}

// --- Normalize helpers ---
function normalizeUnit(raw) {
  if (!raw) return 'units';
  var u = String(raw).trim().toLowerCase();
  if (u === 'lbs' || u === 'lb') return 'lbs';
  if (u === 'gal' || u === 'gallons' || u === 'gallon') return 'gal';
  if (u === 'bag' || u === 'bags') return 'bags';
  if (u === 'tons' || u === 'ton') return 'tons';
  if (u === 'box' || u === 'boxes') return 'boxes';
  if (u === 'pallet' || u === 'pallets') return 'pallets';
  if (u === 'units' || u === 'unit') return 'units';
  if (u === 'acre' || u === 'acres') return 'acre';
  return u;
}

function normalizeCrop(raw) {
  if (!raw) return '';
  var c = String(raw).trim();
  // Capitalize first letter of each word
  return c.replace(/\b\w/g, function (l) { return l.toUpperCase(); })
    .replace(/_/g, ' ');
}

function normalizeBrand(raw) {
  if (!raw) return '';
  var b = String(raw).trim();
  // Capitalize first letter
  return b.charAt(0).toUpperCase() + b.slice(1);
}

function parseDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    // Excel serial date
    var date = new Date((val - 25569) * 86400000);
    return date.toISOString().split('T')[0];
  }
  return String(val);
}

// --- Parse SEED INVENTORY sheet ---
var ws = wb.Sheets['SEED INVENTORY'];
if (!ws) {
  console.error('Sheet "SEED INVENTORY" not found');
  process.exit(1);
}

var range = XLSX.utils.decode_range(ws['!ref']);
console.log('Sheet range: ' + ws['!ref'] + ' (' + (range.e.r - range.s.r) + ' rows)');

// Accumulate unique products and suppliers
var productMap = {}; // key -> product
var supplierMap = {}; // name -> supplier
var receipts = [];
var returns = [];

for (var row = 2; row <= range.e.r; row++) { // Skip header row (0-indexed row 1 = row 2 in sheet)
  var date = ws[XLSX.utils.encode_cell({ r: row, c: 0 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 0 })].v : null;
  var name = ws[XLSX.utils.encode_cell({ r: row, c: 1 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 1 })].v : '';
  var lot = ws[XLSX.utils.encode_cell({ r: row, c: 2 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 2 })].v) : '';
  var ticket = ws[XLSX.utils.encode_cell({ r: row, c: 3 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 3 })].v) : '';
  var productType = ws[XLSX.utils.encode_cell({ r: row, c: 4 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 4 })].v).trim().toLowerCase() : '';
  var inout = ws[XLSX.utils.encode_cell({ r: row, c: 5 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 5 })].v).trim().toLowerCase() : '';
  var brand = ws[XLSX.utils.encode_cell({ r: row, c: 6 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 6 })].v).trim() : '';
  var crop = ws[XLSX.utils.encode_cell({ r: row, c: 7 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 7 })].v).trim() : '';
  var variety = ws[XLSX.utils.encode_cell({ r: row, c: 8 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 8 })].v).trim() : '';
  var qty = ws[XLSX.utils.encode_cell({ r: row, c: 10 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 10 })].v : null;
  var unit = ws[XLSX.utils.encode_cell({ r: row, c: 11 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 11 })].v : '';
  var packQty = ws[XLSX.utils.encode_cell({ r: row, c: 12 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 12 })].v : null;
  var packType = ws[XLSX.utils.encode_cell({ r: row, c: 13 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 13 })].v).trim() : '';
  var inputName = ws[XLSX.utils.encode_cell({ r: row, c: 15 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 15 })].v).trim() : '';
  var inputQty = ws[XLSX.utils.encode_cell({ r: row, c: 16 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 16 })].v : null;
  var inputUnit = ws[XLSX.utils.encode_cell({ r: row, c: 17 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 17 })].v).trim() : '';
  var notes = ws[XLSX.utils.encode_cell({ r: row, c: 18 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 18 })].v).trim() : '';
  var retQty = ws[XLSX.utils.encode_cell({ r: row, c: 19 })]
    ? ws[XLSX.utils.encode_cell({ r: row, c: 19 })].v : null;
  var retType = ws[XLSX.utils.encode_cell({ r: row, c: 20 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 20 })].v).trim() : '';
  var retNotes = ws[XLSX.utils.encode_cell({ r: row, c: 21 })]
    ? String(ws[XLSX.utils.encode_cell({ r: row, c: 21 })].v).trim() : '';

  if (!date && !brand && !inputName) continue; // Empty row

  var dateStr = parseDate(date);
  var isSeed = productType === 'seed' || (productType === '' && crop && !inputName);
  var isInput = productType === 'input' || (!productType && inputName);
  var isReturn = inout === 'return';

  // --- Process seed records ---
  if (isSeed && brand && (crop || variety)) {
    var normalCrop = normalizeCrop(crop);
    var normalBrand = normalizeBrand(brand);
    var prodKey = 'SEED:' + normalBrand + ':' + normalCrop + ':' + variety;

    if (!productMap[prodKey]) {
      productMap[prodKey] = {
        id: generateId('prod'),
        type: 'SEED',
        brand: normalBrand,
        supplier: normalBrand,
        crop: normalCrop,
        variety: variety,
        productName: '',
        inputCategory: '',
        unitType: normalizeUnit(unit),
        packSize: 0,
        packType: packType,
        organicCertNumber: '',
        omriListed: false,
        notes: '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Create supplier if brand is new
    if (normalBrand && !supplierMap[normalBrand]) {
      supplierMap[normalBrand] = {
        id: generateId('sup'),
        name: normalBrand,
        contactName: '',
        phone: '',
        email: '',
        address: '',
        notes: 'Imported from spreadsheet',
        active: true,
        createdAt: new Date().toISOString()
      };
    }

    var product = productMap[prodKey];
    var supplier = supplierMap[normalBrand];

    if (!isReturn && qty != null && qty !== 0) {
      receipts.push({
        id: generateId('rct'),
        orderId: '',
        productId: product.id,
        supplierId: supplier ? supplier.id : '',
        dateReceived: dateStr,
        quantityReceived: Math.abs(parseFloat(qty) || 0),
        unit: normalizeUnit(unit),
        lotNumber: lot,
        ticketNumber: ticket,
        receivedBy: String(name).trim(),
        verifiedBy: '',
        verificationMethod: 'MANUAL',
        photoPath: '',
        scanData: null,
        discrepancyFlag: false,
        discrepancyNotes: '',
        notes: notes,
        createdAt: new Date().toISOString()
      });
    }

    if (isReturn && qty != null) {
      returns.push({
        id: generateId('ret'),
        productId: product.id,
        orderId: '',
        supplierId: supplier ? supplier.id : '',
        dateReturned: dateStr,
        quantityReturned: Math.abs(parseFloat(qty) || 0),
        unit: normalizeUnit(unit),
        reason: notes || 'Returned',
        creditAmount: 0,
        creditReceived: false,
        processedBy: String(name).trim(),
        notes: retNotes || '',
        createdAt: new Date().toISOString()
      });
    }
  }

  // --- Process input records (cols P, Q, R) ---
  if (inputName && inputQty != null) {
    var inputProdKey = 'INPUT::' + inputName;

    if (!productMap[inputProdKey]) {
      // Guess category from name
      var category = 'OTHER';
      var lowerName = inputName.toLowerCase();
      if (lowerName.match(/urea|dap|potash|nitrogen|0-0-|46-0|18-46|10-34|13-0|tera.?fed/i)) {
        category = 'FERTILIZER';
      } else if (lowerName.match(/inoculant|vault|exceed|bradyrhizobium/i)) {
        category = 'INOCULANT';
      } else if (lowerName.match(/repel|battalion|homeplate|accomplish|cx-1|kelpak|follar/i)) {
        category = 'AMENDMENT';
      }

      productMap[inputProdKey] = {
        id: generateId('prod'),
        type: 'INPUT',
        brand: '',
        supplier: '',
        crop: '',
        variety: '',
        productName: inputName,
        inputCategory: category,
        unitType: normalizeUnit(inputUnit),
        packSize: 0,
        packType: '',
        organicCertNumber: '',
        omriListed: false,
        notes: '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    var inputProduct = productMap[inputProdKey];

    receipts.push({
      id: generateId('rct'),
      orderId: '',
      productId: inputProduct.id,
      supplierId: '',
      dateReceived: dateStr,
      quantityReceived: Math.abs(parseFloat(inputQty) || 0),
      unit: normalizeUnit(inputUnit),
      lotNumber: '',
      ticketNumber: ticket,
      receivedBy: String(name).trim(),
      verifiedBy: '',
      verificationMethod: 'MANUAL',
      photoPath: '',
      scanData: null,
      discrepancyFlag: false,
      discrepancyNotes: '',
      notes: notes,
      createdAt: new Date().toISOString()
    });
  }

  // --- Process return columns (T, U) — these are messy text, best-effort parse ---
  if (retQty && !isReturn) {
    var retStr = String(retQty).trim();
    // Try to extract a number from the text
    var numMatch = retStr.match(/(\d+)\s*$/);
    if (numMatch) {
      var retNum = parseInt(numMatch[1]);
      // Try to find the product from the text or from the same row
      var retProductId = '';
      if (brand && (crop || variety)) {
        var rpKey = 'SEED:' + normalizeBrand(brand) + ':' + normalizeCrop(crop) + ':' + variety;
        if (productMap[rpKey]) retProductId = productMap[rpKey].id;
      }

      if (retProductId && retNum > 0) {
        returns.push({
          id: generateId('ret'),
          productId: retProductId,
          orderId: '',
          supplierId: supplier ? supplier.id : '',
          dateReturned: dateStr,
          quantityReturned: retNum,
          unit: normalizeUnit(retType || unit),
          reason: retStr,
          creditAmount: 0,
          creditReceived: false,
          processedBy: String(name).trim(),
          notes: retNotes || '',
          createdAt: new Date().toISOString()
        });
      }
    }
  }
}

// --- Build final store ---
var products = Object.values(productMap);
var suppliers = Object.values(supplierMap);

var seedProducts = products.filter(function (p) { return p.type === 'SEED'; });
var inputProducts = products.filter(function (p) { return p.type === 'INPUT'; });

console.log('\n=== Import Summary ===');
console.log('Seed products:  ' + seedProducts.length);
console.log('Input products: ' + inputProducts.length);
console.log('Suppliers:      ' + suppliers.length);
console.log('Receipts:       ' + receipts.length);
console.log('Returns:        ' + returns.length);

console.log('\nSeed products:');
seedProducts.forEach(function (p) {
  console.log('  ' + p.brand + ' - ' + p.crop + ' ' + p.variety + ' (' + p.unitType + ')');
});

console.log('\nInput products:');
inputProducts.forEach(function (p) {
  console.log('  ' + p.productName + ' [' + p.inputCategory + '] (' + p.unitType + ')');
});

console.log('\nSuppliers:');
suppliers.forEach(function (s) {
  console.log('  ' + s.name);
});

if (previewOnly) {
  console.log('\n-- Preview mode: no data saved --');
  process.exit(0);
}

// --- Save to data.json ---
// Load existing store or create new
var store = {
  products: [],
  suppliers: [],
  forecasts: [],
  orders: [],
  receipts: [],
  returns: [],
  settings: { cropYear: 2026, defaultUnit: 'units' }
};

if (fs.existsSync(DATA_FILE)) {
  store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log('\nExisting data found. Merging (existing records preserved).');
}

// Add imported data (don't overwrite existing)
store.products = store.products.concat(products);
store.suppliers = store.suppliers.concat(suppliers);
store.receipts = store.receipts.concat(receipts);
store.returns = store.returns.concat(returns);

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
console.log('\nData saved to ' + DATA_FILE);
console.log('Total records: ' + store.products.length + ' products, ' +
  store.suppliers.length + ' suppliers, ' +
  store.receipts.length + ' receipts, ' +
  store.returns.length + ' returns');
