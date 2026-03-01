#!/usr/bin/env node
'use strict';

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const Calc = require('./public/calc.js');
const fieldopsClient = require('./fieldops/client');
const fieldopsSync = require('./fieldops/sync');
// node-cron loaded on demand only when FieldOps sync is enabled

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const MAX_BACKUPS = 5;

// Gzip all responses — ~60-70% payload reduction for JSON/HTML/JS/CSS
app.use(compression());
app.use(express.json({ limit: '50mb' }));
// Static files: cache for 1 hour in browser, revalidate via ETag
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// perf: Cache-Control on GET API responses — reference data cached longer
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    const isRefData = /^\/(crop-names|implement-names|settings)/.test(req.path);
    res.set('Cache-Control', isRefData ? 'public, max-age=60' : 'public, max-age=10');
  }
  next();
});

// --- In-memory data store ---
let store = {
  settings: {
    year: 2026,
    fuelPricePerGal: 5.00,
    useFixedMachineryRate: false,
    fixedMachineryRate: 100.00,
    useFlatRentRate: false,
    wageRate: 25,
    carryMonths: 6
  },
  enterprises: [],
  fields: [],
  products: [],
  implements: [],
  cropPricing: [],
  cropTypes: [],
  laborOverhead: [],
  seeds: [],
  rent: [],
  buyers: [],
  sales: [],
  suppliers: [],
  programs: [],
  farmGeoJSON: null
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

// Write lock: simple promise queue
let writeQueue = Promise.resolve();
function withLock(fn) {
  const p = writeQueue.then(fn, fn);
  writeQueue = p.catch(() => {});
  return p;
}

// Async file helpers — avoid blocking the event loop during writes
const fsp = fs.promises;

async function saveDataImmediate() {
  return withLock(async () => {
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

// Debounced save: coalesces rapid edits into a single disk write.
// Waits 500ms of inactivity before flushing. Each call resets the timer.
// Before: 10 rapid edits = 10 × 332KB writes. After: 1 × 332KB write.
let _saveTimer = null;
let _savePromise = null;
let _saveResolvers = [];
function saveData() {
  return new Promise((resolve, reject) => {
    _saveResolvers.push({ resolve, reject });
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      const resolvers = _saveResolvers.splice(0);
      saveDataImmediate()
        .then(() => resolvers.forEach(r => r.resolve()))
        .catch(err => resolvers.forEach(r => r.reject(err)));
    }, 500);
  });
}

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// --- Helper: build refs object for calc engine ---
function getRefs() {
  return {
    products: store.products,
    implements: store.implements,
    cropPricing: store.cropPricing,
    cropTypes: store.cropTypes,
    laborOverhead: store.laborOverhead,
    seeds: store.seeds,
    buyers: store.buyers
  };
}

function enrichField(field) {
  const budget = Calc.computeFieldBudget(field, getRefs(), store.settings);
  return Object.assign({}, field, { _computed: budget });
}

// Clear crop pricing cache whenever pricing data changes
function clearPricingCache() {
  Calc.clearCropPricingCache();
}

// =============================================
// API ROUTES
// =============================================

// --- Settings ---
app.get('/api/settings', (req, res) => {
  res.json(store.settings);
});

app.put('/api/settings', async (req, res) => {
  const allowed = ['year', 'fuelPricePerGal', 'useFixedMachineryRate', 'fixedMachineryRate', 'useFlatRentRate', 'wageRate', 'carryMonths'];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) store.settings[k] = req.body[k];
  });
  await saveData();
  res.json(store.settings);
});

// --- Dashboard ---
app.get('/api/dashboard', (req, res) => {
  const yieldMode = req.query.yieldMode === 'actual' ? 'actual' : 'projected';
  const dashboard = Calc.computeDashboard(store.fields, store.enterprises, getRefs(), store.settings, { yieldMode });
  res.json(dashboard);
});

