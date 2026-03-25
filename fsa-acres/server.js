#!/usr/bin/env node
'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var https = require('https');
var Calc = require('./public/calc.js');
var cors = require('cors');
var { createClient } = require('@supabase/supabase-js');

var app = express();
var PORT = process.env.PORT || 3002;
var SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

// ── Supabase client ───────────────────────────────────────────────────────────
var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables.');
  console.error('  SUPABASE_URL:', SUPABASE_URL ? 'set' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');
  console.error('');
  console.error('Create fsa-acres/.env with:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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
    var isRollup = req.path.indexOf('/rollup') === 0 || req.path.indexOf('/settings') === 0;
    res.set('Cache-Control', isRollup ? 'public, max-age=60' : 'public, max-age=10');
  }
  next();
});

// ── Tillage codes (static reference data) ────────────────────────────────────
var TILLAGE_CODES = Calc.TILLAGE_CODES;

// ── Settings (app config — stored locally, not farm data) ────────────────────
var DEFAULT_SETTINGS = { year: 2026, county: 'Rock', state: 'WI', producerName: '' };

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
    }
  } catch (e) {
    console.warn('Could not read settings.json, using defaults:', e.message);
  }
  return Object.assign({}, DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  try {
    var dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Could not save settings.json:', e.message);
  }
}

var appSettings = loadSettings();

// ── In-memory CLU cache (10s TTL — prevents N+1 Supabase calls on dashboard) ──
var cluCache = { data: null, ts: 0 };
var CLU_CACHE_TTL = 10 * 1000; // 10s

function invalidateCluCache() {
  cluCache.data = null;
  cluCache.ts = 0;
}

// ── Column mapping helpers ────────────────────────────────────────────────────

// Map Supabase snake_case row → camelCase for API responses (frontend compatibility)
function mapToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    legacy_id: row.legacy_id || null,
    cropYear: row.crop_year || null,
    farmNumber: row.farm_number || '',
    tractNumber: row.tract_number || '',
    clu: row.clu || '',
    fieldName: row.field_name || '',
    farmName: row.farm_name || '',
    fsaAcres: row.fsa_acres || 0,
    crop: row.crop || '',
    irrigated: Boolean(row.irrigated),
    organic: Boolean(row.organic),
    doubleCrop: Boolean(row.double_crop),
    coverCrop: Boolean(row.cover_crop),
    grainPlantDate: row.grain_plant_date || '',
    use: row.use || '',
    reported: Boolean(row.reported),
    lineNumber: row.line_number || '',
    policyNumber: row.policy_number || '',
    unitNumber: row.unit_number || '',
    aph: row.aph || 0,
    registryFieldId: row.registry_field_id || null,
    registryCropId: row.registry_crop_id || null,
    landClass: row.land_class || '',
    // Conservation practice tracking fields (individual columns, not JSONB)
    tillage2024: row.tillage_2024 || '',
    tillage2025: row.tillage_2025 || '',
    cc2024: row.cc_2024 || '',
    cc2025: row.cc_2025 || '',
    ntAdoption2024: row.nt_adoption_2024 || '',
    ntAdoption2025: row.nt_adoption_2025 || '',
    ccAdoption2024: row.cc_adoption_2024 || '',
    ccAdoption2025: row.cc_adoption_2025 || '',
    // Carry through any extra fields not explicitly mapped
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Map camelCase request body → snake_case for Supabase writes
function mapCluToDb(body) {
  var db = {};
  if (body.farmNumber !== undefined) db.farm_number = body.farmNumber;
  if (body.tractNumber !== undefined) db.tract_number = body.tractNumber;
  if (body.clu !== undefined) db.clu = String(body.clu);
  if (body.fieldName !== undefined) db.field_name = body.fieldName || null;
  if (body.farmName !== undefined) db.farm_name = body.farmName || null;
  if (body.fsaAcres !== undefined) db.fsa_acres = Number(body.fsaAcres) || 0;
  if (body.crop !== undefined) db.crop = body.crop || null;
  if (body.irrigated !== undefined) db.irrigated = Boolean(body.irrigated);
  if (body.organic !== undefined) db.organic = Boolean(body.organic);
  if (body.doubleCrop !== undefined) db.double_crop = Boolean(body.doubleCrop);
  if (body.coverCrop !== undefined) db.cover_crop = Boolean(body.coverCrop);
  if (body.grainPlantDate !== undefined) db.grain_plant_date = body.grainPlantDate || null;
  if (body.use !== undefined) db.use = body.use || null;
  if (body.reported !== undefined) db.reported = Boolean(body.reported);
  if (body.lineNumber !== undefined) db.line_number = body.lineNumber || null;
  if (body.policyNumber !== undefined) db.policy_number = body.policyNumber || null;
  if (body.unitNumber !== undefined) db.unit_number = body.unitNumber || null;
  if (body.aph !== undefined) db.aph = Number(body.aph) > 0 ? Number(body.aph) : null;
  if (body.registryFieldId !== undefined) db.registry_field_id = body.registryFieldId || null;
  if (body.registryCropId !== undefined) db.registry_crop_id = body.registryCropId || null;
  if (body.landClass !== undefined) db.land_class = body.landClass || null;
  if (body.cropYear !== undefined) db.crop_year = Number(body.cropYear) || null;
  // Conservation practice fields
  if (body.tillage2024 !== undefined) db.tillage_2024 = body.tillage2024 || null;
  if (body.tillage2025 !== undefined) db.tillage_2025 = body.tillage2025 || null;
  if (body.cc2024 !== undefined) db.cc_2024 = body.cc2024 || null;
  if (body.cc2025 !== undefined) db.cc_2025 = body.cc2025 || null;
  if (body.ntAdoption2024 !== undefined) db.nt_adoption_2024 = body.ntAdoption2024 || null;
  if (body.ntAdoption2025 !== undefined) db.nt_adoption_2025 = body.ntAdoption2025 || null;
  if (body.ccAdoption2024 !== undefined) db.cc_adoption_2024 = body.ccAdoption2024 || null;
  if (body.ccAdoption2025 !== undefined) db.cc_adoption_2025 = body.ccAdoption2025 || null;
  return db;
}

