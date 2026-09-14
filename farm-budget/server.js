#!/usr/bin/env node
'use strict';

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const compression = require('compression');
const Calc = require('./public/calc.js');
const fieldopsClient = require('./fieldops/client');
const fieldopsSync = require('./fieldops/sync');
const audit = require('./audit');
const { runAgent } = require('./lib/agent/loop');
const cron = require('node-cron');
// node-cron loaded here for audit + FieldOps sync

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
// DATA_FILE is overridable so a second MACRO instance can run a different
// plan year in parallel (MACRO 2027 on its own port + data file) while this
// one keeps tracking the current season. Backups and the save lock all derive
// from this constant, so the two instances never touch each other's files.
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, 'data', 'data.json');
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

// ── Embed auth helpers ───────────────────────────────────────────
// Browsers authenticate with a per-user grant minted by the portal:
// v1.<app>.<userId>.<exp>.<hmacHex>, HMAC-signed with the server-held
// EMBED_TOKEN (which never reaches a browser). The raw token itself is
// only accepted from server-to-server callers (?token= / x-embed-token).
const EMBED_APP_NAME = 'farm-budget';
const EMBED_GRANT_COOKIE = 'embed_grant_' + EMBED_APP_NAME.replace(/-/g, '_');
function verifyEmbedGrant(grant) {
  // v1.<app>.<userId>.<exp>.<sig>            — legacy, no role claim
  // v2.<app>.<userId>.<role>.<exp>.<sig>     — role rides inside the signed payload
  // Returns { userId, role|null } on success (truthy for existing boolean callers).
  if (!grant || typeof grant !== 'string') return false;
  const parts = grant.split('.');
  const isV1 = parts[0] === 'v1' && parts.length === 5;
  const isV2 = parts[0] === 'v2' && parts.length === 6;
  if ((!isV1 && !isV2) || parts[1] !== EMBED_APP_NAME) return false;
  const exp = parseInt(parts[parts.length - 2], 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const grantCrypto = require('crypto');
  const expected = grantCrypto.createHmac('sha256', process.env.EMBED_TOKEN)
    .update(parts.slice(0, parts.length - 1).join('.')).digest('hex');
  const sigBuf = Buffer.from(parts[parts.length - 1]);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !grantCrypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  return { userId: parts[2], role: isV2 ? parts[3] : null };
}

// ── Embed-token gate ─────────────────────────────────────────────
// Cookie-setting runs BEFORE static files so the initial page load
// (/?token=xxx) sets the cookie even though express.static handles
// the response. API routes are gated separately.
if (process.env.EMBED_TOKEN) {
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (typeof req.query.grant === 'string' && verifyEmbedGrant(req.query.grant)) {
      res.cookie(EMBED_GRANT_COOKIE, req.query.grant, {
        httpOnly: true, sameSite: 'lax', secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    next();
  });
}

// Static files served before API auth so pages always load
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// API auth gate
if (process.env.EMBED_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.query.token === process.env.EMBED_TOKEN) return next();
    if (req.get('x-embed-token') === process.env.EMBED_TOKEN) return next();
    if (req.cookies && req.cookies.embed_session === process.env.EMBED_TOKEN) return next();
    if (typeof req.query.grant === 'string' && verifyEmbedGrant(req.query.grant)) return next();
    if (req.cookies && verifyEmbedGrant(req.cookies[EMBED_GRANT_COOKIE])) return next();
    res.status(403).json({ error: 'Forbidden' });
  });
}

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
    interestRate: 0.06,
    carryMonths: 6
  },
  enterprises: [],
  fields: [],
  products: [],
  implements: [],
  cropPricing: [],
  cropTypes: [],
  laborOverhead: [],
  overheadPools: [],
  glAccountMap: [],
  plImports: [],
  seeds: [],
  rent: [],
  buyers: [],
  sales: [],
  suppliers: [],
  programs: [],
  machineryPrograms: [],
  quickPlanConfig: [],
  orders: [],
  deliveries: [],
  unitPacks: [],
  farmGeoJSON: null
};

// --- Audit state ---
let latestAudit = null;
const AUDIT_FILE = path.join(__dirname, 'data', 'audit-results.json');
try {
  if (fs.existsSync(AUDIT_FILE)) {
    latestAudit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    console.log('[Audit] Loaded persisted results from disk');
  }
} catch (e) { console.warn('[Audit] Could not load persisted audit:', e.message); }

async function executeAudit() {
  var start = Date.now();
  latestAudit = audit.runAudit(store, Calc, getRefs);
  latestAudit.durationMs = Date.now() - start;
  console.log('[Audit] Completed: ' + latestAudit.summary.errors + ' errors, ' +
    latestAudit.summary.warnings + ' warnings, ' + latestAudit.summary.info + ' info (' +
    latestAudit.durationMs + 'ms)');
  try {
    await fsp.writeFile(AUDIT_FILE, JSON.stringify(latestAudit, null, 2));
  } catch (e) { console.error('[Audit] Persist error:', e.message); }
  return latestAudit;
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  // Guard collections added after initial data.json was created
  if (!store.quickPlanConfig) store.quickPlanConfig = [];
  if (!store.strawSales) store.strawSales = [];
  if (!store.strawOps) store.strawOps = [];
  if (!store.strawProduction) store.strawProduction = [];
  if (!store.strawRemovalRates || !store.strawRemovalRates.length) {
    store.strawRemovalRates = STRAW_REMOVAL_DEFAULTS.map(r => Object.assign({ id: generateId('srate') }, r));
  }
  if (!store.inputQuotes) store.inputQuotes = [];
  recomputeDblSharedAcres();
}

// --- Double-crop ground sharing ---
// A DBL CROP entry is the SECOND crop on ground whose base crop is another budget
// entry (dblPartnerFieldId). calc.js charges the DBL entry 0.5× rent/overhead; the
// base crop needs to know how many of its acres are shared so it gets 0.5× on those.
// dblSharedAcres is denormalized onto the base crop here (single-field calc stays
// possible everywhere) and recomputed after every field mutation and on boot.

function effAcres(f) {
  return (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
}

function recomputeDblSharedAcres() {
  const sharedByPartner = {};
  (store.fields || []).forEach(f => {
    if ((f.cropType || '').toUpperCase().indexOf('DBL') >= 0 && f.dblPartnerFieldId) {
      sharedByPartner[f.dblPartnerFieldId] =
        (sharedByPartner[f.dblPartnerFieldId] || 0) + effAcres(f);
    }
  });
  (store.fields || []).forEach(f => {
    const shared = sharedByPartner[f.id]
      ? Math.round(Math.min(sharedByPartner[f.id], effAcres(f)) * 100) / 100
      : 0;
    if ((f.dblSharedAcres || 0) !== shared) f.dblSharedAcres = shared;
    if (!f.dblSharedAcres) delete f.dblSharedAcres;
  });
}

// Budget entries covering the same physical farm: matched by registryFieldId when
// set, otherwise by normalized name. Used for rent-basis math.
function farmGroupFields(field) {
  const key = field.registryFieldId || (field.name || '').trim().toLowerCase();
  if (!key) return [field];
  return (store.fields || []).filter(f =>
    (f.registryFieldId || (f.name || '').trim().toLowerCase()) === key
  );
}

// Physical acres farmed this year on a farm group = sum of effective acres of the
// base-crop (non-DBL) entries. DBL second crops ride on ground already counted.
function farmedAcres(groupFields) {
  return groupFields
    .filter(f => (f.cropType || '').toUpperCase().indexOf('DBL') < 0)
    .reduce((sum, f) => sum + effAcres(f), 0);
}

// A farm group opts into full rent recovery (lump ÷ farmed acres instead of
// lump ÷ registry reported acres) when any member has rentBasis: 'farmed'.
function groupRentBasis(groupFields) {
  return groupFields.some(f => f.rentBasis === 'farmed') ? 'farmed' : 'reported';
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
    // Keep denormalized double-crop shared acres consistent on every save path
    // (field CRUD, splits, batch edits, registry sync).
    recomputeDblSharedAcres();
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
        .then(() => {
          resolvers.forEach(r => r.resolve());
          notifySeedInventory();
        })
        .catch(err => resolvers.forEach(r => r.reject(err)));
    }, 500);
  });
}

// Graceful shutdown: flush any pending debounced save before the process exits.
// Without this, a `pm2 restart` during the 500ms debounce window silently drops data.
async function flushAndExit(signal) {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    const resolvers = _saveResolvers.splice(0);
    try {
      await saveDataImmediate();
      resolvers.forEach(r => r.resolve());
      console.log('[shutdown] ' + signal + ' — pending save flushed OK');
    } catch (err) {
      resolvers.forEach(r => r.reject(err));
      console.error('[shutdown] Flush failed:', err.message);
    }
  }
  process.exit(0);
}
process.on('SIGTERM', () => flushAndExit('SIGTERM'));
process.on('SIGINT',  () => flushAndExit('SIGINT'));

// Build a seed-inventory URL with the shared embed token — seed-inventory's auth
// middleware 403s any request without it, including server-to-server calls.
function seedInventoryUrl(path) {
  var base = (process.env.SEED_INVENTORY_URL || 'http://localhost:3006') + path;
  var token = process.env.SEED_INVENTORY_TOKEN || process.env.EMBED_TOKEN || '';
  if (!token) return base;
  return base + (path.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(token);
}

// Live sync: notify seed-inventory to re-pull forecasts after every save.
// Fire-and-forget — seed-inventory being down should never block farm-budget.
// Every attempt is recorded in _syncStatus so failures are visible instead of silent.
let _syncStatus = {
  lastNotifyAt: null, lastNotifyOk: null, lastNotifyError: null,
  lastReconAt: null, lastReconOk: null, lastReconError: null
};
function recordNotify(ok, err) {
  _syncStatus.lastNotifyAt = new Date().toISOString();
  _syncStatus.lastNotifyOk = ok;
  _syncStatus.lastNotifyError = ok ? null : (err || 'unknown error');
  if (!ok) console.warn('[live-sync] notify seed-inventory failed:', _syncStatus.lastNotifyError);
}
function recordSiSync(ok, err) {
  _syncStatus.lastReconAt = new Date().toISOString();
  _syncStatus.lastReconOk = ok;
  _syncStatus.lastReconError = ok ? null : (err || 'unknown error');
  if (!ok) console.warn('[live-sync] reconciliation fetch from seed-inventory failed:', _syncStatus.lastReconError);
}
let _notifyTimer = null;
function notifySeedInventory() {
  // Debounce notifications to 2s so rapid saves don't hammer seed-inventory
  if (_notifyTimer) clearTimeout(_notifyTimer);
  _notifyTimer = setTimeout(() => {
    _notifyTimer = null;
    var url = seedInventoryUrl('/api/forecasts/sync-webhook');
    var cropYear = (store.settings && store.settings.cropYear) || null;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cropYear: cropYear }) })
      .then(function (r) {
        recordNotify(r.ok, r.ok ? null : 'seed-inventory returned ' + r.status);
      })
      .catch(function (e) {
        recordNotify(false, e.message);
      });
  }, 2000);
}

// Sync health for the UI badge — did the last push/pull to seed-inventory work?
app.get('/api/sync-status', function (req, res) {
  res.json(Object.assign({}, _syncStatus, {
    cropYear: (store.settings && store.settings.cropYear) || null,
    seedInventoryUrl: process.env.SEED_INVENTORY_URL || 'http://localhost:3006'
  }));
});

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
    overheadPools: store.overheadPools || [],
    overheadRates: Calc.computeOverheadRates(store.fields, store.overheadPools || []),
    seeds: store.seeds,
    buyers: store.buyers,
    marketingPrices: store.marketingPrices || null
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
  const allowed = ['year', 'fuelPricePerGal', 'useFixedMachineryRate', 'fixedMachineryRate', 'useFlatRentRate', 'wageRate', 'interestRate', 'carryMonths', 'useOverheadPools'];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) store.settings[k] = req.body[k];
  });
  await saveData();
  res.json(store.settings);
});

// --- Grain Yield Overlay (Phase 52) ---
// In-memory cache for yield data pushed from grain-tickets.
// Stored as a lookup map keyed by "registryFieldId|registryCropId".
let _grainYields = { data: null, updatedAt: null };

// POST /api/yield-from-grain — receives bulk yield summaries from grain-tickets
// Authenticated by ecosystem token (server-to-server push, not a user action).
app.post('/api/yield-from-grain', (req, res) => {
  const token = req.headers['x-ecosystem-token'];
  const expected = process.env.ECOSYSTEM_TOKEN || process.env.EMBED_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { summaries, cropYear } = req.body;
  if (!Array.isArray(summaries)) {
    return res.status(400).json({ error: 'summaries array is required' });
  }

  // Build lookup map keyed by "registryFieldId|registryCropId"
  const map = {};
  for (const s of summaries) {
    if (s.registryFieldId && s.registryCropId) {
      const key = s.registryFieldId + '|' + s.registryCropId;
      map[key] = {
        yieldPerAcre: s.yieldPerAcre,
        totalNetBU: s.totalNetBU,
        ticketCount: s.ticketCount,
        cropName: s.cropName,
        farmName: s.farmName,
        acres: s.acres,
        registryFieldId: s.registryFieldId,
        registryCropId: s.registryCropId,
        cropYear: cropYear,
        syncedAt: new Date().toISOString()
      };
    }
  }

  // Stamp the year this payload belongs to. grain-tickets pushes whichever crop
  // year the edited ticket carried, so the cache is not necessarily MACRO's year.
  _grainYields = { data: map, updatedAt: new Date().toISOString(), cropYear: Number(cropYear) || null };
  res.json({ ok: true, count: summaries.length });
});

// Pull yield summaries directly from grain-tickets — self-heal after a restart,
// since the push cache is in-memory and grain-tickets only pushes on ticket changes.
const GRAIN_API_URL = process.env.GRAIN_API_URL || 'http://localhost:3007';

