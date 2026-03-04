# Phase 10: Migration & Cutover - Research

**Researched:** 2026-03-01
**Domain:** Node.js data migration, Prisma CRUD, JSON-to-PostgreSQL cutover
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Data enrichment during migration**
  - Extract HBT bin numbers from notes field into dedicated `hbtBinNo` column (507 of 527 tickets have them)
  - Extract truck/trailer IDs from notes field into dedicated `truckId` column (best-effort parse)
  - Notes field keeps original text intact — extraction copies data, doesn't remove it
  - All 14 duplicate ticket numbers migrate as-is — schema uses @@index (not @unique) on ticketNo
  - All existing crop configs get `cropYear=2025` as default (current harvest season data)

- **Cutover approach**
  - Big-bang cutover: stop server, run migration script, restart with Prisma routes
  - Off-season timing — no field users active, brief downtime is acceptable
  - Migration script includes `--dry-run` mode that reports what it would do without writing to PostgreSQL
  - Rollback plan: data.json.archive stays intact; if PostgreSQL has issues, revert server.js to JSON routes from git history

- **Archive and code cleanup**
  - data.json renamed to data.json.archive after successful migration
  - All .bak rotating backup files (data.json.bak.1 through .bak.5) deleted after migration
  - All JSON-based code removed from server.js entirely (loadData, saveData, withLock, backup rotation, in-memory store)
  - In-memory caching layer removed (farmSummaryCache, ticketById/ticketByNo maps) — PostgreSQL handles queries directly
  - Dead code deleted, not commented out — git history preserves it

- **Migration verification**
  - Console summary output: tickets migrated, farms migrated, crop configs migrated, HBT bins extracted, truck IDs extracted, any warnings
  - Auto-verify calc.js: pick 10 random tickets, run calc.js against both JSON source and DB records, confirm byte-identical totals
  - Data anomalies (0 weight, missing dates, empty farm names): warn in console output but migrate everything — bad data in JSON stays as-is in DB
  - Post-cutover: manual smoke test of create, edit, delete ticket through browser UI

### Claude's Discretion

- HBT bin number parsing regex/pattern
- Truck ID extraction heuristics
- Random ticket selection strategy for calc.js verification
- PWA CACHE_NAME bump approach
- Prisma query patterns and error handling in route handlers
- Write-lock implementation during migration (if needed)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | Existing grain ticket data migrates from JSON to PostgreSQL with zero data loss | Migration script pattern: read JSON, insert via Prisma createMany, verify row counts match |
| DB-02 | All existing ticket CRUD operations work against PostgreSQL (not JSON) | Full route rewrite: all 15 routes replaced with equivalent Prisma queries; API response shape preserved for backward compat |
| DB-03 | Calculation engine (calc.js) produces identical results before and after migration | calc.js runs from server (already used in /api/tickets enrichment); migration verifier reads 10 random DB tickets and compares outputs |
| DB-04 | Existing UI and PWA continue functioning during and after migration | Response shapes preserved exactly; CACHE_NAME bumped in sw.js forces full SW refresh; no client JS changes needed |
</phase_requirements>

---

## Summary

Phase 10 is a precision data migration and code rewrite with zero tolerance for data loss. The work splits cleanly into two deliverables: (1) a standalone migration script (`migrate-json.js`) that reads data.json, inserts all records into PostgreSQL via Prisma, and verifies row counts and calc.js parity; and (2) a full rewrite of server.js routes replacing the in-memory JSON store with Prisma queries. No new features are added — the external API surface (URL paths, HTTP methods, response shapes) must remain byte-identical.

The most important finding is that the `/api/crops` endpoint currently returns a plain key-value object (`{ "Rye": { discount, testWeight, moistureShrink } }`) not an array, and the browser client uses `Object.keys(refData.cropConfig)` and `refData.cropConfig[cropName]` directly. The Prisma CropConfig model stores rows, so the GET /api/crops route must convert DB rows back to this object shape — or the UI silently breaks. This is the highest-risk backward-compat issue.

