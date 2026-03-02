# Phase 13: Reconciliation Engine & Discrepancy UI - Research

**Researched:** 2026-03-02
**Domain:** Matching engine (string normalization, scoped Prisma updates), vanilla JS SPA extension (badges, two-panel split, inline dispute UI)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Matching trigger & flow**
- Auto-match runs immediately when a settlement is committed — no extra user step required
- Re-match button available on each settlement for when new tickets arrive after initial import
- Ticket number normalization: strip H-prefix and leading zeros, compare numeric core (H066666, 066666, 66666 all match to "66666")
- Match results shown as summary toast notification ("42 matched, 3 unmatched") with badge count on settlement card

**Variance display**
- Show both pounds and percentage: "-340 lbs (-0.8%)"
- Color-coded: green within 1% tolerance, red above 1% threshold (hardcoded for now — configurable threshold deferred to v2.x REC-06)
- Settlement summary table: per-crop per-buyer rows (e.g., "Hybrid Rye — Meristem Malt")
- Columns: farm lbs, buyer lbs, variance (lbs + %), ticket count
- Pounds are the primary comparison unit (apples-to-apples); buyer's reported bushels and farm's calculated bushels shown in adjacent columns for reference only — variance computed on pounds only

**Unmatched loads view**
- Two-panel split layout: "Farm-Only Tickets" on left, "Settlement-Only Lines" on right; stacks vertically on mobile
- Filter dropdowns at top: buyer and cropYear (default to most recent cropYear)
- Manual matching: user selects a farm ticket and a settlement line, clicks "Link" — sets matchStatus to "manual"
- Reason hints on each unmatched ticket: "No settlement for [buyer]" or "Ticket# not in settlement"

**Dispute & override workflow**
- Inline dispute: click "Dispute" button on matched ticket row, text field appears for note, status changes immediately — no modal
- Flag + note only — no resolution workflow for now (deferred to v2.x WRK-01)
- Manual overrides show distinct orange "Manual" badge vs green "Matched" badge — preserves audit trail of human intervention
- Color-coded badge column on ticket list: Unreconciled (gray), Matched (green), Disputed (red), Manual (orange)
- Same badge appears on ticket detail screen

### Claude's Discretion
- Navigation/routing structure for reconciliation views
- Exact toast notification implementation
- Mobile responsive breakpoints for two-panel split
- Badge styling and positioning on ticket list
- Settlement summary table pagination or scrolling behavior

### Deferred Ideas (OUT OF SCOPE)
- Configurable weight discrepancy tolerance per crop (REC-06) — v2.x
- Multi-buyer season summary on one screen (REC-07) — v2.x
- Fuzzy matching by date + weight for non-matching ticket numbers (REC-08) — v2.x
- Disputed ticket resolution workflow with resolvedAt tracking (WRK-01) — v2.x
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REC-01 | System matches farm tickets to settlement lines by ticket number within same buyer and cropYear | `normalizeTicketNo()` function + Prisma `updateMany` scoped to `buyerId` + `cropYear` on Ticket; SettlementLine.ticketId FK + matchStatus already in schema |
| REC-02 | Each ticket shows reconciliation status: unreconciled, matched, disputed, or manual-override | matchStatus field already on SettlementLine; need to surface it on Ticket list + detail — server adds `matchStatus` to ticket response by joining to SettlementLine |
| REC-03 | User can view all unmatched loads — farm-only tickets and settlement-only lines | Two-panel view: farm tickets with no matched settlement line + settlement lines with matchStatus "unmatched"; both queries with buyer+cropYear filter |
| REC-04 | User can view settlement summary comparing farm totals vs buyer settled totals per crop/buyer/season | Aggregate query: GROUP BY crop across farm tickets + sum(netWeight) from settlement lines — scoped to buyer+cropYear |
| REC-05 | User can flag a matched ticket as disputed and add notes | PATCH /api/settlement-lines/:id/dispute — sets matchStatus to "disputed", writes notes; persists to SettlementLine table |
</phase_requirements>

---

## Summary

Phase 13 is a pure server-logic + UI extension phase built entirely on the existing Express + Prisma + PostgreSQL + vanilla JS SPA stack. No new npm packages are needed. The schema from Phase 9 already provides everything required: `SettlementLine.ticketId` (FK), `SettlementLine.matchStatus` (string, default "unmatched"), and `SettlementLine.notes`. No Prisma migration is needed.

