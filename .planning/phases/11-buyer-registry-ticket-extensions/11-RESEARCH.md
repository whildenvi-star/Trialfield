# Phase 11: Buyer Registry & Ticket Extensions - Research

**Researched:** 2026-03-01
**Domain:** Express REST API + vanilla JS SPA — buyer CRUD, FK wiring, ticket filter extension
**Confidence:** HIGH

## Summary

Phase 11 is entirely within the existing grain-tickets stack: Express + Prisma 6 + vanilla JS SPA. No new libraries are needed. The Buyer, BuyerColumnMap, Settlement, and SettlementLine models are already in the schema (created in Phase 9) and the Prisma migration is already applied and verified. The buyerId FK column already exists on Ticket (null for all 527 migrated rows), and cropYear is already populated (2025 for all existing tickets). The schema work for this phase is therefore **zero migration required** — it's pure application code.

The two plans described in the roadmap (11-01: Buyer CRUD API + admin UI, 11-02: schema extension + ticket filter) are already clearly scoped. However, note that the roadmap description of 11-02 as "schema extension" is misleading — the schema already has everything needed. Plan 11-02 is actually about wiring the FK into the ticket entry form (destination dropdown → buyer autocomplete), adding a buyer filter to the ticket list, and surfacing cropYear in the ticket detail. No new Prisma migration is required.

The primary design decision for the planner is whether to do the Buyer admin page in admin.html (extending the existing Crops/Farms admin) or as a separate buyers.html page. The admin.html pattern is well-established and provides the exact CRUD table + add-form + inline-edit pattern that buyers need.

**Primary recommendation:** Extend admin.html with a Buyers section (matching the existing Crops/Farms pattern exactly), add `/api/buyers` CRUD routes to server.js, then wire the ticket entry form to use a buyer `<select>` dropdown and add a buyer filter `<select>` to the ticket list tab. No new files needed beyond what already exists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUY-01 | User can create, edit, and delete buyer/destination records (name, type, shortCode) | Buyer model is already in schema. CRUD routes follow exact same pattern as `/api/crops` and `/api/farms`. Admin page extends admin.html. |
| BUY-02 | User can select a destination (buyer) when entering a ticket | Ticket.buyerId FK already exists (null). Change entry form `destination` text field to a `<select>` populated from `/api/buyers`. Server POST/PUT must accept `buyerId`. |
| BUY-03 | User can store per-buyer import column mapping for reuse | BuyerColumnMap model with `@@unique([buyerId, fieldName])` is already in schema. CRUD routes upsert by `(buyerId, fieldName)`. Config survives restart because it's in PostgreSQL. |
| TKT-01 | Each ticket has an explicit cropYear field for season scoping | cropYear is already a first-class column on Ticket, populated for all 527 migrated tickets. No migration needed. The entry form just needs to expose it (default = current year, allow override). |
| TKT-02 | User can filter and view tickets by buyer/destination | Ticket list already has filter dropdowns. Add a buyer filter `<select>` populated from `/api/buyers`. Server `GET /api/tickets` needs a `?buyerId=` query param to filter by FK. |
</phase_requirements>

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.18.0 | HTTP routing for buyer CRUD API | Already in use for all existing routes |
| @prisma/client | ^6.19.2 | Database queries for Buyer, BuyerColumnMap | Already in use, all models generated |
| prisma | ^6.19.2 | Schema management | Already migrated — no new migration needed |

### Supporting (no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | ^17.3.1 | DATABASE_URL loading | Already loaded in lib/db.js |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending admin.html | New buyers.html page | Both work; extending admin.html avoids a new file and keeps all admin in one place |
| `<select>` for buyer on entry form | Autocomplete input | Select is simpler, works offline, and there are only ~5 buyers — overkill to autocomplete |
| Server-side buyer filter (`?buyerId=`) | Client-side filter | Server-side is consistent with how farm/crop filters work; client-side would be simpler but breaks CSV export filtering |

