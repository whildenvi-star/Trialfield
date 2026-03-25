#!/usr/bin/env node
'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Calc = require('./public/calc.js');
const multer = require('multer');
const XLSX = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('./lib/db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Settlement file upload — diskStorage saves outside public/ for parse-to-commit handoff
const settlementStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'settlements');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const uploadSettlement = multer({
  storage: settlementStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and Excel files are accepted'));
  }
});

const anthropic = new Anthropic.default();

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3007;

// Health check — before CORS/middleware for fast, dependency-free response
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'grain-tickets', uptime: process.uptime() }));

const corsOptions = {
  origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());

// ── Embed-token gate ─────────────────────────────────────────────
// Cookie-setting MUST run before app.get('/') and express.static
// so the initial page load (/?token=xxx) sets the cookie.
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

// Serve index.html with GLOMALIN_ENABLED injected — MUST be before express.static
app.get('/', (req, res) => {
  const enabled = process.env.CHAT_AGENT_ENABLED === 'true';
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  // Inject GLOMALIN_ENABLED flag before closing </head>
  const script = `<script>window.GLOMALIN_ENABLED=${enabled};</script>`;
  html = html.replace('</head>', script + '\n</head>');
  res.type('html').send(html);
});

// Serve static files before API auth so pages always load
app.use(express.static(path.join(__dirname, 'public')));

// API auth gate — agent routes exempted (have own kill-switch + daily cap)
if (process.env.EMBED_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/agent')) return next();
    if (req.query.token === process.env.EMBED_TOKEN) return next();
    if (req.cookies && req.cookies.embed_session === process.env.EMBED_TOKEN) return next();
    res.status(403).json({ error: 'Forbidden' });
  });
}

// perf: Cache-Control on GET API responses — allows browser to skip refetch for short TTL
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=10'); // 10s for list data
  }
  next();
});

// --- Agent kill-switch middleware ---
app.use('/api/agent', (req, res, next) => {
  if (process.env.CHAT_AGENT_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Chat agent is disabled' });
  }
  next();
});

// --- Agent route imports ---
const { handleChat } = require('./lib/agent/chat');
const { checkAndIncrementCap } = require('./lib/agent/daily-cap');

// POST /api/agent/chat — SSE streaming chat endpoint
app.post('/api/agent/chat', handleChat);

// GET /api/agent/status — returns agent enabled status + daily usage
app.get('/api/agent/status', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const usage = await prisma.agentDailyUsage.findUnique({ where: { date: today } });
    const dailyCap = parseInt(process.env.CHAT_DAILY_CAP || '50', 10);
    const count = usage ? usage.count : 0;
    res.json({
      enabled: true, // if we got here, kill-switch middleware passed
      dailyCap,
      messagesUsed: count,
      remaining: Math.max(0, dailyCap - count),
      nearLimit: count >= dailyCap * 0.8
    });
  } catch (err) {
    console.error('Agent status error:', err);
    res.status(500).json({ error: 'Failed to check agent status' });
  }
});