The **matching engine** (Plan 13-01) is a server-side function called `runMatch(settlementId)` that normalizes ticket numbers (strip H-prefix and leading zeros), queries farm tickets scoped to the settlement's `buyerId` and `cropYear`, and writes `ticketId` + `matchStatus = "matched"` to `SettlementLine` rows that found a farm ticket match. This function runs automatically at the end of the existing `POST /api/settlements/:id/commit` route and is also exposed as `POST /api/settlements/:id/rematch` for the re-match button. The `normalizeTicketNo()` pure function strips `H`/`h` prefix and all leading zeros so "H066666", "066666", "66666" all reduce to "66666". Matching is scoped to `buyerId + cropYear` — not global — which correctly handles the 14 known duplicate ticket numbers in the dataset.

The **discrepancy UI** (Plan 13-02) adds a new "Reconciliation" sub-nav view inside the existing Settlements tab, following the same `settlement-nav-btn` / `settlement-view hidden` pattern established in Phase 12. It contains three sub-views: the Settlement Summary table (per-crop/per-buyer aggregate), the Unmatched Loads two-panel view (farm-only left / settlement-only right), and the Disputed Tickets view. Badge columns on the ticket list (`#ticket-tbody`) and ticket detail screen require adding a status column to the existing table and enriching the `/api/tickets` response to include each ticket's latest reconciliation status via a join to `SettlementLine`.

**Primary recommendation:** Implement `runMatch()` as a standalone module function in `server.js` (not a separate file — stays consistent with existing single-file server pattern), called from both the commit endpoint and the new rematch endpoint. Surface matchStatus on tickets by adding a `_reconciliation` field to `dbTicketToJson()` output using a join on `SettlementLine`. This avoids a schema change (matchStatus lives on SettlementLine, not Ticket) while still displaying status per ticket in the UI.

---

## Standard Stack