Notes parsing for HBT bin extraction covers 505 of 527 tickets. The dominant pattern is `HBT# NNNN` or `HBT#NNNN` with or without a space. One ticket uses "Blue Ticket NNNN" as a synonym. Nineteen tickets have notes that contain only destination names ("Seneca", "GR01 Ken Trucked") with no HBT or truck info — these should yield null for both hbtBinNo and truckId, which is expected and acceptable.

**Primary recommendation:** Write migrate-json.js as a self-contained Node.js script that runs outside the server process. Rewrite server.js routes in one atomic commit after migration is verified. Bump CACHE_NAME in sw.js from 'grain-tickets-v2' to 'grain-tickets-v3' as part of the route rewrite deploy.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | ^6.19.2 (already installed) | Database queries in migration script and server.js | Phase 9 foundation — already in package.json, migration already applied |
| dotenv | ^16.x (already installed) | Load DATABASE_URL in migration script | Already used in lib/db.js; same pattern needed in standalone migrate-json.js |
| Node.js fs/path | built-in | Read data.json, rename to .archive, delete .bak files | No extra dependency needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lib/db.js (local) | Phase 9 output | PrismaClient singleton | Import in server.js routes (`const prisma = require('./lib/db')`) |
| public/calc.js | existing | Verify totals during migration | require('./public/calc.js') from migrate-json.js for cross-check |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| prisma.createMany() | prisma.create() loop | createMany is 10-100x faster for bulk inserts; skipDuplicates option not needed here |
| lib/db.js singleton | direct new PrismaClient() | Migration script is short-lived and single-process; direct instantiation is fine for migrate-json.js |

**Installation:**

No new packages required. Phase 9 already installed:
```bash
# Already in grain-tickets/package.json:
# prisma@^6.19.2, @prisma/client@^6.19.2, dotenv
```

---

## Architecture Patterns

### Recommended Project Structure

```
grain-tickets/
├── migrate-json.js       # NEW: standalone migration script (Plan 10-01)
├── server.js             # REWRITE: all routes use Prisma (Plan 10-02)
├── lib/db.js             # Phase 9 — import in both migrate-json.js and server.js
├── data/
│   ├── data.json.archive # RENAMED from data.json after successful migration
│   └── (data.json.bak.* deleted)
└── public/
    └── sw.js             # CACHE_NAME bump from v2 to v3
```

### Pattern 1: Migration Script Structure (migrate-json.js)

**What:** Standalone Node.js script, not part of the Express server. Reads data.json, inserts to DB, verifies, renames archive file.

**When to use:** Run once during cutover window with server stopped.

**Example:**
```javascript
// migrate-json.js
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const dryRun = process.argv.includes('--dry-run');

async function run() {
  const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const { tickets, farms, cropConfig } = store;

  console.log(`Source: ${tickets.length} tickets, ${farms.length} farms, ${Object.keys(cropConfig).length} crop configs`);

  if (dryRun) {
    console.log('[DRY RUN] Would insert the above. No DB writes.');
    await prisma.$disconnect();
    return;
  }

  // 1. Migrate CropConfigs
  const cropRows = Object.entries(cropConfig).map(([cropName, cfg]) => ({
    cropYear: 2025,
    cropName,
    testWeight: cfg.testWeight || 56,
    moistureShrink: cfg.moistureShrink || 0,
    discount: cfg.discount || 0
  }));
  await prisma.cropConfig.createMany({ data: cropRows });

  // 2. Migrate Farms
  const farmRows = farms.map(f => ({
    legacyId: f.id,
    name: f.farm,
    // ... all farm fields
  }));
  await prisma.farm.createMany({ data: farmRows });

  // 3. Migrate Tickets (with HBT/truck extraction)
  const ticketRows = tickets.map(t => ({
    legacyId: t.id,
    // ...
    hbtBinNo: extractHbtBinNo(t.notes),
    truckId: extractTruckId(t.notes),
    // notes kept intact
  }));
  await prisma.ticket.createMany({ data: ticketRows });

  // 4. Verify row counts
  // 5. Verify calc.js parity on 10 tickets
  // 6. Archive data.json
}
```

