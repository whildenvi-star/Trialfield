#!/usr/bin/env node
'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3006;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const PHOTO_DIR = path.join(__dirname, 'data', 'photos');
const MAX_BACKUPS = 5;
const FARM_BUDGET_URL = process.env.FARM_BUDGET_URL || 'http://localhost:3001';
const FARM_BUDGET_TOKEN = process.env.FARM_BUDGET_TOKEN || process.env.EMBED_TOKEN || '';

// Build a farm-budget URL with embed token for server-to-server calls
function budgetUrl(apiPath) {
  var sep = apiPath.includes('?') ? '&' : '?';
  return FARM_BUDGET_URL + apiPath + (FARM_BUDGET_TOKEN ? sep + 'token=' + FARM_BUDGET_TOKEN : '');
}

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'seed-inventory', uptime: process.uptime() }));

// Ensure directories exist
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

// Multer for delivery ticket photos (disk storage — keep the photo file)
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) { cb(null, PHOTO_DIR); },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'rct_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6) + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Multer for spreadsheet import (memory storage)
const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Anthropic client (lazy — only initialized if API key exists)
let anthropic = null;
function getAnthropic() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic.default();
  }
  return anthropic;
}

const corsOptions = {
  origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Cookie-setting BEFORE static files so initial page load sets the cookie
if (process.env.EMBED_TOKEN) {
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.query.token === process.env.EMBED_TOKEN) {
      res.cookie('embed_session', process.env.EMBED_TOKEN, {
        httpOnly: true, sameSite: 'lax', secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: false }));
app.use('/photos', express.static(PHOTO_DIR));

// API auth gate
if (process.env.EMBED_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.query.token === process.env.EMBED_TOKEN) return next();
    if (req.cookies && req.cookies.embed_session === process.env.EMBED_TOKEN) return next();
    res.status(403).json({ error: 'Forbidden' });
  });
}

// Prevent browsers from caching API responses — stale data on reconciliation is dangerous
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// ─── In-memory data store ───────────────────────────────────────────
let store = {
  products: [],
  suppliers: [],
  forecasts: [],
  orders: [],
  receipts: [],
  returns: [],
  settings: { cropYear: 2026, defaultUnit: 'units' }
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    var loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Merge with defaults so new collections are always present
    store = Object.assign({
      products: [],
      suppliers: [],
      forecasts: [],
      orders: [],
      receipts: [],
      returns: [],
      productOverlays: [],
      supplierMappings: [],
      settings: { cropYear: 2026, defaultUnit: 'units' }
    }, loaded);
    // Migration: fix AMENDMENT → BIOLOGICAL category
    var migrated = false;
    (store.products || []).forEach(function (p) {
      if (p.inputCategory === 'AMENDMENT') {
        p.inputCategory = 'BIOLOGICAL';
        migrated = true;
      }
    });
    if (!store.productOverlays) store.productOverlays = [];
    if (!store.supplierMappings) store.supplierMappings = [];
    if (migrated) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
    }
  }
}

// Write lock: simple promise queue for safe concurrent writes
let writeQueue = Promise.resolve();

function withLock(fn) {
  var p = writeQueue.then(fn, fn);
  writeQueue = p.catch(function () {});
  return p;
}

function saveData() {
  return withLock(async function () {
    // Rotate backups
    for (var i = MAX_BACKUPS; i > 1; i--) {
      var from = DATA_FILE + '.bak.' + (i - 1);
      var to = DATA_FILE + '.bak.' + i;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak.1');
    }
    // Atomic write
    var tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  });
}

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// ─── Products CRUD ──────────────────────────────────────────────────

app.get('/api/products', function (req, res) {
  var items = store.products;
  if (req.query.type) items = items.filter(function (p) { return p.type === req.query.type; });
  if (req.query.active === 'true') items = items.filter(function (p) { return p.active !== false; });
  res.json(items);
});

app.get('/api/products/search', function (req, res) {
  var q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  var matches = store.products.filter(function (p) {
    if (p.active === false) return false;
    var haystack = [p.brand, p.supplier, p.crop, p.variety, p.productName].filter(Boolean).join(' ').toLowerCase();
    return haystack.indexOf(q) !== -1;
  }).slice(0, 20);
  res.json(matches);
});

