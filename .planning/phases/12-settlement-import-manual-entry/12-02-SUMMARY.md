---
phase: 12-settlement-import-manual-entry
plan: 02
subsystem: grain-tickets
tags: [manual-entry, settlement-detail, line-crud, inline-edit, service-worker, prisma, spa]
requirements: [SET-03, SET-04]

dependency_graph:
  requires:
    - grain-tickets/prisma/schema.prisma (Settlement, SettlementLine models from Phase 9)
    - grain-tickets/server.js (express server, existing settlement parse/commit routes from Plan 12-01)
    - grain-tickets/public/settlements.js (import UI module from Plan 12-01)
    - grain-tickets/public/index.html (Settlements tab from Plan 12-01)
  provides:
    - POST /api/settlements (create manual settlement header — no file)
    - POST /api/settlements/:id/lines (add individual line)
    - GET /api/settlements/:id/lines (list all lines ordered by id)
    - PUT /api/settlements/:settlementId/lines/:lineId (partial update)
    - DELETE /api/settlements/:settlementId/lines/:lineId (single line delete)
    - grain-tickets/public/settlements.js (manual entry form, settlement detail view, inline line editing)
    - SW cache v5 (forces browser cache invalidation for returning users)
  affects:
    - grain-tickets/server.js (5 new settlement CRUD routes)
    - grain-tickets/public/settlements.js (rewritten — 1219 lines, manual entry + detail views added)
    - grain-tickets/public/index.html (Manual Entry sub-nav button, settlement-manual, settlement-detail divs)
    - grain-tickets/public/style.css (.hidden utility class added)
    - grain-tickets/public/sw.js (CACHE_NAME v4 -> v5)

tech_stack:
  added: []
  patterns:
    - Manual settlement header: POST /api/settlements with null sourceFile + null filePath (distinguishes from file imports)
    - Partial PUT: dynamically builds updateData object from req.body keys present — only updates sent fields
    - Inline edit: clicking Edit replaces td textContent with input elements; Enter/Escape to save/cancel
    - Hidden class toggle: .hidden utility class added to style.css; JS uses classList.add/remove('hidden') for view switching
    - Session state: manualSettlementId persists across line additions so user can add many lines without re-selecting buyer
    - formatDate(): UTC-aware YYYY-MM-DD from ISO date strings (getUTCFullYear/Month/Date avoids timezone shift)
    - fmtNum(): formats Decimal/float values to configurable decimal places for display

key_files:
  created: []
  modified:
    - grain-tickets/server.js (5 new routes: POST /api/settlements, POST/GET/PUT/DELETE /api/settlements/:id/lines)
    - grain-tickets/public/settlements.js (rewritten 1219 lines — manual entry + detail views + sub-nav)
    - grain-tickets/public/index.html (Manual Entry button, settlement-manual, settlement-detail, settlement-history divs)
    - grain-tickets/public/style.css (.hidden utility class at top)
    - grain-tickets/public/sw.js (CACHE_NAME grain-tickets-v4 -> grain-tickets-v5)

decisions:
  - null sourceFile + null filePath distinguishes manual settlements from file imports in the same Settlement table
  - manualSettlementId module-level state persists the active session across rapid multi-line entry without re-selection
  - makeLineEditable() shared between manual-entry lines table and detail view lines table — one inline-edit implementation
  - formatDate() uses UTC getters (getUTCFullYear etc.) to display YYYY-MM-DD correctly regardless of client timezone
  - .hidden CSS utility class added (was missing from style.css) — required for view-switching via classList

metrics:
  duration: "327 seconds"
  completed: "2026-03-02"
  tasks_completed: 2
  files_changed: 5
  files_created: 0
---

# Phase 12 Plan 02: Manual Settlement Entry + Detail View Summary

Manual settlement entry form with session state, settlement detail view with inline line editing, and line-level CRUD routes — enabling paper-only buyers without digital files.

## What Was Built

### Task 1: Manual settlement header + line-level CRUD server routes (commit: b24475d)

Added 5 routes to `server.js`:

- **POST /api/settlements** — creates a manual settlement header with `null sourceFile` and `null filePath` (distinguishing factor from file imports). Validates `buyerId` and `cropYear`, returns `{ id, buyerId, cropYear, notes, importedAt }`.

- **POST /api/settlements/:id/lines** — adds a single `SettlementLine`. Parses all 8 fields: `ticketNo` trimmed to null, dates anchored to noon UTC (`T12:00:00.000Z`) per Phase 10 convention, `parseFloat || null` for numeric fields, `String(parseFloat(value))` for Decimal fields (price, deductions, netPayment). Returns 201 with the created line.

- **GET /api/settlements/:id/lines** — lists all `SettlementLine` records for a settlement ordered by `id asc` (insertion order). Returns 404 if settlement not found.

- **PUT /api/settlements/:settlementId/lines/:lineId** — partial update via dynamic `updateData` object. Verifies the line exists and belongs to the given settlement (scope check). Uses same parse logic as create. Returns 404 if line not in settlement.

