#!/usr/bin/env node
'use strict';

const express = require('express');
const path = require('path');
const Calc = require('./public/calc.js');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('./lib/db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const anthropic = new Anthropic.default();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// perf: Cache-Control on GET API responses — allows browser to skip refetch for short TTL
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=10'); // 10s for list data
  }
  next();
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

// --- Helper: convert Prisma Ticket row to JSON shape expected by client/calc.js ---
function dbTicketToJson(dbTicket) {
  return {
    id: dbTicket.id,
    date: dbTicket.date instanceof Date ? dbTicket.date.toISOString().split('T')[0] : dbTicket.date,
    farm: dbTicket.farm,
    netWeight: dbTicket.netWeight,
    moisture: dbTicket.moisture,
    fm: dbTicket.fm || 0,
    crop: dbTicket.crop,
    ticketNo: dbTicket.ticketNo || '',
    notes: dbTicket.notes || '',
    hbtBinNo: dbTicket.hbtBinNo || null,
    truckId: dbTicket.truckId || null,
    buyerId: dbTicket.buyerId || null,
    grainBinId: dbTicket.grainBinId || null,
    destination: dbTicket.destination || null,
    cropYear: dbTicket.cropYear
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
    const tickets = await prisma.ticket.findMany({ where, orderBy: { date: 'desc' } });
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
    const ticket = await prisma.ticket.findUnique({ where: { id } });
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
        destination: null  // New tickets use FK (buyerId/grainBinId), not free-text
      }
    });
    res.status(201).json(enrichTicket(dbTicketToJson(ticket), cropConfig));
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

    const ticket = await prisma.ticket.update({ where: { id }, data: updateData });
    const cropConfig = await buildCropConfigObject(ticket.cropYear);
    res.json(enrichTicket(dbTicketToJson(ticket), cropConfig));
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
    await prisma.ticket.delete({ where: { id } });
    res.json({ ok: true });
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
      truck: 'truck'
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
        truck: parseFloat(req.body.truck) || 0
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

    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
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

// --- Start ---
app.listen(PORT, '0.0.0.0', async () => {
  const ticketCount = await prisma.ticket.count();
  const farmCount = await prisma.farm.count();
  const cropCount = await prisma.cropConfig.count();
  console.log(`Connected to PostgreSQL: ${ticketCount} tickets, ${farmCount} farms, ${cropCount} crop configs`);
  console.log(`Grain Tickets server running at http://localhost:${PORT}`);
  console.log(`LAN access: http://<your-ip>:${PORT}`);
});