// --- Enterprises ---
app.get('/api/enterprises', (req, res) => {
  res.json(store.enterprises);
});

app.get('/api/enterprises/:id', (req, res) => {
  const ent = store.enterprises.find(e => e.id === req.params.id);
  if (!ent) return res.status(404).json({ error: 'Enterprise not found' });
  const entFields = store.fields.filter(f => f.enterpriseId === ent.id);
  const summary = Calc.computeEnterpriseSummary(entFields, getRefs(), store.settings);
  res.json({ enterprise: ent, ...summary });
});

// --- Fields ---
app.get('/api/fields', (req, res) => {
  let fields = store.fields;
  if (req.query.enterpriseId) {
    fields = fields.filter(f => f.enterpriseId === req.query.enterpriseId);
  }
  // Skip enrichment for bulk queries (implement usage, etc.)
  if (req.query.all === 'true') {
    return res.json(fields);
  }
  res.json(fields.map(enrichField));
});

app.get('/api/fields/:id', (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  res.json(enrichField(field));
});

app.post('/api/fields', async (req, res) => {
  const field = Object.assign({ id: generateId('fld') }, req.body);
  if (!field.inputs) field.inputs = [];
  if (!field.machinery) field.machinery = [];
  store.fields.push(field);
  await saveData();
  res.status(201).json(enrichField(field));
});

app.put('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });

  // Merge all provided fields
  const updatable = [
    'name', 'enterpriseId', 'systemCode', 'crop', 'cropType',
    'acres', 'rentPerAcre', 'inputs', 'seed', 'machinery',
    'yieldPerAcre', 'yieldUnit', 'cropInsurancePerAcre',
    'insuranceIncomePerAcre', 'govPaymentLabel', 'govPaymentsPerAcre',
    'auxPayments', 'tariffsPerAcre', 'geometry', 'harvestMoisture', 'buyerId', 'templateId'
  ];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) store.fields[idx][k] = req.body[k];
  });

  await saveData();
  res.json(enrichField(store.fields[idx]));
});