async function pullGrainYields() {
  const token = process.env.ECOSYSTEM_TOKEN || process.env.EMBED_TOKEN;
  if (!token) return null;
  try {
    const cropYear = store.settings.year || new Date().getFullYear();
    const r = await fetch(`${GRAIN_API_URL}/api/yield-summaries?cropYear=${cropYear}`, {
      headers: { 'x-embed-token': token },
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const json = await r.json();
    const map = {};
    (json.summaries || []).forEach(s => {
      if (s.registryFieldId && s.registryCropId) {
        map[s.registryFieldId + '|' + s.registryCropId] = {
          yieldPerAcre: s.yieldPerAcre,
          totalNetBU: s.totalNetBU,
          ticketCount: s.ticketCount,
          cropName: s.cropName,
          farmName: s.farmName,
          acres: s.acres,
          registryFieldId: s.registryFieldId,
          registryCropId: s.registryCropId,
          cropYear: json.cropYear || cropYear,
          syncedAt: new Date().toISOString()
        };
      }
    });
    _grainYields = {
      data: map,
      updatedAt: new Date().toISOString(),
      cropYear: Number(json.cropYear) || cropYear
    };
    return map;
  } catch {
    return null;
  }
}

// Registry crop lookup for yield aggregation — id → {name, unit, aliases[]}.
// The registry is the crop-name crosswalk: MACRO's names ("Hybrid Seed Rye")
// and grain-tickets' names ("Hybrid Rye") are both aliases of one registry crop.
const REGISTRY_API_URL = process.env.REGISTRY_API_URL || 'http://localhost:3005';
let _registryCrops = { data: null, ts: 0 };
async function fetchRegistryCrops() {
  if (_registryCrops.data && Date.now() - _registryCrops.ts < 10 * 60 * 1000) return _registryCrops.data;
  try {
    const token = process.env.ECOSYSTEM_TOKEN || process.env.EMBED_TOKEN;
    const r = await fetch(`${REGISTRY_API_URL}/api/crops`, {
      headers: token ? { 'x-embed-token': token } : {},
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const crops = await r.json();
      if (Array.isArray(crops)) _registryCrops = { data: crops, ts: Date.now() };
    }
  } catch { /* keep stale cache on failure */ }
  return _registryCrops.data;
}

// GET /api/yield-from-grain — client fetches cached grain yield data for dashboard overlay
// and inline card editing. Falls back to a live pull when the push cache is empty.
// Ships two extra views for the dashboard: byCrop (per-registry-crop aggregates across
// fields) and nameIndex (normalized name/alias → registryCropId) so the client can
// resolve any crop spelling to the crop-wide actual.
app.get('/api/yield-from-grain', async (req, res) => {
  // The numerator (bushels) comes from the push cache, the denominator (acres)
  // from store.fields — which are always settings.year. grain-tickets replaces
  // the cache wholesale with whatever year the last edited ticket carried, so
  // correcting a 2025 ticket would otherwise render 2025 bushels over 2026 acres
  // as this year's "GT Actual". Re-pull on mismatch, and serve nothing rather
  // than a cross-year ratio we can't repair.
  const macroYear = Number(store.settings.year) || new Date().getFullYear();
  if (!_grainYields.data || Number(_grainYields.cropYear) !== macroYear) await pullGrainYields();
  const yearMatches = Number(_grainYields.cropYear) === macroYear;
  const crops = (await fetchRegistryCrops()) || [];

  const byCrop = {};
  const entries = (yearMatches && _grainYields.data) || {};
  Object.keys(entries).forEach(key => {
    const e = entries[key];
    const cropId = e.registryCropId || key.split('|')[1];
    if (!cropId) return;
    if (!byCrop[cropId]) {
      const reg = crops.find(c => c.id === cropId);
      byCrop[cropId] = {
        cropName: reg ? reg.name : e.cropName,
        unit: reg ? reg.unit : 'Bu',
        totalNetBU: 0, acres: 0, ticketAcres: 0, ticketCount: 0, fieldCount: 0,
        yieldPerAcre: 0, cropYear: e.cropYear, syncedAt: e.syncedAt
      };
    }
    const g = byCrop[cropId];
    g.totalNetBU += e.totalNetBU || 0;
    g.ticketAcres += e.acres || (e.yieldPerAcre > 0 ? (e.totalNetBU || 0) / e.yieldPerAcre : 0);
    g.ticketCount += e.ticketCount || 0;
    g.fieldCount++;
  });

  // Built after byCrop so alias collisions resolve toward the crop that has
  // ticket data. Collisions are legal and expected: the registry's uniqueness
  // key is name + organic flag, so conventional and organic records share a
  // `name` ("Peas", "Soybeans", "Snap Beans", ...) and are told apart only by
  // their aliases ("Peas"/"Field Peas" vs "ORG Peas"/"Organic Peas").
  // So match the token's OWN organic-ness against the crop's flag first — bare
  // "Soybeans" must stay conventional even when the organic record is the one
  // carrying tickets. Ticket presence only breaks ties on the same side of the
  // flag; without this the acres denominator and the dashboard's "GT Actual"
  // both land on the wrong crop.
  const ORGANIC_TOKEN = /^(org|organic)\b/;
  const nameIndex = {};
  const nameFits = {};
  crops.forEach(c => {
    [c.name].concat(c.aliases || []).forEach(n => {
      if (!n) return;
      const norm = String(n).trim().toLowerCase();
      const fits = ORGANIC_TOKEN.test(norm) === !!c.organic;
      const existing = nameIndex[norm];
      if (existing) {
        if (nameFits[norm] && !fits) return;
        if (fits === nameFits[norm] && byCrop[existing] && !byCrop[c.id]) return;
      }
      nameIndex[norm] = c.id;
      nameFits[norm] = fits;
    });
  });

  // Denominator: crop acres from the enterprise budgets (MACRO fields), not
  // grain-tickets Farm rows — Farm rows hold one crop per farm, so subfields
  // and double-cropped ground get the wrong acres. Same acre basis as
  // calc.js computeFieldBudget: plantedAcres when set, else field.acres.
  const enterpriseAcres = {};
  (store.fields || []).forEach(f => {
    const cropId = nameIndex[(f.crop || '').trim().toLowerCase()];
    if (!cropId) return;
    const acres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
    enterpriseAcres[cropId] = (enterpriseAcres[cropId] || 0) + acres;
  });

  Object.keys(byCrop).forEach(cropId => {
    const g = byCrop[cropId];
    g.totalNetBU = Math.round(g.totalNetBU * 100) / 100;
    g.ticketAcres = Math.round(g.ticketAcres * 100) / 100;
    // Fall back to ticket-derived acres when MACRO has no field for the crop.
    g.acres = enterpriseAcres[cropId] > 0 ? Math.round(enterpriseAcres[cropId] * 100) / 100 : g.ticketAcres;
    g.acresSource = enterpriseAcres[cropId] > 0 ? 'enterprise' : 'tickets';
    g.yieldPerAcre = g.acres > 0 ? Math.round((g.totalNetBU / g.acres) * 100) / 100 : 0;
  });

  res.json({
    yields: entries,
    updatedAt: _grainYields.updatedAt,
    cropYear: macroYear,
    cacheCropYear: _grainYields.cropYear || null,
    byCrop,
    nameIndex
  });
});

// --- Dashboard ---
app.get('/api/dashboard', (req, res) => {
  const yieldMode = req.query.yieldMode === 'actual' ? 'actual' : 'projected';
  const dashboard = Calc.computeDashboard(store.fields, store.enterprises, getRefs(), store.settings, { yieldMode });
  res.json(dashboard);
});

// --- Budget Field Details (for organic-cert budget-summary consumption) ---
// Returns per-field computed budgets with all 10 cost categories (per-acre values)
// so Sandy's view can mirror the macro rollup layout exactly.
app.get('/api/budget-field-details', (req, res) => {
  const refs = getRefs();
  const rows = store.fields.map(field => {
    const resolvedEntId = Calc.resolveEnterpriseId(field, store.cropTypes || [], store.enterprises);
    const ent = store.enterprises.find(e => e.id === resolvedEntId);
    const b = Calc.computeFieldBudget(field, refs, store.settings);
    return {
      fieldId: field.id,
      fieldName: field.name,
      crop: field.crop,
      acres: b.effectiveAcres,
      enterpriseId: resolvedEntId,
      enterpriseName: ent ? ent.name : '',
      category: ent ? ent.category : 'conventional',
      // 10 cost categories (per-acre)
      rentPerAcre: b.rentPerCropAcre,
      fertPerAcre: b.totalFertPerAcre,
      seedPerAcre: b.seedCostPerAcre,
      machineryPerAcre: b.machineryPerAcre,
      laborPerAcre: Calc.round2((b.laborPerAcre || 0) + (b.overheadPerAcre || 0)),
      fuelPerAcre: b.fuelPerAcre,
      dryingPerAcre: b.dryingPerAcre,
      interestPerAcre: b.interestPerAcre,
      insurancePerAcre: b.cropInsurancePerAcre,
      expPerAcre: b.expPerAcre,
      // Overhead split out (laborPerAcre above still lumps labor + overhead
      // for the older consumers). opExpPerAcre = everything except overhead.
      overheadPerAcre: b.overheadPerAcre,
      overheadSource: b.overheadSource,
      overheadPools: b.overheadPools,
      opExpPerAcre: b.opExpPerAcre,
      cop: b.cop,
      opCop: b.opCop,
      // Financial (organic-cert RBAC will gate visibility)
      yieldPerAcre: b.yieldPerAcre,
      pricePerUnit: b.pricePerUnit,
      cropIncomePerAcre: b.cropIncomePerAcre,
      profitPerAcre: b.profitPerAcre
    };
  });

  // Group by category for subtotals
  const organic = rows.filter(r => r.category === 'organic');
  const conventional = rows.filter(r => r.category === 'conventional');

  function computeSubtotal(subset) {
    const totalAcres = subset.reduce((s, r) => s + r.acres, 0);
    if (totalAcres === 0) return { acres: 0 };
    const wa = key => Calc.round2(subset.reduce((s, r) => s + r[key] * r.acres, 0) / totalAcres);
    return {
      acres: totalAcres,
      rentPerAcre: wa('rentPerAcre'),
      fertPerAcre: wa('fertPerAcre'),
      seedPerAcre: wa('seedPerAcre'),
      machineryPerAcre: wa('machineryPerAcre'),
      laborPerAcre: wa('laborPerAcre'),
      fuelPerAcre: wa('fuelPerAcre'),
      dryingPerAcre: wa('dryingPerAcre'),
      interestPerAcre: wa('interestPerAcre'),
      insurancePerAcre: wa('insurancePerAcre'),
      expPerAcre: wa('expPerAcre'),
      cropIncomePerAcre: wa('cropIncomePerAcre'),
      profitPerAcre: wa('profitPerAcre')
    };
  }

  res.json({
    year: store.settings.year,
    fields: rows,
    organicSubtotal: computeSubtotal(organic),
    conventionalSubtotal: computeSubtotal(conventional),
    grandTotal: computeSubtotal(rows)
  });
});

// --- Actuals from Portal (organic-cert) ---
// Fetches Sandy's entered actuals from organic-cert and caches them briefly.
// Called internally by the dashboard when yieldMode=actual, or directly via API.
let _actualsCache = { data: null, expiry: 0 };

async function fetchPortalActuals(year) {
  const now = Date.now();
  if (_actualsCache.data && _actualsCache.expiry > now) return _actualsCache.data;

  // organic-cert (3004) owns /api/budget-actuals. The old default of 3002 is
  // fsa-acres, which 403s — and because the catch below swallows it, the
  // dashboard's Actual mode silently showed no actuals at all in production.
  const portalUrl = process.env.PORTAL_API_URL || process.env.CERT_API_URL || 'http://localhost:3004';
  const token = process.env.ECOSYSTEM_TOKEN || '';
  try {
    const res = await fetch(`${portalUrl}/api/budget-actuals?year=${year}&token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const json = await res.json();
    // Build lookup map: "fieldname|crop" -> actuals
    const map = {};
    (json.actuals || []).forEach(a => {
      const key = (a.fieldName || '').toLowerCase() + '|' + (a.crop || '').toLowerCase();
      map[key] = a;
    });
    _actualsCache = { data: map, expiry: now + 30000 }; // 30s cache
    return map;
  } catch {
    return null;
  }
}

app.get('/api/actuals-from-portal', async (req, res) => {
  const year = parseInt(req.query.year) || store.settings.year;
  const actuals = await fetchPortalActuals(year);
  if (!actuals) return res.json({ actuals: {} });
  res.json({ actuals });
});

// Override the dashboard endpoint to include actuals overlay when yieldMode=actual
app.get('/api/dashboard-with-actuals', async (req, res) => {
  const yieldMode = req.query.yieldMode === 'actual' ? 'actual' : 'projected';
  const dashboard = Calc.computeDashboard(store.fields, store.enterprises, getRefs(), store.settings, { yieldMode });

  if (yieldMode === 'actual') {
    // Overlay Sandy's actuals onto enterprise summaries.
    //
    // This block indexes es.budgets[], a per-field breakdown that
    // computeDashboard does NOT return — its summaries are
    // {enterprise, cropRows, totals}, aggregated by crop. The overlay has
    // therefore never populated anything, and until PORTAL_API_URL was
    // corrected that went unnoticed: actualsMap was always null, so nothing
    // below ran. With a real map it threw TypeError on es.budgets.forEach,
    // and because an exception in an async Express handler becomes an
    // unhandled rejection rather than a 500, the request hung forever with no
    // error and no CPU.
    //
    // Guarded rather than rewritten: attaching crop-level actuals to
    // crop-level rows is a reporting decision, not a mechanical repair. The
    // client already tolerates the absence (dashboard.js checks `es.budgets &&`),
    // so a guarded no-op is exactly today's behaviour, minus the hang.
    try {
      const actualsMap = await fetchPortalActuals(store.settings.year);
      if (actualsMap) {
        (dashboard.enterpriseSummaries || []).forEach(es => {
          (es.budgets || []).forEach(fb => {
            const field = fb.field || {};
            const key = (field.name || '').toLowerCase() + '|' + (field.crop || '').toLowerCase();
            const actual = actualsMap[key];
            if (actual) {
              fb.actuals = {
                seedTotal: actual.actualSeedTotal,
                fertTotal: actual.actualFertTotal,
                chemTotal: actual.actualChemTotal,
                opsTotal: actual.actualOpsTotal,
                total: actual.actualTotal,
                acres: actual.acres
              };
            }
          });
        });
      }
    } catch (e) {
      // Never let the overlay take the dashboard down with it.
      console.error('[dashboard-with-actuals] overlay skipped:', e.message);
    }
  }

  res.json(dashboard);
});

// --- Procurement Status (ordered/delivered per product, pulled from seed-inventory) ---
let _procurementCache = { data: null, fetchedAt: 0 };
const PROCUREMENT_CACHE_TTL = 30 * 1000;

app.get('/api/procurement-status', async (req, res) => {
  const now = Date.now();
  if (_procurementCache.data && (now - _procurementCache.fetchedAt) < PROCUREMENT_CACHE_TTL) {
    return res.json(_procurementCache.data);
  }
  try {
    const siResp = await fetch(seedInventoryUrl('/api/reconciliation'));
    if (!siResp.ok) throw new Error('seed-inventory returned ' + siResp.status);
    const recon = await siResp.json();
    const byName = {};
    const byId = {};
    recon.forEach(function (row) {
      var entry = {
        orderedQty: row.totalOrdered || 0,
        deliveredQty: row.totalDelivered || 0,
        unit: row.unit || ''
      };
      if (row.budgetProductId) byId[row.budgetProductId] = entry;
      var key = (row.type === 'SEED' ? row.variety : row.productName) || '';
      if (!key) return;
      byName[key.toLowerCase()] = entry;
    });
    const response = { offline: false, byName: byName, byId: byId };
    _procurementCache = { data: response, fetchedAt: now };
    recordSiSync(true, null);
    res.json(response);
  } catch (e) {
    recordSiSync(false, e.message);
    res.json({ offline: true, byName: {}, byId: {} });
  }
});

// --- Local Invoice Totals (confirmed invoiceCostTotal per enterprise) ---
app.get('/api/enterprise-invoice-totals', (req, res) => {
  const byEnterprise = {};
  const pendingFields = [];

  store.fields.forEach(field => {
    const entId = Calc.resolveEnterpriseId(field, store.cropTypes || [], store.enterprises);
    if (!byEnterprise[entId]) byEnterprise[entId] = { inputs: 0, count: 0 };

    let pendingCount = 0;
    (field.inputs || []).forEach(inp => {
      if (inp.passStatus === 'confirmed' && inp.invoiceCostTotal != null) {
        byEnterprise[entId].inputs += inp.invoiceCostTotal;
        byEnterprise[entId].count += 1;
      } else if (!inp.passStatus || inp.passStatus === 'planned') {
        pendingCount++;
      }
    });

    if (pendingCount > 0) {
      pendingFields.push({
        fieldId: field.id,
        fieldName: field.name,
        crop: field.crop || '',
        enterpriseId: entId,
        registryFieldId: field.registryFieldId || null,
        pendingCount
      });
    }
  });

  // Sort pending fields alphabetically
  pendingFields.sort((a, b) => a.fieldName.localeCompare(b.fieldName));

  res.json({ byEnterprise, pendingFields });
});

// --- Enterprises ---
app.get('/api/enterprises', (req, res) => {
  res.json(store.enterprises);
});

app.get('/api/enterprises/:id', (req, res) => {
  const ent = store.enterprises.find(e => e.id === req.params.id);
  if (!ent) return res.status(404).json({ error: 'Enterprise not found' });
  const entFields = store.fields.filter(f =>
    Calc.resolveEnterpriseId(f, store.cropTypes || [], store.enterprises) === ent.id
  );
  const summary = Calc.computeEnterpriseSummary(entFields, getRefs(), store.settings);
  res.json({ enterprise: ent, ...summary });
});

app.put('/api/enterprises/:id', async (req, res) => {
  const idx = store.enterprises.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Enterprise not found' });
  Object.assign(store.enterprises[idx], req.body);
  await saveData();
  res.json(store.enterprises[idx]);
});

// --- Fields ---
app.get('/api/fields', (req, res) => {
  let fields = store.fields;
  if (req.query.enterpriseId) {
    fields = fields.filter(f =>
      Calc.resolveEnterpriseId(f, store.cropTypes || [], store.enterprises) === req.query.enterpriseId
    );
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
  // Idempotency guard: if registryFieldId provided, check for existing field
  if (req.body.registryFieldId) {
    const existingField = store.fields.find(f => f.registryFieldId === req.body.registryFieldId);
    if (existingField) {
      return res.status(200).json(enrichField(existingField));
    }
  }
  const field = Object.assign({ id: generateId('fld') }, req.body);
  if (!field.inputs) field.inputs = [];
  if (!field.machinery) field.machinery = [];
  store.fields.push(field);
  recomputeDblSharedAcres();
  await saveData();
  res.status(201).json(enrichField(field));
});

app.put('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });

  // Merge all provided fields
  const updatable = [
    'name', 'enterpriseId', 'systemCode', 'crop', 'cropType',
    'acres', 'plantedAcres', 'rentPerAcre', 'inputs', 'seed', 'seeds', 'machinery',
    'yieldPerAcre', 'yieldUnit', 'yieldMode', 'projectedYieldPerAcre', 'cropInsurancePerAcre',
    'insuranceIncomePerAcre', 'govPaymentLabel', 'govPaymentsPerAcre',
    'auxPayments', 'tariffsPerAcre', 'geometry', 'harvestMoisture', 'buyerId', 'templateId', 'machineryProgramId',
    'registryFieldName', 'splitGroupId', 'registryFieldId',
    'tillage', 'notes', 'dblPartnerFieldId', 'rentBasis'
  ];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) store.fields[idx][k] = req.body[k];
  });

  recomputeDblSharedAcres();
  await saveData();
  res.json(enrichField(store.fields[idx]));
});

app.delete('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });
  const deletedId = store.fields[idx].id;
  store.fields.splice(idx, 1);
  // Clear dangling partner links to the deleted field
  store.fields.forEach(f => {
    if (f.dblPartnerFieldId === deletedId) delete f.dblPartnerFieldId;
  });
  recomputeDblSharedAcres();
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
      inputs: JSON.parse(JSON.stringify(source.inputs || [])),
      seed: source.seed ? JSON.parse(JSON.stringify(source.seed)) : null,
      seeds: source.seeds ? JSON.parse(JSON.stringify(source.seeds)) : [],
      machinery: JSON.parse(JSON.stringify(source.machinery || [])),
      yieldPerAcre: source.yieldPerAcre || 0,
      yieldUnit: source.yieldUnit || 'Bu',
      cropInsurancePerAcre: source.cropInsurancePerAcre || 0,
      insuranceIncomePerAcre: source.insuranceIncomePerAcre || 0,
      auxPayments: JSON.parse(JSON.stringify(source.auxPayments || [])),
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

// --- Link existing fields as a split group ---
// For fields that share a registry parcel but weren't created via split
app.post('/api/fields/link-split', async (req, res) => {
  const { fieldIds, registryFieldName } = req.body;
  if (!fieldIds || fieldIds.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 field IDs' });
  }
  if (!registryFieldName) {
    return res.status(400).json({ error: 'registryFieldName is required' });
  }

  const fields = fieldIds.map(id => store.fields.find(f => f.id === id)).filter(Boolean);
  if (fields.length < 2) {
    return res.status(404).json({ error: 'Could not find all fields' });
  }

  // Check none are already in a different split group
  const existing = fields.find(f => f.splitGroupId);
  if (existing) {
    return res.status(400).json({ error: '"' + existing.name + '" is already in a split group. Merge it first.' });
  }

  const sgId = generateId('sg');
  fields.forEach(f => {
    f.splitGroupId = sgId;
    f.registryFieldName = registryFieldName;
  });

  await saveData();
  res.json({
    splitGroupId: sgId,
    fields: fields.map(f => ({ id: f.id, name: f.name, acres: f.acres, crop: f.crop }))
  });
});

// --- Generic CRUD factory ---
function crudRoutes(path, collectionName, prefix, parseFields, onChange) {
  app.get(`/api/${path}`, (req, res) => {
    var items = store[collectionName];
    // Support ?organicGround=true filter for products and seeds
    if (req.query.organicGround === 'true') {
      items = items.filter(function (x) { return !!x.organicGround; });
    }
    res.json(items);
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

// ── STRAW ──────────────────────────────────────────────────────────────────
// Small-grain straw baled off after grain harvest: the work (mow / rake / bale /
// stack / haul) on one side, tons sold to a straw buyer on the other. Nets to a
// $/ac pair written onto the field budget as STRAW (income) + STRAW COST.

crudRoutes('straw-sales', 'strawSales', 'straw');
crudRoutes('straw-ops', 'strawOps', 'strawop');

// Bales made per field per year — one row each, upserted rather than CRUDed.
app.post('/api/straw-production', async (req, res) => {
  const fieldId = req.body.fieldId;
  const cropYear = parseInt(req.body.cropYear, 10) || store.settings.year;
  if (!fieldId) return res.status(400).json({ error: 'fieldId required' });
  if (!Array.isArray(store.strawProduction)) store.strawProduction = [];
  let row = store.strawProduction.find(p => p.fieldId === fieldId && p.cropYear === cropYear);
  if (!row) {
    row = { id: generateId('strawprod'), fieldId, cropYear, bales: 0, avgBaleLbs: 0, notes: '' };
    store.strawProduction.push(row);
  }
  ['bales', 'avgBaleLbs'].forEach(k => {
    if (req.body[k] !== undefined) row[k] = Number(req.body[k]) || 0;
  });
  if (req.body.notes !== undefined) row.notes = req.body.notes;
  await saveData();
  res.json(row);
});

// Cost basis for one straw op. Quantity comes from the field unless overridden.
const STRAW_BASES = ['/ac', '/bale', '/ton', 'flat'];

function strawOpQty(op, ctx) {
  if (op.qtyOverride !== undefined && op.qtyOverride !== null && op.qtyOverride !== '') {
    return Number(op.qtyOverride) || 0;
  }
  switch (op.basis) {
    case '/bale': return ctx.bales;
    case '/ton': return ctx.tonsMade;
    case 'flat': return 1;
    default: return ctx.acres;
  }
}

// ── Fertility removal ──
// Baling carries nutrients off the field that a chopped-and-spread residue would
// have left behind. Book rates in lb per ton of straw, by crop family, priced
// from the products table's own analysis and billed price. N is carried for the
// record but not costed — straw N largely immobilizes at that C:N ratio.
const STRAW_REMOVAL_DEFAULTS = [
  { crop: 'Wheat',  n: 12, p205: 4, k20: 25 },
  { crop: 'Rye',    n: 11, p205: 4, k20: 22 },
  { crop: 'Barley', n: 13, p205: 5, k20: 30 },
  { crop: 'Kernza', n: 12, p205: 4, k20: 25 },
  { crop: 'Other',  n: 12, p205: 4, k20: 25 }
];
const STRAW_COSTED_NUTRIENTS = ['p205', 'k20'];

crudRoutes('straw-removal-rates', 'strawRemovalRates', 'srate');

// Which cropTypes family a field's crop belongs to — "ORG seed wheat" → "Wheat".
function strawCropFamily(cropName) {
  const key = (cropName || '').trim().toLowerCase();
  if (!key) return 'Other';
  const cts = store.cropTypes || [];
  for (const ct of cts) {
    if ((ct.name || '').trim().toLowerCase() === key) return ct.name;
    for (const sub of (ct.subCrops || [])) {
      if ((sub.name || '').trim().toLowerCase() === key) return ct.name;
    }
  }
  return 'Other';
}

function strawRemovalRate(family) {
  const rates = store.strawRemovalRates || [];
  return rates.find(r => (r.crop || '').toLowerCase() === (family || '').toLowerCase()) ||
         rates.find(r => (r.crop || '').toLowerCase() === 'other') ||
         { crop: 'Other', n: 0, p205: 0, k20: 0 };
}

// A fertilizer's name states its own analysis — "18-46-0 DAP" is 46% P2O5. When
// the stored fraction contradicts the name, the stored value is a typo, and
// cheapest-source picking would happily price phosphorus off a product that has
// none. Suspect rows are excluded from pricing and reported instead.
const NPK_IN_NAME = /^\s*(\d{1,2})-(\d{1,2})-(\d{1,2})/;

function analysisFromName(name, key) {
  const m = NPK_IN_NAME.exec(name || '');
  if (!m) return null;
  return (key === 'p205' ? Number(m[2]) : Number(m[3])) / 100;
}

function analysisIsSuspect(product, key) {
  const expected = analysisFromName(product.name, key);
  if (expected === null) return false;
  return Math.abs(expected - (Number(product[key]) || 0)) > 0.02;
}

// An analysis is a percent by WEIGHT, so it only means something against a
// weight unit. A liquid billed by the fluid ounce can't be converted without
// its density, and reading $/oz as $/lb inflates the result 16-fold — so
// volume-priced products are left out of removal pricing entirely.
const LBS_PER_APP_UNIT = { lbs: 1, lb: 1, pound: 1, pounds: 1, ton: 2000, tons: 2000 };

function appUnitLbs(product) {
  return LBS_PER_APP_UNIT[String(product.unit || '').trim().toLowerCase()] || null;
}

// $/lb of actual nutrient: billed price ÷ conversion gives $ per application
// unit, converted to $/lb of product, divided again by the analysis fraction.
// 0-0-60 at $445/ton → $0.371/lb K2O.
function nutrientSources(key, organicOnly) {
  return (store.products || [])
    .filter(p => (Number(p[key]) || 0) > 0 && (Number(p.unitBilledPrice) || 0) > 0)
    .filter(p => (organicOnly ? !!p.organic : true))
    .filter(p => !analysisIsSuspect(p, key))
    .filter(p => appUnitLbs(p) !== null)
    .map(p => {
      const perAppUnit = (Number(p.unitBilledPrice) || 0) / (Number(p.conversionRate) || 1);
      const perLbProduct = perAppUnit / appUnitLbs(p);
      return {
        productId: p.id,
        product: p.name,
        organic: !!p.organic,
        analysis: Number(p[key]) || 0,
        placeholder: !!p.analysisPlaceholder,
        perLb: Math.round((perLbProduct / (Number(p[key]) || 1)) * 1000) / 1000
      };
    })
    // A measured analysis outranks a guessed one: cheapest wins only within a
    // tier, so a $4/ton by-product carrying placeholder numbers can't displace
    // the potash you'd actually spread.
    .sort((a, b) => (a.placeholder - b.placeholder) || (a.perLb - b.perLb));
}

// Every product whose stored analysis disagrees with its own name — the straw
// tab surfaces these so a typo shows up as a warning, not as a wrong dollar.
function suspectAnalyses() {
  const out = [];
  (store.products || []).forEach(p => {
    ['p205', 'k20'].forEach(key => {
      if (!analysisIsSuspect(p, key)) return;
      out.push({
        productId: p.id,
        product: p.name,
        nutrient: key === 'p205' ? 'P2O5' : 'K2O',
        stored: Number(p[key]) || 0,
        expected: analysisFromName(p.name, key)
      });
    });
  });
  return out;
}

// Cheapest legitimate source by default; a pinned product in settings wins.
// Organic ground has to be replaced with an approved product, so it prices
// against the organic list and only falls back when that list is empty.
function priceNutrient(key, organic) {
  const pinnedBy = (store.settings.strawRemovalSources || {})[organic ? 'org' : 'conv'] || {};
  const conventional = nutrientSources(key, false);
  if (pinnedBy[key]) {
    const hit = conventional.find(s => s.productId === pinnedBy[key]);
    if (hit) return hit;
  }
  if (!organic) return conventional[0] || null;
  const approved = nutrientSources(key, true);
  if (approved[0]) return approved[0];
  // No approved source to price against — fall back so the row still carries a
  // number, but say so: organic replacement runs well above the conventional
  // rate, so this figure understates the real cost.
  return conventional[0] ? Object.assign({}, conventional[0], { fallback: true }) : null;
}

function isOrganicField(f) {
  if ((f.systemCode || '').toUpperCase() === 'ORG') return true;
  const ent = (store.enterprises || []).find(e =>
    e.id === Calc.resolveEnterpriseId(f, store.cropTypes || [], store.enterprises));
  return /organic/i.test((ent && ent.name) || '');
}

// GET /api/straw/summary?year= — small-grain fields with straw work + sales rolled up per farm
app.get('/api/straw/summary', (req, res) => {
  const year = parseInt(req.query.year, 10) || store.settings.year;
  const refs = getRefs();
  const sgEntIds = store.enterprises
    .filter(e => /small grain/i.test(e.name || ''))
    .map(e => e.id);
  const sgFields = store.fields.filter(f =>
    sgEntIds.includes(Calc.resolveEnterpriseId(f, store.cropTypes || [], store.enterprises)));
  const inYear = row => (parseInt(row.cropYear, 10) || store.settings.year) === year;
  const sales = (store.strawSales || []).filter(inYear);
  const ops = (store.strawOps || []).filter(inYear);
  const production = (store.strawProduction || []).filter(inYear);

  const rows = sgFields.map(f => {
    const b = Calc.computeFieldBudget(f, refs, store.settings);
    const acres = b.effectiveAcres || 0;
    const fSales = sales.filter(s => s.fieldId === f.id);
    const tons = fSales.reduce((s, x) => s + (Number(x.tons) || 0), 0);
    const dollars = fSales.reduce((s, x) => s + (Number(x.tons) || 0) * (Number(x.pricePerTon) || 0), 0);

    const prod = production.find(p => p.fieldId === f.id) || null;
    const bales = prod ? (Number(prod.bales) || 0) : 0;
    const avgBaleLbs = prod ? (Number(prod.avgBaleLbs) || 0) : 0;
    // Tons made from bales when weighed; otherwise fall back to tons sold so
    // per-ton ops still cost out on farms that sold everything off the field.
    const tonsMade = bales > 0 && avgBaleLbs > 0 ? (bales * avgBaleLbs) / 2000 : tons;

    const ctx = { acres, bales, tonsMade };
    const fOps = ops.filter(o => o.fieldId === f.id).map(o => {
      const qty = strawOpQty(o, ctx);
      const cost = (Number(o.rate) || 0) * qty;
      return Object.assign({}, o, { qty: Calc.round2(qty), cost: Calc.round2(cost) });
    });
    const costTotal = fOps.reduce((s, o) => s + o.cost, 0);

    // Removal follows the bales off the field, so it costs against tons made —
    // not tons sold. Straw still stacked in the yard already left the ground.
    const organic = isOrganicField(f);
    const family = strawCropFamily(f.crop);
    const rate = strawRemovalRate(family);
    const removalLbs = {
      n: Calc.round2(tonsMade * (Number(rate.n) || 0)),
      p205: Calc.round2(tonsMade * (Number(rate.p205) || 0)),
      k20: Calc.round2(tonsMade * (Number(rate.k20) || 0))
    };
    const removalSources = {};
    let removalCost = 0;
    STRAW_COSTED_NUTRIENTS.forEach(key => {
      const src = priceNutrient(key, organic);
      removalSources[key] = src;
      if (src) removalCost += removalLbs[key] * src.perLb;
    });
    const removal = {
      family: family,
      organic: organic,
      rates: { n: Number(rate.n) || 0, p205: Number(rate.p205) || 0, k20: Number(rate.k20) || 0 },
      lbs: removalLbs,
      sources: removalSources,
      costTotal: Calc.round2(removalCost),
      costPerAcre: acres > 0 ? Calc.round2(removalCost / acres) : 0,
      costPerTon: tonsMade > 0 ? Calc.round2(removalCost / tonsMade) : 0
    };

    const aux = (f.auxPayments || []).find(a => (a.label || '').trim().toUpperCase() === 'STRAW');
    const auxCost = (f.auxPayments || []).find(a => (a.label || '').trim().toUpperCase() === 'STRAW COST');
    return {
      fieldId: f.id,
      farm: f.name,
      crop: f.crop,
      acres: Calc.round2(acres),
      bales: bales,
      avgBaleLbs: avgBaleLbs,
      tonsMade: Calc.round2(tonsMade),
      balesPerAcre: acres > 0 ? Calc.round2(bales / acres) : 0,
      saleCount: fSales.length,
      tons: Calc.round2(tons),
      tonsPerAcre: acres > 0 ? Calc.round2(tons / acres) : 0,
      avgPricePerTon: tons > 0 ? Calc.round2(dollars / tons) : 0,
      dollars: Calc.round2(dollars),
      dollarsPerAcre: acres > 0 ? Calc.round2(dollars / acres) : 0,
      opCount: fOps.length,
      costTotal: Calc.round2(costTotal),
      costPerAcre: acres > 0 ? Calc.round2(costTotal / acres) : 0,
      costPerBale: bales > 0 ? Calc.round2(costTotal / bales) : 0,
      netTotal: Calc.round2(dollars - costTotal),
      netPerAcre: acres > 0 ? Calc.round2((dollars - costTotal) / acres) : 0,
      removal: removal,
      netAfterRemovalTotal: Calc.round2(dollars - costTotal - removal.costTotal),
      netPerAcreAfterRemoval: acres > 0 ? Calc.round2((dollars - costTotal - removal.costTotal) / acres) : 0,
      ops: fOps,
      production: prod,
      budgetStrawPerAcre: aux ? (Number(aux.perAcre) || 0) : null,
      budgetStrawCostPerAcre: auxCost ? (Number(auxCost.perAcre) || 0) : null
    };
  });
  res.json({
    year: year,
    settingsYear: store.settings.year,
    bases: STRAW_BASES,
    removalRates: store.strawRemovalRates || [],
    costedNutrients: STRAW_COSTED_NUTRIENTS,
    suspectAnalyses: suspectAnalyses(),
    fields: rows,
    sales: sales,
    ops: ops,
    production: production
  });
});

// POST /api/straw/apply/:fieldId — write straw income and cost onto the field as
// two aux payment lines: STRAW (+$/ac gross) and STRAW COST (−$/ac).
app.post('/api/straw/apply/:fieldId', async (req, res) => {
  const f = store.fields.find(x => x.id === req.params.fieldId);
  if (!f) return res.status(404).json({ error: 'Field not found' });
  const perAcre = Number(req.body.perAcre);
  if (!isFinite(perAcre) || perAcre < 0) return res.status(400).json({ error: 'perAcre required' });
  const costPerAcre = Number(req.body.costPerAcre) || 0;
  if (costPerAcre < 0) return res.status(400).json({ error: 'costPerAcre must be positive' });
  if (!Array.isArray(f.auxPayments)) f.auxPayments = [];

  const upsert = (label, value) => {
    const existing = f.auxPayments.find(a => (a.label || '').trim().toUpperCase() === label);
    if (value === 0) {
      // Don't leave a zero line lying around in the budget.
      if (existing) f.auxPayments.splice(f.auxPayments.indexOf(existing), 1);
      return;
    }
    if (existing) existing.perAcre = value;
    else f.auxPayments.push({ label: label, perAcre: value });
  };
  upsert('STRAW', Calc.round2(perAcre));
  upsert('STRAW COST', Calc.round2(-Math.abs(costPerAcre)));

  await saveData();
  res.json({ ok: true, fieldId: f.id, perAcre: perAcre, costPerAcre: costPerAcre });
});

// Rent — removed (managed in Farm Registry app)
// Data retained in store.rent for backward compat

// --- Bulk sync acres & rent from Farm Registry ---
const REGISTRY_URL = process.env.FARM_REGISTRY_URL || 'http://localhost:3005';
const REGISTRY_TOKEN = process.env.EMBED_TOKEN || '';
function registryUrl(path) {
  var sep = path.indexOf('?') === -1 ? '?' : '&';
  return REGISTRY_URL + path + (REGISTRY_TOKEN ? sep + 'token=' + encodeURIComponent(REGISTRY_TOKEN) : '');
}

// --- Archived seasons (MACRO #YEAR flipping) ---
// scripts/rollover-season.js writes data/seasons/<year>.json at rollover;
// these serve them read-only for the sidebar season switcher + season.html.
const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

app.get('/api/seasons', (req, res) => {
  let archived = [];
  try {
    archived = fs.readdirSync(SEASONS_DIR)
      .filter(f => /^\d{4}\.json$/.test(f))
      .map(f => parseInt(f.slice(0, 4), 10));
  } catch (e) { /* no seasons dir yet */ }
  const current = (store.settings && store.settings.year) || new Date().getFullYear();
  const seasons = [{ year: current, current: true }]
    .concat(archived.filter(y => y !== current).map(y => ({ year: y, current: false })))
    .sort((a, b) => b.year - a.year);
  res.json(seasons);
});

app.get('/api/season-data/:year', (req, res) => {
  const year = String(req.params.year);
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Bad year' });
  if (store.settings && String(store.settings.year) === year) {
    return res.status(400).json({ error: 'That is the live season — use the live APIs' });
  }
  const file = path.join(SEASONS_DIR, year + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No archive for ' + year });
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(file);
});

// Field boundary shapes for dashboard thumbnails — registry geometry keyed by
// registryFieldId, 5-min cache (registry is the boundary source of truth).
const fieldShapesCache = { data: null, ts: 0 };
app.get('/api/field-shapes', async (req, res) => {
  try {
    if (fieldShapesCache.data && Date.now() - fieldShapesCache.ts < 5 * 60 * 1000) {
      return res.json(fieldShapesCache.data);
    }
    const resp = await fetch(registryUrl('/api/fields?active=true'));
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();
    const shapes = {};
    regFields.forEach(rf => { if (rf.geometry) shapes[rf.id] = rf.geometry; });
    fieldShapesCache.data = shapes;
    fieldShapesCache.ts = Date.now();
    res.json(shapes);
  } catch (err) {
    res.json({});
  }
});

app.post('/api/fields/sync-registry', async (req, res) => {
  try {
    const resp = await fetch(registryUrl('/api/fields?active=true'));
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();

    // Build lookup: lowercased name/alias → registry field
    const regLookup = {};
    // Build ID lookup: registryFieldId → registry field (canonical — no name ambiguity)
    const regById = {};
    regFields.forEach(rf => {
      regLookup[rf.name.toLowerCase()] = rf;
      (rf.aliases || []).forEach(a => { regLookup[a.toLowerCase()] = rf; });
      regById[rf.id] = rf;
    });

    // Match a budget field to its registry entry.
    // Returns { rf, exact } where exact=true means name/ID matched exactly
    // (safe to sync acres), exact=false means prefix match only (rent-only sync —
    // sub-parcels like "OMNI BIG SOUTH" within "Omni" keep their own acreage).
    function findRegMatch(fieldName, registryFieldId, registryFieldName) {
      if (registryFieldId) return { rf: regById[registryFieldId] || null, exact: true };
      const fl = (fieldName || '').toLowerCase();
      const frn = (registryFieldName || '').toLowerCase();
      const exact = regLookup[fl] || (frn && regLookup[frn]);
      if (exact) return { rf: exact, exact: true };
      const prefix = regFields.find(rf => {
        const keys = [rf.name.toLowerCase(), ...(rf.aliases || []).map(a => a.toLowerCase())];
        return keys.some(k =>
          fl === k || fl.startsWith(k + ' ') ||
          (frn && (frn === k || frn.startsWith(k + ' ')))
        );
      });
      return { rf: prefix || null, exact: false };
    }

    const results = { synced: [], unmatched: [], unchanged: [], splitWarnings: [] };
    let changed = false;

    store.fields.forEach(field => {
      const { rf: match, exact: exactMatch } = findRegMatch(field.name, field.registryFieldId, field.registryFieldName);
      if (!match) {
        results.unmatched.push(field.name);
        return;
      }
      // Store registryFieldId so future syncs use the canonical ID path
      if (!field.registryFieldId && match.id) {
        field.registryFieldId = match.id;
        changed = true;
      }

      let fieldChanged = false;
      const isSplit = !!field.splitGroupId;

      // Sync acres — only when caller explicitly requests it (acresSync=true).
      // The background auto-sync (fired on every enterprise tab open) skips acres so
      // manually-set planted/budget acres are not silently overwritten. The "Sync from
      // Registry" button in the field editor passes acresSync=true for a full sync.
      // Prefix-matched sub-parcels (e.g. "OMNI BIG SOUTH" inside "Omni") are always skipped.
      const syncAcres = req.body.acresSync === true;
      if (syncAcres && !isSplit && exactMatch && Math.abs((field.acres || 0) - match.reportingAcres) > 0.001) {
        field.acres = match.reportingAcres;
        fieldChanged = true;
      }

      // Sync rent rate using stable registry-based denominator.
      // baseRate = totalRentDollars / reportingAcres — store the FULL farm rate.
      // calc.js applies cropTypeMultiplier (0.5 for DBL CROP, weighted for base
      // crops with dblSharedAcres) so we must NOT pre-divide here.
      // Farms opted into rentBasis 'farmed' spread the lump over this year's
      // farmed acres instead, so the full lump lands in the crop budgets even
      // when part of the farm sits idle.
      // Skip for split sub-fields: their acres are handled in the split-group pass below.
      if (!isSplit && match.totalRentDollars > 0) {
        let rentDenom = match.reportingAcres;
        const group = farmGroupFields(field);
        if (groupRentBasis(group) === 'farmed') {
          const fa = farmedAcres(group);
          if (fa > 0) rentDenom = fa;
        }
        const baseRate = match.totalRentDollars / rentDenom;
        var rate = Math.round(baseRate * 100) / 100;
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

    // Build split groups for rent allocation and validation
    const splitGroups = {};
    store.fields.forEach(f => {
      if (!f.splitGroupId) return;
      if (!splitGroups[f.splitGroupId]) splitGroups[f.splitGroupId] = { fields: [], registryFieldName: f.registryFieldName, registryFieldId: f.registryFieldId };
      splitGroups[f.splitGroupId].fields.push(f);
    });
    Object.keys(splitGroups).forEach(sgId => {
      const group = splitGroups[sgId];
      const { rf: regMatch } = findRegMatch(null, group.registryFieldId, group.registryFieldName);
      if (!regMatch) return;
      const allocatedAcres = group.fields.reduce((sum, f) => sum + (f.acres || 0), 0);

      // Sync rent rate for split sub-fields: prorate totalRentDollars across the
      // total acres allocated within this split group. This ensures the group's
      // combined rent equals the gross rent proportional to split acres.
      if (regMatch.totalRentDollars > 0 && allocatedAcres > 0) {
        var rate = Math.round((regMatch.totalRentDollars / allocatedAcres) * 100) / 100;
        group.fields.forEach(f => {
          if (Math.abs((f.rentPerAcre || 0) - rate) > 0.001) {
            f.rentPerAcre = rate;
            changed = true;
          }
        });
      }

      // Warn if allocated acres don't match registry
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

// --- Prorated rent rate lookup ---
// Returns the correct $/ac rent rate for a registry farm, using total budget crop acres
// (not registry reportingAcres) as the denominator. Called from the field editor so the
// rent hint and saved rate are always consistent with the server-side sync.
// Query params: registryFieldId (preferred) OR name (fallback fuzzy match)
// Optional: excludeFieldId — exclude this field's acres from the denominator (for editing
//   an existing field whose acres may change before save; avoids double-counting).
app.get('/api/fields/rent-rate', async (req, res) => {
  try {
    const { registryFieldId, name } = req.query;
    if (!registryFieldId && !name) {
      return res.status(400).json({ error: 'registryFieldId or name required' });
    }

    // Fetch registry to get totalRentDollars and reportingAcres
    const resp = await fetch(registryUrl('/api/fields?active=true'));
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();

    // Find the registry match
    let regField = null;
    if (registryFieldId) {
      regField = regFields.find(rf => rf.id === registryFieldId);
    }
    if (!regField && name) {
      const lname = name.toLowerCase();
      regField = regFields.find(rf =>
        rf.name.toLowerCase() === lname ||
        (rf.aliases || []).some(a => a.toLowerCase() === lname)
      );
      if (!regField) {
        regField = regFields.find(rf =>
          lname.startsWith(rf.name.toLowerCase()) ||
          (rf.aliases || []).some(a => lname.startsWith(a.toLowerCase()))
        );
      }
    }

    if (!regField) {
      return res.json({ found: false });
    }

    if (!regField.totalRentDollars || regField.totalRentDollars <= 0) {
      return res.json({ found: true, registryFieldId: regField.id, registryFieldName: regField.name, totalRentDollars: 0, rentPerAcre: 0 });
    }

    // Base rate = totalRentDollars / denominator (stable — not affected by enterprise entries).
    // Denominator is registry reportingAcres, or this year's farmed acres when the
    // farm group opted into rentBasis 'farmed' (full lump recovery).
    // Always return the FULL base rate: field.rentPerAcre stores the full farm rate and
    // calc.js applies the DBL CROP 0.5× multiplier at budget time (see bulk-sync above).
    // Pre-dividing here would stack with calc.js and quarter the rent.
    const lnameReg = regField.name.toLowerCase();
    const regAliases = (regField.aliases || []).map(a => a.toLowerCase());
    const group = store.fields.filter(f => {
      if (f.registryFieldId) return f.registryFieldId === regField.id;
      const fn = (f.name || '').trim().toLowerCase();
      return fn === lnameReg || fn.startsWith(lnameReg) ||
        regAliases.some(a => fn === a || fn.startsWith(a));
    });
    const basis = groupRentBasis(group);
    const groupFarmedAcres = Math.round(farmedAcres(group) * 100) / 100;
    let rentDenom = regField.reportingAcres;
    if (basis === 'farmed' && groupFarmedAcres > 0) rentDenom = groupFarmedAcres;
    const baseRate = regField.totalRentDollars / rentDenom;
    const rentPerAcre = Math.round(baseRate * 100) / 100;

    res.json({
      found: true,
      registryFieldId: regField.id,
      registryFieldName: regField.name,
      totalRentDollars: regField.totalRentDollars,
      registryReportingAcres: regField.reportingAcres,
      rentBasis: basis,
      farmedAcres: groupFarmedAcres,
      denominatorAcres: Math.round(rentDenom * 100) / 100,
      baseRatePerAcre: rentPerAcre,
      rentPerAcre: rentPerAcre
    });
  } catch (err) {
    res.status(502).json({ error: 'Rent rate lookup failed: ' + err.message });
  }
});

// --- Proxy: registry crop list (avoids CORS when called from browser) ---
// Cached 60s in-memory to avoid hammering farm-registry on every page load
let _registryCropsCache = null;
let _registryCropsCacheExpiry = 0;
app.get('/api/registry/crops', async (req, res) => {
  try {
    const now = Date.now();
    if (!_registryCropsCache || now > _registryCropsCacheExpiry) {
      const resp = await fetch(registryUrl('/api/crops'));
      if (!resp.ok) throw new Error('Registry returned ' + resp.status);
      _registryCropsCache = await resp.json();
      _registryCropsCacheExpiry = now + 60 * 1000; // 60s cache
    }
    res.json(_registryCropsCache);
  } catch (err) {
    res.status(502).json({ error: 'Registry crops unavailable: ' + err.message });
  }
});

// --- Proxy: search registry fields (avoids CORS when called from browser) ---
app.get('/api/registry/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const resp = await fetch(registryUrl('/api/fields/search?q=' + encodeURIComponent(q)));
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    res.json(await resp.json());
  } catch (err) {
    res.status(502).json({ error: 'Registry search failed: ' + err.message });
  }
});

// --- Acre Reconciliation ---
app.get('/api/dashboard/reconciliation', async (req, res) => {
  try {
    const resp = await fetch(registryUrl('/api/fields?active=true'));
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
    const reconRefs = getRefs();

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

      // Physical acres: split sub-fields sum (they divide the land); non-split entries
      // may be double-cropped (same land, different crops) so take the max of those.
      const splitFields    = budgetFields.filter(f => !!f.splitGroupId);
      const nonSplitFields = budgetFields.filter(f => !f.splitGroupId);
      const nonSplitAcres  = nonSplitFields.length ? Math.max(...nonSplitFields.map(f => f.acres || 0)) : 0;
      const splitAcres     = splitFields.reduce((sum, f) => sum + (f.acres || 0), 0);
      var budgetAcres = nonSplitAcres + splitAcres;

      var delta = Math.round((budgetAcres - rf.reportingAcres) * 100) / 100;
      var status = budgetFields.length === 0 ? 'missing' :
                   Math.abs(delta) < 0.02 ? 'matched' :
                   delta < 0 ? 'under' : 'over';
      if (status === 'matched') matched++;

      // Rent reconciliation: lump owed for the farm vs rent allocated into crop
      // budgets (calc applies double-crop sharing, so this surfaces both idle-acre
      // under-recovery and unmatched double-crop acres).
      var rentLump = rf.totalRentDollars || 0;
      var rentAllocated = 0;
      budgetFields.forEach(f => {
        rentAllocated += Calc.computeFieldBudget(f, reconRefs, store.settings).rentTotal || 0;
      });
      rentAllocated = Math.round(rentAllocated * 100) / 100;

      rows.push({
        registryField: rf.name,
        registryAcres: rf.reportingAcres,
        budgetAcres: budgetAcres,
        delta: delta,
        status: status,
        cropCount: nonSplitFields.length,
        rentLump: rentLump,
        rentAllocated: rentAllocated,
        rentDelta: Math.round((rentAllocated - rentLump) * 100) / 100,
        rentBasis: groupRentBasis(budgetFields),
        subFields: budgetFields.map(f => ({ name: f.name, crop: f.crop || '', acres: f.acres, splitGroupId: f.splitGroupId }))
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

// --- Overhead pools (QuickBooks-fed, allocated by driver) ---
// Pool: { id, name, driver, annualDollars, sourceYear, note }
crudRoutes('overhead-pools', 'overheadPools', 'ohp');
// Account map: { id, account, destination } — destination is a pool id or one
// of 'direct' (already a field line), 'fieldops' (calibrates implements),
// 'exclude', 'unmapped'.
crudRoutes('gl-account-map', 'glAccountMap', 'gla');

// Farm-wide driver totals, $/unit per pool, and the budget's current stack so
// the QuickBooks total can be reconciled against it.
app.get('/api/overhead-rates', (req, res) => {
  const refs = getRefs();
  const stack = { overhead: 0, machinery: 0, labor: 0, fuel: 0, acres: 0, flatOverhead: 0 };
  const flatRefs = Object.assign({}, refs, { overheadRates: null });
  store.fields.forEach(f => {
    const b = Calc.computeFieldBudget(f, refs, store.settings);
    stack.overhead += b.overheadTotal;
    stack.machinery += b.machineryTotal;
    stack.labor += b.laborTotal;
    stack.fuel += b.fuelTotal;
    stack.acres += b.effectiveAcres;
    stack.flatOverhead += Calc.computeFieldBudget(f, flatRefs, store.settings).overheadTotal;
  });
  Object.keys(stack).forEach(k => { stack[k] = Calc.round2(stack[k]); });
  res.json(Object.assign({}, refs.overheadRates, {
    drivers: Calc.OVERHEAD_DRIVERS,
    useOverheadPools: store.settings.useOverheadPools !== false,
    budgetStack: stack
  }));
});

// --- QuickBooks P&L import ---
// plImports: [{ year, importedAt, rows: [{ account, amount }] }]
app.get('/api/pl-import', (req, res) => {
  res.json(store.plImports || []);
});

app.post('/api/pl-import', async (req, res) => {
  const year = parseInt(req.body.year, 10);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!year || !rows.length) return res.status(400).json({ error: 'year and rows required' });
  const clean = rows
    .map(r => ({ account: String(r.account || '').trim(), amount: Math.round((parseFloat(r.amount) || 0) * 100) / 100 }))
    .filter(r => r.account);
  store.plImports = (store.plImports || []).filter(p => p.year !== year);
  store.plImports.push({ year, importedAt: new Date().toISOString(), rows: clean });
  store.plImports.sort((a, b) => a.year - b.year);
  // Every account gets a map row once; existing decisions are kept.
  store.glAccountMap = store.glAccountMap || [];
  const known = {};
  store.glAccountMap.forEach(m => { known[m.account.toLowerCase()] = true; });
  let added = 0;
  clean.forEach(r => {
    const k = r.account.toLowerCase();
    if (!known[k]) {
      store.glAccountMap.push({ id: generateId('gla'), account: r.account, destination: 'unmapped' });
      known[k] = true;
      added++;
    }
  });
  await saveData();
  res.json({ ok: true, year, rows: clean.length, newAccounts: added });
});

// Set each pool's annual dollars to the sum of its mapped accounts for a year.
app.post('/api/overhead-pools/apply-import', async (req, res) => {
  const year = parseInt(req.body.year, 10);
  const imp = (store.plImports || []).find(p => p.year === year);
  if (!imp) return res.status(404).json({ error: 'No import for ' + year });
  const byAccount = {};
  imp.rows.forEach(r => { byAccount[r.account.toLowerCase()] = (byAccount[r.account.toLowerCase()] || 0) + r.amount; });
  const sums = {};
  (store.glAccountMap || []).forEach(m => {
    const amt = byAccount[m.account.toLowerCase()];
    if (amt === undefined) return;
    sums[m.destination] = (sums[m.destination] || 0) + amt;
  });
  const applied = [];
  (store.overheadPools || []).forEach(p => {
    if (sums[p.id] !== undefined) {
      p.annualDollars = Calc.round2(sums[p.id]);
      p.sourceYear = year;
      applied.push({ id: p.id, name: p.name, annualDollars: p.annualDollars });
    }
  });
  await saveData();
  res.json({ ok: true, year, applied, sums });
});

// Sales
crudRoutes('sales', 'sales', 'sale');

// Buyers — basis affects pricing
crudRoutes('buyers', 'buyers', 'buy', null, clearPricingCache);

// Suppliers
crudRoutes('suppliers', 'suppliers', 'sup');

// Input quotes — dated vendor bids per product; record-only, never syncs to unitBilledPrice
crudRoutes('input-quotes', 'inputQuotes', 'iq');

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
// sections: array of 'inputs' | 'machinery' | 'seed' | 'yield' | 'crop' (default: all)
app.post('/api/programs/:id/apply-bulk', async (req, res) => {
  const prog = store.programs.find(p => p.id === req.params.id);
  if (!prog) return res.status(404).json({ error: 'Program not found' });
  const fieldIds = req.body.fieldIds || [];
  const allSections = ['inputs', 'machinery', 'seed', 'yield', 'crop'];
  const sections = Array.isArray(req.body.sections) && req.body.sections.length
    ? req.body.sections.filter(s => allSections.includes(s))
    : allSections;

  const sectionKeys = {
    inputs:   ['inputs'],
    machinery:['machinery'],
    seed:     ['seed', 'seeds'],
    yield:    ['yieldPerAcre', 'yieldUnit', 'harvestMoisture', 'cropInsurancePerAcre'],
    crop:     ['crop', 'cropType', 'systemCode', 'buyerId']
  };

  var updated = 0;
  fieldIds.forEach(fid => {
    const idx = store.fields.findIndex(f => f.id === fid);
    if (idx === -1) return;
    sections.forEach(sec => {
      (sectionKeys[sec] || []).forEach(k => {
        if (prog[k] !== undefined) {
          store.fields[idx][k] = JSON.parse(JSON.stringify(prog[k]));
        }
      });
    });
    if (sections.includes('inputs')) {
      (store.fields[idx].inputs || []).forEach(inp => { inp.id = generateId('inp'); });
      store.fields[idx].templateId = prog.id;
    }
    if (sections.includes('machinery')) {
      (store.fields[idx].machinery || []).forEach(m => { m.id = generateId('mach'); });
    }
    updated++;
  });

  await saveData();
  res.json({ updated: updated });
});

// Push machinery program to selected fields — machinery only, inputs/seed/yield untouched
app.post('/api/machinery-programs/:id/push', async (req, res) => {
  const prog = store.machineryPrograms.find(p => p.id === req.params.id);
  if (!prog) return res.status(404).json({ error: 'Machinery program not found' });
  const fieldIds = req.body.fieldIds || [];
  var updated = 0;
  fieldIds.forEach(fid => {
    const idx = store.fields.findIndex(f => f.id === fid);
    if (idx === -1) return;
    store.fields[idx].machinery = JSON.parse(JSON.stringify(prog.machinery || []));
    store.fields[idx].machinery.forEach(m => { m.id = generateId('mach'); });
    store.fields[idx].machineryProgramId = prog.id;
    updated++;
  });
  await saveData();
  res.json({ updated });
});

// Batch variety swap — seeds only, inputs/machinery/yield left untouched
app.post('/api/fields/batch-variety', async (req, res) => {
  const { fieldIds, variety, population } = req.body;
  if (!Array.isArray(fieldIds) || !fieldIds.length) return res.status(400).json({ error: 'fieldIds required' });
  if (!variety) return res.status(400).json({ error: 'variety required' });
  var updated = 0;
  fieldIds.forEach(fid => {
    const idx = store.fields.findIndex(f => f.id === fid);
    if (idx === -1) return;
    const field = store.fields[idx];
    const acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    // Keep existing population if caller sends 0 or omits it
    const existingPop = (field.seeds && field.seeds[0] ? field.seeds[0].population : null) ||
                        (field.seed ? field.seed.population : null) || 0;
    const pop = (population && population > 0) ? population : existingPop;
    field.seeds = [{ variety: variety, population: pop, acres: acres }];
    field.seed  = { variety: variety, population: pop };
    updated++;
  });
  await saveData();
  res.json({ updated: updated });
});

// Batch enterprise reassignment — move all fields using a given crop to a new enterprise
app.post('/api/fields/batch-enterprise', async (req, res) => {
  const { cropName, enterpriseId } = req.body;
  if (!cropName) return res.status(400).json({ error: 'cropName required' });
  var updated = 0;
  store.fields.forEach(function (f) {
    if (f.crop === cropName) {
      f.enterpriseId = enterpriseId || null;
      updated++;
    }
  });
  if (updated > 0) await saveData();
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

// Machinery Programs
crudRoutes('machinery-programs', 'machineryPrograms', 'mplan');

// Quick Plan Config — maps (crop, variant, tillage) → (inputProgramId, machineryProgramId)
crudRoutes('quick-plan-config', 'quickPlanConfig', 'qpc');

// --- Forecast: aggregate field inputs + seeds into procurement view ---
app.get('/api/forecast', async function (req, res) {
  res.set('Cache-Control', 'no-store');

  var productMap = {};
  var productIndex = {};
  (store.products || []).forEach(function (p) {
    productIndex[(p.name || '').trim().toLowerCase()] = p;
  });

  // Build enterprise lookup maps
  var entCatMap = {};
  var entNameMap = {};
  (store.enterprises || []).forEach(function (e) {
    entCatMap[e.id] = e.category || 'conventional';
    entNameMap[e.id] = e.shortName || e.name || '';
  });

  // Aggregate field inputs
  (store.fields || []).forEach(function (field) {
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    var entCat = entCatMap[field.enterpriseId] || 'conventional';
    (field.inputs || []).forEach(function (inp) {
      if (!inp.productName) return;
      var key = inp.productName.trim().toLowerCase();
      var product = productIndex[key];
      var mapKey = inp.productName; // preserve original casing as map key
      if (!productMap[mapKey]) {
        productMap[mapKey] = {
          productName: inp.productName,
          budgetProductId: product ? product.id : '',
          budgetProductType: 'product',
          supplierId: product ? (product.supplierId || '') : '',
          unit: product ? (product.unit || '') : '',
          purchaseUnit: product ? (product.purchaseUnit || product.unit || '') : '',
          conversionRate: product ? (product.conversionRate || 1) : 1,
          unitCost: product ? Calc.computeApplicationPrice(product) : 0,
          category: product ? (product.category || 'Other') : 'Other',
          organicGround: product ? !!product.organicGround : false,
          totalQty: 0, convQty: 0, orgQty: 0,
          fields: []
        };
      }
      var fieldQty = (inp.quantity || 0) * acres;
      var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
      productMap[mapKey].totalQty += fieldQty;
      if (entCat === 'organic') productMap[mapKey].orgQty += fieldQty;
      else productMap[mapKey].convQty += fieldQty;
      productMap[mapKey].fields.push({
        fieldName: field.name,
        enterprise: entNameMap[field.enterpriseId] || '',
        acres: acres,
        qty: fieldQty,
        rate: inp.quantity || 0,
        cost: Math.round(fieldQty * appPrice * 100) / 100,
        season: inp.season || ''
      });
    });
  });

  // Aggregate seed varieties from fields
  var seedIndex = {};
  (store.seeds || []).forEach(function (s) {
    seedIndex[(s.variety || '').trim().toLowerCase()] = s;
  });
  (store.fields || []).forEach(function (field) {
    var fieldSeeds = field.seeds && field.seeds.length > 0 ? field.seeds : (field.seed ? [field.seed] : []);
    if (!fieldSeeds.length) return;
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    var seedEntCat = entCatMap[field.enterpriseId] || 'conventional';
    fieldSeeds.forEach(function (fs) {
      if (!fs.variety) return;
      var s = seedIndex[fs.variety.trim().toLowerCase()];
      var pop = fs.population || 0;
      var seedsPerUnit = s ? (s.seedsPerUnit || 1) : 1;
      var qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0;
      var mapKey = 'seed:' + fs.variety;
      if (!productMap[mapKey]) {
        productMap[mapKey] = {
          productName: fs.variety,
          budgetProductId: s ? s.id : '',
          budgetProductType: 'seed',
          supplierId: s ? (s.supplierId || '') : '',
          unit: 'units',
          unitCost: s ? (s.pricePerUnit || 0) : 0,
          category: 'Seed',
          isSeedVariety: true,
          organicGround: s ? !!s.organicGround : false,
          totalQty: 0, convQty: 0, orgQty: 0,
          fields: []
        };
      }
      productMap[mapKey].totalQty += qty;
      if (seedEntCat === 'organic') productMap[mapKey].orgQty += qty;
      else productMap[mapKey].convQty += qty;
      productMap[mapKey].fields.push({
        fieldName: field.name,
        enterprise: entNameMap[field.enterpriseId] || '',
        acres: acres,
        qty: qty,
        rate: pop,
        cost: Math.round(qty * (s ? (s.pricePerUnit || 0) : 0) * 100) / 100,
        season: 'Spring'
      });
    });
  });

  // Pull ordered/delivered quantities from seed-inventory (single source of truth for procurement)
  var orderedMap = {};
  var deliveredMap = {};
  var orderedById = {};
  var deliveredById = {};
  try {
    var siCropYear = (store.settings && store.settings.cropYear) ? store.settings.cropYear : 2026;
    var siResp = await fetch(seedInventoryUrl('/api/reconciliation?cropYear=' + siCropYear));
    if (siResp.ok) {
      var recon = await siResp.json();
      recon.forEach(function (row) {
        // ID-first: rows linked to a farm-budget product match exactly
        if (row.budgetProductId) {
          orderedById[row.budgetProductId] = (orderedById[row.budgetProductId] || 0) + (row.totalOrdered || 0);
          deliveredById[row.budgetProductId] = (deliveredById[row.budgetProductId] || 0) + (row.totalDelivered || 0);
        }
        // Name fallback for unlinked rows — normalize to lowercase so casing differences don't break matching
        var key = (row.type === 'SEED' ? row.variety : row.productName);
        if (!key) return;
        key = key.trim().toLowerCase();
        orderedMap[key] = (orderedMap[key] || 0) + (row.totalOrdered || 0);
        deliveredMap[key] = (deliveredMap[key] || 0) + (row.totalDelivered || 0);
      });
      recordSiSync(true, null);
    } else {
      recordSiSync(false, 'seed-inventory returned ' + siResp.status);
    }
  } catch (e) {
    // seed-inventory unavailable — procurement columns will show 0
    recordSiSync(false, e.message);
  }

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
    var nameKey = (row.productName || '').trim().toLowerCase();
    var ordered = (row.budgetProductId && orderedById[row.budgetProductId] !== undefined)
      ? orderedById[row.budgetProductId] : (orderedMap[nameKey] || 0);
    var delivered = (row.budgetProductId && deliveredById[row.budgetProductId] !== undefined)
      ? deliveredById[row.budgetProductId] : (deliveredMap[nameKey] || 0);
    // Convert forecast to billed (purchase) units so forecast/ordered/delivered all match
    var conv = row.conversionRate || 1;
    var billedQty = row.isSeedVariety ? row.totalQty : Math.ceil(row.totalQty / conv * 100) / 100;
    var billedUnit = row.isSeedVariety ? (row.unit || 'units') : (row.purchaseUnit || row.unit || '');
    var totalCost = Math.round(row.totalQty * (row.unitCost || 0) * 100) / 100;
    var cq = row.convQty || 0, oq = row.orgQty || 0;
    var splitType = cq > 0 && oq > 0 ? 'split' : (oq > 0 ? 'organic' : 'conventional');
    var convCost = row.totalQty > 0 ? Math.round(totalCost * cq / row.totalQty * 100) / 100 : 0;
    var orgCost  = row.totalQty > 0 ? Math.round(totalCost * oq / row.totalQty * 100) / 100 : 0;
    grouped[cat].push(Object.assign({}, row, {
      supplierName: supplierMap[row.supplierId] || '',
      totalCost: totalCost,
      convCost: convCost,
      orgCost: orgCost,
      splitType: splitType,
      billedQty: billedQty,
      billedUnit: billedUnit,
      orderedQty: ordered,
      deliveredQty: delivered,
      remaining: billedQty - ordered,
      pctOrdered: billedQty > 0 ? Math.round(ordered / billedQty * 100) : 0
    }));
  });

  var categories = categoryOrder
    .filter(function (cat) { return grouped[cat]; })
    .map(function (cat) { return { name: cat, products: grouped[cat] }; });

  res.json({ categories: categories });
});

// --- Organic Ground Forecast ---
// Returns forecast data filtered to products/seeds designated for certified organic ground
app.get('/api/forecast/organic-ground', function (req, res) {
  res.set('Cache-Control', 'no-store');

  // Build indexes of organic-ground products and seeds
  var productIndex = {};
  (store.products || []).forEach(function (p) {
    if (p.organicGround) {
      productIndex[(p.name || '').trim().toLowerCase()] = p;
    }
  });

  var seedIndex = {};
  (store.seeds || []).forEach(function (s) {
    if (s.organicGround) {
      seedIndex[(s.variety || '').trim().toLowerCase()] = s;
    }
  });

  // Aggregate field inputs — only organic-ground products
  var inputs = [];
  var inputMap = {};
  (store.fields || []).forEach(function (field) {
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    (field.inputs || []).forEach(function (inp) {
      if (!inp.productName) return;
      var key = inp.productName.trim().toLowerCase();
      if (!productIndex[key]) return; // skip non-organic-ground
      var product = productIndex[key];
      if (!inputMap[key]) {
        inputMap[key] = {
          productId: product.id,
          productName: inp.productName,
          unit: product.unit || '',
          category: product.category || 'Other',
          totalQty: 0,
          fields: []
        };
        inputs.push(inputMap[key]);
      }
      var fieldQty = (inp.quantity || 0) * acres;
      inputMap[key].totalQty += fieldQty;
      inputMap[key].fields.push({ fieldName: field.name, acres: acres, qty: fieldQty, rate: inp.quantity || 0 });
    });
  });

  // Also check program-level inputs
  (store.programs || []).forEach(function (prog) {
    if (!prog.inputs || prog.inputs.length === 0) return;
    var matchingFields = (store.fields || []).filter(function (f) {
      return f.systemCode === prog.systemCode && f.crop === prog.crop;
    });
    if (matchingFields.length === 0) return;
    prog.inputs.forEach(function (progInput) {
      if (!progInput.productName) return;
      var key = progInput.productName.trim().toLowerCase();
      if (!productIndex[key]) return;
      var product = productIndex[key];
      matchingFields.forEach(function (field) {
        var alreadyOnField = (field.inputs || []).some(function (fi) {
          return (fi.productName || '').trim().toLowerCase() === key;
        });
        if (alreadyOnField) return;
        var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
        if (!inputMap[key]) {
          inputMap[key] = {
            productId: product.id,
            productName: progInput.productName,
            unit: product.unit || '',
            category: product.category || 'Other',
            totalQty: 0,
            fields: []
          };
          inputs.push(inputMap[key]);
        }
        var fieldQty = (progInput.quantity || 0) * acres;
        inputMap[key].totalQty += fieldQty;
        inputMap[key].fields.push({ fieldName: field.name, acres: acres, qty: fieldQty, rate: progInput.quantity || 0 });
      });
    });
  });

  // Aggregate seed varieties — only organic-ground seeds
  var seeds = [];
  var seedMap = {};
  (store.fields || []).forEach(function (field) {
    var fieldSeeds = field.seeds && field.seeds.length > 0 ? field.seeds : (field.seed ? [field.seed] : []);
    if (!fieldSeeds.length) return;
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    fieldSeeds.forEach(function (fs) {
      if (!fs.variety) return;
      var vKey = fs.variety.trim().toLowerCase();
      if (!seedIndex[vKey]) return; // skip non-organic-ground
      var s = seedIndex[vKey];
      var pop = fs.population || 0;
      var seedsPerUnit = s.seedsPerUnit || 1;
      var qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0;
      if (!seedMap[vKey]) {
        seedMap[vKey] = {
          seedId: s.id,
          crop: s.crop,
          brand: s.brand || '',
          variety: s.variety,
          totalQty: 0,
          fields: []
        };
        seeds.push(seedMap[vKey]);
      }
      seedMap[vKey].totalQty += qty;
      seedMap[vKey].fields.push({ fieldName: field.name, acres: acres, qty: qty });
    });
  });

  res.json({ inputs: inputs, seeds: seeds });
});

// --- Product Demand Table for Receiving Manager ---
// Combines forecast data with order/delivery status for receiving area use
app.get('/api/demand', async function (req, res) {
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
    var fieldSeeds = field.seeds && field.seeds.length > 0 ? field.seeds : (field.seed ? [field.seed] : []);
    if (!fieldSeeds.length) return;
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    fieldSeeds.forEach(function (fs) {
      if (!fs.variety) return;
      var key = fs.variety.trim().toLowerCase();
      var s = seedIndex[key];
      var pop = fs.population || 0;
      var seedsPerUnit = s ? (s.seedsPerUnit || 1) : 1;
      var qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0;
      if (!seedAgg[key]) seedAgg[key] = { name: fs.variety, totalQty: 0 };
      seedAgg[key].totalQty += qty;
    });
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

  // Pull ordered/delivered from seed-inventory (single source of truth for procurement)
  var orderedMap = {};
  var deliveredMap = {};
  var deliveryWindowMap = {};
  try {
    var siResp = await fetch(seedInventoryUrl('/api/reconciliation'));
    if (siResp.ok) {
      var recon = await siResp.json();
      recon.forEach(function (row) {
        var key = row.type === 'SEED'
          ? (row.variety + (row.crop ? ' (' + row.crop + ')' : ''))
          : row.productName;
        if (!key) return;
        orderedMap[key] = (orderedMap[key] || 0) + (row.totalOrdered || 0);
        deliveredMap[key] = (deliveredMap[key] || 0) + (row.totalDelivered || 0);
      });
      recordSiSync(true, null);
    } else {
      recordSiSync(false, 'seed-inventory returned ' + siResp.status);
    }
  } catch (e) {
    // seed-inventory unavailable — procurement columns will show 0
    recordSiSync(false, e.message);
  }

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

// ── Marketing price snapshot ────────────────────────────────────────────────
// The browser (owner session inside the portal) reads the pooled rollup from
// /marketing/position/data and saves a per-crop snapshot here. calc.js prices
// futures-tier crops from it (see resolveCropPricing). Server-side dashboards
// read the saved copy — never fetched inline, because the portal's rollup
// itself calls this app's /api/dashboard for bushels and COP.
app.get('/api/marketing-prices', (req, res) => {
  res.json(store.marketingPrices || null);
});

app.put('/api/marketing-prices', async (req, res) => {
  const body = req.body || {};
  if (!body.byCrop || typeof body.byCrop !== 'object') {
    return res.status(400).json({ error: 'byCrop object required' });
  }
  const year = parseInt(body.cropYear, 10);
  if (year && store.settings && store.settings.year && year !== store.settings.year) {
    return res.status(400).json({ error: 'cropYear ' + year + ' does not match this MACRO (' + store.settings.year + ')' });
  }
  const byCrop = {};
  Object.keys(body.byCrop).forEach(k => {
    const e = body.byCrop[k] || {};
    const num = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
    byCrop[String(k).trim().toLowerCase()] = {
      crop: String(e.crop || k),
      variant: String(e.variant || ''),
      commodity: String(e.commodity || ''),
      tier: e.tier === 'futures' ? 'futures' : 'tracking',
      blendDollars: num(e.blendDollars),
      wapDollars: num(e.wapDollars),
      pooledDollars: num(e.pooledDollars),
      premiumPerBu: num(e.premiumPerBu),
      poolFutures: num(e.poolFutures),
      poolBlend: num(e.poolBlend),
      poolPctSold: num(e.poolPctSold),
      poolSoldBu: num(e.poolSoldBu),
      poolProjectedBu: num(e.poolProjectedBu),
      cbot: num(e.cbot),
      cbotContract: e.cbotContract ? String(e.cbotContract) : '',
      pctSold: num(e.pctSold),
      soldBu: num(e.soldBu),
      projectedBu: num(e.projectedBu)
    };
  });
  store.marketingPrices = {
    updatedAt: new Date().toISOString(),
    cropYear: year || (store.settings && store.settings.year) || null,
    byCrop
  };
  clearPricingCache();
  await saveData();
  res.json(store.marketingPrices);
});

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

// --- Budget Audit API ---
app.get('/api/audit', (req, res) => {
  if (!latestAudit) return res.json({ message: 'No audit has run yet', alerts: [], summary: null });
  var result = latestAudit;
  // Filter support
  var alerts = result.alerts.filter(function (a) { return !a.resolved; });
  if (req.query.severity) alerts = alerts.filter(function (a) { return a.severity === req.query.severity; });
  if (req.query.category) alerts = alerts.filter(function (a) { return a.category === req.query.category; });
  if (req.query.fieldId) alerts = alerts.filter(function (a) { return a.fieldId === req.query.fieldId; });
  // Summary-only mode for badge polling
  if (req.query.summary === 'true') {
    var unresolved = result.alerts.filter(function (a) { return !a.resolved; });
    var s = { errors: 0, warnings: 0, info: 0 };
    unresolved.forEach(function (a) {
      if (a.severity === 'error') s.errors++;
      else if (a.severity === 'warning') s.warnings++;
      else s.info++;
    });
    return res.json({ runAt: result.runAt, summary: s });
  }
  res.json({ runAt: result.runAt, durationMs: result.durationMs, fieldsAudited: result.fieldsAudited, alerts: alerts, summary: result.summary });
});

app.post('/api/audit/run', async (req, res) => {
  try {
    var result = await executeAudit();
    res.json(result);
  } catch (err) {
    console.error('[Audit] Manual run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit/resolve', async (req, res) => {
  if (!latestAudit) return res.status(404).json({ error: 'No audit results' });
  var alertId = req.body.alertId;
  if (!alertId) return res.status(400).json({ error: 'alertId required' });
  var found = false;
  latestAudit.alerts.forEach(function (a) {
    if (a.id === alertId) { a.resolved = true; found = true; }
  });
  if (!found) return res.status(404).json({ error: 'Alert not found' });
  // Re-persist
  try { await fsp.writeFile(AUDIT_FILE, JSON.stringify(latestAudit, null, 2)); } catch (e) { /* ignore */ }
  res.json({ ok: true });
});

// --- Glomalin Terminal Chat (Claude API) ---

// ── Document intake ──────────────────────────────────────────────
// Upload a DeLong invoice or contract; the server transcribes it, matches it
// against fields/products (or against the marketing contract book), and returns
// a proposal. Nothing is written until the operator approves rows.
const docExtract = require('./lib/docintake/extract');
const docMatch = require('./lib/docintake/match');
const docApply = require('./lib/docintake/apply');
const docStore = require('./lib/docintake/store');

const DOC_MAX_BYTES = 20 * 1024 * 1024;
const DOC_MEDIA = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

app.get('/api/documents', (req, res) => {
  res.json({ documents: docStore.list(parseInt(req.query.limit, 10) || 50) });
});

app.get('/api/documents/:id', (req, res) => {
  const rec = docStore.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

app.get('/api/documents/:id/original', (req, res) => {
  const rec = docStore.get(req.params.id);
  const full = docStore.originalPath(req.params.id);
  if (!rec || !full || !fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', rec.mediaType);
  res.setHeader('Content-Disposition', 'inline; filename="' + rec.filename.replace(/"/g, '') + '"');
  fs.createReadStream(full).pipe(res);
});

// Upload + transcribe + match. The expensive step is the model call, so a
// re-upload of a scan we already read returns the stored proposal instead.
app.post('/api/documents', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });

  const { filename, mediaType, base64 } = req.body || {};
  if (!base64) return res.status(400).json({ error: 'base64 is required' });
  if (DOC_MEDIA.indexOf(mediaType) === -1) {
    return res.status(400).json({ error: 'Unsupported type ' + mediaType + ' — PDF, JPEG, PNG or WebP' });
  }

  let buffer;
  try { buffer = Buffer.from(base64, 'base64'); }
  catch (e) { return res.status(400).json({ error: 'base64 did not decode' }); }
  if (!buffer.length) return res.status(400).json({ error: 'Empty file' });
  if (buffer.length > DOC_MAX_BYTES) {
    return res.status(413).json({ error: 'File is ' + (buffer.length / 1048576).toFixed(1) + 'MB; limit is 20MB' });
  }

  const saved = docStore.saveOriginal(buffer, mediaType, filename);
  const prior = docStore.get(saved.id);

  // Transcription is the expensive half and the scan never changes, so a
  // re-upload reuses it. Matching is NOT reused: statuses like "already on
  // file" are a statement about the budget as it stands right now, and a
  // cached one would hide a row that has since been reverted.
  const reused = !!(prior && prior.extracted && !req.query.force);

  let extracted;
  if (reused) {
    extracted = { invoices: prior.extracted.invoices || [], contracts: prior.extracted.contracts || [],
                  unreadable: !!prior.unreadable, usage: prior.usage || null };
  } else {
    try {
      extracted = await docExtract.extractDocuments(apiKey, {
        base64: buffer.toString('base64'), mediaType: mediaType, filename: saved.filename
      });
    } catch (e) {
      console.error('[documents] extract failed:', e.message, e.detail || '');
      return res.status(502).json({ error: e.message, detail: e.detail || null });
    }
  }

  const proposals = extracted.invoices.map(function (inv) {
    return docMatch.proposeInvoice(inv, { fields: store.fields, products: store.products });
  });

  const docKind = extracted.contracts.length && !extracted.invoices.length ? 'contract'
    : extracted.invoices.length && !extracted.contracts.length ? 'invoice'
    : extracted.invoices.length ? 'mixed' : 'unrecognised';

  const record = docStore.upsert(Object.assign({}, saved, {
    uploadedAt: new Date().toISOString(),
    uploadedBy: (req.query.user || req.get('x-user-name') || null),
    docKind: docKind,
    unreadable: extracted.unreadable,
    summary: docKind === 'contract'
      ? extracted.contracts.length + ' contract(s)'
      : proposals.map(function (p) { return '#' + (p.invoiceNumber || '?') + ' ' + (p.fieldName || 'unmatched'); }).join(', '),
    extracted: { invoices: extracted.invoices, contracts: extracted.contracts },
    proposals: proposals,
    usage: extracted.usage
  }));

  res.json(Object.assign({}, record, { reused: reused }));
});

// Apply approved invoice rows. Body: { confirmedBy, invoices: [{ invoiceNumber,
// invoiceVendor, invoiceDate, acres, rows: [{ fieldId, productId, inputId,
// invoiceQty, invoiceUnit, lineTotal }] }] }
app.post('/api/documents/:id/apply', async (req, res) => {
  const rec = docStore.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });

  const invoices = Array.isArray(req.body && req.body.invoices) ? req.body.invoices : [];
  if (!invoices.length) return res.status(400).json({ error: 'No invoices supplied' });

  const outcomes = [];
  for (const inv of invoices) {
    const header = {
      invoiceNumber: inv.invoiceNumber || null,
      invoiceVendor: inv.invoiceVendor || null,
      invoiceDate: inv.invoiceDate || null,
      acres: inv.acres,
      confirmedBy: req.body.confirmedBy || null
    };
    const result = docApply.applyInvoice(store, header, inv.rows || []);
    if (!result.ok) return res.status(400).json({ error: 'Nothing applied', errors: result.errors });
    outcomes.push({ invoiceNumber: header.invoiceNumber, confirmed: result.confirmed, added: result.added, results: result.results });
  }

  await saveData();

  const applied = outcomes.reduce(function (n, o) { return n + o.confirmed + o.added; }, 0);

  // Re-match against what we just wrote. The refreshed proposal is what the
  // next upload of this same scan would produce — applied rows now read
  // "already on file", which is how a double-apply is prevented visibly.
  const proposals = ((rec.extracted && rec.extracted.invoices) || []).map(function (inv) {
    return docMatch.proposeInvoice(inv, { fields: store.fields, products: store.products });
  });

  docStore.upsert({
    id: rec.id,
    appliedAt: new Date().toISOString(),
    appliedCount: (rec.appliedCount || 0) + applied,
    appliedDetail: outcomes,
    proposals: proposals
  });

  res.json({ ok: true, applied: applied, outcomes: outcomes, document: docStore.get(rec.id) });
});

// Contracts go to the marketing book in organic-cert, which owns them.
// mode=diff is read-only; mode=create only inserts contracts we have no record of.
app.post('/api/documents/:id/contracts', async (req, res) => {
  const rec = docStore.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  const contracts = (rec.extracted && rec.extracted.contracts) || [];
  if (!contracts.length) return res.status(400).json({ error: 'No contracts were found in this document' });

  // organic-cert owns the marketing book and listens on 3004. Deliberately NOT
  // PORTAL_API_URL: that name is already used here for a different host (and is
  // set to the portal on 3000 elsewhere in the ecosystem), so overloading it
  // would send contracts to whatever happens to answer that port.
  const certUrl = process.env.CERT_API_URL || 'http://localhost:3004';
  const token = process.env.ECOSYSTEM_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'ECOSYSTEM_TOKEN not configured — cannot reach the marketing book' });

  const mode = (req.body && req.body.mode) === 'create' ? 'create' : 'diff';
  try {
    const upstream = await fetch(certUrl + '/api/marketing/ingest-contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ecosystem-token': token },
      body: JSON.stringify({
        mode: mode,
        documentId: rec.id,
        contracts: contracts,
        overrides: (req.body && req.body.overrides) || {}
      })
    });
    const json = await upstream.json().catch(function () { return null; });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Marketing book refused', detail: json });
    }
    if (mode === 'create') {
      docStore.upsert({ id: rec.id, contractsCreatedAt: new Date().toISOString(), contractsCreated: json.created });
    }
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the marketing book', detail: e.message });
  }
});

// ── Chat agent guardrails: daily cap + audit log ─────────────────
var CHAT_USAGE_FILE = path.join(__dirname, 'data', 'chat-usage.json');
var CHAT_LOG_FILE = path.join(__dirname, 'data', 'chat-log.jsonl');
var CHAT_DAILY_CAP = parseInt(process.env.CHAT_DAILY_CAP, 10) || 150;
function chatUsageToday() {
  try {
    var u = JSON.parse(fs.readFileSync(CHAT_USAGE_FILE, 'utf8'));
    if (u.date === new Date().toISOString().slice(0, 10)) return u.count || 0;
  } catch (e) { /* first use — zero */ }
  return 0;
}
function bumpChatUsage() {
  try {
    fs.writeFileSync(CHAT_USAGE_FILE, JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      count: chatUsageToday() + 1
    }));
  } catch (e) { /* non-fatal */ }
}
function logChat(entry) {
  try { fs.appendFileSync(CHAT_LOG_FILE, JSON.stringify(entry) + '\n'); } catch (e) { /* non-fatal */ }
}

app.post('/api/chat', async (req, res) => {
  if (process.env.CHAT_AGENT_ENABLED === 'false') {
    return res.status(503).json({ error: 'Chat agent disabled' });
  }
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write('data: ' + JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env' }) + '\n\n');
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  var userMessage = (req.body.message || '').trim();
  var chatHistory = (Array.isArray(req.body.history) ? req.body.history : []).slice(-20);

  // Role is derived server-side, never trusted from the browser:
  // - v2 grant → role rides inside the HMAC-signed payload; authoritative.
  // - v1 grant → legacy browser with no role claim; clamped to office until
  //   the portal mints v2 (no financials on an unverified role).
  // - raw EMBED_TOKEN → trusted server-to-server caller; may state a role.
  // - no EMBED_TOKEN configured → local dev; body role, default admin.
  var bodyRole = (req.body.role || '').toLowerCase();
  var chatUserId = null;
  var chatRole;
  if (process.env.EMBED_TOKEN) {
    var rawTokenOk = req.query.token === process.env.EMBED_TOKEN ||
      req.get('x-embed-token') === process.env.EMBED_TOKEN ||
      (req.cookies && req.cookies.embed_session === process.env.EMBED_TOKEN);
    var grantInfo = verifyEmbedGrant(
      typeof req.query.grant === 'string' ? req.query.grant : (req.cookies && req.cookies[EMBED_GRANT_COOKIE])
    );
    if (grantInfo && grantInfo.role) {
      chatRole = grantInfo.role.toLowerCase();
      chatUserId = grantInfo.userId;
    } else if (grantInfo) {
      chatUserId = grantInfo.userId;
      chatRole = (bodyRole === 'admin' || bodyRole === 'agronomist' || !bodyRole) ? 'office' : bodyRole;
    } else if (rawTokenOk) {
      chatRole = bodyRole || 'admin';
    } else {
      chatRole = 'office';
    }
  } else {
    chatRole = bodyRole || 'admin';
  }
  // Normalize: 'viewer' and 'office' both mean the office persona
  if (chatRole === 'viewer') chatRole = 'office';
  var isFullAccess = (chatRole === 'admin' || chatRole === 'agronomist');
  var isOffice = (chatRole === 'office');
  var isOperator = (chatRole === 'operator');

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  if (chatUsageToday() >= CHAT_DAILY_CAP) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write('data: ' + JSON.stringify({ error: 'Daily chat cap reached (' + CHAT_DAILY_CAP + '). Resets at midnight UTC.' }) + '\n\n');
    res.write('data: [DONE]\n\n');
    return res.end();
  }
  bumpChatUsage();

  // Run the tool-based agent. It queries live data through tools instead of
  // reading a pre-stuffed context blob, so units and arithmetic come from one
  // audited path (lib/agent/tools.js) rather than the model's arithmetic.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  function emit(payload) {
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
  }

  var agentCtx = {
    store: store,
    getRefs: getRefs,
    futuresCache: futuresCache,
    getLatestAudit: function () { return latestAudit; },
    getCropYear: getCropYear
  };

  try {
    var agentResult = await runAgent({
      apiKey: apiKey,
      message: userMessage,
      history: chatHistory,
      role: chatRole,
      ctx: agentCtx,
      emit: emit
    });
    res.write('data: [DONE]\n\n');
    res.end();
    logChat({
      ts: new Date().toISOString(), userId: chatUserId, role: chatRole,
      message: userMessage, reply: agentResult.text, tools: agentResult.toolCalls
    });
  } catch (err) {
    console.error('[Chat] Error:', err.message, err.detail || '');
    emit({ error: err.message });
    res.write('data: [DONE]\n\n');
    res.end();
    logChat({
      ts: new Date().toISOString(), userId: chatUserId, role: chatRole,
      message: userMessage, error: err.message
    });
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
  // Overhead pools + QuickBooks account map (2026-09)
  ['overheadPools', 'glAccountMap', 'plImports'].forEach(function (k) {
    if (!Array.isArray(store[k])) { store[k] = []; changed = true; }
  });
  if (store.settings && store.settings.useOverheadPools === undefined) {
    store.settings.useOverheadPools = true;
    changed = true;
  }
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
  // Seed boilerplate machinery program templates
  if (!store.machineryPrograms || !store.machineryPrograms.length) {
    store.machineryPrograms = [
      { id: 'mplan_notill_soy',     name: 'No-Till Soybeans',    description: 'No-till — planter, weed zapper ×2, harvest',                   machinery: [{ implementName:'Planter',passes:1},{ implementName:'Weed Zapper',passes:2},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_notill_corn',    name: 'No-Till Corn',         description: 'No-till — planter, stalk chopper, harvest',                    machinery: [{ implementName:'Planter',passes:1},{ implementName:'Stalk Choper',passes:1},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_conv_soy',       name: 'Conventional Soybeans',description: 'Tilled — disk, soil finisher ×2, planter, weed zapper, harvest', machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Weed Zapper',passes:1},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_conv_corn',      name: 'Conventional Corn',    description: 'Tilled — disk, soil finisher ×2, planter, stalk chopper, harvest', machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Stalk Choper',passes:1},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_org_soy',        name: 'Organic Soybeans',     description: 'Organic — disk, soil finisher ×2, planter, rotary hoe ×2, cultivator ×2, hooded redball, harvest', machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Rotary Hoe 60',passes:2},{ implementName:'Cultivator 12',passes:2},{ implementName:'Hooded Redball',passes:1},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_org_seed_corn',  name: 'Organic Seed Corn',    description: 'Organic seed corn — full cultivation + detasseling',           machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Rotary Hoe 60',passes:1},{ implementName:'Tine Weed 80',passes:1},{ implementName:'Cultivator 12',passes:2},{ implementName:'detassle cut',passes:1},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_org_wheat',      name: 'Organic Wheat',        description: 'Organic wheat — drill seeded, spinner fertility',              machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:1},{ implementName:'Drill',passes:1},{ implementName:'Spinner',passes:2},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] },
      { id: 'mplan_canning_beans',  name: 'Canning Beans',        description: 'Canning / food beans — soil finisher ×2, planter, harvest',   machinery: [{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Weed Zapper',passes:1},{ implementName:'Combine + Buggy',passes:1}] },
      { id: 'mplan_canning_corn',   name: 'Canning Corn',         description: 'Canning corn — disk, soil finisher ×2, planter, harvest',     machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:2},{ implementName:'Planter',passes:1},{ implementName:'Combine + Buggy',passes:1}] },
      { id: 'mplan_hybrid_rye',     name: 'Hybrid Seed Rye',      description: 'Hybrid rye — disk, soil finisher, drill, spinner ×2, harvest', machinery: [{ implementName:'Disk',passes:1},{ implementName:'Soil Finisher',passes:1},{ implementName:'Drill',passes:1},{ implementName:'Spinner',passes:2},{ implementName:'Combine + Buggy',passes:1},{ implementName:'Trucking',passes:1}] }
    ];
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
  // Migrate enterpriseId from crop type level down to each sub-crop
  (store.cropTypes || []).forEach(function (ct) {
    if (ct.enterpriseId && ct.subCrops) {
      ct.subCrops.forEach(function (sc) {
        if (sc.enterpriseId === undefined) {
          sc.enterpriseId = ct.enterpriseId;
          changed = true;
        }
      });
      delete ct.enterpriseId;
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
  // Add organicGround designation — explicit flag for items used on certified organic ground
  (store.products || []).forEach(function (p) {
    if (p.organicGround === undefined) {
      p.organicGround = !!p.organic; // default from existing OMRI-based organic flag
      changed = true;
    }
  });
  (store.seeds || []).forEach(function (s) {
    if (s.organicGround === undefined) {
      s.organicGround = false;
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

// ── Sales & Marketing — Supabase-backed routes ────────────────────────────────
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function getCropYear() {
  return store.settings && store.settings.year ? store.settings.year : new Date().getFullYear();
}

app.get('/api/marketing/instruments', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const year = parseInt(req.query.cropYear) || getCropYear();
  const { data, error } = await supabase.from('sale_instruments').select('*').eq('crop_year', year).order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/marketing/instruments', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const year = getCropYear();
  const NUMERIC = ['bushels','price_per_bushel','basis','futures_reference','delivered_bu',
    'strike_price','premium_paid','ko_level','ki_level','daily_bu','weekly_bu','leverage_ratio'];
  const BLOCKED = ['commodity_id', 'variant_id'];
  const payload = { crop_year: parseInt(req.body.crop_year) || year };
  Object.entries(req.body).forEach(([k, v]) => {
    if (BLOCKED.includes(k)) return;
    payload[k] = NUMERIC.includes(k) ? (v !== '' && v !== null && v !== undefined ? Number(v) : null) : v;
  });
  const { data, error } = await supabase.from('sale_instruments').insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/marketing/instruments/:id', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const NUMERIC = ['bushels','price_per_bushel','basis','futures_reference','delivered_bu',
    'strike_price','premium_paid','ko_level','ki_level','daily_bu','weekly_bu','leverage_ratio'];
  const patch = {};
  Object.entries(req.body).forEach(([k, v]) => {
    patch[k] = NUMERIC.includes(k) ? (v !== '' && v !== null && v !== undefined ? Number(v) : null) : v;
  });
  const { data, error } = await supabase.from('sale_instruments').update(patch).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/marketing/instruments/:id', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const { error } = await supabase.from('sale_instruments').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.post('/api/marketing/migrate-legacy', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const sales = store.sales || [];
  if (!sales.length) return res.json({ migrated: 0, message: 'No legacy sales to migrate' });

  const year = getCropYear();

  function findCropTypeId(cropName) {
    const cn = (cropName || '').toLowerCase().trim();
    let ct = store.cropTypes.find(c => (c.name || '').toLowerCase().trim() === cn);
    if (ct) return ct.id;
    ct = store.cropTypes.find(c =>
      (c.subCrops || []).some(sc => (sc.name || '').toLowerCase().trim() === cn)
    );
    return ct ? ct.id : null;
  }

  function extractTotalBu(contractNo) {
    const m = String(contractNo || '').match(/^([0-9,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  }

  const records = [];
  const errors = [];

  for (const sale of sales) {
    const isAccum = /accumulator/i.test(sale.contractNo || '');
    const ctId = findCropTypeId(sale.crop);
    if (!ctId) {
      errors.push({ id: sale.id, reason: 'No crop type found for: ' + sale.crop });
      continue;
    }
    const payload = { crop_type_id: ctId, crop_year: year, buyer: sale.buyer || null, delivery_start: sale.date || null };
    if (isAccum) {
      const totalBu = extractTotalBu(sale.contractNo);
      Object.assign(payload, {
        instrument_type: 'accumulator',
        bushels: totalBu || null,
        delivered_bu: sale.amount || null,
        price_per_bushel: sale.cbotPrice || sale.price || null,
        basis: sale.basis || null,
        accumulation_start: sale.date || null,
        notes: sale.contractNo || null,
      });
    } else {
      Object.assign(payload, {
        instrument_type: 'cash',
        bushels: sale.amount || null,
        price_per_bushel: sale.price || null,
        basis: sale.basis || null,
        contract_number: sale.contractNo || null,
        notes: sale.notes || null,
      });
    }
    const { data, error } = await supabase.from('sale_instruments').insert(payload).select().single();
    if (error) {
      errors.push({ id: sale.id, reason: error.message });
    } else {
      records.push({ legacyId: sale.id, newId: data.id, type: payload.instrument_type, crop: sale.crop });
    }
  }

  if (records.length > 0) {
    store.sales = [];
    await saveData();
  }

  res.json({ migrated: records.length, skipped: errors.length, errors: errors.length ? errors : undefined, records });
});
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MACRO ${getCropYear()} server running at http://localhost:${PORT}`);

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
    cron.schedule('*/' + intervalMin + ' * * * *', function () {
      fieldopsSync.runSync(store, generateId, saveData)
        .then(function (r) { console.log('[FieldOps] Scheduled sync:', r.status); })
        .catch(function (e) { console.error('[FieldOps] Scheduled sync error:', e.message); });
    });
  } else {
    console.log('[FieldOps] Sync disabled (set FIELDOPS_SYNC_ENABLED=true in .env to enable)');
  }

  // --- Scheduled Budget Audit ---
  var auditSchedule = process.env.AUDIT_CRON || '0 6 * * *';
  cron.schedule(auditSchedule, function () {
    executeAudit().catch(function (e) { console.error('[Audit] Cron error:', e.message); });
  });
  console.log('[Audit] Scheduled: ' + auditSchedule);

  // Run initial audit 10 seconds after startup
  setTimeout(function () {
    executeAudit().catch(function (e) { console.error('[Audit] Initial run error:', e.message); });
  }, 10000);
});
