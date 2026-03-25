#!/usr/bin/env node
'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var https = require('https');
var Calc = require('./public/calc.js');

var cors = require('cors');

var app = express();
var PORT = process.env.PORT || 3002;
var DATA_FILE = path.join(__dirname, 'data', 'data.json');
var MAX_BACKUPS = 5;

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', function (req, res) { res.json({ status: 'ok', app: 'fsa-acres', uptime: process.uptime() }); });

var corsOptions = {
  origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// perf: Cache-Control on GET API responses — allows browser to skip refetch for short TTL
app.use('/api', function (req, res, next) {
  if (req.method === 'GET') {
    // Rollup/reference data: 60s cache; live data: 10s
    var isRollup = req.path.indexOf('/rollup') === 0 || req.path.indexOf('/settings') === 0;
    res.set('Cache-Control', isRollup ? 'public, max-age=60' : 'public, max-age=10');
  }
  next();
});

// --- In-memory data store ---
var store = {
  settings: { year: 2026, county: 'Rock', state: 'WI', producerName: '' },
  cluRecords: [],
  farms: [],
  pricing: [],
  insurancePolicies: [],
  gcsEnrollments: [],
  tillageCodes: Calc.TILLAGE_CODES
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!store.tillageCodes) store.tillageCodes = Calc.TILLAGE_CODES;
  }
}

// Write lock
var writeQueue = Promise.resolve();
function withLock(fn) {
  var p = writeQueue.then(fn, fn);
  writeQueue = p.catch(function () {});
  return p;
}

// Async file helpers — avoid blocking event loop during writes
var fsp = fs.promises;

function saveData() {
  return withLock(async function () {
    // Rotate backups (async to avoid blocking event loop)
    for (var i = MAX_BACKUPS; i > 1; i--) {
      var from = DATA_FILE + '.bak.' + (i - 1);
      var to = DATA_FILE + '.bak.' + i;
      try { await fsp.rename(from, to); } catch (e) { /* backup slot empty */ }
    }
    try { await fsp.copyFile(DATA_FILE, DATA_FILE + '.bak.1'); } catch (e) { /* first save */ }
    var tmp = DATA_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(store, null, 2));
    await fsp.rename(tmp, DATA_FILE);
  });
}

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// --- Cross-app fetch with TTL cache + timeout (perf: avoid redundant calls & hangs) ---
var fetchCache = {};
var FETCH_CACHE_TTL = 60 * 1000; // 60s cache for cross-app data
var FETCH_TIMEOUT = 5000; // 5s timeout prevents hangs when peer apps are down

function cachedFetch(url, ttlMs) {
  var now = Date.now();
  var ttl = ttlMs || FETCH_CACHE_TTL;
  if (fetchCache[url] && (now - fetchCache[url].ts) < ttl) {
    return Promise.resolve(fetchCache[url].data);
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT);
  return fetch(url, { signal: ctrl.signal })
    .then(function (r) { clearTimeout(timer); return r.json(); })
    .then(function (data) {
      fetchCache[url] = { data: data, ts: now };
      return data;
    })
    .catch(function (err) {
      clearTimeout(timer);
      // Return stale cache if available, otherwise null
      if (fetchCache[url]) return fetchCache[url].data;
      return null;
    });
}

// ===== Settings =====
app.get('/api/settings', function (req, res) {
  res.json(store.settings);
});

app.put('/api/settings', function (req, res) {
  var allowed = ['year', 'county', 'state', 'producerName'];
  allowed.forEach(function (k) {
    if (req.body[k] !== undefined) store.settings[k] = req.body[k];
  });
  saveData().then(function () { res.json(store.settings); });
});

// ===== CLU Records =====
app.get('/api/clu-records', function (req, res) {
  var records = store.cluRecords;
  if (req.query.farmNumber) records = records.filter(function (r) { return r.farmNumber === req.query.farmNumber; });
  if (req.query.crop) records = records.filter(function (r) { return r.crop === req.query.crop; });
  if (req.query.fieldName) records = records.filter(function (r) { return r.fieldName === req.query.fieldName; });
  if (req.query.reported === 'true') records = records.filter(function (r) { return r.reported; });
  if (req.query.reported === 'false') records = records.filter(function (r) { return !r.reported; });
  res.json(records);
});