app.delete('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });
  store.fields.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// --- Generic CRUD factory ---
function crudRoutes(path, collectionName, prefix, parseFields, onChange) {
  app.get(`/api/${path}`, (req, res) => {
    res.json(store[collectionName]);
  });

  app.post(`/api/${path}`, async (req, res) => {
    const item = Object.assign({ id: generateId(prefix) }, req.body);
    store[collectionName].push(item);
    await saveData();
    if (onChange) onChange();
    res.status(201).json(item);
  });

  app.put(`/api/${path}/:id`, async (req, res) => {
    const idx = store[collectionName].findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    Object.assign(store[collectionName][idx], req.body);
    await saveData();
    if (onChange) onChange();
    res.json(store[collectionName][idx]);
  });

  app.delete(`/api/${path}/:id`, async (req, res) => {
    const idx = store[collectionName].findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    store[collectionName].splice(idx, 1);
    await saveData();
    if (onChange) onChange();
    res.json({ ok: true });
  });
}

// Products (Inputs)
crudRoutes('products', 'products', 'prod');

// Implements
crudRoutes('implements', 'implements', 'impl');

// Seeds
crudRoutes('seeds', 'seeds', 'seed');

// Rent — removed (managed in Farm Registry app)
// Data retained in store.rent for backward compat

// --- Bulk sync acres & rent from Farm Registry ---
const REGISTRY_URL = process.env.FARM_REGISTRY_URL || 'http://localhost:3005';

app.post('/api/fields/sync-registry', async (req, res) => {
  try {
    const resp = await fetch(REGISTRY_URL + '/api/fields?active=true');
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();

    // Build lookup: lowercased name/alias → registry field
    const regLookup = {};
    regFields.forEach(rf => {
      regLookup[rf.name.toLowerCase()] = rf;
      (rf.aliases || []).forEach(a => { regLookup[a.toLowerCase()] = rf; });
    });

    const results = { synced: [], unmatched: [], unchanged: [] };
    let changed = false;

    store.fields.forEach(field => {
      const match = regLookup[(field.name || '').toLowerCase()];
      if (!match) {
        results.unmatched.push(field.name);
        return;
      }

      let fieldChanged = false;

      // Sync acres
      if (Math.abs((field.acres || 0) - match.reportingAcres) > 0.001) {
        field.acres = match.reportingAcres;
        fieldChanged = true;
      }

      // Sync rent: derive $/ac from registry totalRentDollars
      if (match.totalRentDollars > 0 && match.reportingAcres > 0) {
        var rate = Math.round((match.totalRentDollars / match.reportingAcres) * 100) / 100;
        if (Math.abs((field.rentPerAcre || 0) - rate) > 0.001) {
          field.rentPerAcre = rate;
          fieldChanged = true;
        }
      }

      if (fieldChanged) {
        results.synced.push({ name: field.name, acres: field.acres, rentPerAcre: field.rentPerAcre });
        changed = true;
      } else {
        results.unchanged.push(field.name);
      }
    });

    if (changed) await saveData();
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Registry sync failed: ' + err.message });
  }
});

// Crop Pricing (legacy, kept for backward compat)
crudRoutes('crop-pricing', 'cropPricing', 'cp', null, clearPricingCache);

// Crop Types (hierarchical)
crudRoutes('crop-types', 'cropTypes', 'ctype', null, clearPricingCache);

// Labor/Overhead
crudRoutes('labor-overhead', 'laborOverhead', 'lo');

// Sales
crudRoutes('sales', 'sales', 'sale');

// Buyers — basis affects pricing
crudRoutes('buyers', 'buyers', 'buy', null, clearPricingCache);

// Suppliers
crudRoutes('suppliers', 'suppliers', 'sup');

// Programs (Agronomic Templates) — custom CRUD to handle delete cleanup
app.get('/api/programs', (req, res) => {
  res.json(store.programs);
});

app.post('/api/programs', async (req, res) => {
  const item = Object.assign({ id: generateId('prog') }, req.body);
  store.programs.push(item);
  await saveData();
  res.status(201).json(item);
});

app.put('/api/programs/:id', async (req, res) => {
  const idx = store.programs.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(store.programs[idx], req.body);
  await saveData();
  res.json(store.programs[idx]);
});

app.delete('/api/programs/:id', async (req, res) => {
  const idx = store.programs.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const progId = store.programs[idx].id;
  store.programs.splice(idx, 1);
  // Clear templateId on linked fields
  store.fields.forEach(f => {
    if (f.templateId === progId) f.templateId = '';
  });
  await saveData();
  res.json({ ok: true });
});

// --- Program special endpoints ---
// Apply program to single field
app.post('/api/programs/:id/apply/:fieldId', async (req, res) => {
  const prog = store.programs.find(p => p.id === req.params.id);
  if (!prog) return res.status(404).json({ error: 'Program not found' });
  const idx = store.fields.findIndex(f => f.id === req.params.fieldId);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });

  const agronomicKeys = [
    'crop', 'systemCode', 'cropType', 'inputs', 'seed', 'machinery',
    'yieldPerAcre', 'yieldUnit', 'cropInsurancePerAcre',
    'harvestMoisture', 'buyerId'
  ];
  agronomicKeys.forEach(k => {
    if (prog[k] !== undefined) {
      store.fields[idx][k] = JSON.parse(JSON.stringify(prog[k]));
    }
  });
  (store.fields[idx].inputs || []).forEach(inp => { inp.id = generateId('inp'); });
  (store.fields[idx].machinery || []).forEach(m => { m.id = generateId('mach'); });
  store.fields[idx].templateId = prog.id;

  await saveData();
  res.json(enrichField(store.fields[idx]));
});

