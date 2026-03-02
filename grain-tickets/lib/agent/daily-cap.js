'use strict';

// Daily message cap tracking for the Glomalin chat agent.
// Uses AgentDailyUsage table with one row per calendar day (YYYY-MM-DD).
// Returns allowed status, current count, remaining, and nearLimit flag.

const prisma = require('../db');

async function checkAndIncrementCap() {
  const dailyCap = parseInt(process.env.CHAT_DAILY_CAP || '50', 10);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Upsert: create row if missing, then increment
  const usage = await prisma.agentDailyUsage.upsert({
    where: { date: today },
    create: { date: today, count: 1 },
    update: { count: { increment: 1 } }
  });

  const count = usage.count;
  const remaining = Math.max(0, dailyCap - count);
  const allowed = count <= dailyCap;
  const nearLimit = count >= dailyCap * 0.8;

  return { allowed, count, remaining, nearLimit };
}

module.exports = { checkAndIncrementCap };