### Core (all already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 6.19.2 | Matching writes, aggregate queries, dispute flag update | Already installed; `updateMany`, `groupBy`, `findMany` with `where` + `include` all confirmed working in prior phases |
| express | 4.18.0 | New reconciliation API routes | Already installed; existing pattern to follow |
| vanilla JS (public/*.js) | ES5 (no build) | Reconciliation sub-view UI, badge rendering, two-panel layout | Established pattern for all existing tabs |
| Node.js stdlib | — | `String.replace()` for ticket normalization | Native — no library needed |

### No New Packages Required

The project explicitly prohibits new npm packages for v2.0. Every capability needed is already present:

- Ticket normalization: pure JS string function
- Aggregate sums: Prisma `findMany` + JS `reduce` (or raw SQL via `$queryRaw` if needed for performance)
- Badge rendering: CSS custom properties already in style.css (`--success`, `--danger`, `--amber`, `--text-light`)
- Two-panel layout: CSS flexbox (already used throughout style.css)
- Inline dispute UI: `makeLineEditable()` pattern from Phase 12 (or simpler inline `<textarea>` reveal)

**Installation:** No action required.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. All work goes into existing files:

```
grain-tickets/
├── server.js          # Add: normalizeTicketNo(), runMatch(), 4 new API routes
├── public/
│   ├── index.html     # Add: Reconciliation sub-nav button + container divs
│   ├── settlements.js # Add: reconciliation views (sub-nav, summary, unmatched, dispute)
│   ├── tickets.js     # Modify: add matchStatus badge column to ticket list + detail
│   └── style.css      # Add: badge styles (.badge-matched, .badge-disputed, etc.)
└── public/sw.js       # Bump cache version (v5 → v6)
```

### Pattern 1: Ticket Number Normalization

**What:** Pure function that reduces any ticket number variant to a comparable numeric core string.

**When to use:** Before comparing farm ticket numbers to settlement line ticket numbers during matching, and before building the lookup index.

**Example:**
```javascript
// Source: project-specific (no external library)
function normalizeTicketNo(ticketNo) {
  if (!ticketNo) return null;
  // Strip H/h prefix and all leading zeros
  var s = String(ticketNo).trim().replace(/^[Hh]+/, '').replace(/^0+/, '');
  return s || null;  // null if input was all zeros or empty
}

// Test cases — all normalize to "66666":
// normalizeTicketNo("H066666") → "66666"
// normalizeTicketNo("066666")  → "66666"
// normalizeTicketNo("66666")   → "66666"
// normalizeTicketNo("h66666")  → "66666"
```

**Critical scope constraint:** Normalization comparison must happen within `buyerId + cropYear`. The 14 known duplicate ticket numbers in the dataset mean the same normalized number can exist for different buyers in different years. Never match globally.

### Pattern 2: runMatch() — Scoped Matching Engine

**What:** Server-side function that takes a `settlementId`, fetches the settlement's `buyerId` and `cropYear`, builds a map of `normalizedTicketNo → ticketId` from farm Ticket records, then iterates SettlementLines to write `ticketId` + `matchStatus` for matches.

**When to use:** Called at end of `POST /api/settlements/:id/commit` (auto-match) and from `POST /api/settlements/:id/rematch` (user-triggered re-match).

**Example:**
```javascript
// Source: project-specific, follows existing server.js helper pattern
async function runMatch(settlementId) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: { lines: true }
  });
  if (!settlement) return { matched: 0, unmatched: 0 };

  // Build normalized lookup map: normalizedNo → ticket.id
  // Scoped to buyer + cropYear to handle duplicate ticket numbers
  const farmTickets = await prisma.ticket.findMany({
    where: { buyerId: settlement.buyerId, cropYear: settlement.cropYear }
  });
  const ticketMap = {};
  farmTickets.forEach(t => {
    const norm = normalizeTicketNo(t.ticketNo);
    if (norm) ticketMap[norm] = t.id; // last-write wins for duplicates within scope
  });

  // Match each settlement line
  let matched = 0;
  let unmatched = 0;
  for (const line of settlement.lines) {
    // Skip lines already manually linked
    if (line.matchStatus === 'manual') { matched++; continue; }
    const norm = normalizeTicketNo(line.ticketNo);
    if (norm && ticketMap[norm]) {
      await prisma.settlementLine.update({
        where: { id: line.id },
        data: { ticketId: ticketMap[norm], matchStatus: 'matched' }
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
```

**Performance note:** For 100-500 loads/season this loop is fast enough. No bulk update needed. If future scale requires it, `updateMany` with an `IN` clause is the Prisma upgrade path.

### Pattern 3: Surfacing matchStatus on Ticket API Response

**What:** The `matchStatus` field lives on `SettlementLine`, not `Ticket`. To show badge status on the ticket list and detail, we need to enrich the ticket response. The clean approach is to include a `_reconciliation` object on each ticket returned by the API — fetched with a Prisma `include`.

**When to use:** In `GET /api/tickets` and `GET /api/tickets/:id` responses. Also drives the badge column in the ticket list and detail screen.

**Status derivation rules (in priority order):**
1. If any matched SettlementLine has `matchStatus = 'disputed'` → show "Disputed"
2. If any matched SettlementLine has `matchStatus = 'manual'` → show "Manual"
3. If any matched SettlementLine has `matchStatus = 'matched'` → show "Matched"
4. Otherwise → show "Unreconciled"

**Example:**
```javascript
// In dbTicketToJson() — add _reconciliation field
function dbTicketToJson(dbTicket) {
  const lines = dbTicket.settlementLines || [];
  let recStatus = 'unreconciled';
  if (lines.some(l => l.matchStatus === 'disputed')) recStatus = 'disputed';
  else if (lines.some(l => l.matchStatus === 'manual')) recStatus = 'manual';
  else if (lines.some(l => l.matchStatus === 'matched')) recStatus = 'matched';

  return {
    id: dbTicket.id,
    // ... existing fields ...
    _reconciliation: { status: recStatus, lineCount: lines.length }
  };
}

// Caller must include settlementLines in Prisma query:
const ticket = await prisma.ticket.findUnique({
  where: { id },
  include: { settlementLines: { select: { matchStatus: true } } }
});
```

**Performance consideration:** `GET /api/tickets` includes settlementLines. With 527 tickets and up to 500 settlement lines, the join is fine. Prisma eager loads via two queries (not a SQL JOIN) so no N+1 risk. Only `matchStatus` is selected — not the full line — to minimize payload.

### Pattern 4: Reconciliation Sub-Nav View (UI)

**What:** A fourth sub-nav button ("Reconciliation") added to the existing `settlement-sub-nav` div in `index.html`. Follows the identical pattern as Import / Manual Entry / History buttons from Phase 12: `data-view="reconciliation"` → shows `#settlement-reconciliation` div, hides others.

**Example:**
```html
<!-- index.html — add to .settlement-sub-nav -->
<button class="settlement-nav-btn" data-view="reconciliation">Reconciliation</button>

<!-- Add container div inside #tab-settlements -->
<div id="settlement-reconciliation" class="settlement-view hidden"></div>
```

The `initSettlements()` function in `settlements.js` already handles the sub-nav toggle via `querySelectorAll('.settlement-sub-nav .settlement-nav-btn')` with `data-view` attributes — no changes to the activation logic needed, just adding the new button and container.

### Pattern 5: Two-Panel Unmatched Loads Layout

**What:** CSS flexbox row with two equal-width panels for side-by-side display on desktop, stacking to column on mobile.

**Example:**
```css
/* style.css */
.recon-panels {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.recon-panel {
  flex: 1;
  min-width: 0; /* prevents flex overflow */
}
@media (max-width: 700px) {
  .recon-panels { flex-direction: column; }
}
```

The 700px breakpoint aligns with the project's existing mobile-first approach (style.css uses similar breakpoints for `.form-grid` and `.filters`).

### Pattern 6: Status Badge Rendering

**What:** Inline `<span>` with a `.badge-{status}` class. CSS uses existing color variables: `--success` (green), `--danger` (red), `--amber` (orange), `--text-light` (gray).

**Example:**
```css
/* style.css */
.badge {
  display: inline-block;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-unreconciled { background: rgba(92,110,84,0.2); color: var(--text-light); }
.badge-matched      { background: rgba(74,246,38,0.15); color: var(--success); }
.badge-disputed     { background: rgba(255,59,48,0.15); color: var(--danger); }
.badge-manual       { background: rgba(255,110,64,0.15); color: var(--orange); }
```

### Anti-Patterns to Avoid

- **Matching globally (not scoped to buyer+cropYear):** The 14 known duplicate ticket numbers mean global matching will produce wrong cross-buyer linkages. Always scope queries to `buyerId + cropYear`.
- **Storing matchStatus on Ticket model:** matchStatus belongs on SettlementLine — a ticket may have lines from multiple settlements. The derivation in `dbTicketToJson()` is the correct aggregation point.
- **Re-running match on "disputed" lines:** The matching engine must skip lines with `matchStatus === 'manual'` (user-set). Lines with `matchStatus === 'disputed'` can be re-evaluated on rematch (dispute is a UI flag, not a lock).
- **Using Prisma $queryRaw for the match loop:** At 100-500 lines, ORM queries are fine. Raw SQL adds complexity with no performance benefit at this scale.
- **Overloading `SettlementLine.notes` for dispute notes:** The `notes` field on SettlementLine is already defined and general-purpose. Dispute notes write to this same field — consistent with the schema intent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ticket number normalization | Custom regex parser with full spec | Simple `replace(/^[Hh]+/, '').replace(/^0+/, '')` | Project has defined the exact rule: strip H-prefix and leading zeros only — edge cases are known (H066666 → 66666) |
| Aggregate sums for settlement summary | SQL raw query | Prisma `findMany` + JS `reduce` | Scale is small (500 loads/season); Prisma queries are maintainable; raw SQL adds migration risk |
| Modal dialogs for dispute | Custom modal implementation | Inline `<textarea>` reveal (same pattern as `makeLineEditable()`) | Phase 12 established inline-edit as the project pattern; user decision locks this as inline |
| Separate reconciliation module file | `lib/reconciliation.js` | Keep in `server.js` as helper functions | All prior phases keep server logic in single `server.js`; extracting now breaks consistency |

---

## Common Pitfalls

### Pitfall 1: Duplicate Ticket Numbers Causing Cross-Buyer Match Pollution

**What goes wrong:** If `runMatch()` builds the normalization map across all farm tickets (not scoped to `buyerId + cropYear`), ticket number "66666" from Meristem Malt could match a settlement line from ADM.

**Why it happens:** The 14 duplicate ticket numbers in the dataset are legitimate — different buyers issued different tickets with the same number in different seasons.

**How to avoid:** Always filter farm tickets with `where: { buyerId: settlement.buyerId, cropYear: settlement.cropYear }` before building the normalization map. This is enforced by the `runMatch(settlementId)` function taking a settlement (which carries `buyerId` + `cropYear`) as its input.

**Warning signs:** Test with a buyer filter applied — if unrelated tickets appear in match results, the scope is wrong.

### Pitfall 2: matchStatus Derivation Order on Ticket Display

**What goes wrong:** A ticket matched by two settlement lines (e.g., amended settlement + original) could show "Unreconciled" if the derivation checks `lines.length === 0` instead of checking individual `matchStatus` values.

**Why it happens:** A ticket with `settlementLines = [{matchStatus: 'matched'}, {matchStatus: 'unmatched'}]` means one line matched and one didn't — the ticket should show "Matched" because at least one settlement acknowledged it.

**How to avoid:** Use the priority-order derivation: disputed > manual > matched > unreconciled. Never derive status from array length.

### Pitfall 3: runMatch() Called on Already-Disputed Lines

**What goes wrong:** User flags a ticket as "Disputed". Re-match is triggered (re-match button or new ticket arrives). The re-match overwrites `matchStatus = 'disputed'` back to `'matched'`, losing the user's flag.

**Why it happens:** The rematch loop re-evaluates every line including disputed ones.

**How to avoid:** In `runMatch()`, skip lines where `matchStatus === 'manual'`. For 'disputed' lines — the CONTEXT.md did not lock this, but the safest behavior is to also skip disputed lines on rematch (preserve user's flag). If a ticket's weight changes, the user can manually clear the dispute. Document this decision.

**Update after re-reading CONTEXT.md:** "Manual overrides show distinct orange 'Manual' badge — preserves audit trail of human intervention." The same principle applies to disputed. Skip both 'manual' and 'disputed' during rematch.

### Pitfall 4: GET /api/tickets Performance Regression from SettlementLine Include

**What goes wrong:** Adding `include: { settlementLines: true }` to the `GET /api/tickets` query that loads all 527 tickets sends the entire SettlementLine data for each ticket, massively inflating the payload.

**Why it happens:** Prisma's eager loading via `include` fetches the full related records.

**How to avoid:** Use `include: { settlementLines: { select: { matchStatus: true, id: true } } }` — fetch only the fields needed for status derivation. The `_reconciliation` enrichment only needs `matchStatus`.

**Alternatively:** Add a dedicated `GET /api/tickets/:id/reconciliation-status` endpoint and fetch status lazily on ticket detail screen. This avoids loading reconciliation data on the full list. **Recommendation:** Include minimal select on the list endpoint (matchStatus only) — the status badge is valuable on the list view and worth the small overhead.

### Pitfall 5: Variance Sign Convention Confusion

**What goes wrong:** "farm lbs - buyer lbs" could be positive (farm weighed more) or negative (buyer settled more). Displaying the wrong sign misleads the farmer.

**Why it happens:** Different teams interpret variance direction differently.

**How to avoid:** Define convention as `variance = farm_lbs - buyer_lbs`. Positive means farm had more weight than buyer settled (potential under-payment). Negative means buyer settled more than farm recorded (unusual, may indicate error). Display as "-340 lbs (-0.8%)" per CONTEXT.md. Color-code on absolute value: `Math.abs(variance / farmLbs) > 0.01` → red.

---

## Code Examples

### Ticket Number Normalization (verified against project spec)

```javascript
// Source: derived from CONTEXT.md spec — no external library needed
function normalizeTicketNo(ticketNo) {
  if (!ticketNo) return null;
  var s = String(ticketNo).trim().replace(/^[Hh]+/, '').replace(/^0+/, '');
  return s || null;
}
// normalizeTicketNo('H066666') === '66666'  ✓
// normalizeTicketNo('066666')  === '66666'  ✓
// normalizeTicketNo('66666')   === '66666'  ✓
// normalizeTicketNo(null)      === null     ✓
// normalizeTicketNo('0')       === null     ✓ (all zeros = null)
```

### runMatch() Integration Point in commit endpoint

```javascript
// server.js — add after createMany in POST /api/settlements/:id/commit
const result = await prisma.settlementLine.createMany({ data: lines });

// AUTO-MATCH: run immediately after lines are committed
const matchResult = await runMatch(settlementId);

res.json({
  ok: true,
  linesCreated: result.count,
  matched: matchResult.matched,
  unmatched: matchResult.unmatched
});
```

### Dispute Endpoint Pattern

```javascript
// PATCH /api/settlement-lines/:lineId/dispute
app.patch('/api/settlement-lines/:lineId/dispute', async (req, res) => {
  try {
    const lineId = parseInt(req.params.lineId, 10);
    if (isNaN(lineId)) return res.status(404).json({ error: 'Line not found' });

    const line = await prisma.settlementLine.findUnique({ where: { id: lineId } });
    if (!line) return res.status(404).json({ error: 'Line not found' });

    // Can only dispute matched or manual lines
    if (!['matched', 'manual', 'disputed'].includes(line.matchStatus)) {
      return res.status(400).json({ error: 'Only matched lines can be disputed' });
    }

    const notes = (req.body.notes || '').trim() || null;
    const updated = await prisma.settlementLine.update({
      where: { id: lineId },
      data: { matchStatus: 'disputed', notes }
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Line not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Settlement Summary Aggregate Query

```javascript
// GET /api/reconciliation/summary?buyerId=X&cropYear=2025
// Returns: per-crop rows with farm lbs, buyer lbs, variance
app.get('/api/reconciliation/summary', async (req, res) => {
  try {
    const buyerId = parseInt(req.query.buyerId, 10);
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(buyerId) || isNaN(cropYear)) {
      return res.status(400).json({ error: 'buyerId and cropYear are required' });
    }

    // Farm totals per crop
    const farmTickets = await prisma.ticket.findMany({
      where: { buyerId, cropYear },
      select: { crop: true, netWeight: true }
    });
    const farmByCrop = {};
    farmTickets.forEach(t => {
      if (!farmByCrop[t.crop]) farmByCrop[t.crop] = { farmLbs: 0, farmCount: 0 };
      farmByCrop[t.crop].farmLbs += t.netWeight;
      farmByCrop[t.crop].farmCount++;
    });

    // Buyer settled totals per crop from settlement lines (matched only)
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
        const crop = l.ticket ? l.ticket.crop : null;
        if (!crop) return;
        if (!buyerByCrop[crop]) buyerByCrop[crop] = { buyerLbs: 0, buyerBushels: 0 };
        buyerByCrop[crop].buyerLbs += l.netWeight || 0;
        buyerByCrop[crop].buyerBushels += l.netBushels || 0;
      });
    });

    // Build summary rows
    const crops = new Set([...Object.keys(farmByCrop), ...Object.keys(buyerByCrop)]);
    const rows = Array.from(crops).sort().map(crop => {
      const farm = farmByCrop[crop] || { farmLbs: 0, farmCount: 0 };
      const buyer = buyerByCrop[crop] || { buyerLbs: 0, buyerBushels: 0 };
      const varianceLbs = farm.farmLbs - buyer.buyerLbs;
      const variancePct = farm.farmLbs > 0 ? (varianceLbs / farm.farmLbs) * 100 : 0;
      return {
        crop,
        farmLbs: farm.farmLbs,
        farmCount: farm.farmCount,
        buyerLbs: buyer.buyerLbs,
        buyerBushels: buyer.buyerBushels,
        varianceLbs,
        variancePct: Math.round(variancePct * 100) / 100
      };
    });

    res.json(rows);
  } catch (e) {
    console.error('GET /api/reconciliation/summary error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Unmatched Loads API Endpoint

```javascript
// GET /api/reconciliation/unmatched?buyerId=X&cropYear=2025
app.get('/api/reconciliation/unmatched', async (req, res) => {
  try {
    const buyerId = parseInt(req.query.buyerId, 10);
    const cropYear = parseInt(req.query.cropYear, 10);
    if (isNaN(buyerId) || isNaN(cropYear)) {
      return res.status(400).json({ error: 'buyerId and cropYear are required' });
    }

    // Farm-only tickets: tickets with no matched settlement line for this buyer+cropYear
    const farmTickets = await prisma.ticket.findMany({
      where: { buyerId, cropYear },
      include: {
        settlementLines: {
          where: { matchStatus: { in: ['matched', 'manual'] } },
          select: { id: true }
        }
      }
    });
    const farmOnly = farmTickets
      .filter(t => t.settlementLines.length === 0)
      .map(t => ({
        id: t.id,
        ticketNo: t.ticketNo,
        date: t.date,
        crop: t.crop,
        netWeight: t.netWeight,
        hint: 'Ticket# not in settlement'  // reason hint per CONTEXT.md
      }));

    // Settlement-only lines: lines with matchStatus 'unmatched' for this buyer+cropYear
    const settlements = await prisma.settlement.findMany({
      where: { buyerId, cropYear }
    });
    const settlementIds = settlements.map(s => s.id);
    const settlementOnlyLines = settlementIds.length > 0
      ? await prisma.settlementLine.findMany({
          where: { settlementId: { in: settlementIds }, matchStatus: 'unmatched' },
          select: { id: true, ticketNo: true, date: true, netWeight: true, settlementId: true }
        })
      : [];

    res.json({ farmOnly, settlementOnly: settlementOnlyLines });
  } catch (e) {
    console.error('GET /api/reconciliation/unmatched error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Manual Link Endpoint (for two-panel "Link" action)

```javascript
// POST /api/reconciliation/manual-link
// Body: { ticketId: 123, settlementLineId: 456 }
app.post('/api/reconciliation/manual-link', async (req, res) => {
  try {
    const ticketId = parseInt(req.body.ticketId, 10);
    const lineId = parseInt(req.body.settlementLineId, 10);
    if (isNaN(ticketId) || isNaN(lineId)) {
      return res.status(400).json({ error: 'ticketId and settlementLineId are required' });
    }
    const updated = await prisma.settlementLine.update({
      where: { id: lineId },
      data: { ticketId, matchStatus: 'manual' }
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Line not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| matchStatus default 'unmatched' on SettlementLine | Already in schema from Phase 9 | Phase 9 (done) | No schema migration needed |
| ticketId FK on SettlementLine | Already in schema from Phase 9 | Phase 9 (done) | No schema migration needed |
| Manual file-based data | PostgreSQL + Prisma | Phase 10 (done) | All queries use Prisma, not JSON |

**Deprecated/outdated:**
- Nothing deprecated for this phase. All schema fields were designed in Phase 9 specifically for Phase 13.

---

## Critical Pre-Implementation Discoveries

The following facts were confirmed by reading existing code — these directly affect plan design:

### 1. Schema is Fully Ready — Zero Migration Needed

`prisma/schema.prisma` already has:
- `SettlementLine.ticketId Int?` — FK to Ticket
- `SettlementLine.matchStatus String @default("unmatched")` — already storing "unmatched"|"matched"|"disputed"|"manual"
- `SettlementLine.notes String?` — dispute notes write here
- `Ticket.settlementLines SettlementLine[]` — reverse relation for the `include` pattern
- `@@index([ticketNo])` on Ticket and `@@index([ticketNo])` on SettlementLine — both already indexed for lookup

**Implication:** Plan 13-01 needs NO migration task. The `runMatch()` function writes to existing fields without schema change.

### 2. matchStatus Lives on SettlementLine, Not Ticket

The badge on the ticket list/detail must be **derived** from SettlementLine. The `dbTicketToJson()` function in `server.js` (line ~87) converts Prisma Ticket rows to client JSON — this is the right place to add the `_reconciliation` field. It requires adding `include: { settlementLines: { select: { matchStatus: true } } }` to the Prisma query wherever tickets are fetched for display.

**Implication:** `GET /api/tickets` and `GET /api/tickets/:id` both need the include. `computeFarmSummaries()` (which runs `prisma.ticket.findMany()`) does NOT need it — farm summaries don't need reconciliation status.

### 3. Existing Toast Infrastructure Usable

`app.js` line 90: `window.util.showToast(msg, duration, type)` — already implemented, uses `#entry-toast`. However, this toast is tied to the entry tab. For reconciliation toasts (triggered from the Settlements tab), a new `#settlements-toast` element should be added near the settlements section, or `showToast` should be made tab-agnostic. **Recommendation:** Add a local toast `div` in the settlements section and wire a `showSettlementToast()` helper in `settlements.js` — consistent with the settlements module's self-contained pattern.

### 4. Sub-Nav Already Handles N Buttons

The `initSettlements()` function in `settlements.js` (line ~48) uses `querySelectorAll('.settlement-sub-nav .settlement-nav-btn')` to wire all sub-nav buttons dynamically. Adding a 4th button (`data-view="reconciliation"`) requires zero changes to `initSettlements()` — just HTML changes. The `if (target === 'history') loadSettlements()` conditional block must also add `if (target === 'reconciliation') loadReconciliation()`.

### 5. Settlement Commit Endpoint Location for Auto-Match Hook

`POST /api/settlements/:id/commit` in `server.js` (line ~1072). The `runMatch(settlementId)` call goes immediately after `prisma.settlementLine.createMany()` succeeds and before the `res.json()` response. The response shape needs to include `matched` and `unmatched` counts from the match result.

### 6. Two Selection Lists for Manual Linking (UX Complexity)

The "Farm-Only Tickets" and "Settlement-Only Lines" panels each need a selectable row mechanism. Since there's no fancy list library, the pattern is:
- Click on a farm ticket row → highlights it, stores `selectedFarmTicketId` in module state
- Click on a settlement line row → highlights it, stores `selectedSettlementLineId` in module state
- "Link" button activates only when both are selected → POSTs to `/api/reconciliation/manual-link`

This is standard vanilla JS event delegation on `<tr>` clicks with a CSS `.selected` class.

---

## New API Routes Required

| Method | Path | Purpose | Plan |
|--------|------|---------|------|
| POST | `/api/settlements/:id/rematch` | Re-run matching for a settlement | 13-01 |
| GET | `/api/reconciliation/summary` | Per-crop/buyer aggregate (farm vs buyer lbs) | 13-02 |
| GET | `/api/reconciliation/unmatched` | Farm-only + settlement-only unmatched lists | 13-02 |
| POST | `/api/reconciliation/manual-link` | Link farm ticket to settlement line manually | 13-02 |
| PATCH | `/api/settlement-lines/:lineId/dispute` | Flag line as disputed with note | 13-02 |

Auto-match is integrated into existing `POST /api/settlements/:id/commit` — not a new route.

---

## Open Questions

1. **Rematch behavior for "disputed" lines**
   - What we know: CONTEXT.md says skip 'manual' lines during rematch (preserves audit trail). Disputed is not explicitly stated.
   - What's unclear: Should rematch clear a dispute flag if the match is still valid?
   - Recommendation: Skip both 'manual' and 'disputed' during rematch. This is conservative and preserves user intent. Document the decision in the plan. User can manually clear a dispute if needed.

2. **"No settlement for [buyer]" vs "Ticket# not in settlement" hint logic**
   - What we know: CONTEXT.md specifies these two reason hints for farm-only tickets.
   - What's unclear: "No settlement for [buyer]" implies the buyer has zero settlements at all for that cropYear, while "Ticket# not in settlement" means settlements exist but the ticket wasn't found.
   - Recommendation: In the unmatched API, check if `settlements.length === 0` for the buyer+cropYear → use "No settlement for [buyer]"; else → "Ticket# not in settlement". Simple check in the endpoint or client-side.

3. **Ticket list badge column — table width impact**
   - What we know: The ticket list table already has 15 columns (date through edit button). Adding a badge column makes 16.
   - What's unclear: Will this cause horizontal scroll issues on mobile?
   - Recommendation: Add the badge as a narrow column ("Status") between the ticket number and notes columns — replacing or compressing the existing Dest column. Or add a "Status" column before the Edit button column. The table already requires horizontal scroll on mobile — adding one more narrow column is acceptable.

---

## Sources

### Primary (HIGH confidence)
- `/grain-tickets/prisma/schema.prisma` — confirmed SettlementLine.ticketId, matchStatus, notes fields; Ticket.settlementLines reverse relation
- `/grain-tickets/server.js` (full read) — confirmed existing route patterns, helper structure, Prisma query patterns, auto-match hook location
- `/grain-tickets/public/settlements.js` (partial read) — confirmed sub-nav pattern, SETTLEMENT_FIELDS, module state pattern
- `/grain-tickets/public/app.js` — confirmed `window.util.showToast()`, `window.api` helpers, ref-data pattern
- `/grain-tickets/public/style.css` — confirmed CSS variable palette (--success, --danger, --amber, --orange, --text-light)
- `13-CONTEXT.md` — locked decisions and deferred items
- `.planning/phases/12-settlement-import-manual-entry/12-02-SUMMARY.md` — confirmed makeLineEditable(), formatDate(), manualSettlementId patterns
- `.planning/STATE.md` — confirmed Phase 12 complete, Phase 13 next; no pending blockers for Phase 13

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — REC-01..REC-05 text confirmed

### Tertiary (LOW confidence)
- None — all research based on direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are currently installed, confirmed in package.json and server.js
- Architecture: HIGH — matching engine pattern derived from reading actual schema + server code
- Pitfalls: HIGH — derived from concrete schema constraints (14 duplicate ticket numbers confirmed in STATE.md) and Prisma query behavior
- UI patterns: HIGH — all patterns derived from reading live Phase 12 code (settlements.js, app.js, style.css)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable Express + Prisma stack, no fast-moving dependencies)