// Bulk apply program to multiple fields
app.post('/api/programs/:id/apply-bulk', async (req, res) => {
  const prog = store.programs.find(p => p.id === req.params.id);
  if (!prog) return res.status(404).json({ error: 'Program not found' });
  const fieldIds = req.body.fieldIds || [];

  const agronomicKeys = [
    'crop', 'systemCode', 'cropType', 'inputs', 'seed', 'machinery',
    'yieldPerAcre', 'yieldUnit', 'cropInsurancePerAcre',
    'harvestMoisture', 'buyerId'
  ];
  var updated = 0;
  fieldIds.forEach(fid => {
    const idx = store.fields.findIndex(f => f.id === fid);
    if (idx === -1) return;
    agronomicKeys.forEach(k => {
      if (prog[k] !== undefined) {
        store.fields[idx][k] = JSON.parse(JSON.stringify(prog[k]));
      }
    });
    (store.fields[idx].inputs || []).forEach(inp => { inp.id = generateId('inp'); });
    (store.fields[idx].machinery || []).forEach(m => { m.id = generateId('mach'); });
    store.fields[idx].templateId = prog.id;
    updated++;
  });

  await saveData();
  res.json({ updated: updated });
});

// Create program from existing field
app.post('/api/programs/from-field/:fieldId', async (req, res) => {
  const field = store.fields.find(f => f.id === req.params.fieldId);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const prog = {
    id: generateId('prog'),
    name: req.body.name || (field.crop + ' Program'),
    description: req.body.description || ('Created from ' + field.name),
    crop: field.crop || '',
    systemCode: field.systemCode || 'CON',
    cropType: field.cropType || 'SINGLE CROP',
    inputs: JSON.parse(JSON.stringify(field.inputs || [])),
    seed: field.seed ? JSON.parse(JSON.stringify(field.seed)) : null,
    machinery: JSON.parse(JSON.stringify(field.machinery || [])),
    yieldPerAcre: field.yieldPerAcre || 0,
    yieldUnit: field.yieldUnit || 'Bu',
    cropInsurancePerAcre: field.cropInsurancePerAcre || 0,
    harvestMoisture: field.harvestMoisture || 0,
    buyerId: field.buyerId || '',
    createdFromFieldId: field.id
  };

  store.programs.push(prog);
  await saveData();
  res.status(201).json(prog);
});

// --- Convenience endpoints ---
app.get('/api/crop-names', (req, res) => {
  // Derive from cropTypes if available, fall back to cropPricing
  if (store.cropTypes && store.cropTypes.length > 0) {
    var names = [];
    store.cropTypes.forEach(function (ct) {
      (ct.subCrops || []).forEach(function (sc) { names.push(sc.name); });
    });
    res.json([...new Set(names)].sort());
  } else {
    const names = [...new Set(store.cropPricing.map(cp => cp.crop))].sort();
    res.json(names);
  }
});

app.get('/api/product-names', (req, res) => {
  const names = store.products.map(p => p.name).sort();
  res.json(names);
});

app.get('/api/implement-names', (req, res) => {
  const names = store.implements.map(i => i.name).sort();
  res.json(names);
});

app.get('/api/seed-varieties', (req, res) => {
  const varieties = store.seeds.map(s => ({
    variety: s.variety,
    brand: s.brand,
    crop: s.crop,
    pricePerUnit: s.pricePerUnit
  }));
  res.json(varieties);
});

// --- CBOT Futures Fetch (with 15-minute cache) ---
// Before: every click = live Yahoo Finance HTTP call. After: cached for 15 min per symbol.
const _cbotCache = {};        // { symbol: { price, timestamp, data } }
const CBOT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