### Pattern 2: Prisma createMany for Bulk Insert

**What:** `prisma.createMany({ data: [...] })` inserts all records in a single statement. Much faster than looping `prisma.create()`.

**When to use:** Migrating all 527 tickets, 63 farms, 37 crop configs.

**Key behavior:** Returns `{ count: N }` — use this to verify the expected row count was inserted.

```javascript
const result = await prisma.ticket.createMany({ data: ticketRows });
if (result.count !== tickets.length) {
  throw new Error(`Expected ${tickets.length} tickets, inserted ${result.count}`);
}
```

**Important:** `createMany` does NOT return the created records — only the count. If you need IDs back (e.g., for cross-referencing), use individual `create()` calls or query after insertion.

### Pattern 3: Prisma Query Patterns for Route Rewrite

**What:** Replace each JSON store operation with an equivalent Prisma query in server.js.

**Key mappings:**

```javascript
// GET all tickets (was: store.tickets.map(enrichTicket))
const tickets = await prisma.ticket.findMany({ orderBy: { date: 'desc' } });
const enriched = tickets.map(t => enrichTicket(dbTicketToJson(t), cropConfigCache));

// GET ticket by ID (was: ticketById.get(req.params.id))
const ticket = await prisma.ticket.findFirst({ where: { legacyId: req.params.id } });
// Note: req.params.id is the legacy string ID like "t_000001"
// Prisma integer IDs are internal; routes use legacyId for compat

// POST create ticket (was: store.tickets.push(ticket); saveData())
const ticket = await prisma.ticket.create({ data: { ... } });

// PUT update ticket
const ticket = await prisma.ticket.update({ where: { id: parseInt(req.params.id) }, data: { ... } });

// DELETE ticket
await prisma.ticket.delete({ where: { id: parseInt(req.params.id) } });
```

### Pattern 4: Preserving /api/crops Response Shape

**What:** The current `/api/crops` endpoint returns `{ cropName: { discount, testWeight, moistureShrink } }` (a plain object). The client uses `Object.keys(refData.cropConfig)` to list crop names and `refData.cropConfig[cropName]` to look up config. This shape MUST be preserved.

**Critical:** Prisma stores CropConfig as rows. The route must convert rows back to object shape:

```javascript
app.get('/api/crops', async (req, res) => {
  const rows = await prisma.cropConfig.findMany({ where: { cropYear: 2025 } });
  const obj = {};
  rows.forEach(r => {
    obj[r.cropName] = { discount: r.discount, testWeight: r.testWeight, moistureShrink: r.moistureShrink };
  });
  res.json(obj);
});
```

**Without this conversion:** The client would receive an array instead of an object, `Object.keys()` would return index strings "0", "1", "2"..., and the UI would silently show no crop options or fail validation.

### Pattern 5: cropYear in New Ticket Creation

**What:** The Ticket schema has a required `cropYear Int` field. When creating new tickets via POST /api/tickets, cropYear must be derived from the submitted date.

```javascript
function getCropYear(dateStr) {
  if (!dateStr) return new Date().getFullYear();
  return parseInt(dateStr.slice(0, 4), 10);
}
```

The `cropConfig.findMany()` query in the validation step should use the ticket's cropYear, not hardcoded 2025 — otherwise a ticket entered in 2026 would fail crop validation.

### Pattern 6: HBT Bin Number Extraction

**What:** 505 of 527 tickets have HBT bin numbers in the notes field. Patterns observed:

```
"HBT# 5652 WR Trk# 41"        <- space after HBT#
"HBT#3128 Airport Hipps..."    <- no space after HBT#
"HBT # 5076 #3 Bob"            <- space before #
"Blue Ticket 5075 truck 3 Bob" <- synonym (1 ticket)
```

