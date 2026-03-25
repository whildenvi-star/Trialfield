#!/usr/bin/env node
'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const turfArea = require('@turf/area').default;

const app = express();
const PORT = process.env.PORT || 3005;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const SHAPEFILE_DIR = path.join(__dirname, 'data', 'shapefiles');
const MAX_BACKUPS = 5;

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'farm-registry', uptime: process.uptime() }));

// Ensure shapefile directory exists
if (!fs.existsSync(SHAPEFILE_DIR)) fs.mkdirSync(SHAPEFILE_DIR, { recursive: true });

// Multer config for shapefile uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SHAPEFILE_DIR),
    filename: (req, file, cb) => {
      const fieldId = req.params.id;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, fieldId + ext);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.shp', '.dbf', '.prj', '.shx', '.cpg', '.zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only shapefile components (.shp, .dbf, .prj, .shx, .cpg) or .zip allowed'));
    }
  }
});

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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/client', express.static(path.join(__dirname, 'client')));

// API auth gate
if (process.env.EMBED_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.query.token === process.env.EMBED_TOKEN) return next();
    if (req.cookies && req.cookies.embed_session === process.env.EMBED_TOKEN) return next();
    res.status(403).json({ error: 'Forbidden' });
  });
}

// --- In-memory data store ---
let store = {
  growers: [],
  fields: [],
  crops: []
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

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// perf: Cache-Control on GET API responses
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    // Autocomplete/search results are safe to cache briefly
    const isAutocomplete = req.path.includes('/autocomplete');
    const isSearch = req.path.includes('/search');
    if (isAutocomplete) {
      res.set('Cache-Control', 'public, max-age=300');
    } else if (isSearch) {
      res.set('Cache-Control', 'public, max-age=10');
    } else {
      // Mutable data (fields, growers, crops) — always revalidate
      res.set('Cache-Control', 'no-cache');
    }
  }
  next();
});

// =============================================
// API ROUTES
// =============================================

// --- Growers ---
app.get('/api/growers', (req, res) => {
  res.json(store.growers);
});

app.post('/api/growers', async (req, res) => {
  const grower = Object.assign({ id: generateId('grw') }, req.body);
  store.growers.push(grower);
  await saveData();
  res.status(201).json(grower);
});

app.put('/api/growers/:id', async (req, res) => {
  const idx = store.growers.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Grower not found' });
  const updatable = ['name', 'operators', 'county', 'state'];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) store.growers[idx][k] = req.body[k];
  });
  await saveData();
  res.json(store.growers[idx]);
});

// --- Fields ---
app.get('/api/fields', (req, res) => {
  let fields = store.fields;
  if (req.query.growerId) {
    fields = fields.filter(f => f.growerId === req.query.growerId);
  }
  if (req.query.active === 'true') {
    fields = fields.filter(f => f.active);
  }
  if (req.query.active === 'false') {
    fields = fields.filter(f => !f.active);
  }
  res.json(fields);
});

app.get('/api/fields/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  const matches = store.fields
    .filter(f => f.active && (
      f.name.toLowerCase().includes(q) ||
      (f.aliases || []).some(a => a.toLowerCase().includes(q))
    ))
    .sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10)
    .map(f => ({
      id: f.id,
      name: f.name,
      reportingAcres: f.reportingAcres,
      organicAcres: f.organicAcres,
      ownership: f.ownership,
      totalRentDollars: f.totalRentDollars || 0
    }));
  res.json(matches);
});

// Autocomplete endpoint for field selection dropdowns — must be before :id route
// Returns all active fields sorted by name, optionally filtered by ?q= param
// Response cached 5 minutes (field list rarely changes)
app.get('/api/fields/autocomplete', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const q = (req.query.q || '').toLowerCase().trim();
  let fields = store.fields.filter(f => f.active);

  if (q) {
    fields = fields.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.aliases || []).some(a => a.toLowerCase().includes(q))
    );
  }

  fields = fields
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(f => ({
      id: f.id,
      name: f.name,
      aliases: f.aliases || [],
      reportingAcres: f.reportingAcres,
      organicAcres: f.organicAcres,
      ownership: f.ownership
    }));

  res.json({ fields });
});

