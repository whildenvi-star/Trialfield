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

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const MAX_BACKUPS = 5;

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'farm-budget', uptime: process.uptime() }));

const corsOptions = {
  origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000',
  credentials: true
};
// Gzip all responses — ~60-70% payload reduction for JSON/HTML/JS/CSS
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
// Static files: no cache during development
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
  orders: [],
  deliveries: [],
  unitPacks: [],
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
  if (req.query.splitGroupId) {
    fields = fields.filter(f => f.splitGroupId === req.query.splitGroupId);
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
    'acres', 'plantedAcres', 'rentPerAcre', 'inputs', 'seed', 'machinery',
    'yieldPerAcre', 'yieldUnit', 'cropInsurancePerAcre',
    'insuranceIncomePerAcre', 'govPaymentLabel', 'govPaymentsPerAcre',
    'auxPayments', 'tariffsPerAcre', 'geometry', 'harvestMoisture', 'buyerId', 'templateId',
    'registryFieldName', 'splitGroupId'
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

// --- Split a field into sub-fields ---
app.post('/api/fields/:id/split', async (req, res) => {
  const source = store.fields.find(f => f.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'Field not found' });
  if (source.splitGroupId) return res.status(400).json({ error: 'Field is already part of a split group. Merge first to re-split.' });

  const count = Math.min(Math.max(parseInt(req.body.count) || 2, 2), 10);
  const names = req.body.names || [];
  const enterpriseIds = req.body.enterpriseIds || [];
  const splitGroupId = generateId('sg');
  const registryFieldName = source.registryFieldName || source.name;
  const acresEach = Math.round((source.acres / count) * 100) / 100;
  const rentPerAcre = source.rentPerAcre || 0;

  const created = [];
  for (let i = 0; i < count; i++) {
    const subField = {
      id: generateId('fld'),
      enterpriseId: enterpriseIds[i] || source.enterpriseId,
      name: names[i] || (source.name + ' #' + (i + 1)),
      systemCode: source.systemCode,
      crop: source.crop,
      cropType: source.cropType,
      acres: i === count - 1 ? Math.round((source.acres - acresEach * (count - 1)) * 100) / 100 : acresEach,
      plantedAcres: 0,
      rentPerAcre: rentPerAcre,
      inputs: i === 0 ? JSON.parse(JSON.stringify(source.inputs || [])) : [],
      seed: i === 0 && source.seed ? JSON.parse(JSON.stringify(source.seed)) : null,
      machinery: i === 0 ? JSON.parse(JSON.stringify(source.machinery || [])) : [],
      yieldPerAcre: source.yieldPerAcre || 0,
      yieldUnit: source.yieldUnit || 'Bu',
      cropInsurancePerAcre: source.cropInsurancePerAcre || 0,
      insuranceIncomePerAcre: source.insuranceIncomePerAcre || 0,
      auxPayments: [],
      harvestMoisture: source.harvestMoisture || 0,
      buyerId: source.buyerId || '',
      registryFieldName: registryFieldName,
      splitGroupId: splitGroupId
    };
    created.push(subField);
  }

  // Remove original, add sub-fields
  const srcIdx = store.fields.findIndex(f => f.id === source.id);
  store.fields.splice(srcIdx, 1, ...created);
  await saveData();
  res.json(created.map(enrichField));
});

// --- Merge split fields back into one ---
app.post('/api/fields/merge-split', async (req, res) => {
  const { splitGroupId } = req.body;
  if (!splitGroupId) return res.status(400).json({ error: 'splitGroupId required' });

  const siblings = store.fields.filter(f => f.splitGroupId === splitGroupId);
  if (siblings.length < 2) return res.status(400).json({ error: 'Split group not found or only one field' });

  // Merge: sum acres, keep first sibling's agronomic data
  const primary = siblings[0];
  const totalAcres = siblings.reduce((sum, f) => sum + (f.acres || 0), 0);
  const merged = Object.assign({}, JSON.parse(JSON.stringify(primary)), {
    id: generateId('fld'),
    name: primary.registryFieldName || primary.name,
    acres: Math.round(totalAcres * 100) / 100,
    plantedAcres: 0,
    registryFieldName: null,
    splitGroupId: null
  });

  // Remove all siblings, add merged field
  const siblingIds = new Set(siblings.map(f => f.id));
  store.fields = store.fields.filter(f => !siblingIds.has(f.id));
  store.fields.push(merged);
  await saveData();
  res.json(enrichField(merged));
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

    const results = { synced: [], unmatched: [], unchanged: [], splitWarnings: [] };
    let changed = false;

    store.fields.forEach(field => {
      // Match by name first, then by registryFieldName for split fields
      const match = regLookup[(field.name || '').toLowerCase()]
                 || regLookup[(field.registryFieldName || '').toLowerCase()];
      if (!match) {
        results.unmatched.push(field.name);
        return;
      }

      let fieldChanged = false;
      const isSplit = !!field.splitGroupId;

      // Sync acres — skip for split fields (user manually allocates sub-field acres)
      if (!isSplit && Math.abs((field.acres || 0) - match.reportingAcres) > 0.001) {
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

    // Validate split groups against registry totals
    const splitGroups = {};
    store.fields.forEach(f => {
      if (!f.splitGroupId) return;
      if (!splitGroups[f.splitGroupId]) splitGroups[f.splitGroupId] = { fields: [], registryFieldName: f.registryFieldName };
      splitGroups[f.splitGroupId].fields.push(f);
    });
    Object.keys(splitGroups).forEach(sgId => {
      const group = splitGroups[sgId];
      const regMatch = regLookup[(group.registryFieldName || '').toLowerCase()];
      if (!regMatch) return;
      const allocatedAcres = group.fields.reduce((sum, f) => sum + (f.acres || 0), 0);
      const delta = Math.round((allocatedAcres - regMatch.reportingAcres) * 100) / 100;
      if (Math.abs(delta) > 0.01) {
        results.splitWarnings.push({
          registryFieldName: group.registryFieldName,
          registryAcres: regMatch.reportingAcres,
          allocatedAcres: allocatedAcres,
          delta: delta,
          subFields: group.fields.map(f => ({ name: f.name, acres: f.acres }))
        });
      }
    });

    if (changed) await saveData();
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'Registry sync failed: ' + err.message });
  }
});