**Recommended regex:**
```javascript
function extractHbtBinNo(notes) {
  if (!notes) return null;
  // Primary: HBT# or HBT # followed by digits
  const hbtMatch = notes.match(/HBT\s*#\s*(\d+)/i);
  if (hbtMatch) return hbtMatch[1];
  // Fallback: "Blue Ticket NNNN"
  const blueMatch = notes.match(/blue\s+ticket\s+(\d+)/i);
  if (blueMatch) return blueMatch[1];
  return null;
}
```

This covers 506 of 527 tickets (505 HBT + 1 Blue Ticket). The 19 tickets with destination-only notes ("Seneca", "GR01 Ken") correctly return null.

### Pattern 7: Truck ID Extraction

**What:** 306 of 527 tickets have truck identifiers. Patterns observed:

```
"HBT# 5652 WR Trk# 41"           <- Trk# NNNN
"HBT# 4559 Gary Trk#63"           <- Trk#NN no space
"HBT#5070 Bob Trk # 3 1st load"   <- Trk # with space before #
"HBT# 4564 Airport Hipps Truck # 5 Bob Blue"  <- "Truck #"
"HBT# 4565 Bob # 63 trailer 4 last load"      <- # only, no keyword
"Blue Ticket 5075 truck 3 Bob"    <- "truck N" no #
```

**Recommended regex (best-effort):**
```javascript
function extractTruckId(notes) {
  if (!notes) return null;
  // "Trk# N" or "Truck # N" or "truck N"
  const m = notes.match(/(?:Trk|Truck)\s*#?\s*(\w+)/i);
  if (m) return m[1];
  return null;
}
```

This covers the dominant patterns. The "# 63 trailer" format (no keyword) will not be extracted — acceptable for best-effort requirement.

### Pattern 8: calc.js Parity Verification

**What:** The migration script must prove that Prisma rows produce identical results to the original JSON records when passed through calc.js.

**Challenge:** calc.js takes `(ticket, cropConfig)` where `cropConfig` is the object shape `{ cropName: { discount, testWeight, moistureShrink } }`. After migrating to DB, we must reconstruct this shape for the verification step.

**Approach:**
```javascript
// After migration, build cropConfig object from DB for calc.js verification
const cropRows = await prisma.cropConfig.findMany({ where: { cropYear: 2025 } });
const dbCropConfig = {};
cropRows.forEach(r => {
  dbCropConfig[r.cropName] = { discount: r.discount, testWeight: r.testWeight, moistureShrink: r.moistureShrink };
});

// Pick 10 random tickets for spot-check
const jsonTickets = store.tickets;
const indices = [];
while (indices.length < 10) {
  const i = Math.floor(Math.random() * jsonTickets.length);
  if (!indices.includes(i)) indices.push(i);
}

for (const i of indices) {
  const jsonTkt = jsonTickets[i];
  const dbTkt = await prisma.ticket.findFirst({ where: { legacyId: jsonTkt.id } });

  const jsonResult = Calc.computeTicket(jsonTkt, store.cropConfig);
  const dbResult = Calc.computeTicket(dbTicketToJsonShape(dbTkt), dbCropConfig);

  if (JSON.stringify(jsonResult) !== JSON.stringify(dbResult)) {
    console.error(`MISMATCH ticket ${jsonTkt.id}: JSON=${JSON.stringify(jsonResult)} DB=${JSON.stringify(dbResult)}`);
    process.exit(1);
  }
}
console.log('calc.js parity: 10/10 tickets match');
```

### Pattern 9: DB Ticket to JSON Shape Conversion

**What:** The existing `enrichTicket()` function in server.js calls `Calc.computeTicket(ticket, store.cropConfig)`. After migration, tickets come from Prisma. The shape is slightly different (Prisma adds `id: Int`, `createdAt`, `updatedAt`; the date is a Date object not a string). A converter is needed.