app.get('/api/cbot-fetch', async (req, res) => {
  var symbol = req.query.symbol;
  if (!symbol) return res.json({ error: 'Missing symbol parameter', price: null });

  // Build Yahoo Finance symbol: accept full (ZCZ26.CBT) or root (ZCZ)
  var yahooSymbol;
  if (symbol.includes('.')) {
    yahooSymbol = symbol;
  } else {
    var year = String(new Date().getFullYear()).slice(-2);
    yahooSymbol = symbol + year + '.CBT';
  }

  // Return cached price if fresh (within 15 min)
  var cached = _cbotCache[yahooSymbol];
  if (cached && (Date.now() - cached.fetchedAt < CBOT_CACHE_TTL)) {
    return res.json({ price: cached.price, symbol: yahooSymbol, source: 'cache', timestamp: cached.timestamp });
  }

  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSymbol);
  try {
    var https = require('https');
    var data = await new Promise(function (resolve, reject) {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function (resp) {
        var body = '';
        resp.on('data', function (chunk) { body += chunk; });
        resp.on('end', function () {
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
        });
      }).on('error', reject);
    });

    if (data.chart && data.chart.result && data.chart.result[0]) {
      var meta = data.chart.result[0].meta;
      var rawPrice = meta.regularMarketPrice;
      var price = Math.round((rawPrice / 100) * 10000) / 10000; // CBOT cents → dollars
      var ts = new Date().toISOString();
      // Cache the result
      _cbotCache[yahooSymbol] = { price: price, timestamp: ts, fetchedAt: Date.now() };
      res.json({ price: price, symbol: yahooSymbol, source: 'yahoo', timestamp: ts });
    } else {
      res.json({ error: 'No data returned for ' + yahooSymbol, price: null });
    }
  } catch (err) {
    // On error, serve stale cache if available
    if (cached) {
      return res.json({ price: cached.price, symbol: yahooSymbol, source: 'stale-cache', timestamp: cached.timestamp });
    }
    res.json({ error: 'Fetch failed: ' + err.message, price: null });
  }
});

// --- Farm GeoJSON (shapefile data) ---
app.get('/api/farm-geojson', (req, res) => {
  res.json(store.farmGeoJSON || null);
});

app.put('/api/farm-geojson', async (req, res) => {
  store.farmGeoJSON = req.body;
  await saveData();
  res.json({ ok: true });
});

// --- FieldOps Integration Routes ---
app.get('/api/fieldops/status', (req, res) => {
  res.json({
    configured: fieldopsClient.isConfigured(),
    useMock: fieldopsClient.useMock(),
    syncEnabled: process.env.FIELDOPS_SYNC_ENABLED === 'true',
    syncIntervalMinutes: parseInt(process.env.FIELDOPS_SYNC_INTERVAL_MINUTES) || 60,
    lastSync: store.fieldopsSync ? store.fieldopsSync.lastSync : null,
    lastStatus: store.fieldopsSync ? store.fieldopsSync.lastStatus : null,
    lastError: store.fieldopsSync ? store.fieldopsSync.lastError : null
  });
});

app.get('/api/fieldops/history', (req, res) => {
  res.json(store.fieldopsSync ? store.fieldopsSync.history : []);
});

