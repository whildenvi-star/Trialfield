# Stack Research

**Domain:** Grain traceability — database migration, settlement import, reconciliation engine, buyer management in an existing Express app
**Researched:** 2026-03-01
**Confidence:** HIGH for core stack (verified against ecosystem used elsewhere in this repo and official docs); MEDIUM for settlement import format handling (buyer CSV/Excel formats unknown until samples collected)

---

## Context: What Already Exists (Do Not Re-add)

The grain-tickets app already has the following. This research covers **only what is new for v2.0**.

| Already Present | Do Not Touch |
|-----------------|--------------|
| `express` 4.18 | HTTP server and all existing routes |
| `multer` 2.0.2 | File upload middleware (reuse for settlement import) |
| `xlsx` 0.18.5 | Excel read/write (already present — reuse, don't add ExcelJS) |
| `@anthropic-ai/sdk` 0.75.0 | Claude Vision ticket scanning |
| `calc.js` | Calculation engine — validated against original spreadsheet, do not rewrite |
| `public/` PWA | Service worker, manifest, offline support — preserve entirely |
| Farm Registry integration | `lookup.js` already calls farm-registry on port 3005 |

The organic-cert app (same repo) uses Prisma 6.19.2 + PostgreSQL. This is the established pattern to replicate in grain-tickets. Schema design and migration commands are proven — no new patterns needed.

**Prisma version note:** Prisma 7 was released November 2025 (current stable is 7.4.2 as of 2026-03-01). However, this project pins to **Prisma 6.19.2** deliberately, matching organic-cert. Prisma 7 introduces required driver adapters (`@prisma/adapter-pg`), ESM-first output, and `prisma.config.ts` changes that are breaking changes from Prisma 6. Adding those complexities to a plain-JavaScript CommonJS Express app is not worth it when organic-cert runs on Prisma 6 fine. Migrate both apps together to Prisma 7 in a future milestone when organic-cert upgrades.

---

## Recommended Stack — New Additions Only

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `prisma` | 6.19.2 | ORM + schema + migrations for grain-tickets PostgreSQL | Exact version used in organic-cert (verified in organic-cert/package.json). Consistent tooling across the monorepo. `npx prisma migrate dev` + `npx prisma generate` is the established workflow. Pin to 6.x to avoid Prisma 7 breaking changes until organic-cert upgrades. |
| `@prisma/client` | 6.19.2 | Generated database client | Paired with prisma dev dependency. CommonJS `require('@prisma/client')` works in the existing CJS server.js — no TypeScript migration required. Prisma 6 generates a CJS client by default via the `prisma-client-js` generator. |
| `pg` | 8.x | PostgreSQL driver | Required peer dependency for Prisma 6 with PostgreSQL. The shared PostgreSQL instance already running for organic-cert. Install alongside prisma — Prisma 6 uses `pg` internally without needing an explicit adapter (unlike Prisma 7). |
| `dotenv` | 17.3.1 | Load DATABASE_URL and other env vars at runtime | Already used in organic-cert. Grain-tickets currently has no .env handling. Required in `prisma.config.ts` and at server startup for `DATABASE_URL`. Install as **runtime** dependency, not devDependency — server.js needs it in production. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `csv-parse` | 6.1.0 | Parse buyer settlement CSV files | Already used in organic-cert (package.json confirms csv-parse ^6.1.0). Streaming API handles large settlement files cleanly. Callback/promise API integrates with existing Express route patterns. Match organic-cert version for monorepo consistency. |
| `zod` | 4.3.6 | Schema validation for settlement imports and API inputs | Already in organic-cert. Use when parsing settlement CSV/Excel rows to validate required fields (ticket number, bushels, price) before database insert. Prevents silent bad data from buyer format inconsistencies. `const { z } = require('zod')` works in CommonJS. |
| `date-fns` | 4.1.0 | Date parsing and formatting for settlement records | Already in organic-cert. Settlement sheets use mixed date formats (MM/DD/YYYY from elevators, ISO from some buyers). `parse()` with explicit format strings handles this reliably. Match organic-cert version. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prisma migrate dev` | Schema-driven migrations | Standard Prisma 6 workflow. Each schema change creates a versioned SQL migration in `prisma/migrations/`. Already used in organic-cert — same workflow here. |
| Prisma Studio | Visual database browser during development | Ships with prisma CLI — no install needed. `npx prisma studio` to inspect ticket and settlement data during schema iteration. |
| `prisma/seed.js` | One-time data migration from data.json | Plain JavaScript, no `tsx` needed for a simple seed script. Run with `node prisma/seed.js` during initial deploy. Configured in package.json under `"prisma": { "seed": ... }`. |

---

## Database Migration Strategy (JSON to PostgreSQL)

### One-Time Seed Script

The existing `data.json` (current live data: tickets, farms, cropConfig) must be migrated into PostgreSQL on first deploy. Pattern from organic-cert is a `prisma/seed.js`:

```javascript
// prisma/seed.js — CommonJS, no TypeScript needed
'use strict';
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/data.json'), 'utf8')
);