app.get('/api/fields/:id', (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  res.json(field);
});

app.post('/api/fields', async (req, res) => {
  const field = Object.assign({
    id: generateId('fld'),
    aliases: [],
    active: true,
    geometry: null
  }, req.body);
  if (!field.aliases.includes(field.name)) {
    field.aliases.push(field.name);
  }
  store.fields.push(field);
  await saveData();
  res.status(201).json(field);
});

app.put('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });

  // Validate before applying any changes
  const errors = [];
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
      errors.push({ field: 'name', message: 'Field name is required' });
    }
  }
  if (req.body.reportingAcres !== undefined) {
    if (typeof req.body.reportingAcres !== 'number' || req.body.reportingAcres < 0) {
      errors.push({ field: 'reportingAcres', message: 'Acres must be zero or positive' });
    }
  }
  if (req.body.organicAcres !== undefined) {
    if (typeof req.body.organicAcres !== 'number' || req.body.organicAcres < 0) {
      errors.push({ field: 'organicAcres', message: 'Organic acres must be zero or positive' });
    }
  }
  if (req.body.ownership !== undefined) {
    if (!['owned', 'rented', 'mixed'].includes(req.body.ownership)) {
      errors.push({ field: 'ownership', message: 'Ownership must be owned, rented, or mixed' });
    }
  }
  if (errors.length > 0) return res.status(400).json({ errors });

  const updatable = [
    'name', 'aliases', 'reportingAcres', 'organicAcres', 'ownership', 'certStatus',
    'active', 'geometry', 'notes',
    'rentedTillable', 'ownedTillable', 'nonTillable',
    'organicRented', 'organicOwned',
    'conventionalRented', 'conventionalOwned',
    'transitionalRented', 'transitionalOwned',
    'landlordName', 'landlordContact',
    'totalRentDollars',
    'growerId'
  ];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) store.fields[idx][k] = req.body[k];
  });

  // Backfill growerId default for any existing fields missing it
  if (!store.fields[idx].growerId) {
    store.fields[idx].growerId = 'grw_001';
  }

  try {
    await saveData();
    res.json(store.fields[idx]);
  } catch (err) {
    console.error('saveData error:', err);
    res.status(500).json({ errors: [{ field: '_server', message: 'Save failed — please try again' }] });
  }
});

app.delete('/api/fields/:id', async (req, res) => {
  const idx = store.fields.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Field not found' });
  store.fields.splice(idx, 1);
  await saveData();
  res.json({ ok: true });
});

// --- Shapefile Upload/Download ---
app.post('/api/fields/:id/shapefile', upload.array('files', 6), async (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });

  const uploaded = req.files.map(f => f.filename);
  field.shapefiles = uploaded;
  await saveData();

  // Compute acres from .shp geometry if available
  let computedAcres = null;
  const shpFile = uploaded.find(f => f.endsWith('.shp'));
  if (shpFile) {
    try {
      const shpPath = path.join(SHAPEFILE_DIR, shpFile);
      const source = await shapefile.open(shpPath);
      const features = [];
      let result = await source.read();
      while (!result.done) {
        if (result.value.geometry) features.push(result.value);
        result = await source.read();
      }
      if (features.length) {
        const fc = { type: 'FeatureCollection', features };
        const sqMeters = turfArea(fc);
        computedAcres = Math.round((sqMeters / 4046.8564224) * 100) / 100;
      }
    } catch (err) {
      console.error('Shapefile area calc error:', err.message);
    }
  }

  res.json({ ok: true, files: uploaded, computedAcres });
});

app.get('/api/fields/:id/shapefile', (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field || !field.shapefiles || !field.shapefiles.length) {
    return res.status(404).json({ error: 'No shapefile for this field' });
  }
  // Return the .shp or .zip file (first file that exists)
  for (const fname of field.shapefiles) {
    const fpath = path.join(SHAPEFILE_DIR, fname);
    if (fs.existsSync(fpath)) {
      return res.download(fpath, fname);
    }
  }
  res.status(404).json({ error: 'File not found on disk' });
});