// --- Acre Reconciliation ---
app.get('/api/dashboard/reconciliation', async (req, res) => {
  try {
    const resp = await fetch(REGISTRY_URL + '/api/fields?active=true');
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();

    // Build budget field lookup by registryFieldName and name
    const budgetByRegistry = {};
    store.fields.forEach(f => {
      var key = (f.registryFieldName || f.name || '').toLowerCase();
      if (!budgetByRegistry[key]) budgetByRegistry[key] = [];
      budgetByRegistry[key].push(f);
    });

    var rows = [];
    var matched = 0;
    var total = regFields.length;

    regFields.forEach(rf => {
      var key = rf.name.toLowerCase();
      var budgetFields = budgetByRegistry[key] || [];
      // Also check aliases
      if (!budgetFields.length && rf.aliases) {
        rf.aliases.forEach(a => {
          var aFields = budgetByRegistry[a.toLowerCase()];
          if (aFields && aFields.length) budgetFields = budgetFields.concat(aFields);
        });
      }

      var budgetAcres = budgetFields.reduce((sum, f) => sum + (f.acres || 0), 0);
      var delta = Math.round((budgetAcres - rf.reportingAcres) * 100) / 100;
      var status = budgetFields.length === 0 ? 'missing' :
                   Math.abs(delta) < 0.02 ? 'matched' :
                   delta < 0 ? 'under' : 'over';
      if (status === 'matched') matched++;

      rows.push({
        registryField: rf.name,
        registryAcres: rf.reportingAcres,
        budgetAcres: budgetAcres,
        delta: delta,
        status: status,
        subFields: budgetFields.map(f => ({ name: f.name, acres: f.acres, splitGroupId: f.splitGroupId }))
      });
    });

    res.json({ rows: rows, matched: matched, total: total });
  } catch (err) {
    res.status(502).json({ error: 'Registry unavailable: ' + err.message });
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

// Unit/Pack Definitions — configurable unit types with pack sizing
crudRoutes('unit-packs', 'unitPacks', 'up');


// Orders
crudRoutes('orders', 'orders', 'ord');

// Deliveries — custom routes (NOT crudRoutes factory) because delivery saves must recalculate order status
function recalcOrderStatus(order) {
  if (!order) return;
  var orderDeliveries = store.deliveries.filter(function (d) { return d.orderId === order.id; });
  if (orderDeliveries.length === 0) { order.status = 'ordered'; return; }
  var delivered = {};
  orderDeliveries.forEach(function (d) {
    (d.items || []).forEach(function (item) {
      delivered[item.productName] = (delivered[item.productName] || 0) + (item.deliveredQty || 0);
    });
  });
  var allComplete = (order.items || []).every(function (item) {
    return (delivered[item.productName] || 0) >= (item.orderedQty || 0);
  });
  order.status = allComplete ? 'complete' : 'partial';
}

app.get('/api/deliveries', function (req, res) {
  var result = store.deliveries;
  if (req.query.orderId) {
    result = result.filter(function (d) { return d.orderId === req.query.orderId; });
  }
  res.json(result);
});

app.post('/api/deliveries', async function (req, res) {
  var del = Object.assign({ id: generateId('del') }, req.body);
  store.deliveries.push(del);
  var linkedOrder = store.orders.find(function (o) { return o.id === del.orderId; });
  recalcOrderStatus(linkedOrder);
  await saveData();
  res.status(201).json(del);
});

app.put('/api/deliveries/:id', async function (req, res) {
  var idx = store.deliveries.findIndex(function (d) { return d.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(store.deliveries[idx], req.body);
  var linkedOrder = store.orders.find(function (o) { return o.id === store.deliveries[idx].orderId; });
  recalcOrderStatus(linkedOrder);
  await saveData();
  res.json(store.deliveries[idx]);
});

app.delete('/api/deliveries/:id', async function (req, res) {
  var idx = store.deliveries.findIndex(function (d) { return d.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  var orderId = store.deliveries[idx].orderId;
  store.deliveries.splice(idx, 1);
  var linkedOrder = store.orders.find(function (o) { return o.id === orderId; });
  recalcOrderStatus(linkedOrder);
  await saveData();
  res.json({ ok: true });
});

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

// --- Forecast: aggregate field inputs + seeds into procurement view ---
app.get('/api/forecast', function (req, res) {
  res.set('Cache-Control', 'no-store');

  var productMap = {};
  var productIndex = {};
  (store.products || []).forEach(function (p) {
    productIndex[(p.name || '').trim().toLowerCase()] = p;
  });

  // Aggregate field inputs
  (store.fields || []).forEach(function (field) {
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    (field.inputs || []).forEach(function (inp) {
      if (!inp.productName) return;
      var key = inp.productName.trim().toLowerCase();
      var product = productIndex[key];
      var mapKey = inp.productName; // preserve original casing as map key
      if (!productMap[mapKey]) {
        productMap[mapKey] = {
          productName: inp.productName,
          supplierId: product ? (product.supplierId || '') : '',
          unit: product ? (product.unit || '') : '',
          unitCost: product ? Calc.computeApplicationPrice(product) : 0,
          category: product ? (product.category || 'Other') : 'Other',
          totalQty: 0,
          fields: []
        };
      }
      var fieldQty = (inp.quantity || 0) * acres;
      productMap[mapKey].totalQty += fieldQty;
      productMap[mapKey].fields.push({
        fieldName: field.name,
        acres: acres,
        qty: fieldQty,
        rate: inp.quantity || 0,
        season: inp.season || ''
      });
    });
  });

  // Aggregate program-level inputs (inputs defined in agronomic templates but not on individual fields)
  (store.programs || []).forEach(function (prog) {
    if (!prog.inputs || prog.inputs.length === 0) return;
    // Find fields matching this program's systemCode + crop
    var matchingFields = (store.fields || []).filter(function (f) {
      return f.systemCode === prog.systemCode && f.crop === prog.crop;
    });
    if (matchingFields.length === 0) return;

    prog.inputs.forEach(function (progInput) {
      if (!progInput.productName) return;
      var key = progInput.productName.trim().toLowerCase();
      var product = productIndex[key];
      var mapKey = progInput.productName;

      matchingFields.forEach(function (field) {
        // Skip if this field already has this input (field-level takes precedence)
        var alreadyOnField = (field.inputs || []).some(function (fi) {
          return (fi.productName || '').trim().toLowerCase() === key;
        });
        if (alreadyOnField) return;

        var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
        if (!productMap[mapKey]) {
          productMap[mapKey] = {
            productName: progInput.productName,
            supplierId: product ? (product.supplierId || '') : '',
            unit: product ? (product.unit || '') : '',
            unitCost: product ? Calc.computeApplicationPrice(product) : 0,
            category: product ? (product.category || 'Other') : 'Other',
            totalQty: 0,
            fields: []
          };
        }
        var fieldQty = (progInput.quantity || 0) * acres;
        productMap[mapKey].totalQty += fieldQty;
        productMap[mapKey].fields.push({
          fieldName: field.name,
          acres: acres,
          qty: fieldQty,
          rate: progInput.quantity || 0,
          season: progInput.season || ''
        });
      });
    });
  });

  // Aggregate seed varieties from fields
  var seedIndex = {};
  (store.seeds || []).forEach(function (s) {
    seedIndex[(s.variety || '').trim().toLowerCase()] = s;
  });
  (store.fields || []).forEach(function (field) {
    if (!field.seed || !field.seed.variety) return;
    var s = seedIndex[field.seed.variety.trim().toLowerCase()];
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    var pop = field.seed.population || 0;
    var seedsPerUnit = s ? (s.seedsPerUnit || 1) : 1;
    var qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0;
    var mapKey = 'seed:' + field.seed.variety;
    if (!productMap[mapKey]) {
      productMap[mapKey] = {
        productName: field.seed.variety,
        supplierId: s ? (s.supplierId || '') : '',
        unit: 'units',
        unitCost: s ? (s.pricePerUnit || 0) : 0,
        category: 'Seed',
        isSeedVariety: true,
        totalQty: 0,
        fields: []
      };
    }
    productMap[mapKey].totalQty += qty;
    productMap[mapKey].fields.push({ fieldName: field.name, acres: acres, qty: qty, season: 'Spring' });
  });

  // Build ordered/delivered quantity maps from orders/deliveries
  var orderedMap = {};
  var deliveredMap = {};
  (store.orders || []).forEach(function (order) {
    (order.items || []).forEach(function (item) {
      orderedMap[item.productName] = (orderedMap[item.productName] || 0) + (item.orderedQty || 0);
    });
  });
  (store.deliveries || []).forEach(function (del) {
    (del.items || []).forEach(function (item) {
      deliveredMap[item.productName] = (deliveredMap[item.productName] || 0) + (item.deliveredQty || 0);
    });
  });

  // Resolve supplierName from suppliers
  var supplierMap = {};
  (store.suppliers || []).forEach(function (sup) {
    supplierMap[sup.id] = sup.name;
  });

  // Group by category
  var categoryOrder = ['Seed', 'Fertilizer', 'Chemical', 'Biological', 'Other'];
  var grouped = {};
  Object.values(productMap).forEach(function (row) {
    if (row.totalQty <= 0) return; // filter zero-qty
    var cat = row.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    var ordered = orderedMap[row.productName] || 0;
    var delivered = deliveredMap[row.productName] || 0;
    grouped[cat].push(Object.assign({}, row, {
      supplierName: supplierMap[row.supplierId] || '',
      totalCost: Math.round(row.totalQty * (row.unitCost || 0) * 100) / 100,
      orderedQty: ordered,
      deliveredQty: delivered,
      remaining: row.totalQty - ordered,
      pctOrdered: row.totalQty > 0 ? Math.round(ordered / row.totalQty * 100) : 0
    }));
  });

  var categories = categoryOrder
    .filter(function (cat) { return grouped[cat]; })
    .map(function (cat) { return { name: cat, products: grouped[cat] }; });

  res.json({ categories: categories });
});

// --- Product Demand Table for Receiving Manager ---
// Combines forecast data with order/delivery status for receiving area use
app.get('/api/demand', function (req, res) {
  res.set('Cache-Control', 'no-store');

  var productIndex = {};
  (store.products || []).forEach(function (p) {
    productIndex[(p.name || '').trim().toLowerCase()] = p;
  });
  var seedIndex = {};
  (store.seeds || []).forEach(function (s) {
    seedIndex[(s.variety || '').trim().toLowerCase()] = s;
  });
  var supplierMap = {};
  (store.suppliers || []).forEach(function (sup) {
    supplierMap[sup.id] = sup.name;
  });
  var unitPackMap = {};
  (store.unitPacks || []).forEach(function (up) {
    unitPackMap[up.id] = up;
  });

  var demandRows = [];

  // Aggregate products from field inputs
  var productAgg = {};
  (store.fields || []).forEach(function (field) {
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    (field.inputs || []).forEach(function (inp) {
      if (!inp.productName) return;
      var key = inp.productName.trim().toLowerCase();
      if (!productAgg[key]) productAgg[key] = { name: inp.productName, totalQty: 0 };
      productAgg[key].totalQty += (inp.quantity || 0) * acres;
    });
  });

  // Also aggregate program-level inputs for matching fields
  (store.programs || []).forEach(function (prog) {
    if (!prog.inputs || prog.inputs.length === 0) return;
    var matchingFields = (store.fields || []).filter(function (f) {
      return f.systemCode === prog.systemCode && f.crop === prog.crop;
    });
    if (matchingFields.length === 0) return;
    prog.inputs.forEach(function (progInput) {
      if (!progInput.productName) return;
      var key = progInput.productName.trim().toLowerCase();
      matchingFields.forEach(function (field) {
        var alreadyOnField = (field.inputs || []).some(function (fi) {
          return (fi.productName || '').trim().toLowerCase() === key;
        });
        if (alreadyOnField) return;
        var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
        if (!productAgg[key]) productAgg[key] = { name: progInput.productName, totalQty: 0 };
        productAgg[key].totalQty += (progInput.quantity || 0) * acres;
      });
    });
  });

  Object.values(productAgg).forEach(function (agg) {
    var product = productIndex[agg.name.trim().toLowerCase()];
    demandRows.push({
      productName: agg.name,
      type: 'input',
      category: product ? (product.category || 'Other') : 'Other',
      supplierId: product ? (product.supplierId || '') : '',
      supplierName: product ? (supplierMap[product.supplierId] || '') : '',
      unitPackId: product ? (product.unitPackId || '') : '',
      unitPackDesc: product && product.unitPackId ? ((unitPackMap[product.unitPackId] || {}).packDesc || '') : (product ? (product.purchaseUnit || '') : ''),
      packQty: product && product.unitPackId ? ((unitPackMap[product.unitPackId] || {}).packQty || 1) : 1,
      totalQty: Math.round(agg.totalQty * 100) / 100,
      totalUnitsExpected: 0, // computed below
      deliveryWindow: '', // TODO: derive from order dates if available
      status: 'pending'
    });
  });

  // Aggregate seeds from field seed assignments
  var seedAgg = {};
  (store.fields || []).forEach(function (field) {
    if (!field.seed || !field.seed.variety) return;
    var key = field.seed.variety.trim().toLowerCase();
    var s = seedIndex[key];
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    var pop = field.seed.population || 0;
    var seedsPerUnit = s ? (s.seedsPerUnit || 1) : 1;
    var qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0;
    if (!seedAgg[key]) seedAgg[key] = { name: field.seed.variety, totalQty: 0 };
    seedAgg[key].totalQty += qty;
  });

  Object.values(seedAgg).forEach(function (agg) {
    var seed = seedIndex[agg.name.trim().toLowerCase()];
    demandRows.push({
      productName: agg.name + (seed ? ' (' + (seed.crop || '') + ')' : ''),
      type: 'seed',
      category: 'Seed',
      supplierId: seed ? (seed.supplierId || '') : '',
      supplierName: seed ? (supplierMap[seed.supplierId] || '') : '',
      unitPackId: '',
      unitPackDesc: 'units',
      packQty: 1,
      totalQty: agg.totalQty,
      totalUnitsExpected: agg.totalQty,
      deliveryWindow: '',
      status: 'pending'
    });
  });

  // Enrich with order/delivery status
  var orderedMap = {};
  var deliveredMap = {};
  var deliveryWindowMap = {};
  (store.orders || []).forEach(function (order) {
    (order.items || []).forEach(function (item) {
      orderedMap[item.productName] = (orderedMap[item.productName] || 0) + (item.orderedQty || 0);
      if (order.deliveryDate) deliveryWindowMap[item.productName] = order.deliveryDate;
    });
  });
  (store.deliveries || []).forEach(function (del) {
    (del.items || []).forEach(function (item) {
      deliveredMap[item.productName] = (deliveredMap[item.productName] || 0) + (item.deliveredQty || 0);
    });
  });

  demandRows.forEach(function (row) {
    var key = row.productName;
    var ordered = orderedMap[key] || 0;
    var delivered = deliveredMap[key] || 0;

    // Compute totalUnitsExpected for input products (seeds already computed above)
    if (row.type === 'input' && row.packQty > 0) {
      row.totalUnitsExpected = Math.ceil(row.totalQty / row.packQty);
    }

    row.orderedQty = ordered;
    row.deliveredQty = delivered;
    row.deliveryWindow = deliveryWindowMap[key] || '';

    // Determine status from order/delivery state
    if (delivered >= row.totalQty && row.totalQty > 0) {
      row.status = 'received';
    } else if (ordered > 0) {
      row.status = 'ordered';
    } else {
      row.status = 'pending';
    }
  });

  // Sort: Seeds first, then by category, then by name
  demandRows.sort(function (a, b) {
    if (a.type !== b.type) return a.type === 'seed' ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.productName.localeCompare(b.productName);
  });

  res.json({ rows: demandRows, generatedAt: new Date().toISOString() });
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

// --- Futures Price Feed (Yahoo Finance proxy with 15-min cache) ---
const futuresCache = { data: null, ts: 0 };
const DEFAULT_FUTURES_CONFIG = [
  { key: 'corn',     symbol: 'ZCZ26.CBT',  label: 'CORN',     contract: 'DEC 26' },
  { key: 'soybeans', symbol: 'ZSX26.CBT',  label: 'SOYBEANS', contract: 'NOV 26' },
  { key: 'wheat',    symbol: 'ZWN26.CBT',  label: 'WHEAT',    contract: 'JUL 26' }
];

function getFuturesContracts() {
  return (store.futuresConfig && store.futuresConfig.length > 0)
    ? store.futuresConfig
    : DEFAULT_FUTURES_CONFIG;
}

app.get('/api/futures-config', (req, res) => {
  res.json(getFuturesContracts());
});

app.put('/api/futures-config', async (req, res) => {
  var contracts = req.body;
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return res.status(400).json({ error: 'Must provide an array of contracts' });
  }
  store.futuresConfig = contracts.map(function (c) {
    return { key: c.key || '', symbol: c.symbol || '', label: c.label || '', contract: c.contract || '' };
  });
  // Invalidate cache so next fetch uses new symbols
  futuresCache.data = null;
  futuresCache.ts = 0;
  await saveData();
  res.json(store.futuresConfig);
});

async function fetchFuturesData() {
  const now = Date.now();
  if (futuresCache.data && now - futuresCache.ts < 15 * 60 * 1000) {
    return futuresCache.data;
  }
  var FUTURES_CONTRACTS = getFuturesContracts();
  const results = await Promise.allSettled(
    FUTURES_CONTRACTS.map(async (c) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}?range=1mo&interval=1d`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FarmBudget/1.0)' }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const result = json.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators.quote[0];
      const timestamps = result.timestamp || [];
      const closes = (quotes.close || []).filter(v => v != null);
      const lastClose = closes.length ? closes[closes.length - 1] : null;
      const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
      const change = lastClose && prevClose ? lastClose - prevClose : 0;
      const changePct = prevClose ? (change / prevClose) * 100 : 0;
      // CBOT grains quote in cents (USX) — convert to $/bu for display
      var isCents = (meta.currency || '').toUpperCase() === 'USX';
      var divisor = isCents ? 100 : 1;
      var rawCloses = (quotes.close || []).slice(-30);
      return {
        key: c.key,
        label: c.label,
        contract: c.contract,
        symbol: c.symbol,
        price: lastClose != null ? Math.round(lastClose / divisor * 10000) / 10000 : null,
        change: Math.round((change / divisor) * 10000) / 10000,
        changePct: Math.round(changePct * 100) / 100,
        unit: '$/bu',
        timestamps: timestamps.slice(-30),
        closes: rawCloses.map(function (v) { return v != null ? v / divisor : null; })
      };
    })
  );
  var contracts = getFuturesContracts();
  const data = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { key: contracts[i].key, label: contracts[i].label, contract: contracts[i].contract, error: r.reason.message };
  });
  futuresCache.data = data;
  futuresCache.ts = now;
  return data;
}

app.get('/api/futures', async (req, res) => {
  try {
    const data = await fetchFuturesData();
    res.json(data);
  } catch (err) {
    console.error('[Futures] fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch futures data' });
  }
});

// --- Glomalin Terminal Chat (Claude API) ---
app.post('/api/chat', async (req, res) => {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write('data: ' + JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env' }) + '\n\n');
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  var userMessage = (req.body.message || '').trim();
  var chatHistory = req.body.history || [];
  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  // Gather live farm context from store + cross-module queries
  var contextParts = [];

  // --- LOCAL: Dashboard & Enterprise Summaries ---
  try {
    var dashboard = Calc.computeDashboard(store.fields, store.enterprises, getRefs(), store.settings, { yieldMode: 'projected' });
    var entSummary = (dashboard.enterpriseSummaries || []).map(function (s) {
      var t = s.totals;
      return s.enterprise.shortName + ': ' + t.acres + ' ac, rent $' + (t.rent || 0).toFixed(0) +
        ', expenses $' + (t.expTotal || 0).toFixed(0) + ', crop income $' + (t.cropIncome || 0).toFixed(0) +
        ', profit $' + (t.cropProfit || 0).toFixed(0) + '/ac' +
        ', w/ payments $' + (t.profitWithPayments || 0).toFixed(0) + '/ac';
    });
    contextParts.push('ENTERPRISE SUMMARIES:\n' + entSummary.join('\n'));

    var cropRows = [];
    ['conventional', 'organic'].forEach(function (cat) {
      (dashboard[cat] || []).forEach(function (eg) {
        (eg.cropRows || []).forEach(function (r) {
          cropRows.push(eg.enterprise.shortName + ' ' + r.crop + ': ' + r.acres + ' ac, yield ' +
            r.avgYield + ' ' + (r.unit || 'bu') + '/ac, profit $' + (r.profitPerAcre || 0).toFixed(2) + '/ac, COP $' + (r.cop || 0).toFixed(2) + '/bu');
        });
      });
    });
    if (cropRows.length) contextParts.push('CROP DETAIL:\n' + cropRows.join('\n'));
  } catch (e) {
    contextParts.push('Dashboard data unavailable: ' + e.message);
  }

  // --- LOCAL: Field-level data ---
  try {
    var fieldLines = store.fields.map(function (f) {
      var ent = store.enterprises.find(function (e) { return e.id === f.enterpriseId; });
      var entName = ent ? ent.shortName : 'unassigned';
      var inputCost = (f.inputs || []).reduce(function (s, inp) { return s + (inp.totalCost || 0); }, 0);
      return f.name + ' (' + entName + '): ' + (f.acres || 0) + ' ac, crop ' + (f.crop || 'none') +
        ', rent $' + (f.rentPerAcre || 0).toFixed(0) + '/ac, input cost $' + inputCost.toFixed(0) +
        ', yield ' + (f.projectedYield || 0) + ' ' + (f.yieldUnit || 'bu') + '/ac';
    });
    if (fieldLines.length) contextParts.push('FIELDS (' + fieldLines.length + '):\n' + fieldLines.join('\n'));
  } catch (e) { /* skip */ }

  // --- LOCAL: Programs (crop insurance, gov payments) ---
  try {
    if (store.programs && store.programs.length) {
      var progLines = store.programs.map(function (p) {
        return p.name + ' (' + (p.type || p.category || 'program') + '): ' +
          (p.fieldsApplied || 0) + ' fields, $' + (p.paymentPerAcre || p.amount || 0) + '/ac';
      });
      contextParts.push('PROGRAMS:\n' + progLines.join('\n'));
    }
  } catch (e) { /* skip */ }

  // --- LOCAL: Procurement (orders & deliveries) ---
  try {
    if (store.orders && store.orders.length) {
      var orderLines = store.orders.map(function (o) {
        return o.productName + ' from ' + (o.supplierName || 'TBD') + ': ' +
          (o.quantity || 0) + ' ' + (o.unit || 'units') + ', status ' + (o.status || 'pending') +
          ', $' + (o.totalCost || 0).toFixed(0);
      });
      contextParts.push('ORDERS (' + store.orders.length + '):\n' + orderLines.join('\n'));
    }
    if (store.deliveries && store.deliveries.length) {
      contextParts.push('DELIVERIES: ' + store.deliveries.length + ' received');
    }
  } catch (e) { /* skip */ }

  // --- LOCAL: Seeds ---
  try {
    if (store.seeds && store.seeds.length) {
      var seedLines = store.seeds.map(function (s) {
        return (s.variety || s.name || 'unknown') + ': ' + (s.crop || '') +
          ', $' + (s.pricePerUnit || 0).toFixed(2) + '/' + (s.unit || 'bag') +
          ', rate ' + (s.seedingRate || 0) + '/ac';
      });
      contextParts.push('SEED VARIETIES (' + store.seeds.length + '):\n' + seedLines.join('\n'));
    }
  } catch (e) { /* skip */ }

  // --- LOCAL: Sales / Buyers ---
  try {
    if (store.sales && store.sales.length) {
      var saleLines = store.sales.map(function (s) {
        return (s.buyer || s.buyerName || 'unknown') + ': ' + (s.crop || '') +
          ' ' + (s.bushels || s.quantity || 0) + ' bu @ $' + (s.pricePerBu || s.price || 0).toFixed(2);
      });
      contextParts.push('SALES CONTRACTS (' + store.sales.length + '):\n' + saleLines.join('\n'));
    }
    if (store.buyers && store.buyers.length) {
      contextParts.push('BUYERS: ' + store.buyers.map(function (b) { return b.name; }).join(', '));
    }
  } catch (e) { /* skip */ }

  // --- LOCAL: Futures ---
  try {
    if (futuresCache.data) {
      var futStr = futuresCache.data.map(function (f) {
        if (f.error) return f.label + ': unavailable';
        return f.label + ' (' + f.contract + '): $' + f.price + '/bu, chg ' +
          (f.change >= 0 ? '+' : '') + f.change + ' (' + f.changePct + '%)';
      }).join('\n');
      contextParts.push('CBOT FUTURES:\n' + futStr);
    }
  } catch (e) { /* skip */ }

  // --- LOCAL: Settings & Counts ---
  contextParts.push('SETTINGS: Season ' + (store.settings.year || 'N/A') +
    ', fuel $' + (store.settings.fuelPrice || 0) + '/gal' +
    ', machinery $' + (store.settings.machineryRate || 0) + '/ac' +
    ', wage $' + (store.settings.wageRate || 0) + '/hr' +
    ', carry months ' + (store.settings.carryMonths || 0));

  contextParts.push('NETWORK: ' + (store.fields || []).length + ' budget fields, ' +
    (store.enterprises || []).length + ' enterprises, ' +
    (store.products || []).length + ' products, ' +
    (store.seeds || []).length + ' seed varieties, ' +
    (store.orders || []).length + ' orders, ' +
    (store.deliveries || []).length + ' deliveries');

  // --- CROSS-MODULE: Parallel queries with 3s timeout ---
  var crossModuleQueries = [
    { name: 'FARM REGISTRY', url: 'http://localhost:3005/api/fields', transform: function (data) {
      if (!Array.isArray(data)) return null;
      var total = data.reduce(function (s, f) { return s + (f.reportingAcres || 0); }, 0);
      var organic = data.reduce(function (s, f) { return s + (f.organicAcres || 0); }, 0);
      return data.length + ' registered fields, ' + total.toFixed(1) + ' total ac, ' + organic.toFixed(1) + ' organic ac';
    }},
    { name: 'GRAIN TICKETS', url: 'http://localhost:3000/api/stats', transform: function (data) {
      if (!data) return null;
      var lines = [];
      if (data.totalTickets) lines.push(data.totalTickets + ' tickets');
      if (data.totalWeight) lines.push(Math.round(data.totalWeight).toLocaleString() + ' lbs total');
      if (data.byCrop) {
        Object.keys(data.byCrop).forEach(function (c) {
          var cr = data.byCrop[c];
          lines.push(c + ': ' + (cr.count || cr.tickets || 0) + ' loads, ' + Math.round(cr.weight || cr.totalWeight || 0).toLocaleString() + ' lbs');
        });
      }
      return lines.join('\n') || JSON.stringify(data).slice(0, 300);
    }},
    { name: 'FSA ACRES', url: 'http://localhost:3002/api/rollup/summary-metrics', transform: function (data) {
      if (!data) return null;
      var lines = [];
      if (data.totalEnrolledAcres) lines.push('Enrolled: ' + data.totalEnrolledAcres + ' ac');
      if (data.totalFarms) lines.push(data.totalFarms + ' farms');
      if (data.complianceRate) lines.push('Compliance: ' + data.complianceRate + '%');
      if (data.reportingProgress) lines.push('Reporting: ' + data.reportingProgress);
      return lines.join(', ') || JSON.stringify(data).slice(0, 300);
    }}
  ];

  var crossResults = await Promise.allSettled(crossModuleQueries.map(function (q) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 3000);
    return fetch(q.url, { signal: ctrl.signal })
      .then(function (r) { clearTimeout(timer); return r.json(); })
      .then(function (data) { return { name: q.name, text: q.transform(data) }; })
      .catch(function () { clearTimeout(timer); return { name: q.name, text: null }; });
  }));

  crossResults.forEach(function (r) {
    if (r.status === 'fulfilled' && r.value && r.value.text) {
      contextParts.push(r.value.name + ':\n' + r.value.text);
    }
  });

  var systemPrompt = 'You are Glomalin, the terminal AI for a farming operation\'s macro rollup dashboard. ' +
    'You have access to live data from the entire Glomalin network — farm budget, grain tickets, ' +
    'farm registry, FSA acres, and CBOT futures. Answer questions concisely in a terminal style — ' +
    'short, data-driven responses. Use numbers and units. No markdown headers or bullet lists — plain text, ' +
    'line breaks for structure. Keep responses under 200 words unless the user asks for detail.\n\n' +
    'LIVE DATA:\n' + contextParts.join('\n\n');

  // Build messages array
  var messages = [];
  chatHistory.forEach(function (m) {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: m.content });
    }
  });
  messages.push({ role: 'user', content: userMessage });

  // SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    var claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        stream: true,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!claudeResp.ok) {
      var errText = await claudeResp.text();
      res.write('data: ' + JSON.stringify({ error: 'Claude API error: ' + claudeResp.status }) + '\n\n');
      res.write('data: [DONE]\n\n');
      console.error('[Chat] Claude API error:', claudeResp.status, errText);
      return res.end();
    }

    var reader = claudeResp.body.getReader();
    var decoder = new TextDecoder();
    var sseBuffer = '';

    function processStream() {
      reader.read().then(function (result) {
        if (result.done) {
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        sseBuffer += decoder.decode(result.value, { stream: true });
        var lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf('data: ') === 0) {
            var payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              var evt = JSON.parse(payload);
              if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
                res.write('data: ' + JSON.stringify({ text: evt.delta.text }) + '\n\n');
              }
            } catch (e) { /* skip */ }
          }
        }
        processStream();
      }).catch(function (err) {
        console.error('[Chat] Stream error:', err.message);
        res.write('data: ' + JSON.stringify({ error: 'stream interrupted' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
    }
    processStream();
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
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
  // Add plantedAcres to fields (enterprise-level acre allocation)
  (store.fields || []).forEach(function (f) {
    if (f.plantedAcres === undefined) {
      f.plantedAcres = 0; // 0 = use registry acres
      changed = true;
    }
  });
  // Add cropTypeNames to enterprises (for auto-assignment on crop change)
  (store.enterprises || []).forEach(function (ent) {
    if (ent.cropTypeNames === undefined) {
      var name = (ent.name || '').toLowerCase();
      var types = [];
      // Build crop type list additively (enterprise can span multiple groups)
      if (name.indexOf('canning') !== -1) {
        types = types.concat(['Sweet Corn', 'Food Beans']);
      }
      if (name.indexOf('broadleaf') !== -1) {
        types = types.concat(['Soybeans', 'Peas', 'Vetch', 'Sunflowers', 'Hemp']);
      } else if (name.indexOf('soy') !== -1) {
        types = types.concat(['Soybeans', 'Peas', 'Vetch', 'Sunflowers']);
      }
      if (name.indexOf('small grain') !== -1 || name.indexOf('sm grain') !== -1) {
        types = types.concat(['Wheat', 'Rye', 'Barley', 'Sorghum', 'Hay', 'Kernza']);
      }
      if (name.indexOf('corn') !== -1 && name.indexOf('canning') === -1) {
        types = types.concat(['Corn']);
      }
      ent.cropTypeNames = types;
      changed = true;
    }
  });
  // Add split-field tracking properties
  (store.fields || []).forEach(function (f) {
    if (f.registryFieldName === undefined) {
      f.registryFieldName = null;
      changed = true;
    }
    if (f.splitGroupId === undefined) {
      f.splitGroupId = null;
      changed = true;
    }
  });
  // Add orders and deliveries collections for procurement pipeline
  if (!store.orders) {
    store.orders = [];
    changed = true;
  }
  if (!store.deliveries) {
    store.deliveries = [];
    changed = true;
  }
  // Add category to products with heuristic pre-classification (never overwrite user edits)
  var fertPat = /\d+-\d+-\d+|urea|ammonia|\bams\b|amm\s|potash|manure|compost|\blime\b|sulfur|nitro|thio/i;
  var chemPat = /cide$|icide|zine$|atrazin|resicore|armezon|axial|battle|prowl|herbicid|insecticid|fungicid|oil\b|water$/i;
  var seedPat = /\b(rye|vetch|clover|oats|cover\s*crop|peas seed|seed\s)/i;
  (store.products || []).forEach(function (p) {
    if (p.category === undefined) {
      var n = p.name || '';
      if (fertPat.test(n)) p.category = 'Fertilizer';
      else if (chemPat.test(n)) p.category = 'Chemical';
      else if (seedPat.test(n)) p.category = 'Seed';
      else p.category = 'Other';
      changed = true;
    }
  });
  // v2 recategorization — add Biological category and reclassify "Other" products
  var bioPat = /\bBioActive\b|\bBioRepel\b|\bBio[-\s]?Cal\b|\bUtrisha\b|\bMycoGold\b|\bN-Fix\b|\bRhizol|\bENDO\b/i;
  var bioPat2 = /beneficial\s*nemato|chitosan|\bEco\s*Tec\b|living\s*carbon|compost\s*tea|\bRegalia|\bOroboost\b/i;
  var chemPat2 = /\(2x2\.5\s*Gal\)|\(2x1\s*Gal\)|\(4x|\(265\s*Gal\)|\(250\s*Gal\)/i;
  var chemNames = /\bRoundUp\b|\bClarity\b|\bCobra\b|\bLiberty\b|\bPowerMax\b|\bValor\b|\bVerdict\b|\bZidua\b|\bSharpen\b|\bStatus\b|\bOutlook\b|\bBasagran\b|\bFlexstar\b|\bAuthority\b|\bBuccaneer\b|\bDurango\b|\bEnlist\b|\bDistinct\b|\bHuskie\b/i;
  var chemNames2 = /\bProwl\b|\bResicore\b|\bMustang\b|\bCapture\b|\bHeadline\b|\bVeltyma\b|\bMiravis\b|\bNIS\b|\bCrop\s*Oil\b|\bMeth\s*Oil\b|\bSurfactant|\bCalisto\b|\bPantego\b|\bSonic\b|\bMauler\b|\bCavallo\b|\bUltim/i;
  var chemNames3 = /\bAccent\b|\bBatallion\b|\bCeridian\b|\bForsyte\b|\bHexus\b|\bHomeplate\b|\bInflame\b|\bInterline\b|\bLaudis\b|\bPalisade\b|\bPemex\b|\bSandea\b|\bSatellite\b|\bSteadfast\b|\bStrellius\b|\bThunder\b|\bTriCor\b|\bVeracity\b|\bVolunteer\b|\bWeedone\b|\bBackstop\b|\bRaptor\b/i;
  var fertNames = /\bfeathermeal\b|chicken\s*(litter|crumbles)|\bChick\s*Magic\b|\bSustane\b|\bOrganical\b|\bForti[-\s]?(Cal|Phos)\b|\bchilean\s*nitrate\b|\bMicroHum\b|\bS04\b|\bGypsum\b|\bcopper\s*sulfate\b|\bZone\s*N\b/i;
  var fertNames2 = /\bMint\s*castings\b|\bnon\s*organic\s*s04\b|\bBio[-\s]?Cal\b|\b50\/50\s*Blend\b|\b98G\b|\bBoost\b|\bBoron\b|\bCoron\b|\bMagnesium\b|\bManganese\b|\bZinc\b|\bTeraFed\b|\bZone\s*Tr/i;
  (store.products || []).forEach(function (p) {
    if (!p._recatV2 && p.category === 'Other') {
      var n = p.name || '';
      if (bioPat.test(n) || bioPat2.test(n)) p.category = 'Biological';
      else if (chemPat2.test(n) || chemNames.test(n) || chemNames2.test(n) || chemNames3.test(n)) p.category = 'Chemical';
      else if (fertPat.test(n) || fertNames.test(n) || fertNames2.test(n)) p.category = 'Fertilizer';
      p._recatV2 = true;
      changed = true;
    }
  });
  // Add purchaseUnit field — infer from conversionRate + unit
  var CONV_TO_PURCHASE = {
    '2000': { 'Lbs': 'Ton', 'lbs': 'Ton' },
    '128': { 'OZ': 'Gal', 'oz': 'Gal' },
    '8': { 'Pts': 'Gal' },
    '4': { 'Quart': 'Gal' },
    '16': { 'OZ': 'Lb', 'oz': 'Lb' },
    '56': { 'Lbs': 'Bu', 'lbs': 'Bu' }
  };
  (store.products || []).forEach(function (p) {
    if (p.purchaseUnit === undefined) {
      var conv = String(p.conversionRate);
      var unitMap = CONV_TO_PURCHASE[conv];
      if (unitMap && unitMap[p.unit]) {
        p.purchaseUnit = unitMap[p.unit];
      } else if (p.conversionRate === 1) {
        p.purchaseUnit = p.unit;
      } else if (p.unit === 'Gal' && p.conversionRate > 100) {
        p.purchaseUnit = 'Ton';
      } else {
        p.purchaseUnit = p.unit;
      }
      changed = true;
    }
  });
  // Add organic field — auto-detect OMRI in product name
  (store.products || []).forEach(function (p) {
    if (p.organic === undefined) {
      p.organic = /OMRI/i.test(p.name || '');
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
// Ensure collections added after initial data.json creation exist
if (!store.unitPacks) store.unitPacks = [];
if (!store.programs) store.programs = [];
if (!store.orders) store.orders = [];
if (!store.deliveries) store.deliveries = [];
// Re-run default seeding for unitPacks (the IIFE ran before loadData replaced store)
if (store.unitPacks.length === 0) {
  store.unitPacks = [
    { id: 'up_bag50', name: 'Bag', packQty: 50, packDesc: '50 lb bag', packUom: 'lbs' },
    { id: 'up_bag80', name: 'Bag', packQty: 80, packDesc: '80 lb bag', packUom: 'lbs' },
    { id: 'up_tote40', name: 'Tote', packQty: 40, packDesc: '40 unit tote', packUom: 'units' },
    { id: 'up_probox50', name: 'ProBox', packQty: 50, packDesc: '50 lb ProBox', packUom: 'lbs' },
    { id: 'up_probox80', name: 'ProBox', packQty: 80, packDesc: '80 lb ProBox', packUom: 'lbs' },
    { id: 'up_pallet', name: 'Pallet', packQty: 2000, packDesc: '2000 lb pallet', packUom: 'lbs' },
    { id: 'up_jug25', name: 'Jug', packQty: 2.5, packDesc: '2.5 gal jug', packUom: 'gallons' },
    { id: 'up_drum55', name: 'Drum', packQty: 55, packDesc: '55 gal drum', packUom: 'gallons' },
    { id: 'up_bin', name: 'Bin', packQty: 2000, packDesc: '2000 lb bin', packUom: 'lbs' },
    { id: 'up_unit', name: 'Unit', packQty: 1, packDesc: '1 unit', packUom: 'units' },
    { id: 'up_each', name: 'Each', packQty: 1, packDesc: '1 each', packUom: 'units' }
  ];
}
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