async function main() {
  // Upsert pattern: idempotent, safe to re-run
  for (const ticket of data.tickets) {
    await prisma.ticket.upsert({
      where: { legacyId: ticket.id },
      update: {},
      create: {
        legacyId: ticket.id,
        date: new Date(ticket.date + 'T00:00:00'),
        farmName: ticket.farm,
        netWeight: ticket.netWeight,
        moisture: ticket.moisture,
        crop: ticket.crop,
        ticketNo: ticket.ticketNo || null,
        notes: ticket.notes || '',
        fm: ticket.fm,
      }
    });
  }
  console.log(`Migrated ${data.tickets.length} tickets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Configure in package.json:
```json
{
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

### Preserving Existing Server Routes During Migration

The migration is additive. The approach is:

1. Install Prisma, generate client, create schema, run first migration
2. Add a `db.js` module exporting the singleton Prisma client
3. Rewrite API routes one by one to use `prisma.*` instead of `store.*`
4. Keep `loadData()` and `saveData()` running in parallel until all routes are migrated
5. Remove JSON file store after all routes verified against PostgreSQL

In Node.js CommonJS, module caching makes a singleton automatically:

```javascript
// db.js — CommonJS module, cached on first require
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

```javascript
// server.js — use the singleton
const prisma = require('./db');
```

No `globalThis` pattern needed — unlike Next.js hot reload, Express restarts are full process restarts and module cache is naturally fresh each time.

**Confidence:** HIGH — pattern directly matches Prisma seeding docs and organic-cert's established workflow.

---

## Prisma 6 Setup Pattern for Express CommonJS

### schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Note: Use `prisma-client-js` (not `prisma-client`). The new `prisma-client` generator is Prisma 7's default and requires ESM + explicit output path + driver adapters. For Prisma 6 in a CJS Express app, `prisma-client-js` generates the client into `node_modules/@prisma/client` — the familiar pattern.

### prisma.config.ts (or .js)

Prisma 6 introduced `prisma.config.ts` to replace inline datasource config. Match the organic-cert pattern exactly:

```javascript
// prisma.config.js — CommonJS equivalent for a plain-JS app
// (organic-cert uses TypeScript, grain-tickets can use plain JS)
require('dotenv').config();
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

Alternatively, keep the `env("DATABASE_URL")` in schema.prisma and skip `prisma.config.js` entirely — Prisma 6 still supports the schema-embedded `env()` pattern if dotenv loads before prisma runs. The organic-cert approach with `prisma.config.ts` is cleaner.

---

## Settlement Import

### Format Reality

4+ buyers use different formats. Known patterns from this domain:

| Buyer Type | Typical Format | Key Columns |
|------------|----------------|-------------|
| Large co-op (ADM, Cargill) | CSV download from portal | Contract #, Ticket #, Date, Net Bushels, Price/BU, Gross Amount |
| Local elevator | Excel (.xlsx) emailed | Often one sheet per crop, inconsistent headers |
| Paper-only buyer | No digital format | Manual entry required — forms UI needed, not import |
| Specialty buyer (organic) | CSV or PDF | PDF requires manual entry; CSV is parseable |

### Import Architecture

Use the **already-installed `multer`** for file upload + **`csv-parse` for CSV** + **existing `xlsx`** for Excel. No new upload or parsing libraries needed.

```javascript
// POST /api/settlements/import — reuses existing multer instance
app.post('/api/settlements/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    // csv-parse streaming API
    const { parse } = require('csv-parse');
    const rows = await new Promise((resolve, reject) => {
      const results = [];
      const parser = parse({ columns: true, skip_empty_lines: true, trim: true });
      parser.on('readable', function() {
        let record;
        while ((record = parser.read()) !== null) results.push(record);
      });
      parser.on('error', reject);
      parser.on('end', () => resolve(results));
      parser.write(file.buffer.toString('utf8'));
      parser.end();
    });
    // map rows using buyer importConfig column names
  } else if (file.originalname.match(/\.xlsx?$/)) {
    // existing xlsx — no ExcelJS needed
    const XLSX = require('xlsx');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    // rows is an array of objects with header keys from row 1
  }
});
```

**Why not ExcelJS:** The `xlsx` package (SheetJS CE 0.18.5) is already a dependency. ExcelJS adds ~2.9MB for no capability gain over existing `xlsx.utils.sheet_to_json()` for read-only settlement data extraction.

**Why not a specialized import library:** Libraries like `csv-to-json` or `node-xlsx` add abstraction that makes buyer-specific column mapping harder to customize. Direct `csv-parse` + `xlsx` gives explicit control over each buyer's format quirks.

**Why not PapaParse:** PapaParse is excellent for browser-side CSV parsing. `csv-parse` is the Node.js streaming choice, already in the organic-cert monorepo, and better suited for server-side parsing pipelines.

---

## Reconciliation Engine

### No New Library Needed

The reconciliation engine is **pure business logic** — compare farm ticket totals (from PostgreSQL) against settlement line items (from buyer import). No specialized reconciliation library is required.

The existing `calc.js` already computes `netBU` per ticket. The reconciliation logic is:

```
for each settlement line:
  farm_netBU = sum(ticket.netBU) where ticket.farmName = settlement.farmName
                                  and ticket.crop = settlement.crop
                                  and ticket.date between settlement.periodStart and settlement.periodEnd
  discrepancy = abs(farm_netBU - settlement.netBU)
  flag if discrepancy > tolerance (e.g., 0.5 BU)
```

This is a PostgreSQL aggregation query via Prisma. No reconciliation framework needed — it's a `groupBy` with a JavaScript comparison.

**Recommended pattern:** Prisma `groupBy` for farm totals, then JavaScript comparison against imported settlement rows. Store results in a `ReconciliationRun` table with per-line discrepancy records.

---

## Buyer Management

### No New Library Needed

Buyer management (name, contact, expected format, column mappings) is a standard CRUD resource in PostgreSQL via Prisma. Store **column mapping configuration per buyer** as JSON so the import parser knows which column header means "Ticket Number" for each buyer.

Recommend a `importConfig` JSON column on the `Buyer` model:

```json
{
  "format": "csv",
  "ticketNoColumn": "Ticket #",
  "netBuColumn": "Net Bushels",
  "priceColumn": "Price/BU",
  "dateColumn": "Settlement Date",
  "dateFormat": "MM/DD/YYYY"
}
```

When a new buyer is added, office staff configures their column names once. The import engine uses that config from that point forward — no hardcoded per-buyer parsers.

**Validation:** Use `zod` (already in organic-cert ecosystem) to validate parsed settlement rows against a schema derived from the buyer's importConfig. Surface row-level errors with line numbers back to the UI.

---

## PWA Preservation During Migration

The existing service worker in `public/sw.js` uses network-first strategy and deliberately skips `/api/` routes:

```javascript
// existing sw.js — already correct
if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
```

This means API routes are never cached by the service worker. The database migration (JSON to PostgreSQL) is transparent to the PWA — API response format stays the same, the service worker never touches API calls, and no service worker changes are needed.

The only required action is bumping the `CACHE_NAME` version in `sw.js` when new static assets are deployed:

```javascript
// Before: 'grain-tickets-v2'
// After adding new settlement UI files:
var CACHE_NAME = 'grain-tickets-v3';
```

This forces users' browsers to evict the old cache and fetch updated JS/CSS files. The `PRECACHE` list must include any new static files added for the settlement UI.

**What NOT to do:** Do not add IndexedDB or offline sync for settlement imports. Settlement reconciliation requires real-time database state — offline writes would create data conflicts. The existing offline support for viewing cached pages is sufficient.

---

## Installation

```bash
# In grain-tickets/ directory

# Core — database layer (runtime deps)
npm install prisma @prisma/client pg dotenv

# Supporting — already in organic-cert, add to grain-tickets
npm install csv-parse date-fns zod

# No dev dependencies needed
# (prisma CLI ships in the runtime package for Prisma 6)
```

**After installing:**
```bash
# Initialize Prisma schema
npx prisma init --datasource-provider postgresql

# First migration (after designing schema)
npx prisma migrate dev --name init

# Generate client
npx prisma generate

# Migrate existing data.json into PostgreSQL
node prisma/seed.js
```

**Do not install:**
- `exceljs` — `xlsx` is already present for Excel reads
- `typeorm` or `sequelize` — organic-cert uses Prisma; two ORM systems in one monorepo is unacceptable
- `bull` / `pg-boss` — no background jobs needed in v2.0; reconciliation runs synchronously on-demand
- `express-validator` — `zod` handles validation; don't add a second validation layer
- TypeScript toolchain — the existing server.js is CommonJS JavaScript; Prisma 6 supports `require('@prisma/client')` cleanly; TypeScript migration is a later concern

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prisma 6.19.2 (match organic-cert) | Prisma 7.4.2 | Use Prisma 7 when organic-cert is also migrated. Prisma 7 requires driver adapters, ESM output, and prisma.config.ts changes — breaking changes for a plain-JS CJS app. The gain (3x faster queries, 90% smaller bundle) is not worth the migration risk for v2.0. |
| Prisma 6.19.2 | Drizzle ORM, TypeORM | Use Drizzle if starting from scratch with TypeScript-first. Prisma is the established choice here — same schema language, same migration CLI, same `npx prisma studio` workflow across both apps. |
| `csv-parse` 6.1.0 | PapaParse 5.5.3 | Use PapaParse for browser-side CSV parsing. csv-parse is the server-side Node.js choice and is already in the monorepo via organic-cert. |
| Existing `xlsx` for Excel reads | ExcelJS 4.4.x | Use ExcelJS if you need to write styled Excel output or read cell formulas and images. For settlement import (read-only plain data rows), existing xlsx is sufficient and already installed. |
| `zod` 4.3.6 | Joi, Yup | Use Joi if the team already knows it. Zod is already the choice in organic-cert, matches ecosystem, and `const { z } = require('zod')` works in CommonJS. |
| Sync reconciliation (on-request) | pg-boss background jobs | Use pg-boss if reconciliation takes over 10 seconds or must run unattended on a schedule. At 100-500 loads/season with 4 buyers, reconciliation completes in under 1 second. |
| Plain JS CommonJS (no migration) | Migrate to TypeScript | Migrate TypeScript in a future milestone when the codebase grows or Prisma 7 upgrade is coordinated across the monorepo. For v2.0, preserving existing server.js structure avoids high-risk rewrite. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `exceljs` | xlsx is already installed; second Excel library creates duplicate code paths and unnecessary 2.9MB dep | Continue using existing `xlsx` 0.18.5 |
| `sequelize` or `typeorm` | Inconsistent with organic-cert (Prisma 6); two migration workflows in same git repo is operational overhead | Prisma 6.19.2 |
| `pg-boss` in v2.0 | No async jobs needed at this scale; adds Redis-equivalent operational complexity | Sync reconciliation; add pg-boss in v3.0 if scheduled nightly reconciliation is requested |
| Express version upgrade | Express 4.18 routes work; Express 5 changes error handler middleware signature — upgrade risk with zero user benefit for v2.0 | Stay on Express 4.18 |
| `multer` replacement or addition | Already installed and working for Claude Vision scan uploads; extend existing instance with settlement upload route | Extend existing multer instance |
| Full TypeScript migration | Weeks of refactoring risk to a working app; no type safety benefit justifies it for v2.0 | Incremental TypeScript (new files only) in a later milestone |
| Prisma 7 for grain-tickets only | Creates a split where organic-cert uses Prisma 6 and grain-tickets uses Prisma 7 — different generators, different client APIs, split upgrade testing burden | Pin both to 6.x, upgrade together in one coordinated milestone |

---

## Stack Patterns by Variant

**If a buyer sends PDF settlements only (no CSV/Excel):**
- Do not add a PDF parsing library (pdf-parse, pdfplumber are brittle against format changes)
- Build a manual settlement entry form in the UI (same pattern as existing ticket entry form)
- PDF parsing is a v3.0 concern if volume justifies it

**If settlement files exceed 10,000 rows:**
- Switch from `xlsx.utils.sheet_to_json()` (loads full file into memory) to ExcelJS streaming reader
- Switch from csv-parse callback API to csv-parse stream API with `async iterator` pattern
- At 100-500 loads/season, this will not be needed for this farm

**If reconciliation needs to run on a schedule (e.g., auto-check daily):**
- Add `pg-boss` against the shared PostgreSQL (already documented in project MEMORY.md as planned for organic-cert)
- Single pg-boss instance can serve both apps via shared database

**If grain-tickets eventually migrates to Next.js (future milestone):**
- Prisma schema, migrations, and seed script are fully portable — no schema rework needed
- Server.js routes convert to Next.js API routes; business logic in service layer stays unchanged

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `prisma@6.19.2` | Node 18+ | Grain-tickets runs on macOS with Node 22 (same as organic-cert). Fully compatible. |
| `prisma@6.19.2` | PostgreSQL 14+ | Shared PostgreSQL instance already running and verified for organic-cert. |
| `@prisma/client@6.19.2` | CommonJS `require()` | Confirmed: `const { PrismaClient } = require('@prisma/client')` works in CJS with `prisma-client-js` generator. Prisma 6 generates CJS client into `node_modules/@prisma/client` by default. |
| `csv-parse@6.1.0` | Node 22 | Uses native Node.js streams. No compatibility issues. |
| `xlsx@0.18.5` (existing) | `multer` memory storage | `xlsx.read(req.file.buffer, { type: 'buffer' })` is the documented pattern. Proven in existing import.js already. |
| `zod@4.3.6` | CommonJS `require()` | Zod 4.x ships both ESM and CJS. `const { z } = require('zod')` works. |
| `dotenv@17.3.1` | Node 22, CommonJS | `require('dotenv').config()` at server.js startup loads `.env` before Prisma client initialization. |

---

## Sources

- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/package.json` — Confirmed Prisma 6.19.2, @prisma/client 6.19.2, csv-parse 6.1.0, zod 4.3.6, date-fns 4.1.0, dotenv 17.3.1 versions in active use. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/package.json` — Confirmed existing dependencies: express 4.18, multer 2.0.2, xlsx 0.18.5, @anthropic-ai/sdk 0.75.0. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/server.js` — Confirmed CommonJS `require()` module system, in-memory store structure, and existing multer instance. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/public/sw.js` — Confirmed service worker skips `/api/` routes, uses network-first strategy, CACHE_NAME = 'grain-tickets-v2'. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma.config.ts` — Confirmed `defineConfig` + `dotenv/config` + `datasource.url` pattern used in production. HIGH confidence.
- `https://www.prisma.io/blog/announcing-prisma-orm-7-0-0` — Prisma 7 stable release November 2025. Breaking changes: driver adapters required, ESM-first, new generator. HIGH confidence (official Prisma blog).
- WebSearch confirmed: Prisma 7.4.2 is current stable as of 2026-03-01; Prisma 6.19.2 is latest in 6.x line. MEDIUM confidence (search results, not npm directly checked).
- `https://www.prisma.io/blog/prisma-orm-6-6-0-esm-support-d1-migrations-and-prisma-mcp-server` — Confirmed `prisma-client-js` still works in Prisma 6 for CJS; new `prisma-client` generator is optional in 6.x, default in 7. HIGH confidence (official blog).
- WebSearch: csv-parse 6.1.0 confirmed streaming API and Node.js support. MEDIUM confidence.
- WebSearch: PapaParse 5.5.3 — browser-first, supports Node.js but csv-parse is the established server-side choice. MEDIUM confidence.
- WebSearch: ExcelJS 4.4.x — 2.9M weekly downloads. Recommended for write/style use cases; not needed for read-only settlement parsing when xlsx is already present. MEDIUM confidence.

---

*Stack research for: Grain tickets v2.0 — database migration, settlement import, reconciliation engine, buyer management*
*Researched: 2026-03-01*