// Map insurance camelCase → snake_case for Supabase writes
function mapInsuranceToDb(body) {
  var db = {};
  if (body.farmName !== undefined) db.farm_name = body.farmName || null;
  if (body.farmNumber !== undefined) db.farm_number = body.farmNumber || null;
  if (body.lineNumber !== undefined) db.line_number = body.lineNumber || null;
  if (body.policyNumber !== undefined) db.policy_number = body.policyNumber || null;
  if (body.crop !== undefined) db.crop = body.crop || null;
  if (body.policyYear !== undefined) db.policy_year = Number(body.policyYear) || null;
  if (body.plantedAcres !== undefined) db.planted_acres = Number(body.plantedAcres) || 0;
  if (body.fsaAcresManual !== undefined) db.fsa_acres_manual = Number(body.fsaAcresManual) > 0 ? Number(body.fsaAcresManual) : null;
  if (body.guarantee !== undefined) db.guarantee = Number(body.guarantee) || 0;
  if (body.actual !== undefined) db.actual = Number(body.actual) || 0;
  if (body.claimStatus !== undefined) db.claim_status = body.claimStatus || null;
  if (body.notes !== undefined) db.notes = body.notes || null;
  if (body.coverageLevel !== undefined) db.coverage_level = Number(body.coverageLevel) || null;
  if (body.unitType !== undefined) db.unit_type = body.unitType || null;
  if (body.premiumPerAcre !== undefined) db.premium_per_acre = Number(body.premiumPerAcre) > 0 ? Number(body.premiumPerAcre) : null;
  if (body.agentName !== undefined) db.agent_name = body.agentName || null;
  if (body.preventedPlanting !== undefined) db.prevented_planting = Boolean(body.preventedPlanting);
  if (body.preventedPlantingAcres !== undefined) db.prevented_planting_acres = Number(body.preventedPlantingAcres) > 0 ? Number(body.preventedPlantingAcres) : null;
  if (body.claimFiledDate !== undefined) db.claim_filed_date = body.claimFiledDate || null;
  if (body.claimPaidDate !== undefined) db.claim_paid_date = body.claimPaidDate || null;
  if (body.claimPaidAmount !== undefined) db.claim_paid_amount = Number(body.claimPaidAmount) > 0 ? Number(body.claimPaidAmount) : null;
  if (body.claimNumber !== undefined) db.claim_number = body.claimNumber || null;
  if (body.adjusterName !== undefined) db.adjuster_name = body.adjusterName || null;
  if (body.adjusterPhone !== undefined) db.adjuster_phone = body.adjusterPhone || null;
  if (body.lossType !== undefined) db.loss_type = body.lossType || null;
  return db;
}

// Map Supabase insurance row → camelCase for API responses
function mapInsuranceToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    legacy_id: row.legacy_id || null,
    farmName: row.farm_name || '',
    farmNumber: row.farm_number || '',
    lineNumber: row.line_number || '',
    policyNumber: row.policy_number || '',
    crop: row.crop || '',
    policyYear: row.policy_year || null,
    plantedAcres: row.planted_acres || 0,
    fsaAcresManual: row.fsa_acres_manual || 0,
    guarantee: row.guarantee || 0,
    actual: row.actual || 0,
    claimStatus: row.claim_status || 'none',
    notes: row.notes || '',
    coverageLevel: row.coverage_level || 0,
    unitType: row.unit_type || '',
    premiumPerAcre: row.premium_per_acre || 0,
    agentName: row.agent_name || '',
    preventedPlanting: Boolean(row.prevented_planting),
    preventedPlantingAcres: row.prevented_planting_acres || 0,
    claimFiledDate: row.claim_filed_date || '',
    claimPaidDate: row.claim_paid_date || '',
    claimPaidAmount: row.claim_paid_amount || 0,
    claimNumber: row.claim_number || '',
    adjusterName: row.adjuster_name || '',
    adjusterPhone: row.adjuster_phone || '',
    lossType: row.loss_type || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Map Supabase pricing row → camelCase for API responses
function mapPricingToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    legacy_id: row.legacy_id || null,
    crop: row.crop || '',
    year: row.year || null,
    springPrice: row.spring_price || 0,
    fallPrice: row.fall_price || 0,
    manualOverride: Boolean(row.manual_override),
    lastScraped: row.last_scraped || null
  };
}

// ── Supabase fetch helpers ────────────────────────────────────────────────────