```javascript
function dbTicketToJsonShape(dbTicket) {
  return {
    id: dbTicket.legacyId || String(dbTicket.id),
    date: dbTicket.date instanceof Date
      ? dbTicket.date.toISOString().split('T')[0]
      : dbTicket.date,
    farm: dbTicket.farm,
    netWeight: dbTicket.netWeight,
    moisture: dbTicket.moisture,
    fm: dbTicket.fm || 0,
    crop: dbTicket.crop,
    ticketNo: dbTicket.ticketNo || '',
    notes: dbTicket.notes || '',
    hbtBinNo: dbTicket.hbtBinNo || null,
    truckId: dbTicket.truckId || null
  };
}
```

The enriched ticket response should include `id` as the legacy string ID for client compatibility (the client uses `t.id` to build edit/delete URLs like `/api/tickets/t_000001`).

**Critical finding:** The existing client JavaScript uses the string IDs like `t_000001` throughout. When server.js is rewritten, route handlers must look up tickets by `legacyId`, not by the Prisma integer `id`. Alternatively, new tickets created after migration get a generated integer id — the route handlers must handle both cases.

**Recommended approach:** After migration, retire legacy string IDs. New routes use integer Prisma IDs. The URL `/api/tickets/:id` changes meaning: after migration, `:id` is the integer Prisma id. Since all data is migrated in one shot and the client state is cleared by the CACHE_NAME bump, this is safe — there are no bookmarked ticket URLs with string IDs.

### Pattern 10: PWA Service Worker Cache Bump

**What:** The current CACHE_NAME is `'grain-tickets-v2'` in `public/sw.js`. Bumping to `'grain-tickets-v3'` triggers the SW update lifecycle:

1. Browser downloads new SW
2. SW install event runs, precaches all assets under new cache name
3. Old SW activate event deletes `grain-tickets-v2` cache
4. New SW claims all clients

**Why this matters for migration:** The offline queue in the service worker only intercepts GET requests for static assets (`req.method !== 'GET'` bypasses SW for API calls). There is NO offline queue for POST/PUT/DELETE mutations in this SW — mutations go directly to the server. So the cache bump is purely about ensuring clients load the latest JS files after the route rewrite, not about replaying queued operations.

The success criterion "offline queue replays correctly" is trivially satisfied because there is no offline mutation queue — the SW uses network-first for GETs and passes through all API calls.

**Implementation:** Change one line in sw.js:
```javascript
// Before:
var CACHE_NAME = 'grain-tickets-v2';
// After:
var CACHE_NAME = 'grain-tickets-v3';
```

### Anti-Patterns to Avoid

- **Updating the route IDs in-place during migration:** The `/api/tickets/:id` `:id` parameter currently matches legacy string IDs like `t_000001`. If the route rewrite switches to integer IDs without a CACHE_NAME bump, clients that have the old JS cached will send string IDs to routes expecting integers, causing 500 errors. The CACHE_NAME bump ensures clients reload fresh JS.
- **Using prisma.cropConfig.findFirst({ where: { cropName } }) without cropYear:** Multiple cropYears will be added in future phases. Always filter by cropYear.
- **Returning the Prisma `id` integer as the ticket `id` in API responses without first migrating the client:** The client JS in tickets.js uses `t.id` to construct PUT/DELETE URLs. Changing the ID type from string to integer is safe only if client JS is also updated in the same deploy — which happens via the CACHE_NAME bump causing a full SW cache flush.
- **Forgetting to set `cropYear` on new tickets created post-migration:** The POST /api/tickets handler must derive cropYear from the submitted date and store it.
- **Deleting data.json before verifying row counts:** Always verify `prisma.ticket.count() === sourceTickets.length` before renaming to .archive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk insert | INSERT loop | prisma.createMany() | Single statement, much faster, returns exact count |
| Date conversion | String parsing | `new Date(dateStr + 'T00:00:00')` | Handles YYYY-MM-DD reliably without timezone shift; pass to Prisma as-is |
| Atomic file rename | Copy + delete | `fs.renameSync(src, dest)` | Atomic on same filesystem; data.json → data.json.archive |
| Connection management | Manual connect | lib/db.js singleton | Already built in Phase 9; import it |