app.delete('/api/fields/:id/shapefile', async (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  // Delete files from disk (async to avoid blocking event loop)
  for (const fname of (field.shapefiles || [])) {
    const fpath = path.join(SHAPEFILE_DIR, fname);
    try { await fsp.unlink(fpath); } catch (e) { /* file already gone */ }
  }

  field.shapefiles = [];
  await saveData();
  res.json({ ok: true });
});

// --- Shapefile SVG Preview ---
app.get('/api/fields/:id/shapefile/preview', async (req, res) => {
  const field = store.fields.find(f => f.id === req.params.id);
  if (!field || !field.shapefiles || !field.shapefiles.length) {
    return res.status(404).json({ error: 'No shapefile' });
  }
  // Find the .shp file
  const shpName = field.shapefiles.find(f => f.endsWith('.shp'));
  if (!shpName) return res.status(404).json({ error: 'No .shp file' });
  const shpPath = path.join(SHAPEFILE_DIR, shpName);
  if (!fs.existsSync(shpPath)) return res.status(404).json({ error: 'File not found' });

  try {
    const source = await shapefile.open(shpPath);
    const coords = [];
    let result = await source.read();
    while (!result.done) {
      const geom = result.value.geometry;
      if (geom && geom.coordinates) {
        // Flatten all coordinate rings (Polygon or MultiPolygon)
        const rings = geom.type === 'MultiPolygon'
          ? geom.coordinates.flat()
          : geom.coordinates;
        rings.forEach(ring => coords.push(...ring));
      }
      result = await source.read();
    }
    if (!coords.length) return res.status(404).json({ error: 'No geometry' });

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    coords.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const w = 120, h = 80, pad = 4;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);
    const offX = pad + ((w - pad * 2) - rangeX * scale) / 2;
    const offY = pad + ((h - pad * 2) - rangeY * scale) / 2;

    function tx(x) { return offX + (x - minX) * scale; }
    function ty(y) { return h - (offY + (y - minY) * scale); } // flip Y

    // Build SVG path from first polygon ring
    const source2 = await shapefile.open(shpPath);
    let paths = '';
    let r2 = await source2.read();
    while (!r2.done) {
      const geom = r2.value.geometry;
      if (geom && geom.coordinates) {
        const rings = geom.type === 'MultiPolygon'
          ? geom.coordinates.flat()
          : geom.coordinates;
        rings.forEach(ring => {
          const d = ring.map(([x, y], i) =>
            (i === 0 ? 'M' : 'L') + tx(x).toFixed(1) + ',' + ty(y).toFixed(1)
          ).join(' ') + ' Z';
          paths += `<path d="${d}" fill="#2d5a27" fill-opacity="0.3" stroke="#2d5a27" stroke-width="1.5"/>`;
        });
      }
      r2 = await source2.read();
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`;
    res.set('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error('Shapefile preview error:', err.message);
    res.status(500).json({ error: 'Could not render preview' });
  }
});

// --- Bulk rent backfill (one-time migration from farm-budget) ---
app.post('/api/fields/backfill-rent', async (req, res) => {
  const entries = req.body.entries || [];
  const results = { updated: [], unmatched: [], skipped: [] };

  for (const entry of entries) {
    const name = (entry.fieldName || '').trim().toLowerCase();
    if (!name) continue;
    const field = store.fields.find(f =>
      f.name.toLowerCase() === name ||
      (f.aliases || []).some(a => a.toLowerCase() === name)
    );

    if (!field) {
      results.unmatched.push(entry.fieldName);
      continue;
    }

    if (field.totalRentDollars > 0 && !entry.overwrite) {
      results.skipped.push({ name: field.name, existing: field.totalRentDollars });
      continue;
    }

    field.totalRentDollars = entry.totalRentDollars;
    results.updated.push({ name: field.name, totalRentDollars: entry.totalRentDollars });
  }

  if (results.updated.length > 0) await saveData();
  res.json(results);
});

// --- Crops ---

// Helper: generate next crop_NNN id
function nextCropId() {
  const nums = (store.crops || [])
    .map(c => {
      const m = (c.id || '').match(/^crop_(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const max = nums.length ? Math.max(...nums) : 0;
  return 'crop_' + String(max + 1).padStart(3, '0');
}

// GET /api/crops — all active crops; optional ?q= search
app.get('/api/crops', (req, res) => {
  let crops = (store.crops || []).filter(c => c.active !== false);
  const q = (req.query.q || '').toLowerCase().trim();
  if (q) {
    crops = crops.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(q)) ||
      (c.category || '').toLowerCase().includes(q)
    );
  }
  res.json(crops);
});

// GET /api/crops/autocomplete — lightweight list for dropdowns
// Must be BEFORE /api/crops/:id to prevent Express param shadowing
app.get('/api/crops/autocomplete', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const q = (req.query.q || '').toLowerCase().trim();
  let crops = (store.crops || []).filter(c => c.active !== false);
  if (q) {
    crops = crops.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(q))
    );
  }
  const result = crops
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      organic: c.organic,
      unit: c.unit,
      color: c.color,
      aliases: c.aliases || []
    }));
  res.json({ crops: result });
});

// GET /api/crops/:id — single crop by ID
app.get('/api/crops/:id', (req, res) => {
  const crop = (store.crops || []).find(c => c.id === req.params.id);
  if (!crop) return res.status(404).json({ error: 'Crop not found' });
  res.json(crop);
});

// POST /api/crops — create new crop
app.post('/api/crops', async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const name = String(req.body.name).trim();

  // Check for duplicate (same name + same organic flag)
  const organic = req.body.organic === true || req.body.organic === 'true';
  const duplicate = (store.crops || []).find(
    c => c.active !== false && c.name.toLowerCase() === name.toLowerCase() && c.organic === organic
  );
  if (duplicate) {
    return res.status(409).json({ error: 'A crop with that name and organic flag already exists', existing: duplicate.id });
  }

  if (!store.crops) store.crops = [];
  const crop = Object.assign({
    id: nextCropId(),
    category: 'Other',
    organic: false,
    bushelWeight: null,
    unit: 'Bu',
    color: '#455a64',
    aliases: [name],
    rmaCropCode: null,
    active: true
  }, req.body, { name });

  // Ensure name is always in aliases
  if (!crop.aliases.includes(name)) crop.aliases.unshift(name);

  store.crops.push(crop);
  await saveData();
  res.status(201).json(crop);
});

// PUT /api/crops/:id — update crop
app.put('/api/crops/:id', async (req, res) => {
  if (!store.crops) store.crops = [];
  const idx = store.crops.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Crop not found' });

  const updatable = ['name', 'category', 'organic', 'bushelWeight', 'unit', 'color', 'aliases', 'rmaCropCode', 'active'];
  updatable.forEach(k => {
    if (req.body[k] !== undefined) store.crops[idx][k] = req.body[k];
  });

  try {
    await saveData();
    res.json(store.crops[idx]);
  } catch (err) {
    console.error('saveData error:', err);
    res.status(500).json({ error: 'Save failed — please try again' });
  }
});

// DELETE /api/crops/:id — soft-delete (sets active: false)
app.delete('/api/crops/:id', async (req, res) => {
  if (!store.crops) store.crops = [];
  const idx = store.crops.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Crop not found' });
  store.crops[idx].active = false;
  await saveData();
  res.sendStatus(204);
});

// --- FSA proxy (avoid CORS issues) ---
// perf: TTL cache with stale fallback — avoids hitting fsa-acres on every page load
let fsaCache = { data: null, ts: 0 };
const FSA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/fsa/clu-records', async (req, res) => {
  const now = Date.now();
  if (fsaCache.data && (now - fsaCache.ts) < FSA_CACHE_TTL) {
    return res.json(fsaCache.data);
  }
  try {
    const resp = await fetch('http://localhost:3002/api/clu-records');
    if (!resp.ok) throw new Error('FSA returned ' + resp.status);
    const data = await resp.json();
    fsaCache = { data, ts: now };
    res.json(data);
  } catch (err) {
    // Stale fallback: return cached data if available, even if expired
    if (fsaCache.data) return res.json(fsaCache.data);
    res.status(502).json({ error: 'FSA service unavailable' });
  }
});

// --- Start ---
loadData();
console.log(`Loaded: ${store.fields.length} fields, ${store.growers.length} growers, ${(store.crops || []).length} crops`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Farm Registry running at http://localhost:${PORT}`);
});
