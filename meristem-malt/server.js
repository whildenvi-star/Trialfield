#!/usr/bin/env node
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3003;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const MAX_BACKUPS = 5;

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'meristem-malt', uptime: process.uptime() }));

const corsOptions = {
  origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// perf: Cache-Control on GET API responses — config/pricing rarely changes
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// --- In-memory data store ---
let store = {
  config: {
    grainType: 'conv_barley',
    batchSizeLbs: 500,
    maltYieldPct: 80,
    batchesPerYear: 12,
    grainCostPerBushel: 17,
    variableCosts: [
      { id: 'vc_water', name: 'Water', amount: 1.30, perBatch: true },
      { id: 'vc_electric', name: 'Electrical', amount: 100, perBatch: true },
      { id: 'vc_grain', name: 'Grain (auto-calculated)', amount: 0, perBatch: true, autoCalc: true },
      { id: 'vc_labor', name: 'Labor', amount: 490, perBatch: true, laborRate: 35, laborHours: 14 },
      { id: 'vc_testing', name: 'Grain Testing', amount: 150, perBatch: true }
    ],
    fixedCosts: [
      { id: 'fc_space', name: 'Commercial Space Rental', amount: 3600 },
      { id: 'fc_insurance', name: 'Insurance', amount: 0 },
      { id: 'fc_organic', name: 'Organic Certification', amount: 0 },
      { id: 'fc_safety', name: 'Food Safety Permits', amount: 0 },
      { id: 'fc_marketing', name: 'Marketing', amount: 0 },
      { id: 'fc_accounting', name: 'Accounting', amount: 0 }
    ],
    equipment: [
      { id: 'eq_polybox', name: 'Poly Pro Boxes (8)', cost: 4800, usefulLife: 10 },
      { id: 'eq_datalog', name: 'Data Loggers', cost: 924.73, usefulLife: 7 },
      { id: 'eq_moisture', name: 'Moisture Balance', cost: 4000, usefulLife: 10 },
      { id: 'eq_sacks', name: '50lb Sacks (initial stock)', cost: 500, usefulLife: 1 },
      { id: 'eq_stitcher', name: 'Bag Stitcher', cost: 395.42, usefulLife: 10 }
    ],
    forgottenCosts: [
      { id: 'hc_liability', name: 'Product Liability Insurance', enabled: false, amount: 1200, perBatch: false },
      { id: 'hc_organic', name: 'Organic Certification', enabled: false, amount: 1500, perBatch: false },
      { id: 'hc_food_safety', name: 'Food Safety Licensing/Permits', enabled: false, amount: 500, perBatch: false },
      { id: 'hc_freight', name: 'Freight/Shipping', enabled: false, amount: 50, perBatch: true },
      { id: 'hc_shrink', name: 'Shrink/Loss Factor', enabled: false, amount: 7.5, perBatch: true, isPercent: true },
      { id: 'hc_fuel', name: 'Fuel/Gas for Kilning', enabled: false, amount: 30, perBatch: true },
      { id: 'hc_maintenance', name: 'Equipment Maintenance (2%/yr)', enabled: false, amount: 0, perBatch: false, autoCalcPct: 0.02 },
      { id: 'hc_cleaning', name: 'Cleaning/Sanitation Supplies', enabled: false, amount: 20, perBatch: true },
      { id: 'hc_qc', name: 'Quality Control Testing', enabled: false, amount: 50, perBatch: true },
      { id: 'hc_website', name: 'Website/Online Presence', enabled: false, amount: 200, perBatch: false },
      { id: 'hc_bookkeeping', name: 'Accounting/Bookkeeping', enabled: false, amount: 500, perBatch: false }
    ],
    scenarios: {
      pessimistic: { batchesPerYear: 6, batchSizeLbs: 300, sellingPricePerLb: 3.00 },
      base: { batchesPerYear: 12, batchSizeLbs: 500, sellingPricePerLb: 3.00 },
      optimistic: { batchesPerYear: 24, batchSizeLbs: 500, sellingPricePerLb: 5.00 }
    }
  },
  pricing: {
    conv_corn: 3.00,
    conv_barley: 3.00,
    conv_wheat: 3.00,
    conv_rye: 3.00,
    org_corn: 5.00,
    org_barley: 5.00,
    org_wheat: 5.00,
    org_rye: 5.00
  }
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

let writeQueue = Promise.resolve();
function withLock(fn) {
  const p = writeQueue.then(fn, fn);
  writeQueue = p.catch(() => {});
  return p;
}

// Async file helpers — avoid blocking event loop during writes
const fsp = fs.promises;

function saveData() {
  return withLock(async () => {
    // Rotate backups (async to avoid blocking event loop)
    for (let i = MAX_BACKUPS; i > 1; i--) {
      const from = DATA_FILE + '.bak.' + (i - 1);
      const to = DATA_FILE + '.bak.' + i;
      try { await fsp.rename(from, to); } catch (e) { /* backup slot empty */ }
    }
    try { await fsp.copyFile(DATA_FILE, DATA_FILE + '.bak.1'); } catch (e) { /* first save */ }
    const tmp = DATA_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(store, null, 2));
    await fsp.rename(tmp, DATA_FILE);
  });
}

// --- API Routes ---
app.get('/api/config', (req, res) => {
  res.json(store.config);
});

app.put('/api/config', async (req, res) => {
  store.config = req.body;
  await saveData();
  res.json(store.config);
});

app.get('/api/pricing', (req, res) => {
  res.json(store.pricing);
});

app.put('/api/pricing', async (req, res) => {
  store.pricing = req.body;
  await saveData();
  res.json(store.pricing);
});

// --- Start ---
loadData();
console.log('Meristem Malt config loaded');

app.listen(PORT, '0.0.0.0', () => {
  console.log('Meristem Malt Cost Calculator running at http://localhost:' + PORT);
});