**Key insight:** The migration is a one-time script. Simplicity beats cleverness — sequential awaits, console.log progress, fail-fast on any error.

---

## Common Pitfalls

### Pitfall 1: DateTime Timezone Shift

**What goes wrong:** `new Date('2025-07-22')` in Node.js creates a UTC midnight Date. When Prisma stores it and the server is in a non-UTC timezone, the date can shift to July 21 when read back.

**Why it happens:** JavaScript `new Date('YYYY-MM-DD')` parses as UTC midnight. If the local timezone is behind UTC (e.g., US/Central UTC-6), displaying as local time shows the previous day.

**How to avoid:** Parse dates as `new Date(dateStr + 'T00:00:00')` (no Z suffix = local time) OR store the raw date string in a separate column. Since the schema uses `DateTime`, store `new Date(dateStr + 'T12:00:00')` (noon local) to safely survive any timezone shift, or use `new Date(dateStr + 'T00:00:00.000')` and always read back with `.toISOString().split('T')[0]`.

**Warning signs:** After migration, ticket dates showing one day earlier than source JSON dates.

**Recommended approach:** Use `new Date(dateStr + 'T00:00:00')` (local time, no Z). When reading back from DB for API responses, convert: `dbTicket.date.toISOString().split('T')[0]` will give UTC date — which may differ. Safest: store as noon UTC `new Date(dateStr + 'T12:00:00.000Z')` which stays the same date in any timezone ±12h.

### Pitfall 2: cropConfig Object Shape vs. Array Shape