// Fetch all CLU records from Supabase, with 10s in-memory cache
async function getCluRecords() {
  var now = Date.now();
  if (cluCache.data && (now - cluCache.ts) < CLU_CACHE_TTL) {
    return cluCache.data;
  }
  var { data, error } = await supabase.from('clu_records').select('*');
  if (error) throw Object.assign(new Error(error.message), { supabaseError: true });
  var mapped = (data || []).map(mapToClient);
  cluCache.data = mapped;
  cluCache.ts = now;
  return mapped;
}

// Fetch all insurance policies from Supabase
async function getInsurancePolicies() {
  var { data, error } = await supabase.from('insurance_policies').select('*');
  if (error) throw Object.assign(new Error(error.message), { supabaseError: true });
  return (data || []).map(mapInsuranceToClient);
}

// Fetch all pricing from Supabase
async function getPricing() {
  var { data, error } = await supabase.from('insurance_pricing').select('*');
  if (error) throw Object.assign(new Error(error.message), { supabaseError: true });
  return (data || []).map(mapPricingToClient);
}

// Standard 503 response for Supabase unavailability
function handleDbError(res, err) {
  console.error('Supabase error:', err.message);
  res.status(503).json({ error: 'Data store unavailable', detail: err.message });
}

// ── Cross-app fetch with TTL cache + timeout ──────────────────────────────────
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
      if (fetchCache[url]) return fetchCache[url].data;
      return null;
    });
}

// ===== Settings =====
app.get('/api/settings', function (req, res) {
  res.json(appSettings);
});

app.put('/api/settings', function (req, res) {
  var allowed = ['year', 'county', 'state', 'producerName'];
  allowed.forEach(function (k) {
    if (req.body[k] !== undefined) appSettings[k] = req.body[k];
  });
  saveSettings(appSettings);
  res.json(appSettings);
});

