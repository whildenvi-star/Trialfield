#!/usr/bin/env node
/**
 * rollover-season.js — MACRO season rollover tooling.
 *
 * Archives the live data.json to data/seasons/<year>.json (safe from the
 * 5-slot backup ring, which overwrites itself). Archived seasons are served
 * read-only by /api/seasons + /api/season-data/:year and appear in the
 * sidebar season switcher, so MACRO 2026 stays viewable when MACRO 2027 is
 * the live season.
 *
 * Usage:
 *   node scripts/rollover-season.js                 archive current season
 *   node scripts/rollover-season.js --force         overwrite existing archive
 *   node scripts/rollover-season.js --start-next    archive, then bump
 *                                                   settings.year to year+1
 *
 * --start-next only bumps the year — what carries into the new season
 * (fields, rents, inputs) is a human decision made in the app afterwards.
 * Run with the farm-budget server STOPPED.
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');
const SEASONS_DIR = path.join(__dirname, '..', 'data', 'seasons');

const FORCE = process.argv.includes('--force');
const START_NEXT = process.argv.includes('--start-next');

const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const year = (store.settings && store.settings.year) || new Date().getFullYear();
const archivePath = path.join(SEASONS_DIR, year + '.json');

fs.mkdirSync(SEASONS_DIR, { recursive: true });

if (fs.existsSync(archivePath) && !FORCE) {
  console.error(`Archive for ${year} already exists (${archivePath}) — use --force to overwrite.`);
  process.exit(1);
}

fs.copyFileSync(DATA_FILE, archivePath);
console.log(`Archived MACRO ${year} → data/seasons/${year}.json`);

if (START_NEXT) {
  store.settings.year = year + 1;
  if (store.settings.cropYear != null) store.settings.cropYear = year + 1;
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  console.log(`Live season is now MACRO ${year + 1}. Field/rent/input carryover is yours to decide in the app.`);
} else {
  console.log('Live season unchanged. Run with --start-next at rollover to begin the new MACRO year.');
}
