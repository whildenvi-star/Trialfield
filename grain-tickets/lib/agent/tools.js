'use strict';

// Tool definitions and Prisma implementations for the Glomalin chat agent.
// Read tools query tickets, farms, crops, buyers, grain bins.
// Write tools (add_ticket_note, flag_ticket, remember_note) include _writeAction: true in result.
// NOTE: Settlement/reconciliation data is deliberately excluded from all tools.

const prisma = require('../db');
const Calc = require('../../public/calc.js');

// ---------------------------------------------------------------------------
// Tool definitions (Claude API format)
// ---------------------------------------------------------------------------
function getToolDefinitions() {
  return [
    {
      name: 'query_tickets',
      description:
        'Search and filter grain tickets. Returns ticket records with computed bushel fields. ' +
        'Does NOT return settlement or reconciliation data.',
      input_schema: {
        type: 'object',
        properties: {
          farm: {
            type: 'string',
            description: 'Filter by farm name (case-insensitive partial match)'
          },
          crop: {
            type: 'string',
            description: 'Filter by crop name (case-insensitive partial match)'
          },
          cropYear: {
            type: 'integer',
            description: 'Filter by crop year (e.g. 2025)'
          },
          dateFrom: {
            type: 'string',
            description: 'Start date filter (ISO 8601, e.g. 2025-08-01)'
          },
          dateTo: {
            type: 'string',
            description: 'End date filter (ISO 8601, e.g. 2025-12-31)'
          },
          ticketNo: {
            type: 'string',
            description: 'Filter by ticket number (partial match)'
          },
          buyerName: {
            type: 'string',
            description: 'Filter by buyer name (case-insensitive partial match)'
          },
          limit: {
            type: 'integer',
            description: 'Maximum results to return (default 50, max 100)'
          }
        },
        required: []
      }
    },
    {
      name: 'get_farm_summary',
      description:
        'Get aggregated farm-level summary: total weight, total bushels, average moisture, ' +
        'ticket count, acres, and yield per acre. Groups by farm and crop.',
      input_schema: {
        type: 'object',
        properties: {
          cropYear: {
            type: 'integer',
            description: 'Crop year to summarize (e.g. 2025)'
          },
          farmName: {
            type: 'string',
            description: 'Filter to a specific farm name (partial match)'
          }
        },
        required: []
      }
    },
    {
      name: 'get_crop_stats',
      description:
        'Get aggregated crop-level statistics: total weight, total bushels, average moisture, ' +
        'ticket count. Groups by crop name.',
      input_schema: {
        type: 'object',
        properties: {
          cropYear: {
            type: 'integer',
            description: 'Crop year to aggregate (e.g. 2025)'
          }
        },
        required: []
      }
    },
    {
      name: 'get_buyers',
      description: 'Get the list of all grain buyers with name, short code, and type.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'get_grain_bins',
      description:
        'Get the list of all on-farm grain bins with name, capacity, and ticket count.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'add_ticket_note',
      description:
        'WRITE: Add or update the notes field on a specific ticket. ' +
        'ALWAYS describe this action to the user and ask for confirmation before calling this tool.',
      input_schema: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'integer',
            description: 'The integer ticket ID (not ticket number) to update'
          },
          note: {
            type: 'string',
            description: 'The note text to set on the ticket'
          }
        },
        required: ['ticketId', 'note']
      }
    },
    {
      name: 'flag_ticket',
      description:
        'WRITE: Flag or unflag a ticket by adding or removing a [FLAGGED] prefix in the notes. ' +
        'This is NOT a settlement dispute — it is a simple visibility marker. ' +
        'ALWAYS describe this action to the user and ask for confirmation before calling this tool.',
      input_schema: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'integer',
            description: 'The integer ticket ID to flag or unflag'
          },
          flagged: {
            type: 'boolean',
            description: 'true to add [FLAGGED] marker, false to remove it'
          },
          reason: {
            type: 'string',
            description: 'Optional reason to append after the [FLAGGED] marker'
          }
        },
        required: ['ticketId', 'flagged']
      }
    },
    {
      name: 'remember_note',
      description:
        'WRITE: Store a learnable fact or note for future recall. ' +
        'Use this when the user asks you to remember something about the farm operation.',
      input_schema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The fact or note to remember'
          },
          category: {
            type: 'string',
            description:
              'Category for the note: "farm", "crop", "buyer", or "general" (default "general")'
          }
        },
        required: ['content']
      }
    },
    {
      name: 'recall_notes',
      description:
        'Retrieve stored learnable notes/facts. Optionally filter by category.',
      input_schema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Optional category filter: "farm", "crop", "buyer", or "general"'
          }
        },
        required: []
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolQueryTickets(input) {
  const limit = Math.min(input.limit || 50, 100);
  const where = {};

  if (input.farm) {
    where.farm = { contains: input.farm, mode: 'insensitive' };
  }
  if (input.crop) {
    where.crop = { contains: input.crop, mode: 'insensitive' };
  }
  if (input.cropYear) {
    where.cropYear = input.cropYear;
  }
  if (input.dateFrom || input.dateTo) {
    where.date = {};
    if (input.dateFrom) where.date.gte = new Date(input.dateFrom);
    if (input.dateTo) where.date.lte = new Date(input.dateTo + 'T23:59:59.999Z');
  }
  if (input.ticketNo) {
    where.ticketNo = { contains: input.ticketNo };
  }
  if (input.buyerName) {
    where.buyer = { name: { contains: input.buyerName, mode: 'insensitive' } };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: { buyer: true, grainBin: true },
    orderBy: { date: 'desc' },
    take: limit
  });

  // Load crop configs for the years present to compute bushels
  const years = [...new Set(tickets.map(t => t.cropYear))];
  const cropConfigMap = {};
  for (const year of years) {
    const rows = await prisma.cropConfig.findMany({ where: { cropYear: year } });
    cropConfigMap[year] = {};
    rows.forEach(r => {
      cropConfigMap[year][r.cropName] = {
        discount: r.discount,
        testWeight: r.testWeight,
        moistureShrink: r.moistureShrink
      };
    });
  }

  return {
    count: tickets.length,
    tickets: tickets.map(t => {
      const cropConfig = cropConfigMap[t.cropYear] || {};
      const computed = Calc.computeTicket(t, cropConfig);
      return {
        id: t.id,
        date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
        farm: t.farm,
        crop: t.crop,
        ticketNo: t.ticketNo || '',
        netWeight: t.netWeight,
        moisture: t.moisture,
        fm: t.fm || 0,
        grossBU: computed.grossBU,
        netBU: computed.netBU,
        hbtBinNo: t.hbtBinNo || null,
        truckId: t.truckId || null,
        notes: t.notes || '',
        buyerName: t.buyer ? t.buyer.name : null,
        grainBin: t.grainBin ? t.grainBin.name : null,
        cropYear: t.cropYear
      };
    })
  };
}