// --- Agent Notes CRUD ---
// GET /api/agent/notes — list notes (optionally filter by category, active)
app.get('/api/agent/notes', async (req, res) => {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    else where.active = true; // default to active only
    const notes = await prisma.agentNote.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(notes);
  } catch (err) {
    console.error('Agent notes list error:', err);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

// POST /api/agent/notes — create a note (from admin page)
app.post('/api/agent/notes', async (req, res) => {
  try {
    const { content, category } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
    const note = await prisma.agentNote.create({
      data: {
        content: content.trim(),
        category: category || 'general',
        source: 'admin'
      }
    });
    res.status(201).json(note);
  } catch (err) {
    console.error('Agent note create error:', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/agent/notes/:id — update a note
app.put('/api/agent/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { content, category, active } = req.body;
    const data = {};
    if (content !== undefined) data.content = content.trim();
    if (category !== undefined) data.category = category;
    if (active !== undefined) data.active = active;
    const note = await prisma.agentNote.update({ where: { id }, data });
    res.json(note);
  } catch (err) {
    console.error('Agent note update error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/agent/notes/:id — delete a note permanently
app.delete('/api/agent/notes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.agentNote.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Agent note delete error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// GET /api/agent/conversations — list recent conversations (for audit)
app.get('/api/agent/conversations', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const conversations = await prisma.agentConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(conversations);
  } catch (err) {
    console.error('Agent conversations error:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// --- Helper: extract crop year from YYYY-MM-DD date string ---
// Harvest-season logic: Jun-Dec = that year, Jan-May = prior year (late delivery from prior harvest)
function getCropYear(dateStr) {
  if (!dateStr) return new Date().getFullYear();
  const parts = (dateStr + '').split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year)) return new Date().getFullYear();
  // Jan-May = late delivery from prior harvest season
  if (month >= 1 && month <= 5) return year - 1;
  return year;
}

// --- Helper: build cropConfig object shape from DB ---
async function buildCropConfigObject(cropYear) {
  const year = cropYear || new Date().getFullYear();
  const rows = await prisma.cropConfig.findMany({ where: { cropYear: year } });
  const config = {};
  rows.forEach(r => {
    config[r.cropName] = {
      discount: r.discount,
      testWeight: r.testWeight,
      moistureShrink: r.moistureShrink
    };
  });
  return config;
}

// --- Helper: normalize ticket numbers for reconciliation matching ---
// Strips leading H/h prefix and leading zeros. Returns null for blank/zero-only inputs.
// Examples: "H066666" → "66666", "066666" → "66666", "h066666" → "66666", null → null, "0" → null
function normalizeTicketNo(ticketNo) {
  if (ticketNo == null) return null;
  const s = String(ticketNo).trim();
  if (!s) return null;
  // Strip leading H/h prefix
  const stripped = s.replace(/^[Hh]/, '');
  // Strip leading zeros
  const normalized = stripped.replace(/^0+/, '');
  // If result is empty (was all zeros), return null
  if (!normalized) return null;
  return normalized;
}

// --- Reconciliation matching engine ---
// Matches settlement lines to farm tickets by normalized ticket number.
// Scoped to buyerId + cropYear — never global.
// Skips lines with matchStatus 'manual' or 'disputed' to preserve user flags.
async function runMatch(settlementId) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: { lines: true }
  });
  if (!settlement) return { matched: 0, unmatched: 0 };

  // Load farm tickets scoped to same buyer + cropYear
  const farmTickets = await prisma.ticket.findMany({
    where: { buyerId: settlement.buyerId, cropYear: settlement.cropYear }
  });

  // Build normalized ticket number → ticket.id lookup map
  const ticketMap = {};
  farmTickets.forEach(t => {
    const norm = normalizeTicketNo(t.ticketNo);
    if (norm) ticketMap[norm] = t.id;
  });

  let matched = 0;
  let unmatched = 0;

  // Process each settlement line
  for (const line of settlement.lines) {
    // Skip lines with user-set flags
    if (line.matchStatus === 'manual' || line.matchStatus === 'disputed') continue;

    const norm = normalizeTicketNo(line.ticketNo);
    const farmTicketId = norm ? ticketMap[norm] : undefined;

    if (farmTicketId !== undefined) {
      await prisma.settlementLine.update({
        where: { id: line.id },
        data: { ticketId: farmTicketId, matchStatus: 'matched' }
      });
      matched++;
    } else {
      await prisma.settlementLine.update({
        where: { id: line.id },
        data: { ticketId: null, matchStatus: 'unmatched' }
      });
      unmatched++;
    }
  }

  return { matched, unmatched };
}

// --- Helper: convert Prisma Ticket row to JSON shape expected by client/calc.js ---
// Accepts optional settlementLines array (from Prisma include) to derive _reconciliation status.
function dbTicketToJson(dbTicket) {
  // Derive _reconciliation status from settlement lines if available
  let reconciliation = { status: 'unreconciled', lineCount: 0 };
  if (dbTicket.settlementLines && dbTicket.settlementLines.length > 0) {
    const lines = dbTicket.settlementLines;
    const lineCount = lines.length;
    // Priority order: disputed > manual > matched > unreconciled
    const statuses = lines.map(l => l.matchStatus);
    let status = 'unreconciled';
    if (statuses.includes('matched')) status = 'matched';
    if (statuses.includes('manual')) status = 'manual';
    if (statuses.includes('disputed')) status = 'disputed';
    reconciliation = { status, lineCount };
  }

  return {
    id: dbTicket.id,
    date: dbTicket.date instanceof Date ? dbTicket.date.toISOString().split('T')[0] : dbTicket.date,
    farm: dbTicket.farm,
    netWeight: dbTicket.netWeight,
    moisture: dbTicket.moisture,
    fm: dbTicket.fm || 0,
    crop: dbTicket.crop,
    registryCropId: dbTicket.registryCropId || null,  // canonical crop ID from farm-registry
    ticketNo: dbTicket.ticketNo || '',
    notes: dbTicket.notes || '',
    hbtBinNo: dbTicket.hbtBinNo || null,
    truckId: dbTicket.truckId || null,
    buyerId: dbTicket.buyerId || null,
    grainBinId: dbTicket.grainBinId || null,
    destination: dbTicket.destination || null,
    cropYear: dbTicket.cropYear,
    _reconciliation: reconciliation
  };
}

// --- Helper: convert Prisma Farm row to JSON shape expected by client/calc.js ---
function dbFarmToJson(dbFarm) {
  return {
    id: dbFarm.id,
    farm: dbFarm.name,
    crop: dbFarm.crop || '',
    acres: dbFarm.acres,
    unit: dbFarm.unit,
    type: dbFarm.type,
    guarantee: dbFarm.guarantee,
    coverage: dbFarm.coverage,
    claimThreshold: dbFarm.claimThreshold,
    discount: dbFarm.discount,
    testWeight: dbFarm.testWeight,
    driver: dbFarm.driver || '',
    truck: dbFarm.truck
  };
}

// --- Helper: enrich ticket with computed fields ---
function enrichTicket(ticket, cropConfig) {
  const computed = Calc.computeTicket(ticket, cropConfig);
  return Object.assign({}, ticket, { _computed: computed });
}

// --- Helper: compute farm summaries from DB ---
async function computeFarmSummaries() {
  const [dbTickets, dbFarms] = await Promise.all([
    prisma.ticket.findMany(),
    prisma.farm.findMany({ orderBy: { name: 'asc' } })
  ]);
  const cropConfig = await buildCropConfigObject();
  const jsonTickets = dbTickets.map(dbTicketToJson);
  const jsonFarms = dbFarms.map(dbFarmToJson);
  return Calc.computeFarmSummaries(jsonTickets, jsonFarms, cropConfig);
}

// --- Helper: compute crop aggregation by canonical registryCropId (CONS-11) ---
// Groups ticket totals by registryCropId for cross-module crop aggregation.
// Falls back to grouping by crop name string for tickets without registryCropId.
async function computeCropSummariesByRegistryId() {
  const dbTickets = await prisma.ticket.findMany({ select: {
    crop: true, registryCropId: true, netWeight: true, moisture: true, fm: true, cropYear: true
  }});
  const cropConfig = await buildCropConfigObject();

  const byId = {}; // registryCropId (or '__name__:cropName') → { registryCropId, cropName, totalNetLbs, ticketCount }
  dbTickets.forEach(t => {
    const json = { crop: t.crop, netWeight: t.netWeight, moisture: t.moisture, fm: t.fm };
    const computed = Calc.computeTicket(json, cropConfig);
    const key = t.registryCropId ? t.registryCropId : '__name__:' + (t.crop || '').trim().toLowerCase();
    if (!byId[key]) {
      byId[key] = { registryCropId: t.registryCropId || null, cropName: t.crop, totalNetLbs: 0, totalNetBU: 0, ticketCount: 0 };
    }
    byId[key].totalNetLbs += t.netWeight;
    byId[key].totalNetBU += computed.netBU || 0;
    byId[key].ticketCount++;
  });

  return Object.values(byId).sort((a, b) => (a.cropName || '').localeCompare(b.cropName || ''));
}

// --- Yield Pipeline (Phase 52) ---
// computeYieldSummaries: per-field per-crop yield totals grouped by registryId + registryCropId.
// Tickets must have BOTH Farm.registryId (the farm's canonical registry field ID) and
// Ticket.registryCropId (the canonical crop ID) to be included in yield computation.
async function computeYieldSummaries(cropYear) {
  const year = cropYear || new Date().getFullYear();

  // Load all tickets for this crop year, including the farm name for lookup
  const dbTickets = await prisma.ticket.findMany({
    where: { cropYear: year },
    select: {
      id: true, farm: true, netWeight: true, moisture: true, fm: true,
      crop: true, registryCropId: true, cropYear: true
    }
  });

  // Load all farms to get registryId and acres
  const dbFarms = await prisma.farm.findMany({
    select: { id: true, name: true, registryId: true, acres: true }
  });

  // Build farm name → farm lookup (lowercase, trimmed)
  const farmByName = {};
  dbFarms.forEach(f => {
    farmByName[(f.name || '').trim().toLowerCase()] = f;
  });

  // Get cropConfig for per-crop bushel computation
  const cropConfig = await buildCropConfigObject(year);

  // Group summaries by registryFieldId + registryCropId
  const groups = {}; // key: `${registryFieldId}::${registryCropId}`
  let noFieldIdCount = 0;
  let noCropIdCount = 0;
  const warnedFarms = {};  // track warned farms to log once per farm name
  const warnedCrops = {};  // track warned crops to log once per crop name

  dbTickets.forEach(t => {
    const farmKey = (t.farm || '').trim().toLowerCase();
    const farm = farmByName[farmKey];

    // Exclude tickets whose farm has no registryId
    if (!farm || !farm.registryId) {
      noFieldIdCount++;
      const farmName = t.farm || '(unknown)';
      if (!warnedFarms[farmName]) {
        warnedFarms[farmName] = true;
        console.warn(`Yield pipeline: tickets excluded — farm "${farmName}" has no registryId`);
      }
      return;
    }

    // Exclude tickets with no registryCropId
    if (!t.registryCropId) {
      noCropIdCount++;
      const cropName = t.crop || '(unknown)';
      if (!warnedCrops[cropName]) {
        warnedCrops[cropName] = true;
        console.warn(`Yield pipeline: tickets excluded — crop "${cropName}" has no registryCropId`);
      }
      return;
    }

    const key = `${farm.registryId}::${t.registryCropId}`;
    if (!groups[key]) {
      groups[key] = {
        registryFieldId: farm.registryId,
        registryCropId: t.registryCropId,
        farmName: farm.name,
        cropName: t.crop,
        acres: farm.acres || 0,
        totalNetLbs: 0,
        totalNetBU: 0,
        ticketCount: 0
      };
    }

    groups[key].totalNetLbs += t.netWeight;

    // Compute net BU using existing Calc.computeTicket with per-farm cropConfig
    const ticketJson = { crop: t.crop, netWeight: t.netWeight, moisture: t.moisture, fm: t.fm };
    const computed = Calc.computeTicket(ticketJson, cropConfig);
    groups[key].totalNetBU += computed.netBU || 0;
    groups[key].ticketCount++;
  });

  // Finalize: compute yieldPerAcre and round values
  const summaries = Object.values(groups).map(g => {
    const totalNetBU = Math.round(g.totalNetBU * 100) / 100;
    const yieldPerAcre = g.acres > 0 ? Math.round((totalNetBU / g.acres) * 100) / 100 : 0;
    return {
      registryFieldId: g.registryFieldId,
      registryCropId: g.registryCropId,
      farmName: g.farmName,
      cropName: g.cropName,
      totalNetLbs: Math.round(g.totalNetLbs * 100) / 100,
      totalNetBU,
      yieldPerAcre,
      acres: g.acres,
      ticketCount: g.ticketCount
    };
  });

  return {
    summaries,
    excludedTickets: { noFieldId: noFieldIdCount, noCropId: noCropIdCount }
  };
}

// pushYieldUpdates: called after every ticket save/edit/delete.
// Recomputes yield summaries and pushes to portal insurance_policies and farm-budget.
// Fire-and-forget — never blocks the ticket response. Failures are logged but not thrown.
async function pushYieldUpdates(cropYear) {
  const { summaries, excludedTickets } = await computeYieldSummaries(cropYear);
  console.log(
    `Yield summaries recomputed: ${summaries.length} field/crop combos` +
    (excludedTickets.noFieldId > 0 ? `, ${excludedTickets.noFieldId} excluded (no field ID)` : '') +
    (excludedTickets.noCropId > 0 ? `, ${excludedTickets.noCropId} excluded (no crop ID)` : '')
  );

  const token = process.env.EMBED_TOKEN;
  if (!token) {
    console.warn('pushYieldUpdates: EMBED_TOKEN not set — skipping push to portal and farm-budget');
    return;
  }

  const portalUrl = process.env.PORTAL_ORIGIN || 'http://localhost:3010';
  const budgetUrl = process.env.BUDGET_API_URL || 'http://localhost:3001';
  const payload = JSON.stringify({ summaries, cropYear });
  const headers = { 'Content-Type': 'application/json', 'x-ecosystem-token': token };

  // Push to both endpoints in parallel — independent failures, fire-and-forget
  const [portalResult, budgetResult] = await Promise.allSettled([
    fetch(portalUrl + '/api/insurance/yield-push', {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000)
    }).then(r => r.ok ? `ok (${r.status})` : `http-${r.status}`),
    fetch(budgetUrl + '/api/yield-from-grain', {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000)
    }).then(r => r.ok ? `ok (${r.status})` : `http-${r.status}`)
  ]);

  const portalStatus = portalResult.status === 'fulfilled' ? portalResult.value : `err: ${portalResult.reason?.message || portalResult.reason}`;
  const budgetStatus = budgetResult.status === 'fulfilled' ? budgetResult.value : `err: ${budgetResult.reason?.message || budgetResult.reason}`;
  console.log(`Yield push: portal=${portalStatus}, budget=${budgetStatus}`);
}

// --- Validation ---
function validateTicket(body, cropConfig) {
  const errors = [];
  const netWeight = parseFloat(body.netWeight);
  const moisture = parseFloat(body.moisture);
  const fm = parseFloat(body.fm);

  if (!body.farm || !(body.farm + '').trim()) errors.push('Farm is required');
  if (!body.crop || !(body.crop + '').trim()) errors.push('Crop is required');
  if (body.crop && (body.crop + '').trim()) {
    const trimmed = (body.crop + '').trim();
    if (!cropConfig[trimmed]) {
      let found = false;
      for (const key in cropConfig) {
        if (key.trim() === trimmed) { found = true; break; }
      }
      if (!found) errors.push('Crop "' + trimmed + '" not in crop config');
    }
  }
  if (isNaN(netWeight) || netWeight <= 0) errors.push('Net weight must be greater than 0');
  if (!isNaN(moisture) && (moisture < 0 || moisture > 50)) errors.push('Moisture must be between 0 and 50');
  if (!isNaN(fm) && (fm < 0 || fm > 100)) errors.push('FM must be between 0 and 100');
  if (body.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      errors.push('Date must be YYYY-MM-DD format');
    } else if (isNaN(new Date(body.date + 'T00:00:00').getTime())) {
      errors.push('Invalid date');
    }
  }
  return errors;
}

// --- CSV export helper ---
function csvEscape(val) {
  const s = String(val == null ? '' : val);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// --- API Routes ---

// Tickets
app.get('/api/tickets', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store'); // Prevent stale filter results when switching destination/buyer filters
    const where = {};
    if (req.query.buyerId) {
      const bid = parseInt(req.query.buyerId, 10);
      if (!isNaN(bid)) where.buyerId = bid;
    }
    if (req.query.grainBinId) {
      const gid = parseInt(req.query.grainBinId, 10);
      if (!isNaN(gid)) where.grainBinId = gid;
    }
    if (req.query.cropYear) {
      const cy = parseInt(req.query.cropYear, 10);
      if (!isNaN(cy)) where.cropYear = cy;
    }
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { settlementLines: { select: { matchStatus: true } } }
    });
    const cropConfig = await buildCropConfigObject();
    const enriched = tickets.map(t => enrichTicket(dbTicketToJson(t), cropConfig));
    res.json(enriched);
  } catch (e) {
    console.error('GET /api/tickets error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tickets/search', async (req, res) => {
  try {
    const q = (req.query.ticketNo || '').trim();
    if (!q) return res.json([]);
    const tickets = await prisma.ticket.findMany({
      where: { ticketNo: { contains: q, mode: 'insensitive' } }
    });
    const cropConfig = await buildCropConfigObject();
    res.json(tickets.map(t => enrichTicket(dbTicketToJson(t), cropConfig)));
  } catch (e) {
    console.error('GET /api/tickets/search error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { settlementLines: { select: { matchStatus: true } } }
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const cropConfig = await buildCropConfigObject(ticket.cropYear);
    res.json(enrichTicket(dbTicketToJson(ticket), cropConfig));
  } catch (e) {
    console.error('GET /api/tickets/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const { date, farm, netWeight, moisture, crop, ticketNo, notes, fm } = req.body;
    const cleanTicketNo = (ticketNo || '').trim();

    // Parse destination FK fields — new tickets use buyerId/grainBinId, not free-text destination
    const buyerId = req.body.buyerId ? parseInt(req.body.buyerId, 10) || null : null;
    const grainBinId = req.body.grainBinId ? parseInt(req.body.grainBinId, 10) || null : null;

    // Duplicate ticket check
    if (cleanTicketNo) {
      const existing = await prisma.ticket.findFirst({ where: { ticketNo: cleanTicketNo } });
      if (existing) {
        const d = existing.date instanceof Date ? existing.date.toISOString().split('T')[0] : existing.date;
        return res.status(409).json({
          error: 'Duplicate ticket number',
          message: `Ticket ${cleanTicketNo} already exists (entered on ${d} for ${existing.farm})`
        });
      }
    }

    // Validation
    const cropYear = getCropYear(date);
    const cropConfig = await buildCropConfigObject(cropYear);
    const validationErrors = validateTicket(req.body, cropConfig);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: validationErrors });
    }

    const ticket = await prisma.ticket.create({
      data: {
        date: new Date((date || new Date().toISOString().split('T')[0]) + 'T12:00:00.000Z'),
        cropYear,
        farm: (farm || '').trim(),
        netWeight: parseFloat(netWeight) || 0,
        moisture: parseFloat(moisture) || 0,
        fm: parseFloat(fm) || 0,
        crop: (crop || '').trim(),
        ticketNo: cleanTicketNo || null,
        notes: (notes || '').trim() || null,
        buyerId: buyerId,
        grainBinId: grainBinId,
        destination: null,  // New tickets use FK (buyerId/grainBinId), not free-text
        registryCropId: req.body.registryCropId || null  // canonical crop ID from farm-registry
      }
    });
    res.status(201).json(enrichTicket(dbTicketToJson(ticket), cropConfig));
    // Trigger yield recompute after response — fire-and-forget, never blocks client
    pushYieldUpdates(cropYear).catch(err => console.error('pushYieldUpdates (POST) error:', err));
  } catch (e) {
    console.error('POST /api/tickets error:', e);
    if (e.code === 'P2002') return res.status(409).json({ error: 'Duplicate ticket' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Ticket not found' });

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    const updateData = {};
    const fields = ['date', 'farm', 'netWeight', 'moisture', 'crop', 'ticketNo', 'notes', 'fm'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (['netWeight', 'moisture', 'fm'].includes(f)) {
          updateData[f] = parseFloat(req.body[f]) || 0;
        } else if (f === 'date') {
          updateData.date = new Date(req.body[f] + 'T12:00:00.000Z');
          updateData.cropYear = getCropYear(req.body[f]);
        } else if (f === 'ticketNo') {
          updateData.ticketNo = (req.body[f] || '').trim() || null;
        } else if (f === 'notes') {
          updateData.notes = (req.body[f] || '').trim() || null;
        } else {
          updateData[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
        }
      }
    });

    // Handle destination FK fields separately
    if (req.body.buyerId !== undefined) {
      updateData.buyerId = req.body.buyerId ? parseInt(req.body.buyerId, 10) || null : null;
    }
    if (req.body.grainBinId !== undefined) {
      updateData.grainBinId = req.body.grainBinId ? parseInt(req.body.grainBinId, 10) || null : null;
    }
    // Persist canonical crop ID from farm-registry when provided
    if (req.body.registryCropId !== undefined) {
      updateData.registryCropId = req.body.registryCropId || null;
    }

    const ticket = await prisma.ticket.update({ where: { id }, data: updateData });
    const cropConfig = await buildCropConfigObject(ticket.cropYear);
    res.json(enrichTicket(dbTicketToJson(ticket), cropConfig));
    // Trigger yield recompute after response — fire-and-forget, never blocks client
    pushYieldUpdates(ticket.cropYear).catch(err => console.error('pushYieldUpdates (PUT) error:', err));
  } catch (e) {
    console.error('PUT /api/tickets/:id error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Ticket not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Ticket not found' });
    // Read cropYear before deletion so we can recompute the correct year after
    const existing = await prisma.ticket.findUnique({ where: { id }, select: { cropYear: true } });
    const cropYear = existing ? existing.cropYear : new Date().getFullYear();
    await prisma.ticket.delete({ where: { id } });
    res.json({ ok: true });
    // Trigger yield recompute after response — fire-and-forget, never blocks client
    pushYieldUpdates(cropYear).catch(err => console.error('pushYieldUpdates (DELETE) error:', err));
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Ticket not found' });
    console.error('DELETE /api/tickets/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Batch Delete ---
app.post('/api/tickets/batch-delete', async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No ticket IDs provided' });
    }
    const intIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    const result = await prisma.ticket.deleteMany({ where: { id: { in: intIds } } });
    res.json({ ok: true, deleted: result.count });
  } catch (e) {
    console.error('POST /api/tickets/batch-delete error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- CSV Export ---
app.get('/api/export/tickets', async (req, res) => {
  try {
    let where = {};
    if (req.query.farm) {
      where.farm = { equals: req.query.farm.trim(), mode: 'insensitive' };
    }
    if (req.query.crop) {
      where.crop = { equals: req.query.crop.trim(), mode: 'insensitive' };
    }
    if (req.query.dateFrom || req.query.dateTo) {
      where.date = {};
      if (req.query.dateFrom) where.date.gte = new Date(req.query.dateFrom + 'T00:00:00.000Z');
      if (req.query.dateTo) where.date.lte = new Date(req.query.dateTo + 'T23:59:59.999Z');
    }
    if (req.query.buyerId) {
      const bid = parseInt(req.query.buyerId, 10);
      if (!isNaN(bid)) where.buyerId = bid;
    }
    if (req.query.grainBinId) {
      const gid = parseInt(req.query.grainBinId, 10);
      if (!isNaN(gid)) where.grainBinId = gid;
    }
    if (req.query.cropYear) {
      const cy = parseInt(req.query.cropYear, 10);
      if (!isNaN(cy)) where.cropYear = cy;
    }

    const tickets = await prisma.ticket.findMany({ where });
    const cropConfig = await buildCropConfigObject();

    const headers = ['Date', 'Farm', 'Net Weight (lbs)', 'Moisture %', 'Crop', 'Ticket No', 'Notes', 'FM',
      'Gross BU', 'Net BU', 'Discount', 'Test Weight', 'Moisture Shrink'];

    const rows = tickets.map(t => {
      const json = dbTicketToJson(t);
      const c = Calc.computeTicket(json, cropConfig);
      return [json.date, json.farm, json.netWeight, json.moisture, json.crop, json.ticketNo, json.notes, json.fm,
        c.grossBU, c.netBU, c.discount, c.testWeight, c.moistureShrink];
    });

    const csv = [headers.join(',')].concat(rows.map(row => row.map(csvEscape).join(','))).join('\n');

    let filename = 'grain-tickets';
    if (req.query.farm) filename += '-' + req.query.farm.trim().replace(/\s+/g, '-');
    if (req.query.crop) filename += '-' + req.query.crop.trim().replace(/\s+/g, '-');
    filename += '.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(csv);
  } catch (e) {
    console.error('GET /api/export/tickets error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/export/farms', async (req, res) => {
  try {
    const summaries = await computeFarmSummaries();

    const headers = ['Farm', 'Crop', 'Acres', 'Total BU', 'Yield/Acre', 'Unit', 'Type',
      'Guarantee', 'Coverage', 'Claim Threshold', 'Discount', 'Test Weight'];

    const rows = summaries.map(f => [f.farm, f.crop, f.acres, f.totalBU, f.yieldPerAcre, f.unit, f.type,
      f.guarantee, f.coverage, f.claimThreshold, f.discount, f.testWeight]);

    const csv = [headers.join(',')].concat(rows.map(row => row.map(csvEscape).join(','))).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="farm-summary.csv"');
    res.send(csv);
  } catch (e) {
    console.error('GET /api/export/farms error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Yield summaries by field+crop (Phase 52) ---
// Returns per-field per-crop yield totals grouped by registryFieldId + registryCropId.
// Optional query param: ?cropYear=2026 (defaults to current year)
app.get('/api/yield-summaries', async (req, res) => {
  try {
    const cropYear = req.query.cropYear ? parseInt(req.query.cropYear, 10) : new Date().getFullYear();
    const result = await computeYieldSummaries(cropYear);
    res.json({ summaries: result.summaries, cropYear, excludedTickets: result.excludedTickets });
  } catch (e) {
    console.error('GET /api/yield-summaries error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Crop aggregation by canonical registry ID (CONS-11) ---
// Used for cross-module crop summaries — groups by registryCropId, not crop name string.
app.get('/api/summary/by-crop', async (req, res) => {
  try {
    const summary = await computeCropSummariesByRegistryId();
    res.json(summary);
  } catch (e) {
    console.error('GET /api/summary/by-crop error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Farms
app.get('/api/farms', async (req, res) => {
  try {
    const summaries = await computeFarmSummaries();
    res.json(summaries);
  } catch (e) {
    console.error('GET /api/farms error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/farms/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Farm not found' });
    const farm = await prisma.farm.findUnique({ where: { id } });
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const tickets = await prisma.ticket.findMany({
      where: { farm: { equals: farm.name.trim(), mode: 'insensitive' } }
    });
    const cropConfig = await buildCropConfigObject();
    const jsonTickets = tickets.map(t => enrichTicket(dbTicketToJson(t), cropConfig));
    const jsonFarm = dbFarmToJson(farm);
    const summaries = Calc.computeFarmSummaries(tickets.map(dbTicketToJson), [jsonFarm], cropConfig);
    res.json(Object.assign({}, summaries[0], { tickets: jsonTickets }));
  } catch (e) {
    console.error('GET /api/farms/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/farms/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Farm not found' });

    const existing = await prisma.farm.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Farm not found' });

    const updateData = {};
    // Farm model uses 'name' but client sends 'farm' — handle both
    const fieldMap = {
      farm: 'name',
      crop: 'crop',
      acres: 'acres',
      unit: 'unit',
      type: 'type',
      guarantee: 'guarantee',
      coverage: 'coverage',
      claimThreshold: 'claimThreshold',
      discount: 'discount',
      testWeight: 'testWeight',
      driver: 'driver',
      truck: 'truck',
      registryId: 'registryId'  // farm-registry canonical field ID
    };
    const numericFields = ['acres', 'guarantee', 'coverage', 'claimThreshold', 'discount', 'testWeight', 'truck'];
    Object.entries(fieldMap).forEach(([clientField, dbField]) => {
      if (req.body[clientField] !== undefined) {
        if (numericFields.includes(clientField)) {
          updateData[dbField] = parseFloat(req.body[clientField]) || 0;
        } else {
          updateData[dbField] = typeof req.body[clientField] === 'string' ? req.body[clientField].trim() : req.body[clientField];
        }
      }
    });

    const farm = await prisma.farm.update({ where: { id }, data: updateData });
    const [dbTickets] = await Promise.all([
      prisma.ticket.findMany({ where: { farm: { equals: farm.name.trim(), mode: 'insensitive' } } })
    ]);
    const cropConfig = await buildCropConfigObject();
    const summaries = Calc.computeFarmSummaries(dbTickets.map(dbTicketToJson), [dbFarmToJson(farm)], cropConfig);
    res.json(summaries[0]);
  } catch (e) {
    console.error('PUT /api/farms/:id error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Farm not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Crops CRUD
app.get('/api/crops', async (req, res) => {
  try {
    const cropConfig = await buildCropConfigObject();
    res.json(cropConfig);
  } catch (e) {
    console.error('GET /api/crops error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy crop types from farm-budget (the master crop/sub-crop list)
app.get('/api/crop-types', async (req, res) => {
  try {
    const budgetUrl = process.env.FARM_BUDGET_URL || 'http://localhost:3001';
    const resp = await fetch(budgetUrl + '/api/crop-types');
    if (!resp.ok) throw new Error('farm-budget returned ' + resp.status);
    const cropTypes = await resp.json();
    res.json(cropTypes);
  } catch (e) {
    console.error('GET /api/crop-types proxy error:', e.message);
    // Fallback: derive list from local cropConfig so dropdown still works
    const cropConfig = await buildCropConfigObject();
    const fallback = Object.keys(cropConfig).sort().map(name => ({
      id: name,
      name: name,
      subCrops: [{ name }]
    }));
    res.json(fallback);
  }
});

app.post('/api/crops', async (req, res) => {
  try {
    const { name, discount, testWeight, moistureShrink } = req.body;
    const trimmedName = (name || '').trim();
    if (!trimmedName) return res.status(400).json({ error: 'Crop name is required' });

    const cropYear = new Date().getFullYear();
    const crop = await prisma.cropConfig.create({
      data: {
        cropYear,
        cropName: trimmedName,
        discount: parseFloat(discount) || 0,
        testWeight: parseFloat(testWeight) || 56,
        moistureShrink: parseFloat(moistureShrink) || 0
      }
    });
    res.status(201).json({
      name: crop.cropName,
      discount: crop.discount,
      testWeight: crop.testWeight,
      moistureShrink: crop.moistureShrink
    });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Crop already exists' });
    console.error('POST /api/crops error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/crops/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const cropYear = new Date().getFullYear();
    const existing = await prisma.cropConfig.findFirst({ where: { cropName: name, cropYear } });
    if (!existing) return res.status(404).json({ error: 'Crop not found' });

    const updateData = {};
    ['discount', 'testWeight', 'moistureShrink'].forEach(f => {
      if (req.body[f] !== undefined) {
        updateData[f] = parseFloat(req.body[f]) || 0;
      }
    });

    const crop = await prisma.cropConfig.update({ where: { id: existing.id }, data: updateData });
    res.json({
      name: crop.cropName,
      discount: crop.discount,
      testWeight: crop.testWeight,
      moistureShrink: crop.moistureShrink
    });
  } catch (e) {
    console.error('PUT /api/crops/:name error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Crop not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/crops/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const cropYear = new Date().getFullYear();
    const existing = await prisma.cropConfig.findFirst({ where: { cropName: name, cropYear } });
    if (!existing) return res.status(404).json({ error: 'Crop not found' });
    await prisma.cropConfig.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/crops/:name error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Crop not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- CropConfig Tolerance CRUD ---

// GET /api/crop-config/tolerances?cropYear=N — list all CropConfig rows for a year with tolerance fields
app.get('/api/crop-config/tolerances', async (req, res) => {
  try {
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(cropYear)) return res.status(400).json({ error: 'cropYear is required' });
    const rows = await prisma.cropConfig.findMany({
      where: { cropYear },
      orderBy: { cropName: 'asc' },
      select: { id: true, cropName: true, tolerancePct: true, toleranceLbs: true }
    });
    res.json(rows);
  } catch (e) {
    console.error('GET /api/crop-config/tolerances error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/crop-config/:id/tolerance — update tolerance values for a CropConfig row
app.put('/api/crop-config/:id/tolerance', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const tolerancePct = parseFloat(req.body.tolerancePct);
    const toleranceLbs = parseFloat(req.body.toleranceLbs);
    if (isNaN(tolerancePct) || tolerancePct < 0) return res.status(400).json({ error: 'tolerancePct must be a non-negative number' });
    if (isNaN(toleranceLbs) || toleranceLbs < 0) return res.status(400).json({ error: 'toleranceLbs must be a non-negative number' });

    const updated = await prisma.cropConfig.update({
      where: { id },
      data: { tolerancePct, toleranceLbs },
      select: { id: true, cropName: true, tolerancePct: true, toleranceLbs: true }
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'CropConfig not found' });
    console.error('PUT /api/crop-config/:id/tolerance error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Farms CRUD
app.post('/api/farms', async (req, res) => {
  try {
    const farm = await prisma.farm.create({
      data: {
        name: (req.body.farm || '').trim(),
        crop: (req.body.crop || '').trim() || null,
        acres: parseFloat(req.body.acres) || 0,
        unit: req.body.unit || 'BU',
        type: req.body.type || 'Conventional',
        guarantee: parseFloat(req.body.guarantee) || 0,
        coverage: parseFloat(req.body.coverage) || 0,
        claimThreshold: parseFloat(req.body.claimThreshold) || 0,
        discount: parseFloat(req.body.discount) || 0,
        testWeight: parseFloat(req.body.testWeight) || 56,
        driver: req.body.driver || null,
        truck: parseFloat(req.body.truck) || 0,
        registryId: req.body.registryId || null  // farm-registry canonical field ID
      }
    });
    res.status(201).json(dbFarmToJson(farm));
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Farm already exists' });
    console.error('POST /api/farms error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/farms/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Farm not found' });
    await prisma.farm.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Farm not found' });
    console.error('DELETE /api/farms/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/farm-names', async (req, res) => {
  try {
    const farms = await prisma.farm.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
    const names = [...new Set(farms.map(f => f.name))];
    res.json(names);
  } catch (e) {
    console.error('GET /api/farm-names error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Proxy: registry crop list (avoids CORS when called from browser) ---
// Cached 60s in-memory to avoid hammering farm-registry on every page load
const REGISTRY_URL = process.env.FARM_REGISTRY_URL || 'http://localhost:3005';
let _gtRegistryCropsCache = null;
let _gtRegistryCropsCacheExpiry = 0;
app.get('/api/registry/crops', async (req, res) => {
  try {
    const now = Date.now();
    if (!_gtRegistryCropsCache || now > _gtRegistryCropsCacheExpiry) {
      const resp = await fetch(`${REGISTRY_URL}/api/crops`);
      if (!resp.ok) throw new Error('Registry returned ' + resp.status);
      _gtRegistryCropsCache = await resp.json();
      _gtRegistryCropsCacheExpiry = now + 60 * 1000; // 60s cache
    }
    res.json(_gtRegistryCropsCache);
  } catch (err) {
    res.status(502).json({ error: 'Registry crops unavailable: ' + err.message });
  }
});

// --- Sync Farm acres from Farm Registry ---
// Uses Farm.registryId for canonical ID lookup when available; falls back to name matching.
app.post('/api/farms/sync-registry', async (req, res) => {
  try {
    const resp = await fetch(`${REGISTRY_URL}/api/fields?active=true`);
    if (!resp.ok) throw new Error('Registry returned ' + resp.status);
    const regFields = await resp.json();

    // Build ID lookup (canonical) and name/alias lookup (fallback)
    const regById = {};
    const regByName = {};
    regFields.forEach(rf => {
      regById[rf.id] = rf;
      regByName[rf.name.toLowerCase()] = rf;
      (rf.aliases || []).forEach(a => { regByName[a.toLowerCase()] = rf; });
    });

    const dbFarms = await prisma.farm.findMany();
    const results = { synced: [], unmatched: [], unchanged: [] };

    for (const farm of dbFarms) {
      // Prefer canonical ID lookup; fall back to name matching for legacy records
      let regField = farm.registryId ? regById[farm.registryId] : null;
      if (!regField) {
        regField = regByName[(farm.name || '').toLowerCase().trim()];
      }
      if (!regField) {
        results.unmatched.push(farm.name);
        continue;
      }

      const updateData = {};
      // Store registryId so future syncs use the canonical ID path
      if (!farm.registryId && regField.id) updateData.registryId = regField.id;
      // Sync reporting acres from registry
      if (Math.abs((farm.reportingAcres || 0) - (regField.reportingAcres || 0)) > 0.001) {
        updateData.reportingAcres = regField.reportingAcres;
      }
      // Sync organic acres from registry
      if (Math.abs((farm.organicAcres || 0) - (regField.organicAcres || 0)) > 0.001) {
        updateData.organicAcres = regField.organicAcres;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.syncedAt = new Date();
        await prisma.farm.update({ where: { id: farm.id }, data: updateData });
        results.synced.push({ name: farm.name, ...updateData });
      } else {
        results.unchanged.push(farm.name);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('POST /api/farms/sync-registry error:', err);
    res.status(502).json({ error: 'Registry sync failed: ' + err.message });
  }
});

// --- Stats endpoint for cross-app consumption ---
app.get('/api/stats', async (req, res) => {
  try {
    const [dbTickets, dbFarms] = await Promise.all([
      prisma.ticket.findMany(),
      prisma.farm.findMany()
    ]);
    const cropConfig = await buildCropConfigObject();
    const tickets = dbTickets.map(dbTicketToJson);

    let totalMoisture = 0;
    let moistureCount = 0;
    const dailyIntake = {};
    const cropStats = {};

    tickets.forEach(t => {
      const c = Calc.computeTicket(t, cropConfig);

      if (t.moisture > 0) {
        totalMoisture += t.moisture;
        moistureCount++;
      }

      if (t.date) {
        if (!dailyIntake[t.date]) dailyIntake[t.date] = { weight: 0, tickets: 0, netBU: 0 };
        dailyIntake[t.date].weight += t.netWeight;
        dailyIntake[t.date].tickets += 1;
        dailyIntake[t.date].netBU += c.netBU;
      }

      const cropName = (t.crop || '').trim();
      if (cropName) {
        if (!cropStats[cropName]) {
          cropStats[cropName] = { totalBU: 0, totalWeight: 0, totalMoisture: 0, count: 0, farmSet: {} };
        }
        cropStats[cropName].totalBU += c.netBU;
        cropStats[cropName].totalWeight += t.netWeight;
        cropStats[cropName].totalMoisture += (t.moisture || 0);
        cropStats[cropName].count += 1;
        cropStats[cropName].farmSet[(t.farm || '').trim().toLowerCase()] = true;
      }
    });

    const dailyArray = Object.keys(dailyIntake).sort().map(date => ({
      date, weight: dailyIntake[date].weight, tickets: dailyIntake[date].tickets,
      netBU: Math.round(dailyIntake[date].netBU * 100) / 100
    }));

    const cropArray = Object.keys(cropStats).map(name => {
      const s = cropStats[name];
      return {
        crop: name,
        totalBU: Math.round(s.totalBU * 100) / 100,
        totalWeight: s.totalWeight,
        avgMoisture: s.count > 0 ? Math.round((s.totalMoisture / s.count) * 100) / 100 : 0,
        ticketCount: s.count,
        farmCount: Object.keys(s.farmSet).length
      };
    }).sort((a, b) => b.totalBU - a.totalBU);

    res.json({
      totalTickets: dbTickets.length,
      totalFarms: dbFarms.length,
      avgMoisture: moistureCount > 0 ? Math.round((totalMoisture / moistureCount) * 100) / 100 : 0,
      dailyIntake: dailyArray,
      cropSummary: cropArray
    });
  } catch (e) {
    console.error('GET /api/stats error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Grain Bins CRUD ---
app.get('/api/grain-bins', async (req, res) => {
  try {
    const bins = await prisma.grainBin.findMany({ orderBy: { name: 'asc' } });
    res.json(bins);
  } catch (e) {
    console.error('GET /api/grain-bins error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/grain-bins', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Bin name is required' });
    const bin = await prisma.grainBin.create({
      data: {
        name,
        capacity: parseFloat(req.body.capacity) || 0,
        notes: (req.body.notes || '').trim() || null
      }
    });
    res.status(201).json(bin);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A bin with that name already exists' });
    console.error('POST /api/grain-bins error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/grain-bins/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Grain bin not found' });
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = (req.body.name || '').trim();
    if (req.body.capacity !== undefined) updateData.capacity = parseFloat(req.body.capacity) || 0;
    if (req.body.notes !== undefined) updateData.notes = (req.body.notes || '').trim() || null;
    const bin = await prisma.grainBin.update({ where: { id }, data: updateData });
    res.json(bin);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Grain bin not found' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'A bin with that name already exists' });
    console.error('PUT /api/grain-bins/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/grain-bins/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Grain bin not found' });
    const ticketCount = await prisma.ticket.count({ where: { grainBinId: id } });
    if (ticketCount > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} reference this bin. Reassign them first.`
      });
    }
    await prisma.grainBin.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Grain bin not found' });
    console.error('DELETE /api/grain-bins/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Buyer proxy from farm-budget ---
app.get('/api/buyers', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let buyers;
    try {
      const response = await fetch('http://localhost:3001/api/buyers', { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        console.error('GET /api/buyers: farm-budget returned status', response.status);
        return res.json({ _source: 'unavailable', buyers: [] });
      }
      buyers = await response.json();
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error('GET /api/buyers: farm-budget unreachable:', fetchErr.message);
      return res.json({ _source: 'unavailable', buyers: [] });
    }
    res.json(buyers);
  } catch (e) {
    console.error('GET /api/buyers error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Merged destinations endpoint ---
app.get('/api/destinations', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const [binsResult, buyersResult] = await Promise.allSettled([
      prisma.grainBin.findMany({ orderBy: { name: 'asc' } }),
      (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch('http://localhost:3001/api/buyers', { signal: controller.signal });
          clearTimeout(timeout);
          if (!response.ok) return [];
          return await response.json();
        } catch (e) {
          clearTimeout(timeout);
          console.error('GET /api/destinations: farm-budget fetch failed:', e.message);
          return [];
        }
      })()
    ]);

    const bins = binsResult.status === 'fulfilled' ? binsResult.value : [];
    const buyers = buyersResult.status === 'fulfilled' ? buyersResult.value : [];

    const binItems = bins.map(b => ({
      id: b.id,
      type: 'bin',
      name: b.name,
      capacity: b.capacity
    }));

    const buyerItems = Array.isArray(buyers) ? buyers.map(b => ({
      id: b.id,
      type: 'buyer',
      name: b.name,
      shortCode: b.shortCode || null,
      buyerType: b.type || null
    })) : [];

    // Bins grouped first, each group sorted alphabetically
    const merged = [
      ...binItems.sort((a, b) => a.name.localeCompare(b.name)),
      ...buyerItems.sort((a, b) => a.name.localeCompare(b.name))
    ];

    res.json(merged);
  } catch (e) {
    console.error('GET /api/destinations error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- BuyerColumnMap routes ---
app.get('/api/buyers/:id/column-maps', async (req, res) => {
  try {
    const buyerId = parseInt(req.params.id, 10);
    if (isNaN(buyerId)) return res.json([]);
    const maps = await prisma.buyerColumnMap.findMany({ where: { buyerId } });
    res.json(maps);
  } catch (e) {
    console.error('GET /api/buyers/:id/column-maps error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/buyers/:id/column-maps', async (req, res) => {
  try {
    const buyerId = parseInt(req.params.id, 10);
    if (isNaN(buyerId)) return res.status(400).json({ error: 'Invalid buyer ID' });
    const { fieldName, csvColumn } = req.body;
    if (!fieldName) return res.status(400).json({ error: 'fieldName is required' });
    if (!csvColumn) return res.status(400).json({ error: 'csvColumn is required' });
    const map = await prisma.buyerColumnMap.upsert({
      where: { buyerId_fieldName: { buyerId, fieldName } },
      update: { csvColumn },
      create: { buyerId, fieldName, csvColumn }
    });
    res.json(map);
  } catch (e) {
    console.error('PUT /api/buyers/:id/column-maps error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/buyers/:id/column-maps/:mapId', async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId, 10);
    if (isNaN(mapId)) return res.status(404).json({ error: 'Column map not found' });
    await prisma.buyerColumnMap.delete({ where: { id: mapId } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Column map not found' });
    console.error('DELETE /api/buyers/:id/column-maps/:mapId error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Ticket Scanning via Claude Vision ---
app.post('/api/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Scanning not configured. Set ANTHROPIC_API_KEY environment variable.' });
    }

    const cropConfig = await buildCropConfigObject();
    const cropNames = Object.keys(cropConfig);
    const farms = await prisma.farm.findMany({ select: { name: true } });
    const farmNames = [...new Set(farms.map(f => f.name))].sort();

    const base64Data = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;
    const isPdf = mediaType === 'application/pdf';

    const fileBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: buildScanPrompt(cropNames, farmNames)
            }
          ]
        }
      ]
    });

    const responseText = message.content[0].text;
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('Failed to parse scan response:', responseText);
      return res.status(500).json({ error: 'Could not parse scan results' });
    }

    const result = {
      ticketNo: parsed.ticketNo || null,
      netWeight: parsed.netWeight != null ? parseFloat(parsed.netWeight) || null : null,
      moisture: parsed.moisture != null ? parseFloat(parsed.moisture) || null : null,
      fm: parsed.fm != null ? parseFloat(parsed.fm) || null : null,
      date: parsed.date || null,
      farm: parsed.farm || null,
      crop: parsed.crop || null,
      notes: parsed.notes || null
    };

    res.json(result);

  } catch (err) {
    console.error('Scan error:', err);
    res.status(err.status || 500).json({
      error: 'Scan failed: ' + (err.message || 'Unknown error')
    });
  }
});

function buildScanPrompt(cropNames, farmNames) {
  return `You are reading a grain elevator scale ticket. Extract the following fields from the image.

Return ONLY a JSON object with these exact keys:
- "ticketNo": The ticket/scale number (string, e.g., "H066666")
- "netWeight": Net weight in pounds (number only, no commas, e.g., 55480)
- "moisture": Moisture percentage (number, e.g., 12.9)
- "fm": Foreign matter percentage (number, e.g., 0.1)
- "date": Date in YYYY-MM-DD format (e.g., "2025-10-15")
- "farm": Farm name or customer name (string)
- "crop": Crop type. Must be one of these exact values: ${JSON.stringify(cropNames)}. If the ticket says something equivalent (e.g., "corn" matches "Non-GMO Yellow Corn"), use the closest match from this list.
- "notes": Any additional info like hauler/truck number, bin number, or other notes (string)

Rules:
- If you cannot read a field clearly, set it to null.
- For netWeight, extract the NET weight (not gross or tare). It is in pounds.
- For date, convert to YYYY-MM-DD format regardless of how it appears on the ticket.
- For farm, if you recognize any of these known farms, use the exact name: ${JSON.stringify(farmNames)}
- Return ONLY the JSON object, no other text.`;
}

// --- Settlement Routes ---

// POST /api/settlements/parse — upload file, parse headers + preview, create Settlement record
app.post('/api/settlements/parse', uploadSettlement.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { buyerId, cropYear } = req.body;
    if (!buyerId || !cropYear) return res.status(400).json({ error: 'buyerId and cropYear are required' });

    // Read saved file back as Buffer for XLSX parsing
    const buf = fs.readFileSync(req.file.path);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // header:1 gives raw array rows — first row is column headers
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defVal: '' });
    if (allRows.length === 0) return res.status(422).json({ error: 'File appears to be empty' });

    const headers = allRows[0].map(h => String(h).trim()).filter(h => h.length > 0);
    // 5-row preview of actual data (skip header row, filter blank rows, align to header count)
    const previewRows = allRows.slice(1)
      .filter(r => r.some(c => c !== ''))
      .slice(0, 5)
      .map(r => r.slice(0, headers.length));

    if (headers.length === 0) return res.status(422).json({ error: 'No column headers found in file' });

    // Create Settlement header record (no lines yet), store filePath for commit step
    const settlement = await prisma.settlement.create({
      data: {
        buyerId: parseInt(buyerId, 10),
        cropYear: parseInt(cropYear, 10),
        sourceFile: req.file.originalname,
        filePath: req.file.path
      }
    });

    // Load saved BuyerColumnMap for this buyer (pre-fill dropdowns on subsequent imports)
    const savedMaps = await prisma.buyerColumnMap.findMany({
      where: { buyerId: parseInt(buyerId, 10) }
    });
    const savedMapping = {};
    savedMaps.forEach(m => { savedMapping[m.fieldName] = m.csvColumn; });

    res.json({ settlementId: settlement.id, headers, previewRows, savedMapping });
  } catch (e) {
    console.error('POST /api/settlements/parse error:', e);
    res.status(500).json({ error: e.message || 'Parse failed' });
  }
});

// POST /api/settlements/:id/commit — apply column mapping, bulk insert SettlementLines, save BuyerColumnMap
app.post('/api/settlements/:id/commit', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id, 10);
    if (isNaN(settlementId)) return res.status(404).json({ error: 'Settlement not found' });
    const { mapping } = req.body;
    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ error: 'mapping is required' });
    }

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    if (!settlement.filePath) return res.status(400).json({ error: 'No file associated with this settlement' });

    // Read saved file and parse
    const buf = fs.readFileSync(settlement.filePath);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defVal: '' });
    const headers = allRows[0].map(h => String(h).trim());
    const dataRows = allRows.slice(1).filter(r => r.some(c => c !== ''));

    // Build SettlementLine data using column mapping
    const lines = dataRows.map(row => {
      const get = (fieldName) => {
        const colName = mapping[fieldName];
        if (!colName) return null;
        const idx = headers.indexOf(colName);
        return idx >= 0 ? row[idx] : null;
      };

      const rawTicketNo = get('ticketNo');
      const rawDate = get('date');
      let parsedDate = null;
      if (rawDate instanceof Date) {
        parsedDate = rawDate;
      } else if (rawDate) {
        // Noon UTC anchoring for date-only strings — prevents timezone shift in negative-offset zones
        const s = String(rawDate).trim();
        // Try YYYY-MM-DD or MM/DD/YYYY style
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          // If parsed as date-only string, anchor to noon UTC
          if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
            parsedDate = new Date(d.toISOString().split('T')[0] + 'T12:00:00.000Z');
          } else {
            parsedDate = d;
          }
        }
      }

      const rawPrice = get('price');
      const rawDeductions = get('deductions');
      const rawNetPayment = get('netPayment');

      return {
        settlementId,
        ticketNo: rawTicketNo ? String(rawTicketNo).trim() || null : null,
        date: parsedDate,
        netWeight: parseFloat(get('netWeight')) || null,
        moisture: parseFloat(get('moisture')) || null,
        netBushels: parseFloat(get('netBushels')) || null,
        // Decimal fields must be passed as strings to Prisma
        price: rawPrice != null && rawPrice !== '' ? String(parseFloat(rawPrice)) : null,
        deductions: rawDeductions != null && rawDeductions !== '' ? String(parseFloat(rawDeductions)) : null,
        netPayment: rawNetPayment != null && rawNetPayment !== '' ? String(parseFloat(rawNetPayment)) : null
      };
    }).filter(l => l.ticketNo || l.netWeight); // drop completely empty rows

    // Bulk insert — single query for all lines
    const result = await prisma.settlementLine.createMany({ data: lines });

    // Auto-match: run reconciliation immediately after bulk insert
    const matchResult = await runMatch(settlementId);

    // Save/update BuyerColumnMap for reuse on next import from same buyer
    const buyerId = settlement.buyerId;
    const mapUpserts = Object.entries(mapping)
      .filter(([, csvColumn]) => csvColumn) // skip empty mappings
      .map(([fieldName, csvColumn]) =>
        prisma.buyerColumnMap.upsert({
          where: { buyerId_fieldName: { buyerId, fieldName } },
          update: { csvColumn },
          create: { buyerId, fieldName, csvColumn }
        })
      );
    await Promise.all(mapUpserts);

    res.json({ ok: true, linesCreated: result.count, matched: matchResult.matched, unmatched: matchResult.unmatched });
  } catch (e) {
    console.error('POST /api/settlements/:id/commit error:', e);
    res.status(500).json({ error: e.message || 'Commit failed' });
  }
});

// GET /api/settlements — list all settlements ordered by importedAt desc
// Supports optional ?buyerId=N and ?cropYear=N query params for filtering
app.get('/api/settlements', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const where = {};
    if (req.query.buyerId) {
      const buyerId = parseInt(req.query.buyerId, 10);
      if (!isNaN(buyerId)) where.buyerId = buyerId;
    }
    if (req.query.cropYear) {
      const cropYear = parseInt(req.query.cropYear, 10);
      if (!isNaN(cropYear)) where.cropYear = cropYear;
    }
    const settlements = await prisma.settlement.findMany({
      where,
      orderBy: { importedAt: 'desc' },
      include: {
        buyer: true,
        _count: { select: { lines: true } }
      }
    });
    res.json(settlements);
  } catch (e) {
    console.error('GET /api/settlements error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/settlements/:id — single settlement with buyer and lines
app.get('/api/settlements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Settlement not found' });
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: { buyer: true, lines: true }
    });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    res.json(settlement);
  } catch (e) {
    console.error('GET /api/settlements/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settlements/:id — cascade deletes lines, removes uploaded file from disk
app.delete('/api/settlements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Settlement not found' });
    const settlement = await prisma.settlement.findUnique({ where: { id } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    // Delete from DB (SettlementLines cascade via onDelete: Cascade)
    await prisma.settlement.delete({ where: { id } });

    // Remove uploaded file from disk if it exists
    if (settlement.filePath) {
      try { fs.unlinkSync(settlement.filePath); } catch (e) { /* file may already be gone */ }
    }

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Settlement not found' });
    console.error('DELETE /api/settlements/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settlements — create a manual settlement header (no file upload)
app.post('/api/settlements', async (req, res) => {
  try {
    const buyerId = parseInt(req.body.buyerId, 10);
    const cropYear = parseInt(req.body.cropYear, 10);
    if (!buyerId || isNaN(buyerId)) return res.status(400).json({ error: 'buyerId is required' });
    if (!cropYear || isNaN(cropYear)) return res.status(400).json({ error: 'cropYear is required' });

    const notes = (req.body.notes || '').trim() || null;

    const settlement = await prisma.settlement.create({
      data: {
        buyerId,
        cropYear,
        notes,
        sourceFile: null,
        filePath: null
      }
    });

    res.status(201).json({
      id: settlement.id,
      buyerId: settlement.buyerId,
      cropYear: settlement.cropYear,
      notes: settlement.notes,
      importedAt: settlement.importedAt
    });
  } catch (e) {
    console.error('POST /api/settlements error:', e);
    res.status(500).json({ error: e.message || 'Failed to create settlement' });
  }
});

// POST /api/settlements/:id/lines — add a single line to a settlement
app.post('/api/settlements/:id/lines', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id, 10);
    if (isNaN(settlementId)) return res.status(404).json({ error: 'Settlement not found' });

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    const { ticketNo, date, netWeight, moisture, netBushels, price, deductions, netPayment, notes } = req.body;

    // Parse and anchor date to noon UTC to prevent timezone shift
    let parsedDate = null;
    if (date) {
      const d = new Date(date + 'T12:00:00.000Z');
      parsedDate = isNaN(d.getTime()) ? null : d;
    }

    const data = {
      settlementId,
      ticketNo: (ticketNo || '').trim() || null,
      date: parsedDate,
      netWeight: netWeight != null && netWeight !== '' ? parseFloat(netWeight) || null : null,
      moisture: moisture != null && moisture !== '' ? parseFloat(moisture) || null : null,
      netBushels: netBushels != null && netBushels !== '' ? parseFloat(netBushels) || null : null,
      price: price != null && price !== '' ? String(parseFloat(price)) : null,
      deductions: deductions != null && deductions !== '' ? String(parseFloat(deductions)) : null,
      netPayment: netPayment != null && netPayment !== '' ? String(parseFloat(netPayment)) : null,
      notes: (notes || '').trim() || null
    };

    const line = await prisma.settlementLine.create({ data });
    res.status(201).json(line);
  } catch (e) {
    console.error('POST /api/settlements/:id/lines error:', e);
    res.status(500).json({ error: e.message || 'Failed to create line' });
  }
});

// GET /api/settlements/:id/lines — list all lines for a settlement ordered by id asc
app.get('/api/settlements/:id/lines', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id, 10);
    if (isNaN(settlementId)) return res.status(404).json({ error: 'Settlement not found' });

    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { buyer: true }
    });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    const lines = await prisma.settlementLine.findMany({
      where: { settlementId },
      orderBy: { id: 'asc' }
    });

    res.json(lines);
  } catch (e) {
    console.error('GET /api/settlements/:id/lines error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settlements/:settlementId/lines/:lineId — update a settlement line (partial update)
app.put('/api/settlements/:settlementId/lines/:lineId', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.settlementId, 10);
    const lineId = parseInt(req.params.lineId, 10);
    if (isNaN(settlementId) || isNaN(lineId)) return res.status(404).json({ error: 'Line not found' });

    const line = await prisma.settlementLine.findFirst({ where: { id: lineId, settlementId } });
    if (!line) return res.status(404).json({ error: 'Line not found' });

    const { ticketNo, date, netWeight, moisture, netBushels, price, deductions, netPayment, notes } = req.body;
    const updateData = {};

    if (ticketNo !== undefined) updateData.ticketNo = (ticketNo || '').trim() || null;
    if (date !== undefined) {
      if (date) {
        const d = new Date(date + 'T12:00:00.000Z');
        updateData.date = isNaN(d.getTime()) ? null : d;
      } else {
        updateData.date = null;
      }
    }
    if (netWeight !== undefined) updateData.netWeight = netWeight !== '' ? parseFloat(netWeight) || null : null;
    if (moisture !== undefined) updateData.moisture = moisture !== '' ? parseFloat(moisture) || null : null;
    if (netBushels !== undefined) updateData.netBushels = netBushels !== '' ? parseFloat(netBushels) || null : null;
    if (price !== undefined) updateData.price = price !== '' && price != null ? String(parseFloat(price)) : null;
    if (deductions !== undefined) updateData.deductions = deductions !== '' && deductions != null ? String(parseFloat(deductions)) : null;
    if (netPayment !== undefined) updateData.netPayment = netPayment !== '' && netPayment != null ? String(parseFloat(netPayment)) : null;
    if (notes !== undefined) updateData.notes = (notes || '').trim() || null;

    const updated = await prisma.settlementLine.update({ where: { id: lineId }, data: updateData });
    res.json(updated);
  } catch (e) {
    console.error('PUT /api/settlements/:settlementId/lines/:lineId error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Line not found' });
    res.status(500).json({ error: e.message || 'Failed to update line' });
  }
});

// DELETE /api/settlements/:settlementId/lines/:lineId — delete a single settlement line
app.delete('/api/settlements/:settlementId/lines/:lineId', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.settlementId, 10);
    const lineId = parseInt(req.params.lineId, 10);
    if (isNaN(settlementId) || isNaN(lineId)) return res.status(404).json({ error: 'Line not found' });

    const line = await prisma.settlementLine.findFirst({ where: { id: lineId, settlementId } });
    if (!line) return res.status(404).json({ error: 'Line not found' });

    await prisma.settlementLine.delete({ where: { id: lineId } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Line not found' });
    console.error('DELETE /api/settlements/:settlementId/lines/:lineId error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Reconciliation Routes ---

// POST /api/settlements/:id/rematch — re-run matching, preserving manual/disputed flags
app.post('/api/settlements/:id/rematch', async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id, 10);
    if (isNaN(settlementId)) return res.status(404).json({ error: 'Settlement not found' });
    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    const matchResult = await runMatch(settlementId);
    res.json(matchResult);
  } catch (e) {
    console.error('POST /api/settlements/:id/rematch error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reconciliation/summary?buyerId=X&cropYear=Y — per-crop farm lbs vs buyer lbs with variance
app.get('/api/reconciliation/summary', async (req, res) => {
  try {
    const buyerId = parseInt(req.query.buyerId, 10);
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(buyerId) || isNaN(cropYear)) {
      return res.status(400).json({ error: 'buyerId and cropYear are required' });
    }

    // Farm tickets for this buyer+cropYear, grouped by crop
    const farmTickets = await prisma.ticket.findMany({
      where: { buyerId, cropYear }
    });

    const farmByCrop = {};
    farmTickets.forEach(t => {
      const crop = t.crop || 'Unknown';
      if (!farmByCrop[crop]) farmByCrop[crop] = { farmLbs: 0, farmCount: 0 };
      farmByCrop[crop].farmLbs += t.netWeight;
      farmByCrop[crop].farmCount += 1;
    });

    // Settlement lines (matched/manual/disputed) for this buyer+cropYear, joined to ticket for crop
    const settlements = await prisma.settlement.findMany({
      where: { buyerId, cropYear },
      include: {
        lines: {
          where: { matchStatus: { in: ['matched', 'manual', 'disputed'] } },
          include: { ticket: { select: { crop: true } } }
        }
      }
    });

    const buyerByCrop = {};
    settlements.forEach(s => {
      s.lines.forEach(l => {
        const crop = (l.ticket && l.ticket.crop) ? l.ticket.crop : 'Unknown';
        if (!buyerByCrop[crop]) buyerByCrop[crop] = { buyerLbs: 0, buyerBushels: 0 };
        if (l.netWeight) buyerByCrop[crop].buyerLbs += l.netWeight;
        if (l.netBushels) buyerByCrop[crop].buyerBushels += l.netBushels;
      });
    });

    // Load crop tolerance configs for this year (for withinTolerance evaluation)
    const cropConfigs = await prisma.cropConfig.findMany({
      where: { cropYear },
      select: { cropName: true, tolerancePct: true, toleranceLbs: true }
    });
    const toleranceMap = {};
    cropConfigs.forEach(c => {
      toleranceMap[c.cropName] = { tolerancePct: c.tolerancePct, toleranceLbs: c.toleranceLbs };
    });

    // Build combined crop set
    const crops = new Set([...Object.keys(farmByCrop), ...Object.keys(buyerByCrop)]);
    const rows = Array.from(crops).map(crop => {
      const farm = farmByCrop[crop] || { farmLbs: 0, farmCount: 0 };
      const buyer = buyerByCrop[crop] || { buyerLbs: 0, buyerBushels: 0 };
      const varianceLbs = farm.farmLbs - buyer.buyerLbs;
      const variancePct = farm.farmLbs > 0
        ? Math.round((varianceLbs / farm.farmLbs) * 10000) / 100
        : 0;

      // Compute withinTolerance using configured tolerance (pct takes precedence over lbs)
      const tol = toleranceMap[crop] || { tolerancePct: 0, toleranceLbs: 0 };
      const tolerancePct = tol.tolerancePct || 0;
      const toleranceLbs = tol.toleranceLbs || 0;
      let threshold = 0;
      if (tolerancePct > 0) {
        threshold = farm.farmLbs * (tolerancePct / 100);
      } else if (toleranceLbs > 0) {
        threshold = toleranceLbs;
      }
      // withinTolerance: true if abs variance is within threshold, or if no variance at all
      const withinTolerance = threshold > 0
        ? Math.abs(varianceLbs) <= threshold
        : varianceLbs === 0;

      return {
        crop,
        farmLbs: farm.farmLbs,
        farmCount: farm.farmCount,
        buyerLbs: buyer.buyerLbs,
        buyerBushels: Math.round(buyer.buyerBushels * 100) / 100,
        varianceLbs,
        variancePct,
        withinTolerance,
        tolerancePct,
        toleranceLbs
      };
    }).sort((a, b) => a.crop.localeCompare(b.crop));

    res.json(rows);
  } catch (e) {
    console.error('GET /api/reconciliation/summary error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reconciliation/unmatched?buyerId=X&cropYear=Y — farm-only tickets and settlement-only lines
app.get('/api/reconciliation/unmatched', async (req, res) => {
  try {
    const buyerId = parseInt(req.query.buyerId, 10);
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(buyerId) || isNaN(cropYear)) {
      return res.status(400).json({ error: 'buyerId and cropYear are required' });
    }

    // Farm-only: tickets with no matched/manual settlement line for this buyer+cropYear
    const farmTickets = await prisma.ticket.findMany({
      where: { buyerId, cropYear },
      include: { settlementLines: { select: { matchStatus: true } } }
    });

    // Check if any settlements exist for this buyer+cropYear (for hint generation)
    const settlementCount = await prisma.settlement.count({ where: { buyerId, cropYear } });

    const farmOnly = farmTickets
      .filter(t => !t.settlementLines.some(l => l.matchStatus === 'matched' || l.matchStatus === 'manual'))
      .map(t => ({
        id: t.id,
        ticketNo: t.ticketNo || '',
        date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
        crop: t.crop,
        netWeight: t.netWeight,
        hint: settlementCount === 0
          ? `No settlement for this buyer`
          : 'Ticket# not in settlement'
      }));

    // Settlement-only: lines with matchStatus 'unmatched' across this buyer's settlements
    const settlements = await prisma.settlement.findMany({
      where: { buyerId, cropYear },
      include: {
        lines: {
          where: { matchStatus: 'unmatched' }
        }
      }
    });

    const settlementOnly = [];
    settlements.forEach(s => {
      s.lines.forEach(l => {
        settlementOnly.push({
          id: l.id,
          settlementId: l.settlementId,
          ticketNo: l.ticketNo || '',
          date: l.date instanceof Date ? l.date.toISOString().split('T')[0] : l.date,
          netWeight: l.netWeight,
          netBushels: l.netBushels
        });
      });
    });

    res.json({ farmOnly, settlementOnly });
  } catch (e) {
    console.error('GET /api/reconciliation/unmatched error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reconciliation/fuzzy-candidates?buyerId=X&cropYear=Y — find candidate matches for unmatched settlement lines by date proximity + weight tolerance
app.get('/api/reconciliation/fuzzy-candidates', async (req, res) => {
  try {
    const buyerId = parseInt(req.query.buyerId, 10);
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(buyerId) || isNaN(cropYear)) {
      return res.status(400).json({ error: 'buyerId and cropYear are required' });
    }

    // Helper: absolute calendar days between two date strings (YYYY-MM-DD) or Date objects
    function daysDiff(d1, d2) {
      if (!d1 || !d2) return null;
      const s1 = (d1 instanceof Date) ? d1.toISOString().split('T')[0] : String(d1).split('T')[0];
      const s2 = (d2 instanceof Date) ? d2.toISOString().split('T')[0] : String(d2).split('T')[0];
      const t1 = new Date(s1).getTime();
      const t2 = new Date(s2).getTime();
      return Math.round(Math.abs(t1 - t2) / 86400000);
    }

    // Load crop tolerance configs for weight threshold computation
    const cropConfigs = await prisma.cropConfig.findMany({
      where: { cropYear },
      select: { cropName: true, tolerancePct: true, toleranceLbs: true }
    });
    const toleranceMap = {};
    cropConfigs.forEach(c => {
      toleranceMap[c.cropName] = { tolerancePct: c.tolerancePct || 0, toleranceLbs: c.toleranceLbs || 0 };
    });

    // Fetch all farm tickets for this buyer+cropYear
    const allFarmTickets = await prisma.ticket.findMany({
      where: { buyerId, cropYear },
      include: { settlementLines: { select: { matchStatus: true } } }
    });

    // Unmatched farm tickets: no matched/manual settlement line
    const unmatchedFarmTickets = allFarmTickets.filter(t =>
      !t.settlementLines.some(l => l.matchStatus === 'matched' || l.matchStatus === 'manual')
    );

    // Fetch all unmatched settlement lines for this buyer+cropYear
    const settlements = await prisma.settlement.findMany({
      where: { buyerId, cropYear },
      include: {
        lines: {
          where: { matchStatus: 'unmatched' }
        }
      }
    });

    const unmatchedLines = [];
    settlements.forEach(s => {
      s.lines.forEach(l => {
        unmatchedLines.push(l);
      });
    });

    if (unmatchedLines.length === 0 || unmatchedFarmTickets.length === 0) {
      return res.json([]);
    }

    // For each unmatched settlement line, find candidate farm tickets by date+weight proximity
    const FUZZY_DEFAULT_PCT = 2; // default 2% fuzzy tolerance when no crop config
    const DATE_WINDOW_DAYS = 2;
    const MAX_CANDIDATES = 5;

    const results = [];

    unmatchedLines.forEach(line => {
      const lineDate = line.date instanceof Date ? line.date.toISOString().split('T')[0] : (line.date ? String(line.date).split('T')[0] : null);
      const lineWeight = line.netWeight;

      const candidates = [];

      unmatchedFarmTickets.forEach(ticket => {
        const ticketDate = ticket.date instanceof Date ? ticket.date.toISOString().split('T')[0] : (ticket.date ? String(ticket.date).split('T')[0] : null);

        // Date proximity check
        let dateDiffDays = null;
        if (lineDate && ticketDate) {
          dateDiffDays = daysDiff(lineDate, ticketDate);
          if (dateDiffDays > DATE_WINDOW_DAYS) return; // outside date window
        }
        // If either date is null, skip date filter and allow match by weight only

        // Weight proximity check
        if (!lineWeight || !ticket.netWeight || ticket.netWeight === 0) return;
        const weightVarianceLbs = Math.abs(ticket.netWeight - lineWeight);
        const weightVariancePct = (weightVarianceLbs / ticket.netWeight) * 100;

        // Look up tolerance for this ticket's crop
        const tol = toleranceMap[ticket.crop] || { tolerancePct: 0, toleranceLbs: 0 };
        let toleranceThreshold;
        if (tol.tolerancePct > 0) {
          toleranceThreshold = ticket.netWeight * (tol.tolerancePct / 100);
        } else if (tol.toleranceLbs > 0) {
          toleranceThreshold = tol.toleranceLbs;
        } else {
          // Default: 2% fuzzy tolerance
          toleranceThreshold = ticket.netWeight * (FUZZY_DEFAULT_PCT / 100);
        }

        if (weightVarianceLbs > toleranceThreshold) return; // outside weight window

        candidates.push({
          ticketId: ticket.id,
          ticketNo: ticket.ticketNo || '',
          date: ticketDate,
          netWeight: ticket.netWeight,
          crop: ticket.crop || '',
          weightVarianceLbs: Math.round(weightVarianceLbs * 10) / 10,
          weightVariancePct: Math.round(weightVariancePct * 100) / 100,
          dateDiffDays: dateDiffDays !== null ? dateDiffDays : null
        });
      });

      if (candidates.length === 0) return; // No candidates for this line

      // Sort: smallest weight variance first, then smallest date diff
      candidates.sort((a, b) => {
        const wDiff = a.weightVarianceLbs - b.weightVarianceLbs;
        if (wDiff !== 0) return wDiff;
        const aDate = a.dateDiffDays !== null ? a.dateDiffDays : 999;
        const bDate = b.dateDiffDays !== null ? b.dateDiffDays : 999;
        return aDate - bDate;
      });

      results.push({
        settlementLineId: line.id,
        lineTicketNo: line.ticketNo || '',
        lineDate: lineDate,
        lineNetWeight: lineWeight,
        candidates: candidates.slice(0, MAX_CANDIDATES)
      });
    });

    res.json(results);
  } catch (e) {
    console.error('GET /api/reconciliation/fuzzy-candidates error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reconciliation/manual-link — manually link a ticket to a settlement line
app.post('/api/reconciliation/manual-link', async (req, res) => {
  try {
    const { ticketId, settlementLineId } = req.body;
    if (!ticketId || !settlementLineId) {
      return res.status(400).json({ error: 'ticketId and settlementLineId are required' });
    }
    const tid = parseInt(ticketId, 10);
    const lid = parseInt(settlementLineId, 10);
    if (isNaN(tid) || isNaN(lid)) {
      return res.status(400).json({ error: 'ticketId and settlementLineId must be integers' });
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({ where: { id: tid } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Verify settlement line exists
    const line = await prisma.settlementLine.findUnique({ where: { id: lid } });
    if (!line) return res.status(404).json({ error: 'Settlement line not found' });

    const updated = await prisma.settlementLine.update({
      where: { id: lid },
      data: { ticketId: tid, matchStatus: 'manual' }
    });
    res.json(updated);
  } catch (e) {
    console.error('POST /api/reconciliation/manual-link error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/settlement-lines/:lineId/dispute — flag a settlement line as disputed
// Accepts: notes (legacy), resolutionStatus, resolutionNotes, resolutionDate
app.patch('/api/settlement-lines/:lineId/dispute', async (req, res) => {
  try {
    const lineId = parseInt(req.params.lineId, 10);
    if (isNaN(lineId)) return res.status(404).json({ error: 'Settlement line not found' });

    const line = await prisma.settlementLine.findUnique({ where: { id: lineId } });
    if (!line) return res.status(404).json({ error: 'Settlement line not found' });

    // Only allow disputing matched, manual, or already-disputed lines
    const allowedStatuses = ['matched', 'manual', 'disputed'];
    if (!allowedStatuses.includes(line.matchStatus)) {
      return res.status(400).json({
        error: `Cannot dispute a line with matchStatus '${line.matchStatus}'. Line must be matched, manual, or disputed.`
      });
    }

    const VALID_RESOLUTION_STATUSES = ['Buyer Error', 'Our Error', 'Write-off', 'Pending'];

    // Detect if this is a structured resolution save (new) or legacy notes-only save
    if (req.body.resolutionStatus !== undefined) {
      // New structured resolution flow
      const resolutionStatus = req.body.resolutionStatus;
      if (!VALID_RESOLUTION_STATUSES.includes(resolutionStatus)) {
        return res.status(400).json({
          error: `Invalid resolutionStatus '${resolutionStatus}'. Must be one of: ${VALID_RESOLUTION_STATUSES.join(', ')}`
        });
      }

      const resolutionNotes = (req.body.resolutionNotes || '').trim() || null;

      // Auto-set resolutionDate for resolved statuses; clear it for Pending
      let resolutionDate = null;
      if (resolutionStatus === 'Pending') {
        resolutionDate = null; // Not yet resolved
      } else {
        // Resolved: use provided date or auto-set to now
        if (req.body.resolutionDate) {
          resolutionDate = new Date(req.body.resolutionDate);
          if (isNaN(resolutionDate.getTime())) {
            return res.status(400).json({ error: 'Invalid resolutionDate format. Use ISO date string.' });
          }
        } else {
          resolutionDate = new Date();
        }
      }

      const updated = await prisma.settlementLine.update({
        where: { id: lineId },
        data: {
          matchStatus: 'disputed',
          resolutionStatus,
          resolutionNotes,
          resolutionDate
        }
      });
      return res.json(updated);
    }

    // Legacy backward-compatible path: only notes provided
    const notes = (req.body.notes || '').trim() || null;
    const updated = await prisma.settlementLine.update({
      where: { id: lineId },
      data: { matchStatus: 'disputed', notes }
    });
    res.json(updated);
  } catch (e) {
    console.error('PATCH /api/settlement-lines/:lineId/dispute error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reconciliation/season-summary?cropYear=N — cross-buyer season summary
app.get('/api/reconciliation/season-summary', async (req, res) => {
  try {
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(cropYear)) {
      return res.status(400).json({ error: 'cropYear query parameter is required' });
    }

    // All buyers (for name resolution)
    const allBuyers = await prisma.buyer.findMany();
    const buyerMap = {};
    allBuyers.forEach(b => { buyerMap[b.id] = b; });

    // Farm-side: aggregate tickets by buyerId for this crop year
    const farmAgg = await prisma.ticket.groupBy({
      by: ['buyerId'],
      where: { cropYear, buyerId: { not: null } },
      _count: { id: true },
      _sum: { netWeight: true }
    });

    // Settlement-side: all settlements + lines for this crop year
    const settlements = await prisma.settlement.findMany({
      where: { cropYear },
      include: {
        buyer: true,
        lines: {
          select: {
            id: true,
            netWeight: true,
            netPayment: true,
            matchStatus: true,
            ticketId: true
          }
        }
      }
    });

    // Build per-buyer settlement aggregates
    const settlementByBuyer = {};
    settlements.forEach(s => {
      if (!settlementByBuyer[s.buyerId]) {
        settlementByBuyer[s.buyerId] = {
          lineCount: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          disputedCount: 0,
          totalPayment: 0,
          buyerWeightMatched: 0
        };
      }
      const agg = settlementByBuyer[s.buyerId];
      s.lines.forEach(l => {
        agg.lineCount++;
        const status = l.matchStatus || 'unmatched';
        if (status === 'matched' || status === 'manual') {
          agg.matchedCount++;
          agg.buyerWeightMatched += l.netWeight || 0;
        } else if (status === 'disputed') {
          agg.disputedCount++;
        } else {
          agg.unmatchedCount++;
        }
        agg.totalPayment += l.netPayment ? parseFloat(l.netPayment) : 0;
      });
    });

    // Build per-buyer farm-side lookup
    const farmByBuyer = {};
    farmAgg.forEach(row => {
      if (row.buyerId !== null) {
        farmByBuyer[row.buyerId] = {
          ticketCount: row._count.id,
          totalWeightLbs: row._sum.netWeight || 0
        };
      }
    });

    // Union of all buyer IDs that have tickets OR settlements in this crop year
    const buyerIds = new Set([
      ...Object.keys(farmByBuyer).map(Number),
      ...Object.keys(settlementByBuyer).map(Number)
    ]);

    const result = [];
    buyerIds.forEach(buyerId => {
      const buyer = buyerMap[buyerId];
      if (!buyer) return; // Skip orphaned buyer IDs

      const farm = farmByBuyer[buyerId] || { ticketCount: 0, totalWeightLbs: 0 };
      const sett = settlementByBuyer[buyerId] || {
        lineCount: 0, matchedCount: 0, unmatchedCount: 0,
        disputedCount: 0, totalPayment: 0, buyerWeightMatched: 0
      };

      // Variance: farm weight minus buyer weight (matched lines only)
      const varianceLbs = farm.totalWeightLbs - sett.buyerWeightMatched;
      const variancePct = farm.totalWeightLbs > 0
        ? Math.round((varianceLbs / farm.totalWeightLbs) * 10000) / 100
        : 0;

      // Derive paymentStatus
      let paymentStatus;
      if (sett.lineCount === 0) {
        paymentStatus = 'No Settlements';
      } else if (sett.disputedCount > 0) {
        paymentStatus = 'Has Disputes';
      } else if (sett.unmatchedCount > 0) {
        paymentStatus = 'Partially Matched';
      } else {
        paymentStatus = 'Fully Matched';
      }

      result.push({
        buyerId,
        buyerName: buyer.name,
        buyerShortCode: buyer.shortCode || null,
        ticketCount: farm.ticketCount,
        totalWeightLbs: Math.round(farm.totalWeightLbs),
        settlementLineCount: sett.lineCount,
        matchedCount: sett.matchedCount,
        unmatchedCount: sett.unmatchedCount,
        disputedCount: sett.disputedCount,
        totalPayment: Math.round(sett.totalPayment * 100) / 100,
        varianceLbs: Math.round(varianceLbs),
        variancePct,
        paymentStatus
      });
    });

    // Sort by buyer name ascending
    result.sort((a, b) => a.buyerName.localeCompare(b.buyerName));
    res.json(result);
  } catch (e) {
    console.error('GET /api/reconciliation/season-summary error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Start ---
app.listen(PORT, '0.0.0.0', async () => {
  const ticketCount = await prisma.ticket.count();
  const farmCount = await prisma.farm.count();
  const cropCount = await prisma.cropConfig.count();
  console.log(`Connected to PostgreSQL: ${ticketCount} tickets, ${farmCount} farms, ${cropCount} crop configs`);
  console.log(`Grain Tickets server running at http://localhost:${PORT}`);
  console.log(`LAN access: http://<your-ip>:${PORT}`);
});