app.get('/api/clu-records/:id', function (req, res) {
  var rec = store.cluRecords.find(function (r) { return r.id === req.params.id; });
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

app.post('/api/clu-records', function (req, res) {
  // req.body may include registryFieldId (farm-registry canonical ID) — accepted via Object.assign
  var rec = Object.assign({ id: generateId('clu') }, req.body);
  store.cluRecords.push(rec);
  saveData().then(function () { res.status(201).json(rec); });
});

// Bulk update (mark reported) — must be before :id route
app.put('/api/clu-records/bulk', function (req, res) {
  var ids = req.body.ids || [];
  var updates = req.body.updates || {};
  var updated = 0;
  ids.forEach(function (id) {
    var rec = store.cluRecords.find(function (r) { return r.id === id; });
    if (rec) {
      Object.assign(rec, updates);
      updated++;
    }
  });
  saveData().then(function () { res.json({ ok: true, updated: updated }); });
});

app.put('/api/clu-records/:id', function (req, res) {
  var idx = store.cluRecords.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  // req.body may include registryFieldId (farm-registry canonical ID) — accepted via Object.assign
  Object.assign(store.cluRecords[idx], req.body);
  delete store.cluRecords[idx].id; // prevent id overwrite
  store.cluRecords[idx].id = req.params.id;
  saveData().then(function () { res.json(store.cluRecords[idx]); });
});

app.delete('/api/clu-records/:id', function (req, res) {
  var idx = store.cluRecords.findIndex(function (r) { return r.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.cluRecords.splice(idx, 1);
  saveData().then(function () { res.json({ ok: true }); });
});

// ===== Split CLU =====
app.post('/api/clu-records/:id/split', function (req, res) {
  var original = store.cluRecords.find(function (r) { return r.id === req.params.id; });
  if (!original) return res.status(404).json({ error: 'Not found' });

  var splitAcres = Number(req.body.splitAcres);
  if (!splitAcres || splitAcres <= 0 || splitAcres >= (original.fsaAcres || 0)) {
    return res.status(400).json({ error: 'Split acres must be between 0 and ' + original.fsaAcres });
  }

  // Find next CLU number for this tract
  var tractClus = store.cluRecords.filter(function (r) {
    return r.farmNumber === original.farmNumber && r.tractNumber === original.tractNumber;
  });
  var maxClu = 0;
  tractClus.forEach(function (r) {
    var n = parseInt(r.clu) || 0;
    if (n > maxClu) maxClu = n;
  });
  var newCluNum = String(maxClu + 1);

  // Reduce original acres
  var remainingAcres = Math.round(((original.fsaAcres || 0) - splitAcres) * 100) / 100;
  original.fsaAcres = remainingAcres;

  // Create new CLU record — copy all fields except id, acres, clu number, and crop
  var newRec = Object.assign({}, original, {
    id: generateId('clu'),
    clu: newCluNum,
    fsaAcres: splitAcres,
    crop: req.body.newCrop || '',
    reported: false
  });
  store.cluRecords.push(newRec);

  saveData().then(function () {
    res.json({ original: original, newRecord: newRec });
  });
});

// ===== Duplicate CLU =====
app.post('/api/clu-records/:id/duplicate', function (req, res) {
  var source = store.cluRecords.find(function (r) { return r.id === req.params.id; });
  if (!source) return res.status(404).json({ error: 'Not found' });

  // Find next CLU number for this tract
  var tractClus = store.cluRecords.filter(function (r) {
    return r.farmNumber === source.farmNumber && r.tractNumber === source.tractNumber;
  });
  var maxClu = 0;
  tractClus.forEach(function (r) {
    var n = parseInt(r.clu) || 0;
    if (n > maxClu) maxClu = n;
  });

  var newRec = Object.assign({}, source, {
    id: generateId('clu'),
    clu: String(maxClu + 1),
    reported: false
  });
  store.cluRecords.push(newRec);

  saveData().then(function () { res.json(newRec); });
});

// ===== Rollups =====
app.get('/api/rollup/by-farm', function (req, res) {
  res.json(Calc.rollupByFarm(store.cluRecords));
});

app.get('/api/rollup/by-crop', function (req, res) {
  res.json(Calc.rollupByCrop(store.cluRecords));
});

app.get('/api/rollup/by-field', function (req, res) {
  res.json(Calc.rollupByField(store.cluRecords, req.query.farmNumber || null));
});

app.get('/api/rollup/by-tract', function (req, res) {
  res.json(Calc.rollupByTract(store.cluRecords, req.query.farmNumber || null));
});

app.get('/api/rollup/tillage-summary', function (req, res) {
  var year = Number(req.query.year) || 2025;
  res.json(Calc.tillageSummary(store.cluRecords, year));
});

app.get('/api/rollup/cover-crop-summary', function (req, res) {
  var year = Number(req.query.year) || 2025;
  res.json(Calc.coverCropSummary(store.cluRecords, year));
});

app.get('/api/rollup/summary-metrics', function (req, res) {
  res.json(Calc.summaryMetrics(store.cluRecords));
});

// ===== Pricing =====
app.get('/api/pricing', function (req, res) {
  res.json(store.pricing);
});

app.put('/api/pricing/:id', function (req, res) {
  var idx = store.pricing.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  var allowed = ['crop', 'springPrice', 'fallPrice', 'manualOverride'];
  allowed.forEach(function (k) {
    if (req.body[k] !== undefined) store.pricing[idx][k] = req.body[k];
  });
  saveData().then(function () { res.json(store.pricing[idx]); });
});

app.post('/api/pricing', function (req, res) {
  var item = Object.assign({ id: generateId('pr') }, req.body);
  store.pricing.push(item);
  saveData().then(function () { res.status(201).json(item); });
});

app.delete('/api/pricing/:id', function (req, res) {
  var idx = store.pricing.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.pricing.splice(idx, 1);
  saveData().then(function () { res.json({ ok: true }); });
});

// Scrape prices from USDA RMA Price Discovery API
app.post('/api/pricing/scrape', function (req, res) {
  var today = new Date();
  var dateStr = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
  var url = 'https://public-rma.fpac.usda.gov/apps/PriceDiscovery/Services/RevenuePriceDataService.svc/RevenuePrices?discoveryPeriodDate=' + encodeURIComponent(dateStr);

  https.get(url, function (resp) {
    var body = '';
    resp.on('data', function (chunk) { body += chunk; });
    resp.on('end', function () {
      try {
        var data = JSON.parse(body);
        var items = data.d || data;
        if (!Array.isArray(items)) { return res.json({ ok: true, updated: 0, message: 'No price data returned from RMA' }); }

        var updated = 0;
        items.forEach(function (item) {
          var cropName = (item.CommodityName || '').trim();
          if (!cropName) return;

          var projected = parseFloat(item.ProjectedPrice) || 0;
          var harvest = parseFloat(item.HarvestPrice) || 0;

          // Find matching crop in our pricing (case-insensitive)
          var lc = cropName.toLowerCase();
          var match = store.pricing.find(function (p) {
            return p.crop.toLowerCase() === lc;
          });

          if (match && !match.manualOverride) {
            if (projected > 0) match.springPrice = projected;
            if (harvest > 0) match.fallPrice = harvest;
            match.lastScraped = new Date().toISOString();
            updated++;
          }
        });

        saveData().then(function () {
          res.json({ ok: true, updated: updated, total: items.length, message: updated + ' prices updated from USDA RMA' });
        });
      } catch (e) {
        res.json({ ok: false, error: 'Failed to parse RMA response', message: e.message });
      }
    });
  }).on('error', function (e) {
    res.json({ ok: false, error: 'Failed to reach RMA', message: e.message });
  });
});

// ===== Insurance =====
app.get('/api/insurance', function (req, res) {
  var enriched = store.insurancePolicies.map(function (p) {
    var computed = Calc.computeInsurancePolicy(p, store.cluRecords, store.pricing);
    return Object.assign({}, p, { _computed: computed });
  });
  res.json(enriched);
});

app.get('/api/insurance/:id', function (req, res) {
  var pol = store.insurancePolicies.find(function (p) { return p.id === req.params.id; });
  if (!pol) return res.status(404).json({ error: 'Not found' });
  var computed = Calc.computeInsurancePolicy(pol, store.cluRecords, store.pricing);
  res.json(Object.assign({}, pol, { _computed: computed }));
});

app.post('/api/insurance', function (req, res) {
  var item = Object.assign({ id: generateId('ins') }, req.body);
  store.insurancePolicies.push(item);
  saveData().then(function () { res.status(201).json(item); });
});

app.put('/api/insurance/:id', function (req, res) {
  var idx = store.insurancePolicies.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  var allowed = ['farmName', 'farmNumber', 'lineNumber', 'crop', 'plantedAcres', 'fsaAcresManual',
    'guarantee', 'actual', 'claimStatus', 'notes',
    'policyNumber', 'coverageLevel', 'unitType', 'premiumPerAcre',
    'agentName', 'policyYear', 'claimFiledDate', 'claimPaidDate', 'claimPaidAmount',
    'claimNumber', 'adjusterName', 'adjusterPhone', 'lossType',
    'preventedPlanting', 'preventedPlantingAcres'];
  allowed.forEach(function (k) {
    if (req.body[k] !== undefined) store.insurancePolicies[idx][k] = req.body[k];
  });
  saveData().then(function () {
    var computed = Calc.computeInsurancePolicy(store.insurancePolicies[idx], store.cluRecords, store.pricing);
    res.json(Object.assign({}, store.insurancePolicies[idx], { _computed: computed }));
  });
});

app.delete('/api/insurance/:id', function (req, res) {
  var idx = store.insurancePolicies.findIndex(function (p) { return p.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.insurancePolicies.splice(idx, 1);
  saveData().then(function () { res.json({ ok: true }); });
});

// ===== CLU APH Lookup =====
app.get('/api/clu-aph', function (req, res) {
  var crop = (req.query.crop || '').toLowerCase().trim();
  var farmNumber = (req.query.farmNumber || '').trim();
  if (!crop) return res.json({ avgAph: 0, count: 0, totalRecords: 0 });

  var matching = [];
  var total = 0;
  store.cluRecords.forEach(function (r) {
    if (!r.crop || r.crop.toLowerCase().trim() !== crop) return;
    if (farmNumber && r.farmNumber !== farmNumber) return;
    total++;
    if ((r.aph || 0) > 0) matching.push(r);
  });

  var sum = 0;
  matching.forEach(function (r) { sum += r.aph; });
  var avgAph = matching.length > 0 ? Math.round((sum / matching.length) * 100) / 100 : 0;

  res.json({ avgAph: avgAph, count: matching.length, totalRecords: total });
});

// ===== Reporting Progress =====
app.get('/api/rollup/reporting-progress', function (req, res) {
  res.json(Calc.reportingProgress(store.cluRecords));
});

// ===== Cropping Intentions Report =====
app.get('/api/cropping-intentions', async function (req, res) {
  var budgetFields = await cachedFetch('http://localhost:3001/api/fields') || [];
  var regFields = await cachedFetch('http://localhost:3005/api/fields?active=true') || [];
  var enterprises = await cachedFetch('http://localhost:3001/api/enterprises') || [];

  // Build enterprise lookup
  var entMap = {};
  enterprises.forEach(function (e) { entMap[e.id] = e; });

  // Build budget lookup by normalized name
  var budgetMap = {};
  budgetFields.forEach(function (f) {
    budgetMap[normName(f.name)] = f;
    if (f.registryFieldName) budgetMap[normName(f.registryFieldName)] = f;
  });

  // Build registry alias lookup for fuzzy matching
  var aliasMap = {};
  regFields.forEach(function (rf) {
    aliasMap[normName(rf.name)] = rf;
    (rf.aliases || []).forEach(function (a) { aliasMap[normName(a)] = rf; });
  });

  function findBudgetField(fieldName) {
    var norm = normName(fieldName);
    if (budgetMap[norm]) return budgetMap[norm];
    // Try via registry alias → registry name → budget
    var rf = aliasMap[norm];
    if (rf && budgetMap[normName(rf.name)]) return budgetMap[normName(rf.name)];
    // Fuzzy word match
    var best = null, bestScore = 0;
    budgetFields.forEach(function (bf) {
      var s = syncMatchScore(bf.name, [], fieldName);
      if (bf.registryFieldName) s = Math.max(s, syncMatchScore(bf.registryFieldName, [], fieldName));
      if (s > bestScore) { bestScore = s; best = bf; }
    });
    return bestScore >= 50 ? best : null;
  }

  var records = store.cluRecords;
  if (req.query.farmNumber) {
    records = records.filter(function (r) { return r.farmNumber === req.query.farmNumber; });
  }

  // Sort by farm → tract → unit → CLU
  records = records.slice().sort(function (a, b) {
    var cmp = (a.farmNumber || '').localeCompare(b.farmNumber || '');
    if (cmp !== 0) return cmp;
    cmp = (a.tractNumber || '').localeCompare(b.tractNumber || '');
    if (cmp !== 0) return cmp;
    cmp = (a.unitNumber || '').localeCompare(b.unitNumber || '');
    if (cmp !== 0) return cmp;
    return parseInt(a.clu || '0') - parseInt(b.clu || '0');
  });

  var rows = records.map(function (r) {
    var bf = findBudgetField(r.fieldName);
    var ent = bf && bf.enterpriseId ? entMap[bf.enterpriseId] : null;
    return {
      farmNumber: r.farmNumber || '',
      tractNumber: r.tractNumber || '',
      unitNumber: r.unitNumber || '',
      clu: r.clu || '',
      fieldName: r.fieldName || '',
      landClass: r.landClass || '',
      fsaCrop: r.crop || '',
      fsaAcres: r.fsaAcres || 0,
      organic: !!r.organic,
      budgetCrop: bf ? (bf.crop || '') : '',
      budgetAcres: bf ? (bf.acres || 0) : 0,
      enterprise: ent ? ent.name : '',
      enterpriseCategory: ent ? ent.category : '',
      systemCode: bf ? (bf.systemCode || '') : '',
      plantDate: r.grainPlantDate || '',
      use: r.use || '',
      matched: !!bf
    };
  });

  res.json({
    year: store.settings.year,
    county: store.settings.county,
    state: store.settings.state,
    producerName: store.settings.producerName,
    rows: rows
  });
});

app.get('/api/export/intentions', async function (req, res) {
  // Reuse the same logic via internal fetch
  var url = 'http://localhost:' + PORT + '/api/cropping-intentions' +
    (req.query.farmNumber ? '?farmNumber=' + encodeURIComponent(req.query.farmNumber) : '');
  var data;
  try {
    var r = await fetch(url);
    data = await r.json();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to generate intentions data' });
  }

  var headers = ['Farm#', 'Tract', 'Unit', 'CLU', 'Field', 'Land Class',
    'FSA Crop', 'FSA Acres', 'Organic', 'Budget Crop', 'Budget Acres',
    'Enterprise', 'System Code', 'Plant Date', 'Use', 'Matched'];
  var rows = data.rows.map(function (r) {
    return [r.farmNumber, r.tractNumber, r.unitNumber, r.clu, r.fieldName, r.landClass,
      r.fsaCrop, r.fsaAcres, r.organic ? 'Yes' : 'No', r.budgetCrop, r.budgetAcres,
      r.enterprise, r.systemCode, r.plantDate, r.use, r.matched ? 'Yes' : 'No'];
  });
  var csv = [headers.join(',')].concat(rows.map(function (row) {
    return row.map(function (v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  })).join('\n');
  var fn = 'cropping-intentions' + (req.query.farmNumber ? '-farm' + req.query.farmNumber : '') + '.csv';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fn + '"');
  res.send(csv);
});

// ===== Validation =====
app.get('/api/validation', function (req, res) {
  res.json(Calc.validateRecords(store.cluRecords, store.pricing, store.insurancePolicies));
});

// ===== CSV Export =====
app.get('/api/export/fsa', function (req, res) {
  var records = store.cluRecords;
  if (req.query.farmNumber) {
    records = records.filter(function (r) { return r.farmNumber === req.query.farmNumber; });
  }
  var headers = ['Farm#', 'Tract', 'CLU', 'Field', 'Land Class', 'Crop', 'FSA Acres', 'Irrigated', 'Organic',
    'Plant Date', 'Use', 'Reported', 'Tillage 2025', 'Cover Crop 2025', 'Unit#', 'APH'];
  var rows = records.map(function (r) {
    return [r.farmNumber, r.tractNumber, r.clu, r.fieldName, r.landClass || '', r.crop, r.fsaAcres,
      r.irrigated ? 'Yes' : 'No', r.organic ? 'Yes' : 'No',
      r.grainPlantDate || '', r.use || '', r.reported ? 'Yes' : 'No',
      r.tillage2025 || '', r.cc2025 || '', r.unitNumber || '', r.aph || ''];
  });
  var csv = [headers.join(',')].concat(rows.map(function (row) {
    return row.map(function (v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  })).join('\n');
  var fn = 'fsa-acreage' + (req.query.farmNumber ? '-farm' + req.query.farmNumber : '') + '.csv';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="' + fn + '"');
  res.send(csv);
});

app.get('/api/export/insurance', function (req, res) {
  var headers = ['Policy#', 'Line', 'Farm#', 'Farm Name', 'Crop', 'Planted Acres', 'Coverage%',
    'Unit Type', 'APH Guarantee', 'Actual Yield', 'Shortfall', 'Spring Price', 'Fall Price',
    'Highest Price', '$ Guarantee', 'Indemnity', 'Premium/Ac', 'Total Premium', 'Status', 'Notes'];
  var rows = store.insurancePolicies.map(function (p) {
    var c = Calc.computeInsurancePolicy(p, store.cluRecords, store.pricing);
    return [p.policyNumber || '', p.lineNumber || '', p.farmNumber || '', p.farmName || '',
      p.crop || '', p.plantedAcres || 0, p.coverageLevel || '', p.unitType || '',
      p.guarantee || 0, p.actual || 0, c.shortfall || 0,
      c.springPrice || 0, c.fallPrice || 0, c.highestPrice || 0,
      c.dollarGuarantee || 0, c.indemnity || 0,
      p.premiumPerAcre || 0, (p.premiumPerAcre || 0) * (p.plantedAcres || 0),
      c.claimStatus || 'none', p.notes || ''];
  });
  var csv = [headers.join(',')].concat(rows.map(function (row) {
    return row.map(function (v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  })).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="insurance-summary.csv"');
  res.send(csv);
});

// ===== GCS Enrollments =====
app.get('/api/gcs', function (req, res) {
  var records = store.gcsEnrollments;
  if (req.query.practiceCode) {
    var pc = req.query.practiceCode;
    records = records.filter(function (e) {
      if (pc === '340') return e.cc340Acres > 0;
      if (pc === '345') return e.rt345Acres > 0;
      if (pc === '329') return e.nt329Acres > 0;
      return true;
    });
  }
  res.json(records);
});

app.get('/api/gcs/summary', function (req, res) {
  res.json(Calc.gcsSummary(store.gcsEnrollments));
});

app.post('/api/gcs', function (req, res) {
  var item = Object.assign({ id: generateId('gcs') }, req.body);
  store.gcsEnrollments.push(item);
  saveData().then(function () { res.status(201).json(item); });
});

app.put('/api/gcs/:id', function (req, res) {
  var idx = store.gcsEnrollments.findIndex(function (e) { return e.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(store.gcsEnrollments[idx], req.body);
  store.gcsEnrollments[idx].id = req.params.id;
  saveData().then(function () { res.json(store.gcsEnrollments[idx]); });
});

app.delete('/api/gcs/:id', function (req, res) {
  var idx = store.gcsEnrollments.findIndex(function (e) { return e.id === req.params.id; });
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.gcsEnrollments.splice(idx, 1);
  saveData().then(function () { res.json({ ok: true }); });
});

// ===== Convenience endpoints =====
app.get('/api/farm-numbers', function (req, res) {
  var nums = store.farms.map(function (f) { return { farmNumber: f.farmNumber, farmName: f.farmName }; });
  res.json(nums.sort(function (a, b) { return a.farmNumber.localeCompare(b.farmNumber); }));
});

app.get('/api/field-names', function (req, res) {
  var names = {};
  store.cluRecords.forEach(function (r) { if (r.fieldName) names[r.fieldName] = 1; });
  res.json(Object.keys(names).sort());
});

app.get('/api/crop-names', function (req, res) {
  var names = {};
  store.cluRecords.forEach(function (r) { if (r.crop) names[r.crop] = 1; });
  res.json(Object.keys(names).sort());
});

app.get('/api/tillage-codes', function (req, res) {
  res.json(store.tillageCodes || Calc.TILLAGE_CODES);
});

// --- Registry proxy (field names for autocomplete — legacy, returns names only) ---
app.get('/api/registry/field-names', async function (req, res) {
  try {
    var resp = await fetch('http://localhost:3005/api/fields');
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    var fields = await resp.json();
    var names = fields
      .filter(function (f) { return f.active; })
      .map(function (f) { return f.name; })
      .sort();
    res.json(names);
  } catch (err) {
    res.status(502).json({ error: 'Farm registry unavailable' });
  }
});

// --- Registry proxy: crop list for CLU crop selection dropdown ---
// Cached 60s in-memory to avoid hammering farm-registry on every page load
var _fsaRegistryCropsCache = null;
var _fsaRegistryCropsCacheExpiry = 0;
app.get('/api/registry/crops', async function (req, res) {
  try {
    var now = Date.now();
    if (!_fsaRegistryCropsCache || now > _fsaRegistryCropsCacheExpiry) {
      var resp = await fetch('http://localhost:3005/api/crops');
      if (!resp.ok) throw new Error('Registry returned ' + resp.status);
      _fsaRegistryCropsCache = await resp.json();
      _fsaRegistryCropsCacheExpiry = now + 60 * 1000; // 60s cache
    }
    res.json(_fsaRegistryCropsCache);
  } catch (err) {
    res.status(502).json({ error: 'Registry crops unavailable: ' + err.message });
  }
});

// --- Registry proxy (full field objects for dropdown — includes id, name, aliases) ---
app.get('/api/registry/fields-autocomplete', async function (req, res) {
  try {
    var q = req.query.q || '';
    var url = 'http://localhost:3005/api/fields/autocomplete' + (q ? '?q=' + encodeURIComponent(q) : '');
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    var data = await resp.json();
    // data.fields is an array of { id, name, aliases, reportingAcres, organicAcres, ownership }
    res.json(data.fields || []);
  } catch (err) {
    res.status(502).json({ error: 'Farm registry unavailable' });
  }
});

// --- Farm budget proxy (read-only, bridge to port 3001) ---
app.get('/api/budget/fields', async function (req, res) {
  try {
    var resp = await fetch('http://localhost:3001/api/fields');
    if (!resp.ok) throw new Error('Farm budget returned ' + resp.status);
    res.json(await resp.json());
  } catch (err) {
    res.status(502).json({ error: 'Farm budget unavailable' });
  }
});

// --- Grain ticket yield proxy (bridge to port 3000) ---
app.get('/api/grain-yield', async function (req, res) {
  try {
    var farmsResp = await fetch('http://localhost:3007/api/farms');
    if (!farmsResp.ok) throw new Error('Grain tickets returned ' + farmsResp.status);
    var ticketsResp = await fetch('http://localhost:3007/api/tickets');
    var farms = await farmsResp.json();
    var tickets = ticketsResp.ok ? await ticketsResp.json() : [];

    // Count tickets per farm (lowercase match)
    var counts = {};
    tickets.forEach(function (t) {
      var key = (t.farm || '').trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    var result = farms.map(function (f) {
      var key = (f.farm || '').trim().toLowerCase();
      return {
        farm: f.farm,
        crop: f.crop,
        acres: f.acres,
        totalBU: f.totalBU,
        yieldPerAcre: f.yieldPerAcre,
        ticketCount: counts[key] || 0
      };
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Grain ticket service unavailable' });
  }
});

// ===== Sync Crops from Macro Roll Up =====

function normName(s) {
  return (s || '').trim().toLowerCase()
    .replace(/[''.,]/g, '')
    .replace(/\s+/g, ' ');
}

function syncMatchScore(canonical, aliases, candidate) {
  var normCan = normName(canonical);
  var normCand = normName(candidate);
  if (normCan === normCand) return 100;
  for (var i = 0; i < (aliases || []).length; i++) {
    if (normName(aliases[i]) === normCand) return 95;
  }
  if (normCan.length > 2 && normCand.length > 2) {
    if (normCan.indexOf(normCand) !== -1 || normCand.indexOf(normCan) !== -1) return 70;
  }
  var canWords = normCan.split(' ').filter(function (w) { return w.length > 2; });
  var candWords = normCand.split(' ').filter(function (w) { return w.length > 2; });
  var overlap = canWords.filter(function (w) { return candWords.indexOf(w) !== -1; });
  if (overlap.length > 0 && canWords.length > 0) return 30 + Math.round((overlap.length / canWords.length) * 40);
  return 0;
}

function syncBestMatch(canonical, aliases, candidates, nameKey) {
  var best = null;
  var bestScore = 0;
  candidates.forEach(function (c) {
    var s = syncMatchScore(canonical, aliases, c[nameKey] || '');
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return bestScore >= 30 ? { item: best, score: bestScore } : null;
}

// ===== Enterprise-level crop comparison: Budget acres vs FSA acres by crop =====
app.get('/api/sync-crops/enterprise-preview', async function (req, res) {
  try {
    var dash = await cachedFetch('http://localhost:3001/api/dashboard');
    if (!dash) {
      return res.status(502).json({ error: 'Farm budget unavailable — is port 3001 running?' });
    }

    // Build budget-side crop totals from enterpriseSummaries[].cropRows[]
    var budgetMap = {};
    var enterpriseSummaries = dash.enterpriseSummaries || [];
    enterpriseSummaries.forEach(function (es) {
      var cropRows = es.cropRows || [];
      cropRows.forEach(function (cr) {
        var key = normName(cr.crop);
        if (!budgetMap[key]) {
          budgetMap[key] = { displayName: cr.crop, budgetAcres: 0, enterprises: [] };
        }
        budgetMap[key].budgetAcres += (cr.acres || 0);
        budgetMap[key].enterprises.push({
          name: es.enterprise ? es.enterprise.name : '',
          category: es.enterprise ? es.enterprise.category : '',
          acres: cr.acres || 0
        });
      });
    });

    // Non-crop land class values to exclude from FSA side
    var NON_CROP_CLASSES = ['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'];
    // Non-crop crop names to exclude (lowercased, trimmed)
    var NON_CROP_NAMES = ['', 'nc', 'gls', 'crp', 'idle', 'mixed forage / hay', 'alfalfa', 'grass', 'intermediate wheatgrass'];

    // Build FSA-side filtered crop totals from store.cluRecords
    var fsaMap = {};
    store.cluRecords.forEach(function (r) {
      // Filter: exclude reported CLUs
      if (r.reported === true) return;
      // Filter: exclude non-crop land classes
      if (NON_CROP_CLASSES.indexOf(r.landClass) !== -1) return;
      // Filter: exclude forage use
      if (r.use === 'forage') return;
      // Filter: exclude non-crop crop names
      var cropLower = (r.crop || '').toLowerCase().trim();
      if (NON_CROP_NAMES.indexOf(cropLower) !== -1) return;

      var key = normName(r.crop);
      if (!fsaMap[key]) {
        fsaMap[key] = { displayName: r.crop, fsaAcres: 0, cluCount: 0 };
      }
      fsaMap[key].fsaAcres += (r.fsaAcres || 0);
      fsaMap[key].cluCount++;
    });

    // Collect all unique normalized keys from both sides
    var allKeys = {};
    Object.keys(budgetMap).forEach(function (k) { allKeys[k] = true; });
    Object.keys(fsaMap).forEach(function (k) { allKeys[k] = true; });

    // Merge into comparison rows
    var rows = Object.keys(allKeys).map(function (key) {
      var bSide = budgetMap[key] || { displayName: fsaMap[key] ? fsaMap[key].displayName : key, budgetAcres: 0, enterprises: [] };
      var fSide = fsaMap[key] || { displayName: budgetMap[key] ? budgetMap[key].displayName : key, fsaAcres: 0, cluCount: 0 };
      var displayName = bSide.displayName || fSide.displayName || key;
      var budgetAcres = Math.round((bSide.budgetAcres || 0) * 100) / 100;
      var fsaAcres = Math.round((fSide.fsaAcres || 0) * 100) / 100;
      var diff = Math.round((fsaAcres - budgetAcres) * 100) / 100;
      return {
        crop: displayName,
        budgetAcres: budgetAcres,
        fsaAcres: fsaAcres,
        diff: diff,
        cluCount: fSide.cluCount || 0,
        enterprises: bSide.enterprises || []
      };
    });

    // Sort by budgetAcres descending
    rows.sort(function (a, b) { return b.budgetAcres - a.budgetAcres; });

    // Grand totals
    var budgetGrandTotal = (dash.grandTotals && dash.grandTotals.acres != null)
      ? Math.round(dash.grandTotals.acres * 100) / 100
      : Math.round(rows.reduce(function (s, r) { return s + r.budgetAcres; }, 0) * 100) / 100;
    var fsaGrandTotal = Math.round(rows.reduce(function (s, r) { return s + r.fsaAcres; }, 0) * 100) / 100;

    res.json({ rows: rows, budgetGrandTotal: budgetGrandTotal, fsaGrandTotal: fsaGrandTotal });
  } catch (err) {
    res.status(502).json({ error: 'Farm budget unavailable — is port 3001 running?' });
  }
});

app.get('/api/sync-crops/preview', async function (req, res) {
  try {
    var budgetResp = await fetch('http://localhost:3001/api/fields');
    if (!budgetResp.ok) throw new Error('Budget returned ' + budgetResp.status);
    var budgetFields = await budgetResp.json();

    var regResp = await fetch('http://localhost:3005/api/fields?active=true');
    var regFields = regResp.ok ? await regResp.json() : [];

    // Build CLU field groups: group CLU records by normalized fieldName
    var cluByField = {};
    store.cluRecords.forEach(function (r) {
      var fn = (r.fieldName || '').trim();
      if (!fn) return;
      var key = normName(fn);
      if (!cluByField[key]) cluByField[key] = { name: fn, records: [] };
      cluByField[key].records.push(r);
    });
    var cluFields = Object.keys(cluByField).map(function (k) { return cluByField[k]; });

    var proposals = [];

    // Strategy: anchor on registry fields, match to budget + CLU
    regFields.forEach(function (rf) {
      var aliases = rf.aliases || [];

      // Find matching budget field
      var bm = syncBestMatch(rf.name, aliases, budgetFields, 'name');
      if (!bm || !bm.item.crop) return; // no budget match or no crop assigned

      // Find matching CLU field group
      var cm = syncBestMatch(rf.name, aliases, cluFields, 'name');
      if (!cm) return; // no CLU match

      var budgetCrop = bm.item.crop;
      var combinedScore = Math.min(bm.score, cm.score); // weakest link

      // For each CLU record in this field group
      cm.item.records.forEach(function (clu) {
        // Only sync Tillable CLUs
        if (clu.landClass !== 'Tillable') return;
        // Skip if crop already matches
        if (normName(clu.crop) === normName(budgetCrop)) return;

        proposals.push({
          cluId: clu.id,
          fieldName: clu.fieldName,
          farmNumber: clu.farmNumber,
          tractNumber: clu.tractNumber,
          clu: clu.clu,
          currentCrop: clu.crop || '',
          proposedCrop: budgetCrop,
          budgetFieldName: bm.item.name,
          matchScore: combinedScore,
          fsaAcres: clu.fsaAcres || 0
        });
      });
    });

    // Also check budget fields not in registry (direct CLU name match)
    var matchedBudget = {};
    regFields.forEach(function (rf) {
      var bm = syncBestMatch(rf.name, rf.aliases || [], budgetFields, 'name');
      if (bm) matchedBudget[normName(bm.item.name)] = true;
    });
    budgetFields.forEach(function (bf) {
      if (matchedBudget[normName(bf.name)] || !bf.crop) return;
      // Try direct match against CLU field names
      var cm = syncBestMatch(bf.name, [], cluFields, 'name');
      if (!cm) return;
      cm.item.records.forEach(function (clu) {
        if (clu.landClass !== 'Tillable') return;
        if (normName(clu.crop) === normName(bf.crop)) return;
        // Avoid duplicates
        if (proposals.some(function (p) { return p.cluId === clu.id; })) return;
        proposals.push({
          cluId: clu.id,
          fieldName: clu.fieldName,
          farmNumber: clu.farmNumber,
          tractNumber: clu.tractNumber,
          clu: clu.clu,
          currentCrop: clu.crop || '',
          proposedCrop: bf.crop,
          budgetFieldName: bf.name,
          matchScore: cm.score,
          fsaAcres: clu.fsaAcres || 0
        });
      });
    });

    // Sort by match score descending, then field name
    proposals.sort(function (a, b) {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.fieldName.localeCompare(b.fieldName);
    });

    res.json({ proposals: proposals });
  } catch (err) {
    res.status(502).json({ error: 'Farm Budget unavailable — is port 3001 running?' });
  }
});

app.post('/api/sync-crops/apply', function (req, res) {
  var updates = req.body.updates;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });

  var count = 0;
  updates.forEach(function (u) {
    var rec = store.cluRecords.find(function (r) { return r.id === u.cluId; });
    if (rec && u.crop) {
      rec.crop = u.crop;
      count++;
    }
  });

  saveData().then(function () {
    res.json({ updated: count });
  });
});

// ===== Season Dashboard — cross-app aggregation =====

function buildSeasonalStatus(store, budgetFields, budgetDash, seedDash, seedRecon, regFields, gtFarms) {
  var year = store.settings.year || 2026;

  // -- Early Season --
  var early = { flags: [] };
  if (budgetFields) {
    early.budgetFieldCount = budgetFields.length;
    early.budgetTotalAcres = 0;
    budgetFields.forEach(function (f) { early.budgetTotalAcres += (parseFloat(f.acres) || 0); });
    early.budgetTotalAcres = Math.round(early.budgetTotalAcres * 10) / 10;
  } else {
    early.budgetFieldCount = null;
    early.budgetTotalAcres = null;
    early.flags.push({ type: 'info', msg: 'Farm budget app not running (port 3001)' });
  }
  if (seedDash) {
    early.seedProductCount = seedDash.totalProducts || 0;
    early.seedOrderCount = seedDash.totalOrders || 0;
    early.seedReceiptCount = seedDash.totalReceipts || 0;
    early.seedDeliveryPct = seedDash.deliveryPercent || 0;
    if (early.seedOrderCount === 0 && early.seedProductCount > 0) {
      early.flags.push({ type: 'warn', msg: early.seedProductCount + ' products cataloged but no orders placed yet' });
    }
  } else {
    early.seedProductCount = null;
    early.flags.push({ type: 'info', msg: 'Seed inventory app not running (port 3006)' });
  }
  if (seedRecon) {
    early.forecastCount = seedRecon.length || 0;
    if (early.forecastCount === 0) {
      early.flags.push({ type: 'warn', msg: 'No seed forecasts created yet' });
    }
  } else {
    early.forecastCount = null;
  }

  // -- Planting --
  var planting = { flags: [] };
  if (budgetFields) {
    planting.totalBudgetFields = budgetFields.length;
    planting.fieldsWithCrop = budgetFields.filter(function (f) { return f.crop; }).length;
    planting.totalBudgetAcres = early.budgetTotalAcres;
  } else {
    planting.totalBudgetFields = null;
  }
  var cluWithPlant = store.cluRecords.filter(function (r) {
    var d = r.grainPlantDate || '';
    return d && d !== '' && d !== 'TBD' && d !== '0';
  });
  planting.cluWithPlantDate = cluWithPlant.length;
  planting.cluTotal = store.cluRecords.length;
  if (budgetFields && planting.fieldsWithCrop < budgetFields.length) {
    planting.flags.push({ type: 'warn', msg: (budgetFields.length - planting.fieldsWithCrop) + ' budget fields have no crop assigned' });
  }

  // -- Mid-Season --
  var mid = { flags: [] };
  var reported = store.cluRecords.filter(function (r) { return r.reported; });
  mid.cluReported = reported.length;
  mid.cluTotal = store.cluRecords.length;
  mid.reportingPct = mid.cluTotal > 0 ? Math.round((mid.cluReported / mid.cluTotal) * 100) : 0;
  mid.insurancePolicyCount = store.insurancePolicies.length;
  var policiesWithActual = store.insurancePolicies.filter(function (p) { return p.actual && p.actual > 0; });
  mid.policiesMissingActual = store.insurancePolicies.length - policiesWithActual.length;
  var insCrops = {};
  store.insurancePolicies.forEach(function (p) { if (p.crop) insCrops[normName(p.crop)] = true; });
  mid.cropsInsured = Object.keys(insCrops).length;
  if (mid.cluReported < mid.cluTotal) {
    var unreported = mid.cluTotal - mid.cluReported;
    mid.flags.push({ type: 'warn', msg: unreported + ' CLU records unreported' });
  }
  if (mid.insurancePolicyCount === 0) {
    mid.flags.push({ type: 'warn', msg: 'No insurance policies created yet' });
  }

  // -- Harvest --
  var harvest = { flags: [] };
  if (gtFarms) {
    harvest.grainFarmCount = gtFarms.length;
    harvest.grainTicketCount = 0;
    var cropTotals = {};
    gtFarms.forEach(function (f) {
      harvest.grainTicketCount += (f.ticketCount || 0);
      var cn = (f.crop || '').trim();
      if (cn && f.totalBU > 0) {
        if (!cropTotals[cn]) cropTotals[cn] = 0;
        cropTotals[cn] += f.totalBU;
      }
    });
    harvest.cropSummary = Object.keys(cropTotals)
      .map(function (c) { return { crop: c, totalBU: Math.round(cropTotals[c]) }; })
      .sort(function (a, b) { return b.totalBU - a.totalBU; })
      .slice(0, 8);

    // Insurance yield sync status
    var synced = 0;
    var pending = 0;
    store.insurancePolicies.forEach(function (p) {
      if (!p.crop) return;
      var hasYield = p.actual && p.actual > 0;
      if (hasYield) synced++;
      else pending++;
    });
    harvest.insuranceSynced = synced;
    harvest.insurancePending = pending;
    if (pending > 0) {
      harvest.flags.push({ type: 'warn', msg: pending + ' policies missing actual yield' });
    }
  } else {
    harvest.grainFarmCount = null;
    harvest.flags.push({ type: 'info', msg: 'Grain tickets app not running (port 3000)' });
  }

  // -- Post-Harvest --
  var post = { flags: [] };
  post.claimsPotential = 0;
  post.claimsFiled = 0;
  post.claimsPaid = 0;
  post.claimsDenied = 0;
  store.insurancePolicies.forEach(function (p) {
    var s = p.claimStatus || 'none';
    if (s === 'potential') post.claimsPotential++;
    else if (s === 'filed') post.claimsFiled++;
    else if (s === 'paid') post.claimsPaid++;
    else if (s === 'denied') post.claimsDenied++;
  });

  // -- Connectivity --
  var connectivity = {
    farmBudget: !!budgetFields,
    seedInventory: !!seedDash,
    farmRegistry: !!regFields,
    grainTickets: !!gtFarms,
    fsaAcres: true
  };

  // -- Registry field count --
  var registryFieldCount = regFields ? regFields.length : null;

  return {
    cropYear: year,
    connectivity: connectivity,
    registryFieldCount: registryFieldCount,
    earlySeason: early,
    planting: planting,
    midSeason: mid,
    harvest: harvest,
    postHarvest: post
  };
}

app.get('/api/season/status', async function (req, res) {
  // perf: use cachedFetch with TTL + timeout; deduplicate grain-tickets calls (was 8 fetches, now 6)
  var results = await Promise.all([
    cachedFetch('http://localhost:3001/api/fields'),
    cachedFetch('http://localhost:3001/api/dashboard'),
    cachedFetch('http://localhost:3006/api/dashboard'),
    cachedFetch('http://localhost:3006/api/reconciliation'),
    cachedFetch('http://localhost:3005/api/fields?active=true'),
    cachedFetch('http://localhost:3007/api/farms'),
    cachedFetch('http://localhost:3007/api/stats')
  ]);

  var budgetFields = results[0];
  var budgetDash   = results[1];
  var seedDash     = results[2];
  var seedRecon    = results[3];
  var regFields    = results[4];
  var gtFarms      = results[5];
  var gtStats      = results[6];
  // perf: removed separate /api/tickets fetch — ticket count now from /api/stats
  var gtTickets    = null;

  // Enrich farm data with ticket counts (same as grain-yield proxy)
  if (gtFarms && gtTickets) {
    var counts = {};
    gtTickets.forEach(function (t) {
      var key = (t.farm || '').trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    gtFarms.forEach(function (f) {
      var key = (f.farm || '').trim().toLowerCase();
      f.ticketCount = counts[key] || 0;
    });
  }

  var season = buildSeasonalStatus(store, budgetFields, budgetDash, seedDash, seedRecon, regFields, gtFarms);
  // perf: get ticket count from stats (avoids separate /api/tickets fetch)
  if (gtStats) {
    season.harvest.grainTicketCount = gtStats.totalTickets || 0;
    season.harvest.avgMoisture = gtStats.avgMoisture;
    season.harvest.dailyIntake = gtStats.dailyIntake;
    season.harvest.cropDetails = gtStats.cropSummary;
  }
  res.json(season);
});

app.get('/api/season/field-crosswalk', async function (req, res) {
  // perf: use cachedFetch with TTL + timeout (reuses cache from /api/season/status)
  var results = await Promise.all([
    cachedFetch('http://localhost:3005/api/fields?active=true'),
    cachedFetch('http://localhost:3001/api/fields'),
    cachedFetch('http://localhost:3007/api/farms')
  ]);

  var regFields    = results[0] || [];
  var budgetFields = results[1] || [];
  var gtFarms      = results[2] || [];

  // Extract unique CLU field names
  var cluFieldMap = {};
  store.cluRecords.forEach(function (r) {
    var fn = (r.fieldName || '').trim();
    if (!fn) return;
    var key = normName(fn);
    if (!cluFieldMap[key]) cluFieldMap[key] = { name: fn, acres: 0, count: 0 };
    cluFieldMap[key].acres += (parseFloat(r.fsaAcres) || 0);
    cluFieldMap[key].count++;
  });
  var cluFields = Object.keys(cluFieldMap).map(function (k) { return cluFieldMap[k]; });

  // Fuzzy match helper
  function matchScore(canonical, aliases, candidate) {
    var normCan = normName(canonical);
    var normCand = normName(candidate);
    if (normCan === normCand) return 100;
    for (var i = 0; i < (aliases || []).length; i++) {
      if (normName(aliases[i]) === normCand) return 95;
    }
    if (normCan.length > 2 && normCand.length > 2) {
      if (normCan.indexOf(normCand) !== -1 || normCand.indexOf(normCan) !== -1) return 70;
    }
    var canWords = normCan.split(' ').filter(function (w) { return w.length > 2; });
    var candWords = normCand.split(' ').filter(function (w) { return w.length > 2; });
    var overlap = canWords.filter(function (w) { return candWords.indexOf(w) !== -1; });
    if (overlap.length > 0 && canWords.length > 0) return 30 + Math.round((overlap.length / canWords.length) * 40);
    return 0;
  }

  function bestMatch(canonical, aliases, candidates, nameKey) {
    var best = null;
    var bestScore = 0;
    candidates.forEach(function (c) {
      var s = matchScore(canonical, aliases, c[nameKey] || '');
      if (s > bestScore) { bestScore = s; best = c; }
    });
    return bestScore >= 30 ? { item: best, score: bestScore } : null;
  }

  // Build crosswalk anchored on registry fields
  var crosswalk = [];
  var matchedBudget = {};
  var matchedClu = {};
  var matchedGt = {};

  regFields.forEach(function (rf) {
    var aliases = rf.aliases || [];
    var row = {
      canonical: rf.name,
      registryId: rf.id,
      registryAcres: rf.reportingAcres || 0,
      budget: null,
      fsa: null,
      grainTicket: null,
      issues: []
    };

    var bm = bestMatch(rf.name, aliases, budgetFields, 'name');
    if (bm) {
      row.budget = { name: bm.item.name, crop: bm.item.crop, acres: bm.item.acres, score: bm.score };
      matchedBudget[normName(bm.item.name)] = true;
    }

    var cm = bestMatch(rf.name, aliases, cluFields, 'name');
    if (cm) {
      row.fsa = { name: cm.item.name, acres: Math.round(cm.item.acres * 100) / 100, records: cm.item.count, score: cm.score };
      matchedClu[normName(cm.item.name)] = true;
    }

    var gm = bestMatch(rf.name, aliases, gtFarms, 'farm');
    if (gm) {
      row.grainTicket = { name: gm.item.farm, crop: gm.item.crop, acres: gm.item.acres, score: gm.score };
      matchedGt[normName(gm.item.farm)] = true;
    }

    // Flag issues
    if (!row.budget) row.issues.push('No budget field match');
    if (!row.fsa) row.issues.push('No FSA CLU match');
    if (!row.grainTicket) row.issues.push('No grain ticket match');

    crosswalk.push(row);
  });

  // Add unmatched entries from other sources
  var unmatchedBudget = budgetFields.filter(function (f) { return !matchedBudget[normName(f.name)]; });
  var unmatchedGt = gtFarms.filter(function (f) { return !matchedGt[normName(f.farm)]; });

  var summary = {
    registryFields: regFields.length,
    unmatchedBudget: unmatchedBudget.length,
    unmatchedGrainTicket: unmatchedGt.length
  };

  res.json({ crosswalk: crosswalk, unmatched: { budget: unmatchedBudget.slice(0, 20), grainTicket: unmatchedGt.slice(0, 20) }, summary: summary });
});

// ===== Start =====
loadData();
console.log('Loaded: ' + store.cluRecords.length + ' CLU records, ' +
  store.farms.length + ' farms, ' +
  store.pricing.length + ' pricing entries, ' +
  store.insurancePolicies.length + ' insurance policies, ' +
  store.gcsEnrollments.length + ' GCS enrollments');

app.listen(PORT, '0.0.0.0', function () {
  console.log('FSA Acres server running at http://localhost:' + PORT);
});