async function toolGetFarmSummary(input) {
  const where = {};
  if (input.cropYear) where.cropYear = input.cropYear;
  if (input.farmName) where.farm = { contains: input.farmName, mode: 'insensitive' };

  const tickets = await prisma.ticket.findMany({ where });

  // Load crop configs for the years present
  const years = [...new Set(tickets.map(t => t.cropYear))];
  const cropConfigMap = {};
  for (const year of years) {
    const rows = await prisma.cropConfig.findMany({ where: { cropYear: year } });
    cropConfigMap[year] = {};
    rows.forEach(r => {
      cropConfigMap[year][r.cropName] = {
        discount: r.discount,
        testWeight: r.testWeight,
        moistureShrink: r.moistureShrink
      };
    });
  }

  // Group by farm + crop
  const groups = {};
  for (const t of tickets) {
    const key = `${t.farm}||${t.crop}||${t.cropYear}`;
    if (!groups[key]) {
      groups[key] = {
        farm: t.farm,
        crop: t.crop,
        cropYear: t.cropYear,
        totalWeight: 0,
        totalBU: 0,
        moistureSum: 0,
        ticketCount: 0
      };
    }
    const g = groups[key];
    const cropConfig = cropConfigMap[t.cropYear] || {};
    const computed = Calc.computeTicket(t, cropConfig);
    g.totalWeight += t.netWeight;
    g.totalBU += computed.netBU;
    g.moistureSum += t.moisture;
    g.ticketCount++;
  }

  // Load farm acres data
  const farmNames = [...new Set(tickets.map(t => t.farm))];
  const farmRows = await prisma.farm.findMany({
    where: { name: { in: farmNames } }
  });
  const farmAcresMap = {};
  farmRows.forEach(f => {
    const key = `${f.name}||${f.crop || ''}`;
    farmAcresMap[key] = f.reportingAcres || f.acres || 0;
  });

  const summaries = Object.values(groups).map(g => {
    const acresKey = `${g.farm}||${g.crop}`;
    const acres = farmAcresMap[acresKey] || 0;
    const avgMoisture = g.ticketCount > 0 ? g.moistureSum / g.ticketCount : 0;
    const yieldPerAcre = acres > 0 ? g.totalBU / acres : 0;
    return {
      farm: g.farm,
      crop: g.crop,
      cropYear: g.cropYear,
      totalWeight: Math.round(g.totalWeight),
      totalBU: Math.round(g.totalBU * 100) / 100,
      avgMoisture: Math.round(avgMoisture * 100) / 100,
      ticketCount: g.ticketCount,
      acres,
      yieldPerAcre: Math.round(yieldPerAcre * 100) / 100
    };
  });

  summaries.sort((a, b) => a.farm.localeCompare(b.farm) || a.crop.localeCompare(b.crop));

  return { count: summaries.length, summaries };
}