- **DELETE /api/settlements/:settlementId/lines/:lineId** — verifies settlement scope before deleting. Returns `{ ok: true }`.

All Decimal fields (price, deductions, netPayment) passed as strings to Prisma. Date anchoring uses noon UTC per established Phase 10 pattern.

### Task 2: Manual entry form UI, settlement detail view, SW cache bump (commit: b59a61a)

**`grain-tickets/public/settlements.js`** rewritten at 1219 lines:

- **Three-panel sub-nav** — `renderManualEntryView` integrated into `initSettlements` sub-nav toggle. Import/Manual Entry/History buttons now use `.settlement-nav-btn` class with `classList.add/remove('hidden')` for view switching. The `settlement-detail` view is accessible from History (no direct sub-nav button — detail is navigated to from rows).

- **`renderManualEntryView()`** — checks `manualSettlementId` module state. If no active session: renders `renderManualStartForm()` with buyer dropdown (populated from `refData.destinations`) + crop year input + "Start Manual Settlement" button. On create: POSTs `/api/settlements`, sets `manualSettlementId`, transitions to `renderManualLineForm()`.

- **`renderManualLineForm()` + `buildManualLineUI()`** — fetches settlement + existing lines. Renders session header (buyer, crop year, "End Session" button). Renders `renderManualLinesTable()` above an "Add Line" form with all 8 SETTLEMENT_FIELDS + Notes. On submit: POSTs `/api/settlements/:id/lines`, clears field inputs (keeps session context), shows toast, refreshes lines table.

- **`makeLineEditable(tr, sId, lineId, linesContainer)`** — shared inline-edit function used by both manual entry and detail view. Snapshots original row HTML for cancel. Replaces `<td>` content with `<input>` elements typed and stepped appropriately. Enter key = save, Escape = cancel. On save: PUTs updated fields, refreshes table. On cancel: restores snapshot HTML and re-wires buttons.

- **`showSettlementDetail(sId)` + `buildDetailView()`** — hides all views, shows `#settlement-detail`. Fetches settlement + lines in parallel. Renders header card (buyer, crop year, source file or "Manual Entry", import date, line count). "Back to History" link navigates back. Inline Add Line form (shown on button click, dismissed on cancel/save). Uses `renderDetailLinesTable()` which shares `makeLineEditable()`.

- **`renderSettlementList()`** updated — rows are clickable, "View" button also navigates to detail. Source column shows "Manual Entry" for null sourceFile. Delete button stop-propagation prevents row click from firing.

- **`formatDate(val)`** — uses `getUTCFullYear/Month/Date` for timezone-safe YYYY-MM-DD display from ISO date strings.

- **`fmtNum(val, decimals)`** — formats Decimal/numeric values to N decimal places (price shows 4, netWeight 0, etc.).

**`grain-tickets/public/index.html`** changes:
- Sub-nav changed from `<nav>` to `<div class="settlement-sub-nav">` — buttons now have `class="settlement-nav-btn"`
- Added `<button class="settlement-nav-btn" data-view="manual">Manual Entry</button>`
- Added `<div id="settlement-manual" class="settlement-view hidden"></div>`
- Added `<div id="settlement-history" class="settlement-view hidden"></div>`
- Added `<div id="settlement-detail" class="settlement-view hidden"></div>`
- Import view retains its original content, now without `style="display:none"` (hidden class handles it)

**`grain-tickets/public/style.css`**: Added `.hidden { display: none !important; }` as generic utility at top.

**`grain-tickets/public/sw.js`**: `CACHE_NAME` bumped from `'grain-tickets-v4'` to `'grain-tickets-v5'`.

## Success Criteria Verification

- [x] Manual entry form creates settlement header + individual lines without file upload — POST /api/settlements + POST lines routes wired
- [x] All 8 SettlementLine fields editable through manual form — SETTLEMENT_FIELDS array drives both form inputs and inline edit
- [x] Settlement detail view shows all lines for any settlement (file or manual) — showSettlementDetail() fetches lines regardless of sourceFile
- [x] Individual lines editable and deletable within detail view — makeLineEditable() + DELETE route wired
- [x] Settlement History list clickable to open detail view — row click + View button both call showSettlementDetail()
- [x] Service worker cache bumped to v5 — CACHE_NAME grain-tickets-v5 confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Added .hidden CSS utility class**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified using `hidden` class for view toggling but no generic `.hidden { display: none }` rule existed in style.css. Without it, all settlement views would be visible simultaneously.
- **Fix:** Added `.hidden { display: none !important; }` at top of style.css.
- **Files modified:** grain-tickets/public/style.css
- **Commit:** b59a61a (included in Task 2 commit)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| grain-tickets/server.js | FOUND |
| grain-tickets/public/settlements.js | FOUND |
| grain-tickets/public/index.html | FOUND |
| grain-tickets/public/style.css | FOUND |
| grain-tickets/public/sw.js | FOUND |
| Commit b24475d (Task 1) | FOUND |
| Commit b59a61a (Task 2) | FOUND |