app.get('/api/products/:id', function (req, res) {
  var item = store.products.find(function (p) { return p.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Product not found' });
  res.json(item);
});

app.post('/api/products', async function (req, res) {
  var item = {
    id: generateId('prod'),
    type: req.body.type || 'SEED',
    brand: req.body.brand || '',
    supplier: req.body.supplier || '',
    crop: req.body.crop || '',
    variety: req.body.variety || '',
    productName: req.body.productName || '',
    inputCategory: req.body.inputCategory || '',
    unitType: req.body.unitType || 'units',
    purchaseUnit: req.body.purchaseUnit || req.body.unitType || 'units',
    conversionRate: parseFloat(req.body.conversionRate) || 1,
    packSize: parseFloat(req.body.packSize) || 0,
    packType: req.body.packType || '',
    organicCertNumber: req.body.organicCertNumber || '',
    omriListed: req.body.omriListed || false,
    organicGround: req.body.organicGround || false,
    budgetProductId: req.body.budgetProductId || null,
    budgetProductType: req.body.budgetProductType || null,
    notes: req.body.notes || '',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.products.push(item);
  await saveData();
  res.status(201).json(item);

  // Write-back to farm-budget (fire-and-forget) — only for brand-new products not already linked
  if (!item.budgetProductId) {
    pushProductToBudget(item).then(async function (result) {
      if (result && result.id) {
        item.budgetProductId = result.id;
        item.budgetProductType = result.type;
        _catalogCache = { data: null, fetchedAt: 0 };
        await saveData();
        console.log('[write-back] Product pushed to farm-budget:', item.productName || item.variety, '->', result.id);
      }
    }).catch(function (e) {
      console.warn('[write-back] Product push failed for', item.productName || item.variety, ':', e.message);
    });
  }
});

app.put('/api/products/:id', async function (req, res) {
  var idx = store.products.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  Object.assign(store.products[idx], req.body, { updatedAt: new Date().toISOString() });
  await saveData();
  res.json(store.products[idx]);
});

app.delete('/api/products/:id', async function (req, res) {
  var idx = store.products.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  // Soft delete
  store.products[idx].active = false;
  store.products[idx].updatedAt = new Date().toISOString();
  await saveData();
  res.json({ ok: true });
});

// ─── Suppliers CRUD ─────────────────────────────────────────────────

app.get('/api/suppliers', function (req, res) {
  var items = store.suppliers;
  if (req.query.active === 'true') items = items.filter(function (s) { return s.active !== false; });
  res.json(items);
});

app.get('/api/suppliers/:id', function (req, res) {
  var item = store.suppliers.find(function (s) { return s.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Supplier not found' });
  res.json(item);
});

app.post('/api/suppliers', async function (req, res) {
  var item = {
    id: generateId('sup'),
    name: req.body.name || '',
    contactName: req.body.contactName || '',
    phone: req.body.phone || '',
    email: req.body.email || '',
    address: req.body.address || '',
    notes: req.body.notes || '',
    active: true,
    createdAt: new Date().toISOString()
  };
  store.suppliers.push(item);
  await saveData();
  res.status(201).json(item);

  // Auto-sync to farm-budget (fire-and-forget) so the supplier appears in the reference tab
  ensureSupplierInBudget(item).then(function (budgetId) {
    if (budgetId) console.log('[write-back] Supplier synced to farm-budget:', item.name, '->', budgetId);
  }).catch(function (e) {
    console.warn('[write-back] Supplier sync failed for', item.name, ':', e.message);
  });
});

app.put('/api/suppliers/:id', async function (req, res) {
  var idx = store.suppliers.findIndex(function (s) { return s.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Supplier not found' });
  Object.assign(store.suppliers[idx], req.body, { updatedAt: new Date().toISOString() });
  await saveData();
  res.json(store.suppliers[idx]);
});

app.delete('/api/suppliers/:id', async function (req, res) {
  var idx = store.suppliers.findIndex(function (s) { return s.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Supplier not found' });
  store.suppliers.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// ─── Forecasts CRUD ─────────────────────────────────────────────────

app.get('/api/forecasts', function (req, res) {
  var items = store.forecasts;
  if (req.query.cropYear) items = items.filter(function (f) { return String(f.cropYear) === req.query.cropYear; });
  res.json(items);
});

// Product-grouped view (must be before :id route)
app.get('/api/forecasts/by-product', function (req, res) {
  var cropYear = req.query.cropYear || String(store.settings.cropYear);
  var typeFilter = req.query.type;

  var forecasts = store.forecasts.filter(function (f) {
    return String(f.cropYear) === cropYear;
  });

  var groups = {};
  forecasts.forEach(function (f) {
    if (!groups[f.productId]) groups[f.productId] = [];
    groups[f.productId].push(f);
  });

  var result = [];
  Object.keys(groups).forEach(function (productId) {
    var product = store.products.find(function (p) { return p.id === productId; });
    if (!product) return;
    if (typeFilter && product.type !== typeFilter) return;

    var items = groups[productId];
    var totalQty = items.reduce(function (s, f) { return s + (f.projectedQuantity || 0); }, 0);
    var totalAcres = items.reduce(function (s, f) { return s + (f.linkedAcres || 0); }, 0);

    result.push({
      productId: productId,
      type: product.type,
      brand: product.brand || '',
      crop: product.crop || '',
      variety: product.variety || '',
      productName: product.productName || '',
      category: product.inputCategory || (product.type === 'SEED' ? 'SEED' : ''),
      unit: items[0].unit || product.unitType || '',
      totalQty: Math.round(totalQty * 100) / 100,
      totalAcres: Math.round(totalAcres * 100) / 100,
      fieldCount: items.length,
      fields: items.map(function (f) {
        return {
          fieldName: f.linkedFieldName,
          acres: f.linkedAcres,
          rate: f.ratePerAcre,
          qty: f.projectedQuantity,
          season: f.season,
          unit: f.unit
        };
      }).sort(function (a, b) { return (a.fieldName || '').localeCompare(b.fieldName || ''); })
    });
  });

  result.sort(function (a, b) {
    if (a.type !== b.type) return a.type === 'SEED' ? -1 : 1;
    var nameA = a.variety || a.productName || '';
    var nameB = b.variety || b.productName || '';
    return nameA.localeCompare(nameB);
  });

  res.json(result);
});

app.get('/api/forecasts/:id', function (req, res) {
  var item = store.forecasts.find(function (f) { return f.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Forecast not found' });
  res.json(item);
});

app.post('/api/forecasts', async function (req, res) {
  var item = {
    id: generateId('fct'),
    productId: req.body.productId || '',
    cropYear: parseInt(req.body.cropYear) || store.settings.cropYear,
    season: req.body.season || 'spring',
    projectedQuantity: parseFloat(req.body.projectedQuantity) || 0,
    unit: req.body.unit || 'units',
    linkedFieldName: req.body.linkedFieldName || '',
    linkedFieldId: req.body.linkedFieldId || '',
    linkedAcres: parseFloat(req.body.linkedAcres) || 0,
    ratePerAcre: parseFloat(req.body.ratePerAcre) || 0,
    rateUnit: req.body.rateUnit || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.forecasts.push(item);
  await saveData();
  res.status(201).json(item);
});

app.put('/api/forecasts/:id', async function (req, res) {
  var idx = store.forecasts.findIndex(function (f) { return f.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Forecast not found' });
  Object.assign(store.forecasts[idx], req.body, { updatedAt: new Date().toISOString() });
  await saveData();
  res.json(store.forecasts[idx]);
});

app.delete('/api/forecasts/:id', async function (req, res) {
  var idx = store.forecasts.findIndex(function (f) { return f.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Forecast not found' });
  store.forecasts.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// ─── Pull Forecasts from Farm Budget ─────────────────────────────────

// Shared sync logic — upserts forecast records from farm-budget data and removes orphans.
// Returns { created, updated, removed, skipped }.
function applyForecastSync(data, cropYear) {
  var categoryMap = {
    'Seed': 'SEED',
    'Fertilizer': 'INPUT',
    'Chemical': 'INPUT',
    'Biological': 'INPUT',
    'Other': 'INPUT'
  };
  var inputCategoryMap = {
    'Fertilizer': 'FERTILIZER',
    'Chemical': 'CHEMICAL',
    'Biological': 'BIOLOGICAL',
    'Other': 'OTHER'
  };

  var created = 0;
  var updated = 0;
  var skipped = 0;
  var processedFields = {}; // productId → Set of linkedFieldName

  var categories = data.categories || [];
  for (var ci = 0; ci < categories.length; ci++) {
    var cat = categories[ci];
    var products = cat.products || [];
    for (var pi = 0; pi < products.length; pi++) {
      var bp = products[pi];
      var type = categoryMap[cat.name] || 'INPUT';
      var fields = bp.fields || [];
      if (fields.length === 0) { skipped++; continue; }

      var product = findOrCreateProduct(bp, type, cat.name, inputCategoryMap);
      if (!processedFields[product.id]) processedFields[product.id] = new Set();

      for (var fi = 0; fi < fields.length; fi++) {
        var f = fields[fi];
        var season = (f.season || '').toLowerCase() || 'spring';
        if (season !== 'spring' && season !== 'fall') season = 'full-year';

        processedFields[product.id].add(f.fieldName || '');

        var existing = store.forecasts.find(function (fc) {
          return fc.productId === product.id &&
            fc.linkedFieldName === f.fieldName &&
            String(fc.cropYear) === String(cropYear);
        });

        if (existing) {
          existing.linkedAcres = f.acres || 0;
          existing.ratePerAcre = f.rate || 0;
          existing.projectedQuantity = f.qty || 0;
          existing.season = season;
          existing.unit = bp.unit || 'units';
          existing.rateUnit = (f.rate ? bp.unit + '/ac' : '');
          existing.notes = 'Synced from Farm Budget';
          existing.updatedAt = new Date().toISOString();
          updated++;
        } else {
          store.forecasts.push({
            id: generateId('fct'),
            productId: product.id,
            cropYear: cropYear,
            season: season,
            linkedFieldName: f.fieldName || '',
            linkedFieldId: '',
            linkedAcres: f.acres || 0,
            ratePerAcre: f.rate || 0,
            rateUnit: (f.rate ? bp.unit + '/ac' : ''),
            projectedQuantity: f.qty || 0,
            unit: bp.unit || 'units',
            notes: 'Synced from Farm Budget',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          created++;
        }
      }
    }
  }

  // Remove orphaned auto-synced records whose fields no longer exist in farm-budget
  var removed = 0;
  store.forecasts = store.forecasts.filter(function (fc) {
    if (String(fc.cropYear) !== String(cropYear)) return true;
    if (fc.notes !== 'Synced from Farm Budget') return true;
    if (!processedFields[fc.productId]) return true;
    if (!processedFields[fc.productId].has(fc.linkedFieldName)) {
      removed++;
      return false;
    }
    return true;
  });

  return { created: created, updated: updated, removed: removed, skipped: skipped };
}

// Manual trigger to pull the full product/seed catalog from farm-budget (used by Forecasts tab sync button)
app.post('/api/products/sync-from-budget', async function (req, res) {
  try {
    var result = await syncAllProductsFromBudget();
    _catalogCache = { data: null, fetchedAt: 0 };
    res.json({ ok: true, changed: result.changed, products: result.products, seeds: result.seeds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync from Farm Budget: ' + err.message });
  }
});

app.post('/api/forecasts/pull-from-budget', async function (req, res) {
  try {
    var pullUrl = budgetUrl('/api/forecast');
    var response = await fetch(pullUrl);
    if (!response.ok) throw new Error('Farm Budget returned ' + response.status);
    var data = await response.json();
    var cropYear = store.settings.cropYear || 2026;

    var result = applyForecastSync(data, cropYear);
    // Also sync the full product catalog (not just forecasted products)
    await syncAllProductsFromBudget();
    await saveData();

    res.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      removed: result.removed,
      skipped: result.skipped,
      totalProducts: store.products.filter(function (p) { return p.active !== false; }).length,
      totalForecasts: store.forecasts.filter(function (f) { return String(f.cropYear) === String(cropYear); }).length
    });
  } catch (err) {
    console.error('Pull from budget error:', err);
    res.status(500).json({ error: 'Failed to pull from Farm Budget: ' + err.message });
  }
});

// Live sync webhook — called by farm-budget after every save.
let _syncInProgress = false;
app.post('/api/forecasts/sync-webhook', async function (req, res) {
  // Respond immediately so farm-budget isn't blocked
  res.json({ ok: true, queued: true });

  // Always invalidate the catalog cache so new products appear on next /api/products call
  _catalogCache = { data: null, fetchedAt: 0 };

  if (_syncInProgress) return;
  _syncInProgress = true;

  try {
    var syncUrl = budgetUrl('/api/forecast');
    var response = await fetch(syncUrl);
    if (!response.ok) { _syncInProgress = false; return; }
    var data = await response.json();
    var cropYear = store.settings.cropYear || 2026;

    var result = applyForecastSync(data, cropYear);
    await saveData();
    console.log('[live-sync] Forecasts synced from farm-budget — created:' + result.created + ' updated:' + result.updated + ' removed:' + result.removed + ' (' + new Date().toISOString() + ')');

    // Background: materialize any new products/seeds from farm-budget
    syncAllProductsFromBudget().then(function (r) {
      if (r.changed) console.log('[live-sync] Product catalog synced — ' + r.products + ' products, ' + r.seeds + ' seeds checked');
    }).catch(function (e) { console.warn('[live-sync] Product sync error:', e.message); });
  } catch (err) {
    console.error('[live-sync] Sync failed:', err.message);
  } finally {
    _syncInProgress = false;
  }
});

function findOrCreateProduct(bp, type, categoryName, inputCategoryMap) {
  var name = bp.productName || '';
  var match;

  if (bp.isSeedVariety || type === 'SEED') {
    // Match seed by variety name
    match = store.products.find(function (p) {
      return p.active !== false && p.type === 'SEED' &&
        (p.variety || '').toLowerCase() === name.toLowerCase();
    });
    if (!match) {
      match = {
        id: generateId('prod'),
        type: 'SEED',
        brand: bp.supplierName || '',
        supplier: bp.supplierName || '',
        crop: '',
        variety: name,
        productName: '',
        inputCategory: '',
        unitType: (bp.unit || 'units').toLowerCase(),
        purchaseUnit: (bp.purchaseUnit || bp.unit || 'units').toLowerCase(),
        conversionRate: bp.conversionRate || 1,
        packSize: 0,
        packType: '',
        organicCertNumber: '',
        omriListed: false,
        organicGround: !!bp.organicGround,
        notes: 'Auto-created from Farm Budget sync',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.products.push(match);
    } else {
      // Update organicGround + unit info from budget on every sync
      match.organicGround = !!bp.organicGround;
      if (bp.purchaseUnit) match.purchaseUnit = bp.purchaseUnit.toLowerCase();
      if (bp.conversionRate) match.conversionRate = bp.conversionRate;
    }
  } else {
    // Match input by product name (case-insensitive)
    match = store.products.find(function (p) {
      return p.active !== false && p.type === 'INPUT' &&
        (p.productName || '').toLowerCase() === name.toLowerCase();
    });
    if (!match) {
      match = {
        id: generateId('prod'),
        type: 'INPUT',
        brand: '',
        supplier: bp.supplierName || '',
        crop: '',
        variety: '',
        productName: name,
        inputCategory: inputCategoryMap[categoryName] || 'OTHER',
        unitType: (bp.unit || 'units').toLowerCase(),
        purchaseUnit: (bp.purchaseUnit || bp.unit || 'units').toLowerCase(),
        conversionRate: bp.conversionRate || 1,
        packSize: 0,
        packType: '',
        organicCertNumber: '',
        omriListed: false,
        organicGround: !!bp.organicGround,
        notes: 'Auto-created from Farm Budget sync',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.products.push(match);
    } else {
      // Update organicGround + unit info from budget on every sync
      match.organicGround = !!bp.organicGround;
      if (bp.purchaseUnit) match.purchaseUnit = bp.purchaseUnit.toLowerCase();
      if (bp.conversionRate) match.conversionRate = bp.conversionRate;
    }
  }

  return match;
}

// ─── Farm-Budget Product Sync Helpers ───────────────────────────────

function mapInputCategoryToBudget(cat) {
  var m = { 'FERTILIZER': 'Fertilizer', 'CHEMICAL': 'Chemical', 'BIOLOGICAL': 'Biological', 'OTHER': 'Other', 'SEED': 'Seed' };
  return m[cat] || 'Other';
}

// Push a new seed-inventory product to farm-budget. Returns the budget product id or null.
async function pushProductToBudget(localProduct) {
  try {
    var isSeed = localProduct.type === 'SEED';
    var url = isSeed ? budgetUrl('/api/seeds') : budgetUrl('/api/products');

    // Resolve supplier mapping for the budget-side supplierId
    var budgetSupplierId = '';
    if (localProduct.supplier) {
      var nameMatch = (store.supplierMappings || []).find(function (m) {
        var s = (store.suppliers || []).find(function (s) { return s.id === m.localSupplierId; });
        return s && s.name.toLowerCase() === (localProduct.supplier || '').toLowerCase();
      });
      if (nameMatch) budgetSupplierId = nameMatch.budgetSupplierId;
    }

    var payload = isSeed ? {
      crop: localProduct.crop || '',
      brand: localProduct.brand || '',
      variety: localProduct.variety || '',
      pricePerUnit: 0,
      seedsPerUnit: Math.round(localProduct.conversionRate) || 80000,
      organicGround: !!localProduct.organicGround,
      supplierId: budgetSupplierId || ''
    } : {
      name: localProduct.productName || '',
      category: mapInputCategoryToBudget(localProduct.inputCategory),
      unit: localProduct.unitType || 'lbs',
      purchaseUnit: localProduct.purchaseUnit || '',
      unitBilledPrice: 0,
      conversionRate: localProduct.conversionRate || 1,
      organic: !!localProduct.organicGround,
      organicGround: !!localProduct.organicGround,
      supplierId: budgetSupplierId || ''
    };

    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Farm Budget returned ' + resp.status);
    var created = await resp.json();
    return { id: created.id, type: isSeed ? 'seed' : 'product' };
  } catch (e) {
    console.warn('[write-back] pushProductToBudget failed:', e.message);
    return null;
  }
}

// Ensure a local supplier exists in farm-budget; returns the budget supplier id or null.
async function ensureSupplierInBudget(localSupplier) {
  try {
    // Check existing mapping
    var existing = (store.supplierMappings || []).find(function (m) { return m.localSupplierId === localSupplier.id; });
    if (existing) return existing.budgetSupplierId;

    // Check name match in farm-budget
    var budgetSuppliers = await fetch(budgetUrl('/api/suppliers')).then(function (r) { return r.json(); });
    var nameMatch = budgetSuppliers.find(function (s) {
      return s.name.toLowerCase() === (localSupplier.name || '').toLowerCase();
    });

    var budgetSupplierId;
    if (nameMatch) {
      budgetSupplierId = nameMatch.id;
    } else {
      var created = await fetch(budgetUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: localSupplier.name,
          type: 'product',
          contact: localSupplier.contactName || localSupplier.email || '',
          notes: localSupplier.notes || ''
        })
      }).then(function (r) { return r.json(); });
      budgetSupplierId = created.id;
    }

    if (!store.supplierMappings) store.supplierMappings = [];
    store.supplierMappings.push({ localSupplierId: localSupplier.id, budgetSupplierId: budgetSupplierId, syncedAt: new Date().toISOString() });
    await saveData();
    _catalogCache = { data: null, fetchedAt: 0 };
    return budgetSupplierId;
  } catch (e) {
    console.warn('[write-back] ensureSupplierInBudget failed:', e.message);
    return null;
  }
}

// Materialize all farm-budget products/seeds as local records with budgetProductId set.
// Safe to call repeatedly — skips products already linked by ID or matched by name.
async function syncAllProductsFromBudget() {
  try {
    var results = await Promise.allSettled([
      fetch(budgetUrl('/api/products')).then(function (r) { return r.json(); }),
      fetch(budgetUrl('/api/seeds')).then(function (r) { return r.json(); })
    ]);
    if (results[0].status === 'rejected' && results[1].status === 'rejected') return { changed: false };

    var budgetProducts = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
    var budgetSeeds    = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
    var changed = false;

    // Input products
    for (var i = 0; i < budgetProducts.length; i++) {
      var bp = budgetProducts[i];
      var bpName = (bp.name || '').toLowerCase();
      var local = (store.products || []).find(function (p) {
        if (p.active === false) return false;
        if (p.budgetProductId && p.budgetProductId === bp.id) return true;
        return p.type === 'INPUT' && (p.productName || '').toLowerCase() === bpName;
      });
      if (local) {
        // Backfill ID + keep units in sync
        if (!local.budgetProductId) { local.budgetProductId = bp.id; local.budgetProductType = 'product'; changed = true; }
        if (bp.purchaseUnit && local.purchaseUnit !== bp.purchaseUnit.toLowerCase()) { local.purchaseUnit = bp.purchaseUnit.toLowerCase(); changed = true; }
        if (bp.conversionRate && local.conversionRate !== bp.conversionRate) { local.conversionRate = bp.conversionRate; changed = true; }
      } else {
        store.products.push({
          id: generateId('prod'),
          type: (bp.category === 'Seed') ? 'SEED' : 'INPUT',
          brand: '',
          supplier: '',
          crop: '',
          variety: '',
          productName: bp.name || '',
          inputCategory: mapInputCategoryToBudget(bp.category) === 'Seed' ? '' : mapInputCategoryToBudget(bp.category),
          unitType: (bp.unit || 'units').toLowerCase(),
          purchaseUnit: (bp.purchaseUnit || bp.unit || 'units').toLowerCase(),
          conversionRate: bp.conversionRate || 1,
          packSize: 0, packType: '',
          organicCertNumber: '', omriListed: false,
          organicGround: !!bp.organicGround,
          budgetProductId: bp.id,
          budgetProductType: 'product',
          notes: 'Synced from Farm Budget',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        changed = true;
      }
    }

    // Seeds
    for (var j = 0; j < budgetSeeds.length; j++) {
      var bs = budgetSeeds[j];
      var bsVariety = (bs.variety || '').toLowerCase();
      var localSeed = (store.products || []).find(function (p) {
        if (p.active === false) return false;
        if (p.budgetProductId && p.budgetProductId === bs.id) return true;
        return p.type === 'SEED' && (p.variety || '').toLowerCase() === bsVariety;
      });
      if (localSeed) {
        if (!localSeed.budgetProductId) { localSeed.budgetProductId = bs.id; localSeed.budgetProductType = 'seed'; changed = true; }
      } else {
        store.products.push({
          id: generateId('prod'),
          type: 'SEED',
          brand: bs.brand || '',
          supplier: '',
          crop: bs.crop || '',
          variety: bs.variety || '',
          productName: '',
          inputCategory: '',
          unitType: 'units',
          purchaseUnit: 'units',
          conversionRate: bs.seedsPerUnit || 1,
          packSize: 0, packType: '',
          organicCertNumber: '', omriListed: false,
          organicGround: !!bs.organicGround,
          budgetProductId: bs.id,
          budgetProductType: 'seed',
          notes: 'Synced from Farm Budget',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        changed = true;
      }
    }

    if (changed) await saveData();
    return { changed: changed, products: budgetProducts.length, seeds: budgetSeeds.length };
  } catch (e) {
    console.error('[sync-products] Failed:', e.message);
    return { changed: false, error: e.message };
  }
}

// ─── Budget Catalog Proxy (read-only from farm-budget) ──────────────

var _catalogCache = { data: null, fetchedAt: 0 };
var CATALOG_CACHE_TTL = 60 * 1000;

app.get('/api/budget/catalog', async function (req, res) {
  var now = Date.now();
  if (_catalogCache.data && (now - _catalogCache.fetchedAt) < CATALOG_CACHE_TTL) {
    return res.json(_catalogCache.data);
  }

  try {
    var results = await Promise.allSettled([
      fetch(budgetUrl('/api/products')).then(function (r) { return r.json(); }),
      fetch(budgetUrl('/api/seeds')).then(function (r) { return r.json(); }),
      fetch(budgetUrl('/api/suppliers')).then(function (r) { return r.json(); })
    ]);

    if (results[0].status === 'rejected' && results[1].status === 'rejected') {
      return res.json({ offline: true, error: 'Farm Budget not available', catalog: [] });
    }

    var budgetProducts = results[0].status === 'fulfilled' ? results[0].value : [];
    var budgetSeeds = results[1].status === 'fulfilled' ? results[1].value : [];
    var budgetSuppliers = results[2].status === 'fulfilled' ? results[2].value : [];

    var supplierLookup = {};
    budgetSuppliers.forEach(function (s) { supplierLookup[s.id] = s.name; });

    var catalog = [];

    budgetProducts.forEach(function (p) {
      catalog.push({
        budgetId: p.id,
        budgetType: 'product',
        type: (p.category === 'Seed') ? 'SEED' : 'INPUT',
        name: p.name || '',
        category: p.category || 'Other',
        supplier: supplierLookup[p.supplierId] || '',
        supplierId: p.supplierId || '',
        unit: p.unit || '',
        purchaseUnit: p.purchaseUnit || '',
        unitBilledPrice: p.unitBilledPrice || 0,
        conversionRate: p.conversionRate || 1,
        applicationPrice: p.applicationPrice || 0,
        organic: p.organic || false,
        p205: p.p205 || 0,
        k20: p.k20 || 0
      });
    });

    budgetSeeds.forEach(function (s) {
      catalog.push({
        budgetId: s.id,
        budgetType: 'seed',
        type: 'SEED',
        name: (s.brand ? s.brand + ' ' : '') + (s.variety || ''),
        category: 'Seed',
        crop: s.crop || '',
        brand: s.brand || '',
        variety: s.variety || '',
        supplier: supplierLookup[s.supplierId] || '',
        supplierId: s.supplierId || '',
        unit: 'units',
        pricePerUnit: s.pricePerUnit || 0,
        seedsPerUnit: s.seedsPerUnit || 0,
        organic: false
      });
    });

    catalog.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'SEED' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    var response = { offline: false, catalog: catalog, supplierCount: budgetSuppliers.length };
    _catalogCache = { data: response, fetchedAt: now };
    res.json(response);
  } catch (err) {
    res.json({ offline: true, error: err.message, catalog: [] });
  }
});

// ─── Product Overlays (local organic cert data) ─────────────────────

app.get('/api/product-overlays', function (req, res) {
  res.json(store.productOverlays || []);
});

app.put('/api/product-overlays/:budgetProductId', async function (req, res) {
  var bpId = req.params.budgetProductId;
  var existing = (store.productOverlays || []).find(function (o) { return o.budgetProductId === bpId; });

  if (existing) {
    existing.organicCertNumber = req.body.organicCertNumber || '';
    existing.omriListed = !!req.body.omriListed;
    existing.localNotes = req.body.localNotes || '';
    existing.updatedAt = new Date().toISOString();
    await saveData();
    return res.json(existing);
  }

  var overlay = {
    id: generateId('ovl'),
    budgetProductId: bpId,
    budgetProductType: req.body.budgetProductType || 'product',
    organicCertNumber: req.body.organicCertNumber || '',
    omriListed: !!req.body.omriListed,
    localNotes: req.body.localNotes || '',
    updatedAt: new Date().toISOString()
  };
  store.productOverlays.push(overlay);
  await saveData();
  res.json(overlay);
});

// ─── Supplier Sync to Farm Budget ───────────────────────────────────

// Get supplier mappings
app.get('/api/supplier-mappings', function (req, res) {
  res.json(store.supplierMappings || []);
});

// Assign a local supplier to a farm-budget product (and sync supplier to budget)
app.post('/api/budget/assign-supplier', async function (req, res) {
  var budgetProductId = req.body.budgetProductId;
  var budgetProductType = req.body.budgetProductType || 'product';
  var localSupplierId = req.body.localSupplierId;

  if (!budgetProductId || !localSupplierId) {
    return res.status(400).json({ error: 'budgetProductId and localSupplierId required' });
  }

  var localSupplier = (store.suppliers || []).find(function (s) { return s.id === localSupplierId; });
  if (!localSupplier) {
    return res.status(404).json({ error: 'Local supplier not found' });
  }

  try {
    // Check if we already have a mapping for this local supplier
    var mapping = (store.supplierMappings || []).find(function (m) { return m.localSupplierId === localSupplierId; });
    var budgetSupplierId;

    if (mapping) {
      budgetSupplierId = mapping.budgetSupplierId;
    } else {
      // Fetch existing farm-budget suppliers to find a name match
      var budgetSuppliers = await fetch(budgetUrl('/api/suppliers')).then(function (r) { return r.json(); });
      var existing = budgetSuppliers.find(function (s) {
        return s.name.toLowerCase() === localSupplier.name.toLowerCase();
      });

      if (existing) {
        budgetSupplierId = existing.id;
      } else {
        // Create the supplier in farm-budget
        var created = await fetch(budgetUrl('/api/suppliers'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: localSupplier.name,
            type: 'product',
            contact: localSupplier.contactName || localSupplier.email || '',
            notes: localSupplier.notes || ''
          })
        }).then(function (r) { return r.json(); });
        budgetSupplierId = created.id;
      }

      // Store the mapping
      store.supplierMappings.push({
        localSupplierId: localSupplierId,
        budgetSupplierId: budgetSupplierId,
        syncedAt: new Date().toISOString()
      });
      await saveData();
    }

    // Now update the product/seed in farm-budget with the supplierId
    var updateUrl = budgetProductType === 'seed'
      ? budgetUrl('/api/seeds/' + budgetProductId)
      : budgetUrl('/api/products/' + budgetProductId);

    await fetch(updateUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId: budgetSupplierId })
    });

    // Invalidate catalog cache
    _catalogCache = { data: null, fetchedAt: 0 };

    res.json({ ok: true, budgetSupplierId: budgetSupplierId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync supplier to Farm Budget: ' + err.message });
  }
});

// Bulk sync all local suppliers to farm-budget
app.post('/api/budget/sync-suppliers', async function (req, res) {
  try {
    var budgetSuppliers = await fetch(budgetUrl('/api/suppliers')).then(function (r) { return r.json(); });
    var created = 0;
    var alreadyMapped = 0;

    for (var i = 0; i < store.suppliers.length; i++) {
      var local = store.suppliers[i];
      if (local.active === false) continue;

      // Check existing mapping
      var existingMapping = (store.supplierMappings || []).find(function (m) { return m.localSupplierId === local.id; });
      if (existingMapping) { alreadyMapped++; continue; }

      // Check name match in farm-budget
      var nameMatch = budgetSuppliers.find(function (s) {
        return s.name.toLowerCase() === local.name.toLowerCase();
      });

      var budgetSupplierId;
      if (nameMatch) {
        budgetSupplierId = nameMatch.id;
      } else {
        var newSup = await fetch(budgetUrl('/api/suppliers'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: local.name,
            type: 'product',
            contact: local.contactName || local.email || '',
            notes: local.notes || ''
          })
        }).then(function (r) { return r.json(); });
        budgetSupplierId = newSup.id;
        budgetSuppliers.push(newSup); // Add to local array to prevent duplicates
        created++;
      }

      store.supplierMappings.push({
        localSupplierId: local.id,
        budgetSupplierId: budgetSupplierId,
        syncedAt: new Date().toISOString()
      });
    }

    await saveData();
    _catalogCache = { data: null, fetchedAt: 0 };

    res.json({
      ok: true,
      synced: store.supplierMappings.length,
      created: created,
      alreadyMapped: alreadyMapped
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync suppliers: ' + err.message });
  }
});

// ─── Orders CRUD ────────────────────────────────────────────────────

app.get('/api/orders', function (req, res) {
  var items = store.orders;
  if (req.query.cropYear) items = items.filter(function (o) { return String(o.cropYear) === req.query.cropYear; });
  if (req.query.supplierId) items = items.filter(function (o) { return o.supplierId === req.query.supplierId; });
  if (req.query.paymentStatus) items = items.filter(function (o) { return o.paymentStatus === req.query.paymentStatus; });
  res.json(items);
});

app.get('/api/orders/open', function (req, res) {
  var supplierId = req.query.supplierId;
  var cropYear = req.query.cropYear || String(store.settings.cropYear);

  var open = store.orders.filter(function (o) {
    if (supplierId && o.supplierId !== supplierId) return false;
    if (String(o.cropYear) !== cropYear) return false;
    var delivered = store.receipts
      .filter(function (r) { return r.orderId === o.id; })
      .reduce(function (sum, r) { return sum + (r.quantityReceived || 0); }, 0);
    return delivered < o.quantityOrdered;
  });

  var enriched = open.map(function (o) {
    var product = store.products.find(function (p) { return p.id === o.productId; });
    var delivered = store.receipts
      .filter(function (r) { return r.orderId === o.id; })
      .reduce(function (sum, r) { return sum + (r.quantityReceived || 0); }, 0);
    return Object.assign({}, o, {
      _product: product || null,
      _delivered: delivered,
      _remaining: o.quantityOrdered - delivered
    });
  });
  res.json(enriched);
});

app.get('/api/orders/:id', function (req, res) {
  var item = store.orders.find(function (o) { return o.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Order not found' });
  res.json(item);
});

app.post('/api/orders', async function (req, res) {
  var qty = parseFloat(req.body.quantityOrdered) || 0;
  var price = parseFloat(req.body.pricePerUnit) || 0;
  var discount = parseFloat(req.body.prepayDiscount) || 0;
  var item = {
    id: generateId('ord'),
    productId: req.body.productId || '',
    supplierId: req.body.supplierId || '',
    cropYear: parseInt(req.body.cropYear) || store.settings.cropYear,
    quantityOrdered: qty,
    unit: req.body.unit || 'units',
    pricePerUnit: price,
    totalCost: Math.round(qty * price * (1 - discount) * 100) / 100,
    invoiceNumber: req.body.invoiceNumber || '',
    invoiceDate: req.body.invoiceDate || '',
    paymentStatus: req.body.paymentStatus || 'UNPAID',
    amountPaid: parseFloat(req.body.amountPaid) || 0,
    prepayDiscount: discount,
    dueDate: req.body.dueDate || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.orders.push(item);
  await saveData();
  res.status(201).json(item);
});

app.put('/api/orders/:id', async function (req, res) {
  var idx = store.orders.findIndex(function (o) { return o.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  Object.assign(store.orders[idx], req.body, { updatedAt: new Date().toISOString() });
  // Recalc totalCost if qty/price/discount changed
  var o = store.orders[idx];
  o.totalCost = Math.round((o.quantityOrdered || 0) * (o.pricePerUnit || 0) * (1 - (o.prepayDiscount || 0)) * 100) / 100;
  await saveData();
  res.json(store.orders[idx]);
});

app.delete('/api/orders/:id', async function (req, res) {
  var idx = store.orders.findIndex(function (o) { return o.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  store.orders.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// ─── Receipts CRUD ──────────────────────────────────────────────────

app.get('/api/receipts', function (req, res) {
  var items = store.receipts;
  if (req.query.orderId) items = items.filter(function (r) { return r.orderId === req.query.orderId; });
  if (req.query.productId) items = items.filter(function (r) { return r.productId === req.query.productId; });
  if (req.query.deliveryGroupId) items = items.filter(function (r) { return r.deliveryGroupId === req.query.deliveryGroupId; });
  res.json(items);
});

app.get('/api/receipts/:id', function (req, res) {
  var item = store.receipts.find(function (r) { return r.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Receipt not found' });
  res.json(item);
});

// Update pickup statuses on an order based on its current receipts.
// 'received' when qty >= authorizedQty, 'partial' when some delivered but less, 'pending' otherwise.
function syncPickupStatuses(orderId) {
  var order = store.orders.find(function (o) { return o.id === orderId; });
  if (!order || !Array.isArray(order.pickupNumbers) || order.pickupNumbers.length === 0) return;

  var orderReceipts = store.receipts.filter(function (r) { return r.orderId === orderId; });

  order.pickupNumbers.forEach(function (pku) {
    // Receipts that reference this pickup
    var pkuReceipts = orderReceipts.filter(function (r) { return r.pickupNumberId === pku.id; });
    var delivered = pkuReceipts.reduce(function (s, r) { return s + (r.quantityReceived || 0); }, 0);
    var auth = pku.authorizedQty || 0;
    if (delivered <= 0) {
      pku.status = 'pending';
    } else if (auth > 0 && delivered >= auth) {
      pku.status = 'received';
    } else {
      pku.status = 'partial';
    }
  });
}

app.post('/api/receipts', async function (req, res) {
  var item = {
    id: generateId('rct'),
    orderId: req.body.orderId || '',
    productId: req.body.productId || '',
    supplierId: req.body.supplierId || '',
    farmId: req.body.farmId || '',
    farmName: req.body.farmName || '',
    dateReceived: req.body.dateReceived || new Date().toISOString().split('T')[0],
    quantityReceived: parseFloat(req.body.quantityReceived) || 0,
    unit: req.body.unit || 'units',
    lotNumber: req.body.lotNumber || '',
    ticketNumber: req.body.ticketNumber || '',
    receivedBy: req.body.receivedBy || '',
    verifiedBy: req.body.verifiedBy || '',
    verificationMethod: req.body.verificationMethod || 'MANUAL',
    photoPath: req.body.photoPath || '',
    scanData: req.body.scanData || null,
    discrepancyFlag: req.body.discrepancyFlag || false,
    discrepancyNotes: req.body.discrepancyNotes || '',
    notes: req.body.notes || '',
    pickupNumberId: req.body.pickupNumberId || '',
    createdAt: new Date().toISOString()
  };
  store.receipts.push(item);
  if (item.orderId) syncPickupStatuses(item.orderId);
  await saveData();
  res.status(201).json(item);
});

app.put('/api/receipts/:id', async function (req, res) {
  var idx = store.receipts.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Receipt not found' });
  Object.assign(store.receipts[idx], req.body, { updatedAt: new Date().toISOString() });
  var orderId = store.receipts[idx].orderId;
  if (orderId) syncPickupStatuses(orderId);
  await saveData();
  res.json(store.receipts[idx]);
});

app.delete('/api/receipts/:id', async function (req, res) {
  var idx = store.receipts.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Receipt not found' });
  var orderId = store.receipts[idx].orderId;
  store.receipts.splice(idx, 1);
  if (orderId) syncPickupStatuses(orderId);
  await saveData();
  res.json({ ok: true });
});

// ─── Batch Receipts ─────────────────────────────────────────────────

app.post('/api/receipts/batch', async function (req, res) {
  var shared = req.body.shared || {};
  var items = req.body.items || [];

  if (items.length === 0) {
    return res.status(400).json({ error: 'At least one line item required' });
  }

  var deliveryGroupId = generateId('dlv');
  var created = [];

  var affectedOrderIds = new Set();
  items.forEach(function (item) {
    var receipt = {
      id: generateId('rct'),
      deliveryGroupId: deliveryGroupId,
      orderId: item.orderId || '',
      productId: item.productId || '',
      supplierId: shared.supplierId || '',
      farmId: shared.farmId || '',
      farmName: shared.farmName || '',
      dateReceived: shared.dateReceived || new Date().toISOString().split('T')[0],
      quantityReceived: parseFloat(item.quantityReceived) || 0,
      unit: item.unit || 'units',
      lotNumber: item.lotNumber || '',
      ticketNumber: shared.ticketNumber || '',
      receivedBy: shared.receivedBy || '',
      verifiedBy: shared.verifiedBy || '',
      verificationMethod: shared.verificationMethod || 'MANUAL',
      photoPath: shared.photoPath || '',
      scanData: shared.scanData || null,
      discrepancyFlag: item.discrepancyFlag || false,
      discrepancyNotes: item.discrepancyNotes || '',
      notes: shared.notes || '',
      pickupNumberId: item.pickupNumberId || '',
      createdAt: new Date().toISOString()
    };
    store.receipts.push(receipt);
    created.push(receipt);
    if (receipt.orderId) affectedOrderIds.add(receipt.orderId);
  });

  affectedOrderIds.forEach(function (oid) { syncPickupStatuses(oid); });
  await saveData();
  res.status(201).json({ deliveryGroupId: deliveryGroupId, receipts: created });
});

// ─── Returns CRUD ───────────────────────────────────────────────────

app.get('/api/returns', function (req, res) {
  var items = store.returns;
  if (req.query.cropYear) {
    // Filter by linked order's cropYear
    items = items.filter(function (ret) {
      var order = store.orders.find(function (o) { return o.id === ret.orderId; });
      return order && String(order.cropYear) === req.query.cropYear;
    });
  }
  res.json(items);
});

app.get('/api/returns/:id', function (req, res) {
  var item = store.returns.find(function (r) { return r.id === req.params.id; });
  if (!item) return res.status(404).json({ error: 'Return not found' });
  res.json(item);
});

app.post('/api/returns', async function (req, res) {
  var item = {
    id: generateId('ret'),
    productId: req.body.productId || '',
    orderId: req.body.orderId || '',
    supplierId: req.body.supplierId || '',
    dateReturned: req.body.dateReturned || new Date().toISOString().split('T')[0],
    quantityReturned: parseFloat(req.body.quantityReturned) || 0,
    unit: req.body.unit || 'units',
    reason: req.body.reason || '',
    creditAmount: parseFloat(req.body.creditAmount) || 0,
    creditReceived: req.body.creditReceived || false,
    processedBy: req.body.processedBy || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString()
  };
  store.returns.push(item);
  await saveData();
  res.status(201).json(item);
});

app.put('/api/returns/:id', async function (req, res) {
  var idx = store.returns.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Return not found' });
  Object.assign(store.returns[idx], req.body, { updatedAt: new Date().toISOString() });
  await saveData();
  res.json(store.returns[idx]);
});

app.delete('/api/returns/:id', async function (req, res) {
  var idx = store.returns.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Return not found' });
  store.returns.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// ─── Reconciliation (computed view) ─────────────────────────────────

app.get('/api/reconciliation', async function (req, res) {
  var cropYear = req.query.cropYear || String(store.settings.cropYear);
  var typeFilter = req.query.type;
  var organicOnly = req.query.organic === 'true';

  // Fetch conversion rates from farm-budget for inputs missing local conversionRate
  var budgetConv = {};
  try {
    var bpResp = await fetch(budgetUrl('/api/products'));
    if (bpResp.ok) {
      var bpProducts = await bpResp.json();
      bpProducts.forEach(function (bp) {
        var key = (bp.name || '').trim().toLowerCase();
        if (key && bp.conversionRate) {
          budgetConv[key] = {
            conversionRate: bp.conversionRate,
            purchaseUnit: bp.purchaseUnit || bp.unit || ''
          };
        }
      });
    }
  } catch (e) {
    // farm-budget unavailable — fall back to local product data
  }

  var products = store.products.filter(function (p) {
    if (p.active === false) return false;
    if (typeFilter && p.type !== typeFilter) return false;
    if (organicOnly && !p.organicGround) return false;
    return true;
  });

  var result = products.map(function (p) {
    var forecasts = store.forecasts.filter(function (f) {
      return f.productId === p.id && String(f.cropYear) === cropYear;
    });
    var orders = store.orders.filter(function (o) {
      return o.productId === p.id && String(o.cropYear) === cropYear;
    });
    var orderIds = orders.map(function (o) { return o.id; });
    var receipts = store.receipts.filter(function (r) {
      return r.productId === p.id && (!r.orderId || orderIds.indexOf(r.orderId) !== -1);
    });
    var returns = store.returns.filter(function (ret) {
      return ret.productId === p.id && (!ret.orderId || orderIds.indexOf(ret.orderId) !== -1);
    });

    // Use local conversionRate if set, otherwise look up from farm-budget
    var convRate = p.conversionRate;
    var purchaseUnit = p.purchaseUnit || p.unitType || '';
    if (!convRate || convRate === 1) {
      var lookupKey = (p.type === 'INPUT' ? (p.productName || '') : (p.variety || '')).trim().toLowerCase();
      var budgetMatch = budgetConv[lookupKey];
      if (budgetMatch) {
        convRate = budgetMatch.conversionRate;
        purchaseUnit = budgetMatch.purchaseUnit || purchaseUnit;
        // Backfill the product so future lookups don't need farm-budget
        p.conversionRate = convRate;
        p.purchaseUnit = purchaseUnit;
      }
    }
    convRate = convRate || 1;

    // Convert forecast from application units to billed (purchase) units
    var forecastApp = forecasts.reduce(function (s, f) { return s + (f.projectedQuantity || 0); }, 0);
    var forecast = convRate > 0 ? Math.round(forecastApp / convRate * 100) / 100 : forecastApp;

    var totalOrdered = orders.reduce(function (s, o) { return s + (o.quantityOrdered || 0); }, 0);
    var totalDelivered = receipts.reduce(function (s, r) { return s + (r.quantityReceived || 0); }, 0);
    var totalReturned = returns.reduce(function (s, r) { return s + (r.quantityReturned || 0); }, 0);
    var totalCost = orders.reduce(function (s, o) { return s + (o.totalCost || 0); }, 0);

    // Collect pickup numbers across all orders for this product
    var pickupRows = [];
    orders.forEach(function (o) {
      (o.pickupNumbers || []).forEach(function (pku) {
        pickupRows.push({
          pickupNum: pku.pickupNum || '',
          authorizedQty: pku.authorizedQty || 0,
          unit: pku.unit || purchaseUnit,
          farmName: pku.farmName || '',
          crop: pku.crop || '',
          status: pku.status || 'pending'
        });
      });
    });

    return {
      productId: p.id,
      type: p.type,
      brand: p.brand,
      crop: p.crop || '',
      variety: p.variety || '',
      productName: p.productName || '',
      organicGround: !!p.organicGround,
      unit: purchaseUnit,
      forecast: forecast,
      totalOrdered: totalOrdered,
      totalDelivered: totalDelivered,
      totalReturned: totalReturned,
      onHand: totalDelivered - totalReturned,
      balance: totalOrdered - totalDelivered,
      percentOrdered: forecast > 0 ? Math.round(totalOrdered / forecast * 1000) / 10 : 0,
      percentDelivered: totalOrdered > 0 ? Math.round(totalDelivered / totalOrdered * 1000) / 10 : 0,
      totalCost: totalCost,
      pickupRows: pickupRows
    };
  });

  // Backfill: save any updated conversionRate/purchaseUnit to disk
  if (Object.keys(budgetConv).length > 0) saveData().catch(function () {});

  // Only return products that have at least some activity
  var active = result.filter(function (r) {
    return r.forecast > 0 || r.totalOrdered > 0 || r.totalDelivered > 0;
  });

  res.json(active);
});

// ─── Organic Ground Summary ─────────────────────────────────────────
// Returns order + delivery details for products designated as organic ground
app.get('/api/organic-ground/summary', function (req, res) {
  var cropYear = req.query.cropYear || String(store.settings.cropYear);

  // Filter to organic-ground products only
  var ogProducts = store.products.filter(function (p) {
    return p.active !== false && !!p.organicGround;
  });

  // Build supplier lookup
  var supplierMap = {};
  (store.suppliers || []).forEach(function (s) { supplierMap[s.id] = s.name; });

  var result = ogProducts.map(function (p) {
    var forecasts = store.forecasts.filter(function (f) {
      return f.productId === p.id && String(f.cropYear) === cropYear;
    });
    var orders = store.orders.filter(function (o) {
      return o.productId === p.id && String(o.cropYear) === cropYear;
    });
    var orderIds = orders.map(function (o) { return o.id; });
    var receipts = store.receipts.filter(function (r) {
      return r.productId === p.id && (!r.orderId || orderIds.indexOf(r.orderId) !== -1);
    });

    var convRate = p.conversionRate || 1;
    var purchaseUnit = p.purchaseUnit || p.unitType || '';
    var forecastApp = forecasts.reduce(function (s, f) { return s + (f.projectedQuantity || 0); }, 0);
    var forecastQty = convRate > 0 ? Math.round(forecastApp / convRate * 100) / 100 : forecastApp;
    var orderedQty = orders.reduce(function (s, o) { return s + (o.quantityOrdered || 0); }, 0);
    var deliveredQty = receipts.reduce(function (s, r) { return s + (r.quantityReceived || 0); }, 0);

    return {
      productId: p.id,
      name: p.type === 'SEED' ? (p.variety || p.productName) : (p.productName || p.variety),
      type: p.type,
      crop: p.crop || '',
      variety: p.variety || '',
      brand: p.brand || '',
      unit: purchaseUnit,
      forecastQty: forecastQty,
      orderedQty: orderedQty,
      deliveredQty: deliveredQty,
      orders: orders.map(function (o) {
        return {
          orderId: o.id,
          supplier: supplierMap[o.supplierId] || '',
          qty: o.quantityOrdered || 0,
          invoiceNumber: o.invoiceNumber || '',
          paymentStatus: o.paymentStatus || '',
          dueDate: o.dueDate || ''
        };
      }),
      receipts: receipts.map(function (r) {
        return {
          receiptId: r.id,
          dateReceived: r.dateReceived || '',
          qty: r.quantityReceived || 0,
          lotNumber: r.lotNumber || '',
          ticketNumber: r.ticketNumber || ''
        };
      })
    };
  });

  // Only return items with some activity or forecast
  var active = result.filter(function (r) {
    return r.forecastQty > 0 || r.orderedQty > 0 || r.deliveredQty > 0;
  });

  res.json(active);
});

// ─── Dashboard ──────────────────────────────────────────────────────

app.get('/api/dashboard', function (req, res) {
  var cropYear = String(store.settings.cropYear);

  var orders = store.orders.filter(function (o) { return String(o.cropYear) === cropYear; });
  var orderIds = orders.map(function (o) { return o.id; });
  var receipts = store.receipts.filter(function (r) {
    return !r.orderId || orderIds.indexOf(r.orderId) !== -1;
  });
  var discrepancies = receipts.filter(function (r) { return r.discrepancyFlag; });

  var totalOrdered = orders.reduce(function (s, o) { return s + (o.quantityOrdered || 0); }, 0);
  var totalDelivered = receipts.reduce(function (s, r) { return s + (r.quantityReceived || 0); }, 0);

  res.json({
    cropYear: cropYear,
    totalProducts: store.products.filter(function (p) { return p.active !== false; }).length,
    seedProducts: store.products.filter(function (p) { return p.type === 'SEED' && p.active !== false; }).length,
    inputProducts: store.products.filter(function (p) { return p.type === 'INPUT' && p.active !== false; }).length,
    totalSuppliers: store.suppliers.filter(function (s) { return s.active !== false; }).length,
    totalOrders: orders.length,
    unpaidOrders: orders.filter(function (o) { return o.paymentStatus === 'UNPAID'; }).length,
    totalOrderValue: orders.reduce(function (s, o) { return s + (o.totalCost || 0); }, 0),
    totalReceipts: receipts.length,
    discrepancyCount: discrepancies.length,
    totalReturns: store.returns.length,
    overallDeliveryPercent: totalOrdered > 0 ? Math.round(totalDelivered / totalOrdered * 1000) / 10 : 0
  });
});

// ─── Delivery Verification (Claude Vision) ──────────────────────────

app.post('/api/verify/scan', photoUpload.single('image'), async function (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    var client = getAnthropic();
    if (!client) {
      return res.status(500).json({ error: 'Scanning not configured. Set ANTHROPIC_API_KEY environment variable.' });
    }

    var base64Image = fs.readFileSync(req.file.path).toString('base64');
    var mediaType = req.file.mimetype;

    var supplierNames = store.suppliers.map(function (s) { return s.name; });
    var productNames = store.products.filter(function (p) { return p.active !== false; }).map(function (p) {
      return p.type === 'SEED'
        ? (p.brand + ' ' + p.variety + ' (' + p.crop + ')')
        : (p.brand + ' ' + p.productName);
    });

    var message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: buildDeliveryTicketPrompt(supplierNames, productNames) }
        ]
      }]
    });

    var responseText = message.content[0].text;
    var parsed;
    try {
      var jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('Failed to parse scan response:', responseText);
      return res.status(500).json({ error: 'Could not parse scan results' });
    }

    // Normalize single-product response to items array format
    if (!parsed.items && parsed.product) {
      parsed.items = [{
        product: parsed.product,
        quantity: parsed.quantity,
        unit: parsed.unit,
        lotNumber: parsed.lotNumber
      }];
    }
    if (!Array.isArray(parsed.items)) {
      parsed.items = [];
    }

    res.json({
      scanData: parsed,
      photoPath: req.file.filename
    });

  } catch (err) {
    console.error('Scan error:', err);
    res.status(err.status || 500).json({
      error: 'Scan failed: ' + (err.message || 'Unknown error')
    });
  }
});

function buildDeliveryTicketPrompt(suppliers, products) {
  return 'You are reading a seed or agricultural input delivery ticket / bill of lading / packing slip. ' +
    'This document may contain MULTIPLE products/line items. Extract ALL of them.\n\n' +
    'Return ONLY a JSON object with these keys:\n' +
    '- "supplier": The supplier/vendor name. Known suppliers: ' + JSON.stringify(suppliers) + '\n' +
    '- "ticketNumber": Delivery ticket or BOL number (string)\n' +
    '- "date": Delivery date in YYYY-MM-DD format\n' +
    '- "notes": Any other relevant info (PO number, truck number, etc.)\n' +
    '- "items": An array of objects, one per product/line item on the document. Each object has:\n' +
    '    - "product": The product name, variety, or description. Known products: ' + JSON.stringify(products) + '\n' +
    '    - "quantity": Number of units/bags/containers delivered (number)\n' +
    '    - "unit": Unit of measure (e.g., "units", "bags", "gal", "lbs")\n' +
    '    - "lotNumber": Lot number or batch number (string)\n\n' +
    'Rules:\n' +
    '- If you cannot read a field clearly, set it to null.\n' +
    '- Match supplier and product names to the known lists when possible.\n' +
    '- If there is only ONE product, still return it as a single-element "items" array.\n' +
    '- Return ONLY the JSON object, no other text.';
}

app.post('/api/verify/match', function (req, res) {
  var scanData = req.body.scanData;
  var supplierId = req.body.supplierId;
  var cropYear = String(store.settings.cropYear);

  var openOrders = store.orders.filter(function (o) {
    if (supplierId && o.supplierId !== supplierId) return false;
    if (String(o.cropYear) !== cropYear) return false;
    var delivered = store.receipts
      .filter(function (r) { return r.orderId === o.id; })
      .reduce(function (sum, r) { return sum + (r.quantityReceived || 0); }, 0);
    return delivered < o.quantityOrdered;
  });

  var scannedItems = (scanData && scanData.items) || [];

  var itemMatches = scannedItems.map(function (scannedItem) {
    var matches = openOrders.map(function (o) {
      var product = store.products.find(function (p) { return p.id === o.productId; });
      var delivered = store.receipts
        .filter(function (r) { return r.orderId === o.id; })
        .reduce(function (sum, r) { return sum + (r.quantityReceived || 0); }, 0);
      var remaining = o.quantityOrdered - delivered;

      var score = 0;
      if (product && scannedItem && scannedItem.product) {
        var productStr = product.type === 'SEED'
          ? (product.brand + ' ' + product.variety).toLowerCase()
          : (product.brand + ' ' + product.productName).toLowerCase();
        var scanStr = (scannedItem.product || '').toLowerCase();
        if (productStr.indexOf(scanStr) !== -1 || scanStr.indexOf(productStr) !== -1) {
          score += 50;
        } else if (productStr.split(' ').some(function (w) { return w.length > 2 && scanStr.indexOf(w) !== -1; })) {
          score += 25;
        }
      }
      if (scannedItem && scannedItem.quantity != null) {
        if (Math.abs(scannedItem.quantity - remaining) < 1) {
          score += 30;
        } else if (scannedItem.quantity <= remaining) {
          score += 15;
        }
      }

      return {
        order: o,
        product: product || null,
        delivered: delivered,
        remaining: remaining,
        score: score,
        quantityMatch: scannedItem && scannedItem.quantity != null ? Math.abs(scannedItem.quantity - remaining) < 1 : null
      };
    });

    matches.sort(function (a, b) { return b.score - a.score; });
    return { scannedItem: scannedItem, matches: matches };
  });

  res.json({ itemMatches: itemMatches, scanData: scanData });
});

app.post('/api/verify/confirm', async function (req, res) {
  var shared = req.body.shared || req.body;
  var items = req.body.items;

  // Legacy single-item confirm (no items array)
  if (!items) {
    var receipt = {
      id: generateId('rct'),
      orderId: shared.orderId || '',
      productId: shared.productId || '',
      supplierId: shared.supplierId || '',
      dateReceived: shared.dateReceived || new Date().toISOString().split('T')[0],
      quantityReceived: parseFloat(shared.quantityReceived) || 0,
      unit: shared.unit || 'units',
      lotNumber: shared.lotNumber || '',
      ticketNumber: shared.ticketNumber || '',
      receivedBy: shared.receivedBy || '',
      verifiedBy: shared.verifiedBy || '',
      verificationMethod: shared.verificationMethod || 'SCAN',
      photoPath: shared.photoPath || '',
      scanData: shared.scanData || null,
      discrepancyFlag: shared.discrepancyFlag || false,
      discrepancyNotes: shared.discrepancyNotes || '',
      notes: shared.notes || '',
      pickupNumberId: shared.pickupNumberId || '',
      createdAt: new Date().toISOString()
    };
    store.receipts.push(receipt);
    if (receipt.orderId) syncPickupStatuses(receipt.orderId);
    await saveData();
    return res.status(201).json(receipt);
  }

  // Batch creation with deliveryGroupId
  var deliveryGroupId = generateId('dlv');
  var created = [];
  var affectedOrders = new Set();
  items.forEach(function (item) {
    var receipt = {
      id: generateId('rct'),
      deliveryGroupId: deliveryGroupId,
      orderId: item.orderId || '',
      productId: item.productId || '',
      supplierId: shared.supplierId || '',
      farmId: shared.farmId || '',
      farmName: shared.farmName || '',
      dateReceived: shared.dateReceived || new Date().toISOString().split('T')[0],
      quantityReceived: parseFloat(item.quantityReceived) || 0,
      unit: item.unit || 'units',
      lotNumber: item.lotNumber || '',
      ticketNumber: shared.ticketNumber || '',
      receivedBy: shared.receivedBy || '',
      verifiedBy: shared.verifiedBy || '',
      verificationMethod: shared.verificationMethod || 'SCAN',
      photoPath: shared.photoPath || '',
      scanData: shared.scanData || null,
      discrepancyFlag: item.discrepancyFlag || false,
      discrepancyNotes: item.discrepancyNotes || '',
      notes: shared.notes || '',
      pickupNumberId: item.pickupNumberId || '',
      createdAt: new Date().toISOString()
    };
    store.receipts.push(receipt);
    created.push(receipt);
    if (receipt.orderId) affectedOrders.add(receipt.orderId);
  });
  affectedOrders.forEach(function (oid) { syncPickupStatuses(oid); });
  await saveData();
  res.status(201).json({ deliveryGroupId: deliveryGroupId, receipts: created });
});

// ─── Settings ───────────────────────────────────────────────────────

app.get('/api/settings', function (req, res) {
  res.json(store.settings);
});

app.put('/api/settings', async function (req, res) {
  Object.assign(store.settings, req.body);
  await saveData();
  res.json(store.settings);
});

// ─── Farm Registry proxy (for delivery farm autocomplete) ───────────
var FARM_REGISTRY_URL = process.env.FARM_REGISTRY_URL || 'http://localhost:3005';

app.get('/api/farms/search', async function (req, res) {
  try {
    var q = req.query.q || '';
    var url = FARM_REGISTRY_URL + '/api/fields/search?q=' + encodeURIComponent(q);
    var response = await fetch(url);
    if (!response.ok) throw new Error('Farm registry returned ' + response.status);
    var fields = await response.json();
    res.json(fields);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/farms', async function (req, res) {
  try {
    var url = FARM_REGISTRY_URL + '/api/fields?active=true';
    var response = await fetch(url);
    if (!response.ok) throw new Error('Farm registry returned ' + response.status);
    var fields = await response.json();
    res.json(fields);
  } catch (err) {
    res.json([]);
  }
});

// ─── Organic-cert integration endpoints ─────────────────────────────

app.get('/api/organic/seed-lots', function (req, res) {
  var seedProducts = store.products.filter(function (p) { return p.type === 'SEED' && p.active !== false; });
  // Build supplier lookup: id -> name
  var supplierMap = {};
  store.suppliers.forEach(function (s) { supplierMap[s.id] = s.name; });
  var lots = [];
  seedProducts.forEach(function (p) {
    var productReceipts = store.receipts.filter(function (r) { return r.productId === p.id; });
    productReceipts.forEach(function (r) {
      lots.push({
        productId: p.id,
        crop: p.crop,
        variety: p.variety,
        brand: p.brand,
        productName: p.productName || '',
        supplier: p.supplier,
        supplierName: supplierMap[p.supplier] || p.supplier || '',
        organicCertNumber: p.organicCertNumber,
        omriListed: p.omriListed || false,
        organicGround: !!p.organicGround,
        lotNumber: r.lotNumber,
        quantity: r.quantityReceived,
        unit: r.unit,
        dateReceived: r.dateReceived
      });
    });
  });
  res.json(lots);
});

app.get('/api/organic/materials', function (req, res) {
  var inputs = store.products.filter(function (p) { return p.type === 'INPUT' && p.active !== false; });
  res.json(inputs.map(function (p) {
    return {
      productId: p.id,
      name: p.productName,
      brand: p.brand,
      category: p.inputCategory,
      omriListed: p.omriListed || false,
      organicCertNumber: p.organicCertNumber
    };
  }));
});

// ─── Start ──────────────────────────────────────────────────────────

loadData();
console.log('Loaded ' + store.products.length + ' products, ' +
  store.suppliers.length + ' suppliers, ' +
  store.orders.length + ' orders, ' +
  store.receipts.length + ' receipts');

app.listen(PORT, '0.0.0.0', function () {
  console.log('Seed Inventory server running at http://localhost:' + PORT);
  console.log('LAN access: http://<your-ip>:' + PORT);

  // Pull fresh forecasts from farm-budget on startup so data.json never serves stale numbers.
  // Delay 3s to allow farm-budget to finish its own startup if both restart together.
  setTimeout(async function () {
    try {
      var pullUrl = budgetUrl('/api/forecast');
      var response = await fetch(pullUrl);
      if (!response.ok) { console.warn('[startup-sync] Farm Budget returned', response.status); return; }
      var data = await response.json();
      var cropYear = store.settings.cropYear || 2026;
      var result = applyForecastSync(data, cropYear);
      var catResult = await syncAllProductsFromBudget();
      await saveData();
      console.log('[startup-sync] Forecasts synced — created:' + result.created + ' updated:' + result.updated + ' removed:' + result.removed);
      if (catResult.changed) console.log('[startup-sync] Product catalog updated — ' + catResult.products + ' products, ' + catResult.seeds + ' seeds checked');
    } catch (err) {
      console.warn('[startup-sync] Could not reach Farm Budget:', err.message);
    }
  }, 3000);
});