async function toolGetCropStats(input) {
  const where = {};
  if (input.cropYear) where.cropYear = input.cropYear;

  const tickets = await prisma.ticket.findMany({ where });

  // Load crop configs
  const years = [...new Set(tickets.map(t => t.cropYear))];
  const cropConfigMap = {};
  for (const year of years) {
    const rows = await prisma.cropConfig.findMany({ where: { cropYear: year } });
    cropConfigMap[year] = {};
    rows.forEach(r => {
      cropConfigMap[year][r.cropName] = {
        discount: r.discount,
        testWeight: r.testWeight,
        moistureShrink: r.moistureShrink
      };
    });
  }

  const groups = {};
  for (const t of tickets) {
    const key = `${t.crop}||${t.cropYear}`;
    if (!groups[key]) {
      groups[key] = {
        crop: t.crop,
        cropYear: t.cropYear,
        totalWeight: 0,
        totalBU: 0,
        moistureSum: 0,
        ticketCount: 0
      };
    }
    const g = groups[key];
    const cropConfig = cropConfigMap[t.cropYear] || {};
    const computed = Calc.computeTicket(t, cropConfig);
    g.totalWeight += t.netWeight;
    g.totalBU += computed.netBU;
    g.moistureSum += t.moisture;
    g.ticketCount++;
  }

  const stats = Object.values(groups).map(g => ({
    crop: g.crop,
    cropYear: g.cropYear,
    totalWeight: Math.round(g.totalWeight),
    totalBU: Math.round(g.totalBU * 100) / 100,
    avgMoisture: g.ticketCount > 0 ? Math.round((g.moistureSum / g.ticketCount) * 100) / 100 : 0,
    ticketCount: g.ticketCount
  }));

  stats.sort((a, b) => b.cropYear - a.cropYear || a.crop.localeCompare(b.crop));

  return { count: stats.length, stats };
}

async function toolGetBuyers() {
  const buyers = await prisma.buyer.findMany({
    orderBy: { name: 'asc' }
  });
  return {
    count: buyers.length,
    buyers: buyers.map(b => ({
      id: b.id,
      name: b.name,
      shortCode: b.shortCode || null,
      type: b.type || null
    }))
  };
}

async function toolGetGrainBins() {
  const bins = await prisma.grainBin.findMany({ orderBy: { name: 'asc' } });
  // Get ticket counts per bin
  const counts = await prisma.ticket.groupBy({
    by: ['grainBinId'],
    where: { grainBinId: { not: null } },
    _count: { id: true }
  });
  const countMap = {};
  counts.forEach(c => { countMap[c.grainBinId] = c._count.id; });

  return {
    count: bins.length,
    bins: bins.map(b => ({
      id: b.id,
      name: b.name,
      capacity: b.capacity,
      ticketCount: countMap[b.id] || 0
    }))
  };
}

async function toolAddTicketNote(input) {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) {
    return { error: `Ticket ID ${input.ticketId} not found`, _writeAction: true };
  }
  const updated = await prisma.ticket.update({
    where: { id: input.ticketId },
    data: { notes: input.note }
  });
  return {
    success: true,
    ticketId: updated.id,
    ticketNo: updated.ticketNo,
    notes: updated.notes,
    _writeAction: true
  };
}

async function toolFlagTicket(input) {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) {
    return { error: `Ticket ID ${input.ticketId} not found`, _writeAction: true };
  }

  let currentNotes = ticket.notes || '';
  // Remove existing [FLAGGED] prefix if present
  currentNotes = currentNotes.replace(/^\[FLAGGED\][^\n]*\n?/, '').trim();

  let newNotes;
  if (input.flagged) {
    const reasonPart = input.reason ? ` ${input.reason}` : '';
    newNotes = `[FLAGGED]${reasonPart}\n${currentNotes}`.trim();
  } else {
    newNotes = currentNotes;
  }

  const updated = await prisma.ticket.update({
    where: { id: input.ticketId },
    data: { notes: newNotes }
  });

  return {
    success: true,
    ticketId: updated.id,
    ticketNo: updated.ticketNo,
    flagged: input.flagged,
    notes: updated.notes,
    _writeAction: true
  };
}

async function toolRememberNote(input) {
  const note = await prisma.agentNote.create({
    data: {
      content: input.content.trim(),
      category: input.category || 'general',
      source: 'agent'
    }
  });
  return {
    success: true,
    noteId: note.id,
    content: note.content,
    category: note.category,
    _writeAction: true
  };
}

async function toolRecallNotes(input) {
  const where = { active: true };
  if (input.category) where.category = input.category;
  const notes = await prisma.agentNote.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
  return {
    count: notes.length,
    notes: notes.map(n => ({
      id: n.id,
      content: n.content,
      category: n.category,
      source: n.source,
      createdAt: n.createdAt
    }))
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
async function executeTool(name, input) {
  switch (name) {
    case 'query_tickets':
      return toolQueryTickets(input);
    case 'get_farm_summary':
      return toolGetFarmSummary(input);
    case 'get_crop_stats':
      return toolGetCropStats(input);
    case 'get_buyers':
      return toolGetBuyers();
    case 'get_grain_bins':
      return toolGetGrainBins();
    case 'add_ticket_note':
      return toolAddTicketNote(input);
    case 'flag_ticket':
      return toolFlagTicket(input);
    case 'remember_note':
      return toolRememberNote(input);
    case 'recall_notes':
      return toolRecallNotes(input);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { getToolDefinitions, executeTool };