// ===== CLU Records =====
app.get('/api/clu-records', async function (req, res) {
  try {
    var records = await getCluRecords();
    if (req.query.farmNumber) records = records.filter(function (r) { return r.farmNumber === req.query.farmNumber; });
    if (req.query.crop) records = records.filter(function (r) { return r.crop === req.query.crop; });
    if (req.query.fieldName) records = records.filter(function (r) { return r.fieldName === req.query.fieldName; });
    if (req.query.reported === 'true') records = records.filter(function (r) { return r.reported; });
    if (req.query.reported === 'false') records = records.filter(function (r) { return !r.reported; });
    res.json(records);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.get('/api/clu-records/:id', async function (req, res) {
  try {
    var { data, error } = await supabase.from('clu_records').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json(mapToClient(data));
  } catch (err) {
    handleDbError(res, err);
  }
});

app.post('/api/clu-records', async function (req, res) {
  try {
    var dbRecord = mapCluToDb(req.body);
    // Set crop_year default from settings if not provided
    if (!dbRecord.crop_year) dbRecord.crop_year = appSettings.year || 2026;
    var { data, error } = await supabase.from('clu_records').insert(dbRecord).select().single();
    if (error) throw new Error(error.message);
    invalidateCluCache();
    res.status(201).json(mapToClient(data));
  } catch (err) {
    handleDbError(res, err);
  }
});

// Bulk update (mark reported) — must be before :id route
app.put('/api/clu-records/bulk', async function (req, res) {
  try {
    var ids = req.body.ids || [];
    var updates = req.body.updates || {};
    if (!ids.length) return res.json({ ok: true, updated: 0 });

    var dbUpdates = mapCluToDb(updates);
    if (!Object.keys(dbUpdates).length) return res.json({ ok: true, updated: 0 });

    var { data, error } = await supabase.from('clu_records').update(dbUpdates).in('id', ids).select();
    if (error) throw new Error(error.message);
    invalidateCluCache();
    res.json({ ok: true, updated: (data || []).length });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.put('/api/clu-records/:id', async function (req, res) {
  try {
    var dbUpdates = mapCluToDb(req.body);
    // Never allow id to be overwritten
    delete dbUpdates.id;
    var { data, error } = await supabase.from('clu_records').update(dbUpdates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    invalidateCluCache();
    res.json(mapToClient(data));
  } catch (err) {
    handleDbError(res, err);
  }
});

app.delete('/api/clu-records/:id', async function (req, res) {
  try {
    var { error } = await supabase.from('clu_records').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    invalidateCluCache();
    res.json({ ok: true });
  } catch (err) {
    handleDbError(res, err);
  }
});

// ===== Split CLU =====
app.post('/api/clu-records/:id/split', async function (req, res) {
  try {
    var { data: origRow, error: fetchErr } = await supabase.from('clu_records').select('*').eq('id', req.params.id).single();
    if (fetchErr || !origRow) return res.status(404).json({ error: 'Not found' });
    var original = mapToClient(origRow);

    var splitAcres = Number(req.body.splitAcres);
    if (!splitAcres || splitAcres <= 0 || splitAcres >= (original.fsaAcres || 0)) {
      return res.status(400).json({ error: 'Split acres must be between 0 and ' + original.fsaAcres });
    }

    // Find next CLU number for this tract (query Supabase for max CLU)
    var { data: tractRows } = await supabase.from('clu_records').select('clu')
      .eq('farm_number', original.farmNumber)
      .eq('tract_number', original.tractNumber);
    var maxClu = 0;
    (tractRows || []).forEach(function (r) {
      var n = parseInt(r.clu) || 0;
      if (n > maxClu) maxClu = n;
    });
    var newCluNum = String(maxClu + 1);

    // Reduce original acres
    var remainingAcres = Math.round(((original.fsaAcres || 0) - splitAcres) * 100) / 100;

    // Update original record
    var { data: updatedOrig, error: updateErr } = await supabase.from('clu_records')
      .update({ fsa_acres: remainingAcres })
      .eq('id', req.params.id)
      .select().single();
    if (updateErr) throw new Error(updateErr.message);

    // Insert new CLU record (copy all fields except id, clu number, acres, crop, reported)
    var newDbRecord = mapCluToDb(original);
    delete newDbRecord.id;
    newDbRecord.clu = newCluNum;
    newDbRecord.fsa_acres = splitAcres;
    newDbRecord.crop = req.body.newCrop || null;
    newDbRecord.reported = false;

    var { data: newRow, error: insertErr } = await supabase.from('clu_records').insert(newDbRecord).select().single();
    if (insertErr) throw new Error(insertErr.message);

    invalidateCluCache();
    res.json({ original: mapToClient(updatedOrig), newRecord: mapToClient(newRow) });
  } catch (err) {
    handleDbError(res, err);
  }
});

// ===== Duplicate CLU =====
app.post('/api/clu-records/:id/duplicate', async function (req, res) {
  try {
    var { data: sourceRow, error: fetchErr } = await supabase.from('clu_records').select('*').eq('id', req.params.id).single();
    if (fetchErr || !sourceRow) return res.status(404).json({ error: 'Not found' });
    var source = mapToClient(sourceRow);

    // Find next CLU number for this tract
    var { data: tractRows } = await supabase.from('clu_records').select('clu')
      .eq('farm_number', source.farmNumber)
      .eq('tract_number', source.tractNumber);
    var maxClu = 0;
    (tractRows || []).forEach(function (r) {
      var n = parseInt(r.clu) || 0;
      if (n > maxClu) maxClu = n;
    });

    var newDbRecord = mapCluToDb(source);
    delete newDbRecord.id;
    newDbRecord.clu = String(maxClu + 1);
    newDbRecord.reported = false;

    var { data: newRow, error: insertErr } = await supabase.from('clu_records').insert(newDbRecord).select().single();
    if (insertErr) throw new Error(insertErr.message);

    invalidateCluCache();
    res.json(mapToClient(newRow));
  } catch (err) {
    handleDbError(res, err);
  }
});

// ===== Rollups =====
app.get('/api/rollup/by-farm', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.rollupByFarm(records));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/by-crop', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.rollupByCrop(records));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/by-field', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.rollupByField(records, req.query.farmNumber || null));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/by-tract', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.rollupByTract(records, req.query.farmNumber || null));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/tillage-summary', async function (req, res) {
  try {
    var records = await getCluRecords();
    var year = Number(req.query.year) || 2025;
    res.json(Calc.tillageSummary(records, year));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/cover-crop-summary', async function (req, res) {
  try {
    var records = await getCluRecords();
    var year = Number(req.query.year) || 2025;
    res.json(Calc.coverCropSummary(records, year));
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/rollup/summary-metrics', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.summaryMetrics(records));
  } catch (err) { handleDbError(res, err); }
});

// ===== Pricing =====
app.get('/api/pricing', async function (req, res) {
  try {
    var pricing = await getPricing();
    res.json(pricing);
  } catch (err) { handleDbError(res, err); }
});

app.put('/api/pricing/:id', async function (req, res) {
  try {
    var allowed = { crop: req.body.crop, springPrice: req.body.springPrice, fallPrice: req.body.fallPrice, manualOverride: req.body.manualOverride };
    var dbUpdates = {};
    if (allowed.crop !== undefined) dbUpdates.crop = allowed.crop;
    if (allowed.springPrice !== undefined) dbUpdates.spring_price = Number(allowed.springPrice) || 0;
    if (allowed.fallPrice !== undefined) dbUpdates.fall_price = Number(allowed.fallPrice) || 0;
    if (allowed.manualOverride !== undefined) dbUpdates.manual_override = Boolean(allowed.manualOverride);

    var { data, error } = await supabase.from('insurance_pricing').update(dbUpdates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json(mapPricingToClient(data));
  } catch (err) { handleDbError(res, err); }
});

app.post('/api/pricing', async function (req, res) {
  try {
    var dbRecord = {
      crop: req.body.crop || '',
      spring_price: Number(req.body.springPrice) || 0,
      fall_price: Number(req.body.fallPrice) || 0,
      manual_override: Boolean(req.body.manualOverride),
      year: Number(req.body.year) || appSettings.year || 2026
    };
    var { data, error } = await supabase.from('insurance_pricing').insert(dbRecord).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(mapPricingToClient(data));
  } catch (err) { handleDbError(res, err); }
});

app.delete('/api/pricing/:id', async function (req, res) {
  try {
    var { error } = await supabase.from('insurance_pricing').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { handleDbError(res, err); }
});

// Scrape prices from USDA RMA Price Discovery API
app.post('/api/pricing/scrape', async function (req, res) {
  var today = new Date();
  var dateStr = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
  var url = 'https://public-rma.fpac.usda.gov/apps/PriceDiscovery/Services/RevenuePriceDataService.svc/RevenuePrices?discoveryPeriodDate=' + encodeURIComponent(dateStr);

  https.get(url, function (resp) {
    var body = '';
    resp.on('data', function (chunk) { body += chunk; });
    resp.on('end', async function () {
      try {
        var data = JSON.parse(body);
        var items = data.d || data;
        if (!Array.isArray(items)) { return res.json({ ok: true, updated: 0, message: 'No price data returned from RMA' }); }

        // Fetch current pricing from Supabase
        var pricing;
        try {
          pricing = await getPricing();
        } catch (e) {
          return res.status(503).json({ ok: false, error: 'Data store unavailable', message: e.message });
        }

        var updated = 0;
        var updates = [];

        items.forEach(function (item) {
          var cropName = (item.CommodityName || '').trim();
          if (!cropName) return;

          var projected = parseFloat(item.ProjectedPrice) || 0;
          var harvest = parseFloat(item.HarvestPrice) || 0;

          var lc = cropName.toLowerCase();
          var match = pricing.find(function (p) {
            return p.crop.toLowerCase() === lc;
          });

          if (match && !match.manualOverride) {
            var dbUpdates = { last_scraped: new Date().toISOString() };
            if (projected > 0) dbUpdates.spring_price = projected;
            if (harvest > 0) dbUpdates.fall_price = harvest;
            updates.push({ id: match.id, updates: dbUpdates });
            updated++;
          }
        });

        // Apply updates to Supabase
        if (updates.length > 0) {
          var updatePromises = updates.map(function (u) {
            return supabase.from('insurance_pricing').update(u.updates).eq('id', u.id);
          });
          var results = await Promise.all(updatePromises);
          var failed = results.filter(function (r) { return r.error; });
          if (failed.length > 0) {
            console.error('Pricing scrape: some updates failed:', failed.map(function (r) { return r.error.message; }));
          }
        }

        res.json({ ok: true, updated: updated, total: items.length, message: updated + ' prices updated from USDA RMA' });
      } catch (e) {
        res.json({ ok: false, error: 'Failed to parse RMA response', message: e.message });
      }
    });
  }).on('error', function (e) {
    res.json({ ok: false, error: 'Failed to reach RMA', message: e.message });
  });
});

// ===== Insurance =====
app.get('/api/insurance', async function (req, res) {
  try {
    var [policies, cluRecords, pricing] = await Promise.all([getInsurancePolicies(), getCluRecords(), getPricing()]);
    var enriched = policies.map(function (p) {
      var computed = Calc.computeInsurancePolicy(p, cluRecords, pricing);
      return Object.assign({}, p, { _computed: computed });
    });
    res.json(enriched);
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/insurance/:id', async function (req, res) {
  try {
    var { data, error } = await supabase.from('insurance_policies').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    var pol = mapInsuranceToClient(data);
    var [cluRecords, pricing] = await Promise.all([getCluRecords(), getPricing()]);
    var computed = Calc.computeInsurancePolicy(pol, cluRecords, pricing);
    res.json(Object.assign({}, pol, { _computed: computed }));
  } catch (err) { handleDbError(res, err); }
});

app.post('/api/insurance', async function (req, res) {
  try {
    var dbRecord = mapInsuranceToDb(req.body);
    if (!dbRecord.policy_year) dbRecord.policy_year = appSettings.year || 2026;
    var { data, error } = await supabase.from('insurance_policies').insert(dbRecord).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(mapInsuranceToClient(data));
  } catch (err) { handleDbError(res, err); }
});

app.put('/api/insurance/:id', async function (req, res) {
  try {
    var allowed = ['farmName', 'farmNumber', 'lineNumber', 'crop', 'plantedAcres', 'fsaAcresManual',
      'guarantee', 'actual', 'claimStatus', 'notes',
      'policyNumber', 'coverageLevel', 'unitType', 'premiumPerAcre',
      'agentName', 'policyYear', 'claimFiledDate', 'claimPaidDate', 'claimPaidAmount',
      'claimNumber', 'adjusterName', 'adjusterPhone', 'lossType',
      'preventedPlanting', 'preventedPlantingAcres'];
    var subset = {};
    allowed.forEach(function (k) { if (req.body[k] !== undefined) subset[k] = req.body[k]; });
    var dbUpdates = mapInsuranceToDb(subset);
    if (!Object.keys(dbUpdates).length) return res.status(400).json({ error: 'No valid fields to update' });

    var { data, error } = await supabase.from('insurance_policies').update(dbUpdates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    var pol = mapInsuranceToClient(data);
    var [cluRecords, pricing] = await Promise.all([getCluRecords(), getPricing()]);
    var computed = Calc.computeInsurancePolicy(pol, cluRecords, pricing);
    res.json(Object.assign({}, pol, { _computed: computed }));
  } catch (err) { handleDbError(res, err); }
});

app.delete('/api/insurance/:id', async function (req, res) {
  try {
    var { error } = await supabase.from('insurance_policies').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) { handleDbError(res, err); }
});

// ===== CLU APH Lookup =====
app.get('/api/clu-aph', async function (req, res) {
  try {
    var crop = (req.query.crop || '').toLowerCase().trim();
    var farmNumber = (req.query.farmNumber || '').trim();
    if (!crop) return res.json({ avgAph: 0, count: 0, totalRecords: 0 });

    var records = await getCluRecords();
    var matching = [];
    var total = 0;
    records.forEach(function (r) {
      if (!r.crop || r.crop.toLowerCase().trim() !== crop) return;
      if (farmNumber && r.farmNumber !== farmNumber) return;
      total++;
      if ((r.aph || 0) > 0) matching.push(r);
    });

    var sum = 0;
    matching.forEach(function (r) { sum += r.aph; });
    var avgAph = matching.length > 0 ? Math.round((sum / matching.length) * 100) / 100 : 0;

    res.json({ avgAph: avgAph, count: matching.length, totalRecords: total });
  } catch (err) { handleDbError(res, err); }
});

// ===== Reporting Progress =====
app.get('/api/rollup/reporting-progress', async function (req, res) {
  try {
    var records = await getCluRecords();
    res.json(Calc.reportingProgress(records));
  } catch (err) { handleDbError(res, err); }
});

// ===== Cropping Intentions Report =====
app.get('/api/cropping-intentions', async function (req, res) {
  try {
    var [budgetFields, regFields, enterprises, cluRecords] = await Promise.all([
      cachedFetch('http://localhost:3001/api/fields').then(function (d) { return d || []; }),
      cachedFetch('http://localhost:3005/api/fields?active=true').then(function (d) { return d || []; }),
      cachedFetch('http://localhost:3001/api/enterprises').then(function (d) { return d || []; }),
      getCluRecords()
    ]);

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
      var rf = aliasMap[norm];
      if (rf && budgetMap[normName(rf.name)]) return budgetMap[normName(rf.name)];
      var best = null, bestScore = 0;
      budgetFields.forEach(function (bf) {
        var s = syncMatchScore(bf.name, [], fieldName);
        if (bf.registryFieldName) s = Math.max(s, syncMatchScore(bf.registryFieldName, [], fieldName));
        if (s > bestScore) { bestScore = s; best = bf; }
      });
      return bestScore >= 50 ? best : null;
    }

    var records = cluRecords;
    if (req.query.farmNumber) {
      records = records.filter(function (r) { return r.farmNumber === req.query.farmNumber; });
    }

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
      year: appSettings.year,
      county: appSettings.county,
      state: appSettings.state,
      producerName: appSettings.producerName,
      rows: rows
    });
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/export/intentions', async function (req, res) {
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
app.get('/api/validation', async function (req, res) {
  try {
    var [cluRecords, pricing, policies] = await Promise.all([getCluRecords(), getPricing(), getInsurancePolicies()]);
    res.json(Calc.validateRecords(cluRecords, pricing, policies));
  } catch (err) { handleDbError(res, err); }
});

// ===== CSV Export =====
app.get('/api/export/fsa', async function (req, res) {
  try {
    var records = await getCluRecords();
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
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/export/insurance', async function (req, res) {
  try {
    var [policies, cluRecords, pricing] = await Promise.all([getInsurancePolicies(), getCluRecords(), getPricing()]);
    var headers = ['Policy#', 'Line', 'Farm#', 'Farm Name', 'Crop', 'Planted Acres', 'Coverage%',
      'Unit Type', 'APH Guarantee', 'Actual Yield', 'Shortfall', 'Spring Price', 'Fall Price',
      'Highest Price', '$ Guarantee', 'Indemnity', 'Premium/Ac', 'Total Premium', 'Status', 'Notes'];
    var rows = policies.map(function (p) {
      var c = Calc.computeInsurancePolicy(p, cluRecords, pricing);
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
  } catch (err) { handleDbError(res, err); }
});

// ===== Convenience endpoints =====
app.get('/api/farm-numbers', async function (req, res) {
  try {
    // Fetch distinct farm_number + farm_name from Supabase
    var { data, error } = await supabase.from('clu_records').select('farm_number, farm_name');
    if (error) throw new Error(error.message);
    var seen = {};
    (data || []).forEach(function (r) {
      if (r.farm_number && !seen[r.farm_number]) {
        seen[r.farm_number] = { farmNumber: r.farm_number, farmName: r.farm_name || '' };
      }
    });
    var nums = Object.values(seen).sort(function (a, b) { return a.farmNumber.localeCompare(b.farmNumber); });
    res.json(nums);
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/field-names', async function (req, res) {
  try {
    var records = await getCluRecords();
    var names = {};
    records.forEach(function (r) { if (r.fieldName) names[r.fieldName] = 1; });
    res.json(Object.keys(names).sort());
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/crop-names', async function (req, res) {
  try {
    var records = await getCluRecords();
    var names = {};
    records.forEach(function (r) { if (r.crop) names[r.crop] = 1; });
    res.json(Object.keys(names).sort());
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/tillage-codes', function (req, res) {
  res.json(TILLAGE_CODES);
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
var _fsaRegistryCropsCache = null;
var _fsaRegistryCropsCacheExpiry = 0;
app.get('/api/registry/crops', async function (req, res) {
  try {
    var now = Date.now();
    if (!_fsaRegistryCropsCache || now > _fsaRegistryCropsCacheExpiry) {
      var resp = await fetch('http://localhost:3005/api/crops');
      if (!resp.ok) throw new Error('Registry returned ' + resp.status);
      _fsaRegistryCropsCache = await resp.json();
      _fsaRegistryCropsCacheExpiry = now + 60 * 1000;
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

// --- Grain ticket yield proxy (bridge to port 3007) ---
app.get('/api/grain-yield', async function (req, res) {
  try {
    var farmsResp = await fetch('http://localhost:3007/api/farms');
    if (!farmsResp.ok) throw new Error('Grain tickets returned ' + farmsResp.status);
    var ticketsResp = await fetch('http://localhost:3007/api/tickets');
    var farms = await farmsResp.json();
    var tickets = ticketsResp.ok ? await ticketsResp.json() : [];

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
    var [dash, cluRecords] = await Promise.all([
      cachedFetch('http://localhost:3001/api/dashboard'),
      getCluRecords()
    ]);
    if (!dash) {
      return res.status(502).json({ error: 'Farm budget unavailable — is port 3001 running?' });
    }

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

    var NON_CROP_CLASSES = ['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'];
    var NON_CROP_NAMES = ['', 'nc', 'gls', 'crp', 'idle', 'mixed forage / hay', 'alfalfa', 'grass', 'intermediate wheatgrass'];

    var fsaMap = {};
    cluRecords.forEach(function (r) {
      if (r.reported === true) return;
      if (NON_CROP_CLASSES.indexOf(r.landClass) !== -1) return;
      if (r.use === 'forage') return;
      var cropLower = (r.crop || '').toLowerCase().trim();
      if (NON_CROP_NAMES.indexOf(cropLower) !== -1) return;

      var key = normName(r.crop);
      if (!fsaMap[key]) {
        fsaMap[key] = { displayName: r.crop, fsaAcres: 0, cluCount: 0 };
      }
      fsaMap[key].fsaAcres += (r.fsaAcres || 0);
      fsaMap[key].cluCount++;
    });

    var allKeys = {};
    Object.keys(budgetMap).forEach(function (k) { allKeys[k] = true; });
    Object.keys(fsaMap).forEach(function (k) { allKeys[k] = true; });

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

    rows.sort(function (a, b) { return b.budgetAcres - a.budgetAcres; });

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
    var [budgetFields, regResp, cluRecords] = await Promise.all([
      fetch('http://localhost:3001/api/fields').then(function (r) { return r.ok ? r.json() : []; }),
      fetch('http://localhost:3005/api/fields?active=true').then(function (r) { return r.ok ? r.json() : []; }),
      getCluRecords()
    ]);
    var regFields = regResp || [];

    var cluByField = {};
    cluRecords.forEach(function (r) {
      var fn = (r.fieldName || '').trim();
      if (!fn) return;
      var key = normName(fn);
      if (!cluByField[key]) cluByField[key] = { name: fn, records: [] };
      cluByField[key].records.push(r);
    });
    var cluFields = Object.keys(cluByField).map(function (k) { return cluByField[k]; });

    var proposals = [];

    regFields.forEach(function (rf) {
      var aliases = rf.aliases || [];
      var bm = syncBestMatch(rf.name, aliases, budgetFields, 'name');
      if (!bm || !bm.item.crop) return;

      var cm = syncBestMatch(rf.name, aliases, cluFields, 'name');
      if (!cm) return;

      var budgetCrop = bm.item.crop;
      var combinedScore = Math.min(bm.score, cm.score);

      cm.item.records.forEach(function (clu) {
        if (clu.landClass !== 'Tillable') return;
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

    var matchedBudget = {};
    regFields.forEach(function (rf) {
      var bm = syncBestMatch(rf.name, rf.aliases || [], budgetFields, 'name');
      if (bm) matchedBudget[normName(bm.item.name)] = true;
    });
    budgetFields.forEach(function (bf) {
      if (matchedBudget[normName(bf.name)] || !bf.crop) return;
      var cm = syncBestMatch(bf.name, [], cluFields, 'name');
      if (!cm) return;
      cm.item.records.forEach(function (clu) {
        if (clu.landClass !== 'Tillable') return;
        if (normName(clu.crop) === normName(bf.crop)) return;
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

    proposals.sort(function (a, b) {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.fieldName.localeCompare(b.fieldName);
    });

    res.json({ proposals: proposals });
  } catch (err) {
    res.status(502).json({ error: 'Farm Budget unavailable — is port 3001 running?' });
  }
});

app.post('/api/sync-crops/apply', async function (req, res) {
  try {
    var updates = req.body.updates;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });

    var count = 0;
    var updatePromises = updates
      .filter(function (u) { return u.cluId && u.crop; })
      .map(function (u) {
        count++;
        return supabase.from('clu_records').update({ crop: u.crop }).eq('id', u.cluId);
      });

    await Promise.all(updatePromises);
    invalidateCluCache();
    res.json({ updated: count });
  } catch (err) {
    handleDbError(res, err);
  }
});

// ===== Season Dashboard — cross-app aggregation =====

function buildSeasonalStatus(settings, cluRecords, insurancePolicies, budgetFields, budgetDash, seedDash, seedRecon, regFields, gtFarms) {
  var year = settings.year || 2026;

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
  var cluWithPlant = cluRecords.filter(function (r) {
    var d = r.grainPlantDate || '';
    return d && d !== '' && d !== 'TBD' && d !== '0';
  });
  planting.cluWithPlantDate = cluWithPlant.length;
  planting.cluTotal = cluRecords.length;
  if (budgetFields && planting.fieldsWithCrop < budgetFields.length) {
    planting.flags.push({ type: 'warn', msg: (budgetFields.length - planting.fieldsWithCrop) + ' budget fields have no crop assigned' });
  }

  // -- Mid-Season --
  var mid = { flags: [] };
  var reported = cluRecords.filter(function (r) { return r.reported; });
  mid.cluReported = reported.length;
  mid.cluTotal = cluRecords.length;
  mid.reportingPct = mid.cluTotal > 0 ? Math.round((mid.cluReported / mid.cluTotal) * 100) : 0;
  mid.insurancePolicyCount = insurancePolicies.length;
  var policiesWithActual = insurancePolicies.filter(function (p) { return p.actual && p.actual > 0; });
  mid.policiesMissingActual = insurancePolicies.length - policiesWithActual.length;
  var insCrops = {};
  insurancePolicies.forEach(function (p) { if (p.crop) insCrops[normName(p.crop)] = true; });
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

    var synced = 0;
    var pending = 0;
    insurancePolicies.forEach(function (p) {
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
  insurancePolicies.forEach(function (p) {
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
  try {
    var [cluRecords, insurancePolicies, crossAppResults] = await Promise.all([
      getCluRecords(),
      getInsurancePolicies(),
      Promise.all([
        cachedFetch('http://localhost:3001/api/fields'),
        cachedFetch('http://localhost:3001/api/dashboard'),
        cachedFetch('http://localhost:3006/api/dashboard'),
        cachedFetch('http://localhost:3006/api/reconciliation'),
        cachedFetch('http://localhost:3005/api/fields?active=true'),
        cachedFetch('http://localhost:3007/api/farms'),
        cachedFetch('http://localhost:3007/api/stats')
      ])
    ]);

    var budgetFields = crossAppResults[0];
    var budgetDash   = crossAppResults[1];
    var seedDash     = crossAppResults[2];
    var seedRecon    = crossAppResults[3];
    var regFields    = crossAppResults[4];
    var gtFarms      = crossAppResults[5];
    var gtStats      = crossAppResults[6];

    var season = buildSeasonalStatus(appSettings, cluRecords, insurancePolicies, budgetFields, budgetDash, seedDash, seedRecon, regFields, gtFarms);
    if (gtStats) {
      season.harvest.grainTicketCount = gtStats.totalTickets || 0;
      season.harvest.avgMoisture = gtStats.avgMoisture;
      season.harvest.dailyIntake = gtStats.dailyIntake;
      season.harvest.cropDetails = gtStats.cropSummary;
    }
    res.json(season);
  } catch (err) { handleDbError(res, err); }
});

app.get('/api/season/field-crosswalk', async function (req, res) {
  try {
    var [cluRecords, crossAppResults] = await Promise.all([
      getCluRecords(),
      Promise.all([
        cachedFetch('http://localhost:3005/api/fields?active=true'),
        cachedFetch('http://localhost:3001/api/fields'),
        cachedFetch('http://localhost:3007/api/farms')
      ])
    ]);

    var regFields    = crossAppResults[0] || [];
    var budgetFields = crossAppResults[1] || [];
    var gtFarms      = crossAppResults[2] || [];

    var cluFieldMap = {};
    cluRecords.forEach(function (r) {
      var fn = (r.fieldName || '').trim();
      if (!fn) return;
      var key = normName(fn);
      if (!cluFieldMap[key]) cluFieldMap[key] = { name: fn, acres: 0, count: 0 };
      cluFieldMap[key].acres += (parseFloat(r.fsaAcres) || 0);
      cluFieldMap[key].count++;
    });
    var cluFields = Object.keys(cluFieldMap).map(function (k) { return cluFieldMap[k]; });

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

      if (!row.budget) row.issues.push('No budget field match');
      if (!row.fsa) row.issues.push('No FSA CLU match');
      if (!row.grainTicket) row.issues.push('No grain ticket match');

      crosswalk.push(row);
    });

    var unmatchedBudget = budgetFields.filter(function (f) { return !matchedBudget[normName(f.name)]; });
    var unmatchedGt = gtFarms.filter(function (f) { return !matchedGt[normName(f.farm)]; });

    var summary = {
      registryFields: regFields.length,
      unmatchedBudget: unmatchedBudget.length,
      unmatchedGrainTicket: unmatchedGt.length
    };

    res.json({ crosswalk: crosswalk, unmatched: { budget: unmatchedBudget.slice(0, 20), grainTicket: unmatchedGt.slice(0, 20) }, summary: summary });
  } catch (err) { handleDbError(res, err); }
});

// ===== Start =====
console.log('FSA Acres server starting — using Supabase for CLU records, insurance policies, and pricing');
console.log('Settings loaded from:', fs.existsSync(SETTINGS_FILE) ? SETTINGS_FILE : 'defaults');
console.log('Settings:', JSON.stringify(appSettings));

app.listen(PORT, '0.0.0.0', function () {
  console.log('FSA Acres server running at http://localhost:' + PORT);
});