**What goes wrong:** The client calls `Object.keys(refData.cropConfig)` to list crop names. If the route returns an array (Prisma's natural output), the client gets `["0","1","2"]` as crop names and the UI silently shows nothing or crashes on form submit.

**Why it happens:** Developers treat the API response as equivalent to the DB rows. They are not — the client was built against the flat-file shape.

**How to avoid:** The `GET /api/crops` route must convert DB rows to the object shape. See Pattern 4 above. Test this manually before declaring the route rewrite complete.

**Warning signs:** Crop dropdown shows no options, or shows "0", "1", "2". Ticket submit fails validation with "Crop not in crop config".

### Pitfall 3: Legacy String IDs vs. Prisma Integer IDs

**What goes wrong:** The current API exposes tickets with `id: "t_000001"`. The route handlers use this for GET /api/tickets/:id, PUT, DELETE. After rewrite, Prisma uses integer IDs. If the route changes to integer IDs without a client JS update, the client sends `fetch('/api/tickets/t_000001', { method: 'DELETE' })` and gets a 404 or NaN error.

**Why it happens:** The migration changes the internal ID type but the external API contract is implicit (not versioned).

**How to avoid:** Two options:
1. Keep exposing `legacyId` as the `id` field in all ticket API responses. New tickets get generated legacyId like `t_` + timestamp. Routes do `findFirst({ where: { legacyId: req.params.id } })`.
2. Switch to integer IDs and rely on the CACHE_NAME bump to force-reload client JS that sends integers.

Option 2 is cleaner long-term and safe here because: (a) the CACHE_NAME bump flushes cached JS, (b) there are no bookmarked ticket URLs, (c) the app is used by a small set of known users who will get the new SW on next page load.

**Recommended:** Option 2 — switch to integer IDs. Route handlers parse `parseInt(req.params.id, 10)` and use `prisma.ticket.findUnique({ where: { id: intId } })`. New tickets expose their integer `id` in responses.

### Pitfall 4: Farm.name Uniqueness Constraint

**What goes wrong:** The Farm model has `name String @unique`. If two JSON farms have the same name (even with different crop or acres), `createMany` will fail on the duplicate.

**Why it happens:** The JSON farms array has one entry per farm-crop combination — "Airport" appears with crop "Rye", and could also appear with a different crop. Let's check.

**Verified data:** The 63 farms in data.json each have unique `farm` field values (farm names are unique in the source data — the constraint is safe). However, to be defensive, the migration script should detect and warn on any duplicates before inserting.

**How to avoid:** Before `farm.createMany()`, verify no duplicate `farm` values in source. If found, warn and deduplicate (keep first occurrence) rather than failing.

### Pitfall 5: Server Must Shut Down Before Migration Runs

**What goes wrong:** Running the migration script while the server is running could cause the server to write to data.json mid-migration, and then the archive rename might capture stale data.

**Why it happens:** The cutover runbook is the human's responsibility, but the script should make this explicit.

**How to avoid:** The migration script does NOT need a programmatic write-lock on PostgreSQL — Prisma handles concurrent writes safely. The lock is just "stop the Express server before running the script." Document this clearly in the script's console output and in comments.

---

## Code Examples

Verified patterns from official Prisma 6 documentation and local Phase 9 verification:

### createMany with count verification

```javascript
// Source: Prisma docs - createMany
const result = await prisma.ticket.createMany({
  data: ticketRows
  // skipDuplicates: false (default) — we WANT to fail on true duplicates
});
console.log(`Inserted ${result.count} of ${ticketRows.length} expected tickets`);
if (result.count !== ticketRows.length) {
  throw new Error('Row count mismatch — migration aborted');
}
```

### findMany with date order

```javascript
// GET /api/tickets — matches current behavior of returning all tickets
const tickets = await prisma.ticket.findMany({
  orderBy: { date: 'desc' }
});
```

### findMany with string search

```javascript
// GET /api/tickets/search?ticketNo=H066
const tickets = await prisma.ticket.findMany({
  where: {
    ticketNo: { contains: q, mode: 'insensitive' }
  }
});
```

### Crop validation in route handler

```javascript
// Replaces: !store.cropConfig[trimmed]
// After migration, validate crop exists for the ticket's cropYear
const cropYear = getCropYear(body.date);
const cropExists = await prisma.cropConfig.findFirst({
  where: { cropYear, cropName: (body.crop || '').trim() }
});
if (!cropExists) errors.push(`Crop "${body.crop}" not in crop config for ${cropYear}`);
```

### File archive after successful migration

```javascript
// Atomic rename — same filesystem, no data copy needed
const archivePath = DATA_FILE + '.archive';
fs.renameSync(DATA_FILE, archivePath);
console.log(`Archived: ${DATA_FILE} → ${archivePath}`);

// Delete backup rotation files
for (let i = 1; i <= 5; i++) {
  const bak = DATA_FILE + '.bak.' + i;
  if (fs.existsSync(bak)) {
    fs.unlinkSync(bak);
    console.log(`Deleted: ${bak}`);
  }
}
```

### Ticket shape adapter for calc.js compatibility

```javascript
// Convert Prisma Ticket row to the shape calc.js expects
function dbTicketForCalc(dbTicket) {
  return {
    netWeight: dbTicket.netWeight,
    moisture: dbTicket.moisture,
    fm: dbTicket.fm || 0,
    crop: dbTicket.crop
  };
}
// Usage:
const result = Calc.computeTicket(dbTicketForCalc(dbTicket), cropConfigObject);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON flat file with rotate-backup | PostgreSQL via Prisma | Phase 10 | Eliminates write-lock queue, in-memory indexes, backup rotation code |
| In-memory farmSummaryCache | Direct Prisma query + JS aggregation | Phase 10 | farmSummaryCache, ticketById, ticketByNo maps all removed |
| loadData() on startup | PrismaClient lazy connect | Phase 10 | No startup file I/O — first query triggers connection |

**Deprecated/outdated after Phase 10:**
- `withLock()` / `writeQueue`: removed — PostgreSQL handles concurrent writes natively
- `migrateWhitespace()`: removed — was idempotent data cleanup, no longer needed once DB enforces clean data at write time
- `loadData()`, `saveData()`: removed — replaced by Prisma queries
- In-memory `store`, `farmSummaryCache`, `ticketById`, `ticketByNo`: all removed

---

## Open Questions

1. **Integer vs. legacy string IDs for the route API**
   - What we know: Client JS uses `t.id` to build PUT/DELETE URLs. Current value is a string like `t_000001`.
   - What's unclear: Whether CACHE_NAME bump reliably forces all clients to reload JS before they next make a mutation request.
   - Recommendation: Use integer IDs (cleaner) and rely on the CACHE_NAME bump. This is a low-risk choice for an off-season deploy with known users. Document the requirement that users must allow the PWA to update before using it after deploy.

2. **cropYear for the /api/crops endpoint**
   - What we know: After Phase 11+, there may be 2026 crop configs. The current plan assigns all existing configs to 2025.
   - What's unclear: Should GET /api/crops return ALL crop configs (all years) merged, or only the current year?
   - Recommendation: Return configs for `cropYear = CURRENT_YEAR` (derived from `new Date().getFullYear()`). This makes the endpoint forward-compatible without hardcoding 2025.

3. **Farm route backward compat**
   - What we know: GET /api/farms currently returns `computeFarmSummaries(tickets, farms, cropConfig)` — a computed object with `totalBU` and `yieldPerAcre`. After migration, this computation must still happen via Prisma queries.
   - What's unclear: Performance — 527 tickets * calc.js per request is fast in JSON (microseconds); in Prisma it requires `findMany` then JS aggregation.
   - Recommendation: No caching needed for 527 tickets — Prisma query + JS aggregation is fast enough. farmSummaryCache was only needed because JSON file I/O was slow; PostgreSQL query is faster.

---

## Validation Architecture

> nyquist_validation is not set in config.json — the `workflow` block only contains `research`, `plan_check`, and `verifier`. Skipping Validation Architecture section.

---

## Sources

### Primary (HIGH confidence)

- Local codebase inspection:
  - `grain-tickets/server.js` — complete route surface, all 15 API routes documented
  - `grain-tickets/data/data.json` — 527 tickets, 63 farms, 37 crop configs — actual data analyzed
  - `grain-tickets/public/app.js`, `tickets.js`, `farms.js` — client API consumption patterns verified
  - `grain-tickets/public/sw.js` — service worker implementation: CACHE_NAME = 'grain-tickets-v2', no offline mutation queue
  - `grain-tickets/public/calc.js` — full calculation engine documented
  - `grain-tickets/lib/db.js` — Phase 9 PrismaClient singleton (confirmed working)
  - `grain-tickets/prisma/schema.prisma` — complete v2.0 schema (Phase 9 output)
  - Prisma migration status: 1 migration applied, database in sync
- Phase 9 plan (`09-01-PLAN.md`) — schema decisions: legacyId, @@index on ticketNo, hbtBinNo, truckId columns, CropConfig.cropYear

### Secondary (MEDIUM confidence)

- Notes parsing patterns: empirical analysis of 527 actual ticket notes strings from data.json. Dominant pattern `HBT# NNNN` with variants covers 506/527 tickets.
- Prisma createMany behavior: HIGH confidence (standard Prisma 6 API, locally verified working in Phase 9)

### Tertiary (LOW confidence)

- DateTime timezone behavior: Standard Node.js behavior, not tested against local PostgreSQL in this research. Flag for early testing in migration script.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 9 already installed and verified; no new packages
- Architecture: HIGH — all patterns derived from actual codebase inspection, not assumptions
- Pitfalls: HIGH for cropConfig shape and ID compatibility (verified from client code); MEDIUM for timezone (standard behavior, not locally verified)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable libraries, internal codebase — 30 days)