app.post('/api/fieldops/sync', async (req, res) => {
  try {
    var result = await fieldopsSync.runSync(store, generateId, saveData);
    res.json(result);
  } catch (err) {
    console.error('[FieldOps] Manual sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fieldops/applications/:fieldId', (req, res) => {
  var field = store.fields.find(function (f) { return f.id === req.params.fieldId; });
  if (!field) return res.status(404).json({ error: 'Field not found' });
  res.json(field._fieldops ? field._fieldops.applications || [] : []);
});

app.get('/api/fieldops/yield-history/:fieldId', (req, res) => {
  var field = store.fields.find(function (f) { return f.id === req.params.fieldId; });
  if (!field) return res.status(404).json({ error: 'Field not found' });
  res.json(field._fieldops ? field._fieldops.yieldHistory || [] : []);
});

// --- Data migration: add overhead subcategories if missing ---
function migrateData() {
  var changed = false;
  // Add overhead breakdown fields to laborOverhead
  (store.laborOverhead || []).forEach(function (lo) {
    if (lo.cropInsurance === undefined) {
      var overhead = lo.overheadPerAcre || 0;
      var each = Math.round(overhead / 5 * 100) / 100;
      var remainder = Math.round((overhead - each * 4) * 100) / 100;
      lo.cropInsurance = each;
      lo.propertyTax = each;
      lo.management = each;
      lo.utilities = each;
      lo.misc = remainder;
      changed = true;
    }
  });
  // Add customHireRate and defaultMode to implements
  (store.implements || []).forEach(function (impl) {
    if (impl.customHireRate === undefined) {
      impl.customHireRate = 0;
      impl.defaultMode = 'owned';
      changed = true;
    }
  });
  // Add laborHoursPerAcre to implements
  (store.implements || []).forEach(function (impl) {
    if (impl.laborHoursPerAcre === undefined) {
      impl.laborHoursPerAcre = 0;
      changed = true;
    }
  });
  // Add suppliers collection
  if (!store.suppliers) {
    store.suppliers = [];
    changed = true;
  }
  // Add supplierId to products
  (store.products || []).forEach(function (p) {
    if (p.supplierId === undefined) {
      p.supplierId = '';
      changed = true;
    }
  });
  // Add supplierId to seeds
  (store.seeds || []).forEach(function (s) {
    if (s.supplierId === undefined) {
      s.supplierId = '';
      changed = true;
    }
  });
  // Add landlordId to rent
  (store.rent || []).forEach(function (r) {
    if (r.landlordId === undefined) {
      r.landlordId = '';
      changed = true;
    }
  });
  // Add discountSchedule to buyers
  (store.buyers || []).forEach(function (b) {
    if (b.discountSchedule === undefined) {
      b.discountSchedule = [];
      changed = true;
    }
  });
  // Add wageRate and carryMonths to settings
  if (store.settings.wageRate === undefined) {
    store.settings.wageRate = 25;
    changed = true;
  }
  if (store.settings.carryMonths === undefined) {
    store.settings.carryMonths = 6;
    changed = true;
  }
  // Add harvestMoisture and buyerId to fields
  (store.fields || []).forEach(function (f) {
    if (f.harvestMoisture === undefined) {
      f.harvestMoisture = 0;
      changed = true;
    }
    if (f.buyerId === undefined) {
      f.buyerId = '';
      changed = true;
    }
  });
  // Add programs collection
  if (!store.programs) {
    store.programs = [];
    changed = true;
  }
  // Add templateId to fields
  (store.fields || []).forEach(function (f) {
    if (f.templateId === undefined) {
      f.templateId = '';
      changed = true;
    }
  });
  // Migrate govPaymentsPerAcre + tariffsPerAcre → auxPayments[]
  (store.fields || []).forEach(function (f) {
    if (f.auxPayments === undefined) {
      f.auxPayments = [];
      if (f.govPaymentsPerAcre > 0) {
        f.auxPayments.push({
          label: f.govPaymentLabel || 'Gov Payment',
          perAcre: f.govPaymentsPerAcre
        });
      }
      if (f.tariffsPerAcre > 0) {
        f.auxPayments.push({
          label: 'Tariffs',
          perAcre: f.tariffsPerAcre
        });
      }
      changed = true;
    }
  });
  // Add defaultMoisture to crop pricing records
  var moistureDefaults = {
    corn: 15.5, soybeans: 13.0, soybean: 13.0, beans: 13.0, wheat: 13.5,
    rye: 13.5, barley: 13.5, sorghum: 13.0, hemp: 10.0, hay: 15.0,
    peas: 13.0, kernza: 13.0, vetch: 12.0, sunflowers: 10.0
  };
  (store.cropPricing || []).forEach(function (cp) {
    if (cp.defaultMoisture === undefined) {
      var cropLower = (cp.crop || '').toLowerCase();
      var match = Object.keys(moistureDefaults).find(function (key) {
        return cropLower.indexOf(key) !== -1;
      });
      cp.defaultMoisture = match ? moistureDefaults[match] : 0;
      changed = true;
    }
  });
  // Migrate cropPricing → cropTypes (hierarchical)
  if (!store.cropTypes) store.cropTypes = [];
  if (store.cropTypes.length === 0 && store.cropPricing && store.cropPricing.length > 0) {
    // Grouping rules — ordered by specificity (most specific first)
    var typeRules = [
      { name: 'Sweet Corn', test: /sweet\s*corn/i, color: '#0288d1', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Tons', defaultMoisture: 15.5, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Food Beans', test: /snap\s*bean|lima\s*bean|food\s*bean/i, color: '#ad1457', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Tons', defaultMoisture: 13.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Corn', test: /corn/i, color: '#1565c0', cbotRef: 'CBOT Corn', cbotSymbol: 'ZCZ', pricingMode: 'cbot', defaultUnit: 'Bu', defaultMoisture: 15.5, defaultDrying: 0.3, defaultInterest: 0.06 },
      { name: 'Soybeans', test: /soy|bean/i, color: '#2e7d32', cbotRef: 'CBOT beans', cbotSymbol: 'ZSX', pricingMode: 'cbot', defaultUnit: 'Bu', defaultMoisture: 13.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Wheat', test: /wheat/i, color: '#f9a825', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.5, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Rye', test: /rye/i, color: '#00695c', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.5, defaultDrying: 0.2, defaultInterest: 0.06 },
      { name: 'Barley', test: /barley/i, color: '#e65100', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.5, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Sorghum', test: /sorghum/i, color: '#7b1fa2', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.0, defaultDrying: 0.3, defaultInterest: 0.06 },
      { name: 'Hay', test: /hay/i, color: '#558b2f', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Tons', defaultMoisture: 15.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Hemp', test: /hemp/i, color: '#6d4c41', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Lbs', defaultMoisture: 10.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Peas', test: /peas?(?:\s|$)/i, color: '#009688', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Sunflowers', test: /sunflower/i, color: '#fbc02d', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Lbs', defaultMoisture: 10.0, defaultDrying: 0, defaultInterest: 0.06 },
      { name: 'Kernza', test: /kernza/i, color: '#827717', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 13.0, defaultDrying: 0.3, defaultInterest: 0.06 },
      { name: 'Vetch', test: /vetch/i, color: '#4e342e', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Lbs', defaultMoisture: 12.0, defaultDrying: 0, defaultInterest: 0.06 }
    ];

    // Group records by type
    var groups = {};
    var cbotRecords = {};
    store.cropPricing.forEach(function (cp) {
      var cropName = cp.crop || '';
      // Identify CBOT reference records
      if (/^cbot\s/i.test(cropName)) {
        cbotRecords[cropName] = cp;
        return;
      }
      // Find matching type rule
      var matched = false;
      for (var r = 0; r < typeRules.length; r++) {
        if (typeRules[r].test.test(cropName)) {
          var typeName = typeRules[r].name;
          if (!groups[typeName]) groups[typeName] = { rule: typeRules[r], records: [] };
          groups[typeName].records.push(cp);
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (!groups['Other']) groups['Other'] = { rule: { name: 'Other', color: '#455a64', cbotSymbol: '', pricingMode: 'manual', defaultUnit: 'Bu', defaultMoisture: 0, defaultDrying: 0, defaultInterest: 0.06 }, records: [] };
        groups['Other'].records.push(cp);
      }
    });

    // Build cropTypes from groups
    var ctypeId = 1;
    Object.keys(groups).forEach(function (typeName) {
      var g = groups[typeName];
      var rule = g.rule;
      var cbotPrice = 0;
      // Extract CBOT price from reference record
      if (rule.cbotRef && cbotRecords[rule.cbotRef]) {
        cbotPrice = cbotRecords[rule.cbotRef].pricePerUnit || 0;
      }
      var subCrops = g.records.map(function (cp, idx) {
        // Determine pricing mode for sub-crop
        var scMode = 'contract';
        if (rule.pricingMode === 'cbot') {
          // For CBOT types: ORG/organic → flat, others → cbot
          if (/\borg\b/i.test(cp.crop) || /organic/i.test(cp.crop)) {
            scMode = 'flat';
          } else {
            scMode = 'cbot';
          }
        } else {
          scMode = 'contract';
        }
        return {
          name: cp.crop,
          pricingMode: scMode,
          pricePerUnit: cp.pricePerUnit || 0,
          basisDefault: cp.basis || 0,
          unit: cp.unit || rule.defaultUnit,
          dryingRate: cp.dryingRate || 0,
          shadeIndex: idx
        };
      });

      store.cropTypes.push({
        id: generateId('ctype'),
        name: typeName,
        color: rule.color,
        unit: rule.defaultUnit,
        defaultMoisture: rule.defaultMoisture,
        dryingRate: rule.defaultDrying,
        interestRate: rule.defaultInterest,
        pricingMode: rule.pricingMode,
        cbotPrice: cbotPrice,
        cbotSymbol: rule.cbotSymbol || '',
        cbotLastFetched: null,
        subCrops: subCrops
      });
    });

    changed = true;
    console.log('Migrated ' + store.cropPricing.length + ' cropPricing records into ' + store.cropTypes.length + ' crop types');
  }
  // Add cropBasis to buyers
  (store.buyers || []).forEach(function (b) {
    if (b.cropBasis === undefined) {
      b.cropBasis = {};
      changed = true;
    }
  });
  // Fix CBOT prices stored in cents (should be dollars per bushel)
  (store.cropTypes || []).forEach(function (ct) {
    if (ct.pricingMode === 'cbot' && ct.cbotPrice > 50) {
      ct.cbotPrice = Math.round((ct.cbotPrice / 100) * 10000) / 10000;
      changed = true;
    }
  });
  // Initialize FieldOps sync collection
  if (!store.fieldopsSync) {
    store.fieldopsSync = {
      lastSync: null,
      lastStatus: null,
      lastError: null,
      history: [],
      fieldMapping: {}
    };
    changed = true;
  }
  return changed;
}

// --- Start ---
loadData();
if (migrateData()) {
  saveData().then(function () { console.log('Data migrated (suppliers, labor hours, discount schedules, settings)'); });
}
console.log(`Loaded: ${store.fields.length} fields, ${store.products.length} products, ${store.implements.length} implements, ${store.seeds.length} seeds, ${store.rent.length} rent parcels`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Macro Roll Up server running at http://localhost:${PORT}`);

  // --- Scheduled FieldOps Sync ---
  if (process.env.FIELDOPS_SYNC_ENABLED === 'true') {
    var intervalMin = parseInt(process.env.FIELDOPS_SYNC_INTERVAL_MINUTES) || 60;
    console.log('[FieldOps] Scheduled sync every ' + intervalMin + ' minutes (mock=' + fieldopsClient.useMock() + ')');

    // Run initial sync 30 seconds after startup
    setTimeout(function () {
      fieldopsSync.runSync(store, generateId, saveData)
        .then(function (r) { console.log('[FieldOps] Initial sync:', r.status); })
        .catch(function (e) { console.error('[FieldOps] Initial sync error:', e.message); });
    }, 30000);

    // Schedule recurring sync
    var cron = require('node-cron');
    cron.schedule('*/' + intervalMin + ' * * * *', function () {
      fieldopsSync.runSync(store, generateId, saveData)
        .then(function (r) { console.log('[FieldOps] Scheduled sync:', r.status); })
        .catch(function (e) { console.error('[FieldOps] Scheduled sync error:', e.message); });
    });
  } else {
    console.log('[FieldOps] Sync disabled (set FIELDOPS_SYNC_ENABLED=true in .env to enable)');
  }
});