**Installation:**
```bash
# No new packages required — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

No new files strictly required. Additions are:

```
grain-tickets/
├── server.js              # Add /api/buyers, /api/buyer-column-maps routes
├── public/
│   ├── admin.html         # Add Buyers section (after Farms, before end of <main>)
│   ├── tickets.js         # Add buyer filter <select> wiring
│   └── index.html         # Add buyer <select> to ticket entry form
```

If buyer admin grows complex, a separate `buyers.html` is an option but is not needed for Phase 11 scope.

### Pattern 1: Buyer CRUD Route (mirrors `/api/crops`)

**What:** GET list, POST create, PUT update by id, DELETE by id
**When to use:** Any simple entity with name + a few config fields
**Example (from existing server.js `/api/crops` pattern adapted for buyers):**
```javascript
// Source: grain-tickets/server.js — existing crop/farm route pattern
app.get('/api/buyers', async (req, res) => {
  try {
    const buyers = await prisma.buyer.findMany({ orderBy: { name: 'asc' } });
    res.json(buyers);
  } catch (e) {
    console.error('GET /api/buyers error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/buyers', async (req, res) => {
  try {
    const { name, type, shortCode, notes } = req.body;
    const trimmedName = (name || '').trim();
    if (!trimmedName) return res.status(400).json({ error: 'Buyer name is required' });
    const buyer = await prisma.buyer.create({
      data: { name: trimmedName, type: type || null, shortCode: (shortCode || '').trim() || null, notes: notes || null }
    });
    res.status(201).json(buyer);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Buyer name already exists' });
    console.error('POST /api/buyers error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/buyers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Buyer not found' });
    const updateData = {};
    ['name', 'type', 'shortCode', 'notes'].forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = (req.body[f] || '').trim() || null;
    });
    if (req.body.name !== undefined) updateData.name = (req.body.name || '').trim();
    const buyer = await prisma.buyer.update({ where: { id }, data: updateData });
    res.json(buyer);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Buyer not found' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'Buyer name already exists' });
    console.error('PUT /api/buyers/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/buyers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).json({ error: 'Buyer not found' });
    await prisma.buyer.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Buyer not found' });
    console.error('DELETE /api/buyers/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Pattern 2: BuyerColumnMap Upsert (per-buyer field mapping)

**What:** Upsert a mapping for `(buyerId, fieldName)` — create if new, update if exists. The `@@unique([buyerId, fieldName])` constraint in schema.prisma enables Prisma's upsert by compound unique.
**When to use:** Storing per-buyer config that must survive restarts (this IS in PostgreSQL — it survives)
**Example:**
```javascript
// Source: grain-tickets/prisma/schema.prisma — @@unique([buyerId, fieldName])
app.put('/api/buyers/:id/column-maps', async (req, res) => {
  try {
    const buyerId = parseInt(req.params.id, 10);
    const { fieldName, csvColumn } = req.body;
    if (!fieldName || !csvColumn) return res.status(400).json({ error: 'fieldName and csvColumn required' });
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

app.get('/api/buyers/:id/column-maps', async (req, res) => {
  try {
    const buyerId = parseInt(req.params.id, 10);
    const maps = await prisma.buyerColumnMap.findMany({ where: { buyerId } });
    res.json(maps);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Pattern 3: Ticket buyerId FK — POST/PUT accepts buyerId

**What:** When creating or editing a ticket, accept `buyerId` (integer FK) in addition to existing fields. The `destination` string field is kept but de-emphasized — it becomes read-only legacy for migrated tickets that have a destination string but no buyerId.
**When to use:** Phase 11 transitions new tickets to use buyerId; old migrated tickets have `destination` as a string but NULL buyerId
**Example:**
```javascript
// server.js POST /api/tickets — add buyerId handling
const buyerId = req.body.buyerId ? parseInt(req.body.buyerId, 10) || null : null;
// ...in prisma.ticket.create data:
data: {
  // ...existing fields...
  buyerId: buyerId,
  destination: null  // clear free-text when buyerId is set
}
```

### Pattern 4: GET /api/tickets filter by buyerId

**What:** Add `?buyerId=N` query param support to the existing ticket list endpoint
**When to use:** Ticket log tab needs buyer filter
**Example:**
```javascript
// server.js GET /api/tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const where = {};
    if (req.query.buyerId) {
      const bid = parseInt(req.query.buyerId, 10);
      if (!isNaN(bid)) where.buyerId = bid;
    }
    const tickets = await prisma.ticket.findMany({ where, orderBy: { date: 'desc' } });
    // ...rest of existing enrichment logic
  }
});
```

### Pattern 5: Admin page Buyers section (mirrors existing Crops section)

**What:** Inline-edit table + add form in admin.html, same style as Crops and Farms sections already there
**When to use:** All entity admin in this app uses this pattern
**Fields to show:** Name (editable), Short Code (editable), Type (select: elevator/maltster/co-op/other), Notes (editable), Delete button

### Anti-Patterns to Avoid

- **Don't add a Prisma migration for Phase 11.** The Buyer, BuyerColumnMap models are already in the schema and migration has been applied. Running `prisma migrate dev` again with no schema changes will produce an empty migration and waste time.
- **Don't convert the destination field to a required buyerId.** 527 migrated tickets have NULL buyerId. The buyerId should remain optional on POST — only the new entry UI enforces selecting a buyer. Old tickets still show their legacy `destination` string.
- **Don't replace the destination string column with buyerId.** Keep both. Phase 12/13 settlement matching will use buyerId for new tickets; legacy tickets use destination for display-only. Removing destination would lose data.
- **Don't use a full autocomplete widget for buyer selection in the ticket form.** There are approximately 5 buyers (Meristem Malt, ADM, local co-ops). A plain `<select>` is correct — simpler, faster, works offline (PWA requirement), and less JavaScript to maintain.
- **Don't put BuyerColumnMap CRUD in the main ticket entry flow.** Column mapping is admin-only config (pre-Phase 12 settlement import). It belongs in admin.html, not the daily ticket entry form.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert by compound unique | Custom find-then-create logic | `prisma.buyerColumnMap.upsert({ where: { buyerId_fieldName: {...} } })` | Prisma generates the compound unique index name automatically from `@@unique([buyerId, fieldName])` as `buyerId_fieldName` |
| Input sanitization | Custom XSS escaping | `escHtml()` already in admin.html | The function already exists in admin.html (lines 403-407) |
| Duplicate name error handling | Custom try/catch logic | Prisma error code `P2002` (already used for Farm and Crop) | Consistent with existing patterns |

**Key insight:** This phase is 95% plumbing of existing patterns. The Buyer model, schema, and DB tables already exist. The work is writing the Express routes and HTML/JS that follow established patterns from Crops and Farms.

## Common Pitfalls

### Pitfall 1: Prisma Compound Unique Index Name

**What goes wrong:** When calling `prisma.buyerColumnMap.upsert()`, the `where` clause must use the auto-generated compound field name `buyerId_fieldName` (Prisma joins field names with underscore).
**Why it happens:** Prisma generates the unique index name from the `@@unique([buyerId, fieldName])` directive using field name concatenation.
**How to avoid:** Use `where: { buyerId_fieldName: { buyerId, fieldName } }` — not `where: { buyerId, fieldName }` (that would be an AND query, not the compound unique).
**Warning signs:** Prisma TypeScript error "Argument where: Missing required field buyerId_fieldName" or runtime P2025 on upsert.

### Pitfall 2: buyerId as string vs integer in client/server boundary

**What goes wrong:** HTML `<select>` `value` attributes are always strings. `parseInt('5', 10)` is needed before passing to Prisma. Skipping this causes a Prisma type error because `buyerId` is `Int?` on the Ticket model.
**Why it happens:** DOM `<select>` returns strings; Prisma schema declares `Int?`.
**How to avoid:** Always `parseInt(req.body.buyerId, 10) || null` on the server side before using as FK. In the client JS, pass `parseInt(form.buyerId.value, 10) || null`.
**Warning signs:** Prisma error "Argument buyerId: Invalid value provided. Expected IntNullableFilter, provided String."

### Pitfall 3: Cache-Control on GET /api/tickets (10-second TTL)

**What goes wrong:** The existing middleware sets `Cache-Control: public, max-age=10` on all GET /api responses. Adding the buyerId filter param means the browser will cache the unfiltered result and serve it for 10 seconds when the user switches the buyer filter.
**Why it happens:** `app.use('/api', ...)` sets the header globally before the route handler runs. Query params are not part of the cache key in most browser caches.
**How to avoid:** For the tickets list endpoint (which now has query params), set `Cache-Control: no-store` or a shorter `max-age=0` when query params are present. Alternative: `res.set('Vary', 'Cookie')` or `res.set('Cache-Control', 'no-store')` at the route level to override the middleware.
**Warning signs:** Buyer filter appears to "not work" — previous results shown after filter change until 10-second TTL expires.

### Pitfall 4: Admin.html inline-edit for `type` field needs a `<select>`

**What goes wrong:** The `type` field on Buyer has a fixed vocabulary (elevator, maltster, co-op, other). Treating it as free-text in inline edit produces inconsistent values that break Phase 12 settlement column mapping per-type logic.
**Why it happens:** The existing admin.html inline-edit for string fields defaults to `<input type="text">`. See the Farms section — `type` and `unit` fields correctly use `<select>` for inline edit.
**How to avoid:** Follow the exact pattern from lines 355-370 of admin.html where `type` is handled with a `<select>` in the inline-edit handler.

### Pitfall 5: Deleting a buyer with existing tickets (FK constraint)

**What goes wrong:** `prisma.buyer.delete({ where: { id } })` will throw Prisma error P2003 (foreign key constraint failed) if any Ticket has `buyerId = id`.
**Why it happens:** The Ticket model has `buyer Buyer? @relation(fields: [buyerId], references: [id])` — no `onDelete: Cascade` or `onDelete: SetNull` is defined. PostgreSQL defaults to RESTRICT.
**How to avoid:** Before deleting a buyer, either: (a) check for associated tickets and reject with a helpful message ("Cannot delete — N tickets reference this buyer"), or (b) null out `buyerId` on those tickets first, then delete. Option (a) is safer for traceability.
**Warning signs:** Prisma error code `P2003` on DELETE /api/buyers/:id.

### Pitfall 6: cropYear in ticket entry form — default vs. override

**What goes wrong:** If cropYear is derived server-side from the date field (current implementation in server.js `getCropYear()`), adding a visible cropYear field that the user can edit creates a two-source-of-truth problem.
**Why it happens:** The existing POST /api/tickets derives `cropYear = getCropYear(date)` automatically. If the UI also sends `cropYear`, the server must decide which takes precedence.
**How to avoid:** Server should accept explicit `cropYear` from the form if provided; fall back to `getCropYear(date)` if not. The form should show the derived value as a pre-filled input that the user can override (e.g., late-season tickets from December that belong to the previous crop year). The server logic: `cropYear: req.body.cropYear ? parseInt(req.body.cropYear, 10) : getCropYear(date)`.

## Code Examples

Verified patterns from existing codebase:

### Prisma buyer.findMany with ordering
```javascript
// Mirrors prisma.farm.findMany({ orderBy: { name: 'asc' } }) in server.js line 100
const buyers = await prisma.buyer.findMany({ orderBy: { name: 'asc' } });
```

### Ticket list with buyerId filter (extends existing GET /api/tickets)
```javascript
// Source: grain-tickets/server.js line 152 — GET /api/tickets
// Current: prisma.ticket.findMany({ orderBy: { date: 'desc' } })
// Phase 11 extension:
const where = {};
if (req.query.buyerId) {
  const bid = parseInt(req.query.buyerId, 10);
  if (!isNaN(bid)) where.buyerId = bid;
}
// Also extend existing farm/crop filters if they exist in where before this
const tickets = await prisma.ticket.findMany({ where, orderBy: { date: 'desc' } });
```

### Client-side buyer filter select (extends index.html filter bar)
```javascript
// Source: grain-tickets/public/tickets.js — applyFilters() line 167
// Existing: farm, crop, dateFrom, dateTo filters
// Add buyer filter — follows same pattern as existing farm filter
var buyerId = document.getElementById('filter-buyer').value; // '' or '5'
// In applyFilters():
if (buyerId && t.buyerId !== parseInt(buyerId, 10)) return false;
// NOTE: buyerId must be included in the ticket JSON returned by the server (it isn't currently)
```

### dbTicketToJson must include buyerId
```javascript
// Source: grain-tickets/server.js line 55 — dbTicketToJson()
// Current output lacks buyerId — must add for client-side buyer filter to work
function dbTicketToJson(dbTicket) {
  return {
    id: dbTicket.id,
    // ...existing fields...
    buyerId: dbTicket.buyerId || null,   // ADD THIS
    destination: dbTicket.destination || null,  // ADD THIS for legacy display
    cropYear: dbTicket.cropYear          // ALREADY PRESENT in Ticket model, add to JSON output
  };
}
```

### BuyerColumnMap upsert with compound unique
```javascript
// Source: grain-tickets/prisma/schema.prisma line 99 — @@unique([buyerId, fieldName])
// The generated Prisma unique index name is buyerId_fieldName
await prisma.buyerColumnMap.upsert({
  where: { buyerId_fieldName: { buyerId, fieldName } },
  update: { csvColumn },
  create: { buyerId, fieldName, csvColumn }
});
```

### escHtml in admin.html (already available)
```javascript
// Source: grain-tickets/public/admin.html lines 403-407
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text destination string on tickets | buyerId FK to Buyer table | Phase 11 | Enables per-buyer settlement matching in Phase 12/13 |
| cropYear derived dynamically from date | cropYear as first-class column (already in schema) | Phase 9 schema | Explicit field enables season-scoped queries without date range math |
| JSON file for all data | PostgreSQL via Prisma | Phase 9/10 | Column maps and buyer records persist across restarts without custom serialization |

**Deprecated/outdated:**
- `destination` string field on Ticket: Still present as nullable fallback for 527 legacy tickets. Not removed. New tickets use `buyerId` FK + display buyer name by join/lookup. The `destination` field is not shown in the entry form for new tickets once Phase 11 is complete.

## Open Questions

1. **Should the ticket entry form show cropYear as editable or read-only derived?**
   - What we know: cropYear is already populated from date in the server's `getCropYear()` helper. All 527 migrated tickets have cropYear=2025.
   - What's unclear: Is there a real use case where a user would enter a ticket with a date in year X but want it counted in crop year Y? (e.g., late-harvest December tickets sometimes belong to the following season)
   - Recommendation: Show cropYear as an editable number input, pre-filled from the selected date, with a note "Defaults from date — override for late-season". Server accepts explicit cropYear if provided.

2. **What happens to the `destination` string on existing migrated tickets?**
   - What we know: All 527 migrated tickets have `destination: null` (confirmed by live DB check). The original data.json had destinations as free-text strings in the `destination` field, but review of the migration script shows it was not mapped.
   - What's unclear: Whether those strings were in the original data.json or if destination was always null in the JSON.
   - Recommendation: No action needed. Confirmed `destination` is null for all 527 tickets. Phase 11 simply leaves them null and wires new tickets to use buyerId.

3. **Delete buyer safety: null FK or block delete?**
   - What we know: No tickets currently have buyerId set (all null). So buyer deletes are safe right now. But post-Phase 11, tickets will have FK references.
   - What's unclear: User preference — fail with error message vs. cascade set-null.
   - Recommendation: Reject with error message and count: "Cannot delete — 14 tickets reference this buyer. Reassign them first." This preserves traceability.

## Validation Architecture

> nyquist_validation is not enabled in `.planning/config.json` (no `nyquist_validation` key present — field absent defaults to disabled). Skipping this section.

## Sources

### Primary (HIGH confidence)

- `grain-tickets/prisma/schema.prisma` — All 7 models confirmed present, Buyer/BuyerColumnMap/Settlement/SettlementLine already in DB. `@@unique([buyerId, fieldName])` confirmed on BuyerColumnMap.
- `grain-tickets/server.js` — Full Prisma-based implementation confirmed. All existing route patterns (CRUD, filters, error codes P2002/P2025) directly inspected.
- `grain-tickets/public/admin.html` — Inline-edit pattern, escHtml utility, add-form pattern — all directly inspected and confirmed.
- `grain-tickets/public/tickets.js` — applyFilters(), renderTable(), form submit patterns directly inspected.
- Live DB query: `buyerId: null, cropYear: 2025, destination: null` confirmed on sample ticket from 527-ticket dataset.
- Live DB query: `Buyer: 0, BuyerColumnMap: 0` — tables exist, empty, ready for Phase 11 data.
- `grain-tickets/package.json` — Confirmed express 4.18.0, @prisma/client 6.19.2 — no new dependencies needed.
- `.planning/phases/10-migration-cutover/10-01-SUMMARY.md` — 527 tickets, 63 farms, 37 crop configs in PostgreSQL confirmed.

### Secondary (MEDIUM confidence)

- Prisma documentation: `upsert` with compound unique index uses underscore-joined field name (e.g., `buyerId_fieldName`). Verified against Prisma 6 behavior — standard convention, documented in Prisma Client CRUD guides.
- Prisma error code P2003 for FK constraint failure on delete — standard Prisma error code, consistent across versions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — all patterns directly copied from existing working code in server.js and admin.html
- Pitfalls: HIGH — most pitfalls identified from direct code inspection (compound unique name, FK constraint delete, Cache-Control middleware, cropYear two-source problem)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable stack — Prisma 6.x, Express 4.x, no churn expected)
