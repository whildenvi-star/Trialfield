---
phase: 12-settlement-import-manual-entry
plan: 01
subsystem: grain-tickets
tags: [settlement-import, file-upload, column-mapping, multer, xlsx, prisma, spa]
requirements: [SET-01, SET-02, SET-04]

dependency_graph:
  requires:
    - grain-tickets/prisma/schema.prisma (Settlement, SettlementLine, BuyerColumnMap models from Phase 9)
    - grain-tickets/server.js (Express server, existing multer + Prisma patterns)
    - grain-tickets/public/app.js (tab-activate event, ref-data-loaded event, refData.destinations)
  provides:
    - POST /api/settlements/parse (file upload, XLSX parse, 5-row preview, Settlement record creation)
    - POST /api/settlements/:id/commit (column mapping apply, bulk SettlementLine insert, BuyerColumnMap save)
    - GET /api/settlements (list with buyer + line count)
    - GET /api/settlements/:id (detail with lines)
    - DELETE /api/settlements/:id (cascade + file cleanup)
    - grain-tickets/public/settlements.js (full import UI module)
    - Settlements tab in grain-tickets SPA
  affects:
    - grain-tickets/prisma/schema.prisma (filePath column added to Settlement model)
    - grain-tickets/server.js (fs, XLSX requires; multer diskStorage; 5 new routes)
    - grain-tickets/public/index.html (Settlements tab button + section)
    - grain-tickets/public/style.css (settlement-specific styles)

tech_stack:
  added: []
  patterns:
    - Two-step import: POST /parse creates Settlement record + saves file, POST /commit applies mapping + bulk inserts
    - multer diskStorage saves to uploads/settlements/ outside public/ with randomized filenames
    - XLSX.read with cellDates:true prevents Excel serial date numbers
    - Decimal fields passed as strings to Prisma (price, deductions, netPayment)
    - prisma.settlementLine.createMany for single-query bulk insert (100-500 lines)
    - BuyerColumnMap upsert on buyerId_fieldName compound key saves mapping for reuse
    - tab-activate event wires lazy init on first settlements tab visit
    - ref-data-loaded event populates buyer dropdown from refData.destinations filtered to type=buyer

key_files:
  created:
    - grain-tickets/public/settlements.js (460 lines — full import UI module)
    - grain-tickets/prisma/migrations/20260302154655_add_settlement_filepath/migration.sql
  modified:
    - grain-tickets/prisma/schema.prisma (filePath String? added to Settlement model)
    - grain-tickets/server.js (fs + XLSX requires, multer diskStorage, 5 settlement routes)
    - grain-tickets/public/index.html (Settlements tab button, tab-settlements section with import form and history list)
    - grain-tickets/public/style.css (settlement sub-nav, import-form, column-mapping grid, preview-table, settlement-list, commit-btn)

decisions:
  - filePath String? added to Settlement model via migration (not overloading Settlement.notes with temp path — cleaner parse-to-commit handoff that survives server restart)
  - Noon UTC anchoring applied to date-only strings (YYYY-MM-DD and M/D/YYYY) during commit to prevent timezone shift in negative-offset zones
  - Empty mapping entries filtered before BuyerColumnMap upsert (skip fields left at "-- skip --")
  - Commit validates ticketNo is mapped before insert (client-side gate to prevent meaningless imports)
  - Settlement list uses _count.lines from Prisma include for line count without loading all line data

metrics:
  duration: "4 minutes 30 seconds"
  completed: "2026-03-02"
  tasks_completed: 2
  files_changed: 6
  files_created: 2
---

# Phase 12 Plan 01: Settlement Import UI Summary

Two-step CSV/Excel settlement import with column mapping — multer diskStorage + SheetJS parse + 8-field mapping dropdowns + BuyerColumnMap persistence.

## What Was Built

### Task 1: Prisma migration + settlement server routes (commit: 73d5523)

Added `filePath String?` to the `Settlement` model and ran `npx prisma migrate dev --name add_settlement_filepath`. This stores the server-side upload path for the parse-to-commit handoff without overloading `Settlement.notes`.

Added to `server.js`:
- `const fs = require('fs')` and `const XLSX = require('xlsx')` at top
- `settlementStorage` multer diskStorage that creates `uploads/settlements/` and randomizes filenames
- `uploadSettlement` multer instance with 10 MB limit and CSV/XLS/XLSX extension filter
- `POST /api/settlements/parse` — saves file via diskStorage, parses with `XLSX.read(buf, {type:'buffer', cellDates:true})`, extracts headers (filtered to non-empty), builds 5-row preview (blank rows filtered), creates Settlement record with `filePath`, loads BuyerColumnMap for pre-fill, returns `{ settlementId, headers, previewRows, savedMapping }`
- `POST /api/settlements/:id/commit` — reads `settlement.filePath`, re-parses file, maps data rows through `mapping` object, filters empty rows, bulk inserts via `prisma.settlementLine.createMany`, upserts BuyerColumnMap entries, returns `{ ok, linesCreated }`
- `GET /api/settlements` — list with buyer relation + `_count.lines`, Cache-Control no-store
- `GET /api/settlements/:id` — single settlement with buyer + lines
- `DELETE /api/settlements/:id` — Prisma delete (SettlementLine cascade via schema onDelete:Cascade) + `fs.unlinkSync(filePath)` wrapped in try/catch

### Task 2: Settlement import UI (commit: 96d1d05)

**`grain-tickets/public/settlements.js`** (460 lines):
- IIFE module following same pattern as tickets.js/farms.js (no ES modules)
- `initSettlements()` — called lazily on first `tab-activate` event for "settlements"; attaches sub-nav toggle, file upload button, commit button event listeners
- `loadSettlementBuyers()` — populates `#settlement-buyer` select from `refData.destinations` filtered to `type === 'buyer'`; responds to `ref-data-loaded` event
- `handleFileUpload()` — validates buyer/year/file, posts FormData to `/api/settlements/parse`, stores `settlementId`, calls `renderColumnMapping()` and `renderPreview()`
- `renderColumnMapping(headers, savedMapping)` — renders 8 `.map-row` selects with `data-field` attributes, pre-selects saved mappings
- `renderPreview(headers, previewRows)` — renders `<table class="preview-table">` with up to 5 data rows; formats Date objects with `toLocaleDateString()`
- `handleCommit()` — collects mapping from `querySelectorAll('select[data-field]')`, validates ticketNo mapped, POSTs to `/api/settlements/:id/commit`, shows toast, resets form, switches to history view
- `loadSettlements()` — fetches `GET /api/settlements`, renders list table with delete buttons
- `handleDeleteSettlement(id)` — confirm dialog, DELETE call, reloads list

**`grain-tickets/public/index.html`** additions:
- `<button class="tab-btn" data-tab="settlements">Settlements</button>` in nav
- `<section id="tab-settlements" class="tab-content">` with:
  - `.settlement-sub-nav` with Import/History toggle buttons
  - `#settlement-import` view: buyer select, crop year input, file input, Upload & Preview button
  - `#settlement-status` for error/loading messages
  - `#preview-table-container` for 5-row preview
  - `#column-mapping-panel` with `#column-mapping-container`
  - `#settlement-commit-btn` (hidden until parse succeeds)
  - `#settlement-history` view with `#settlement-list-container`
- `<script src="settlements.js"></script>` before service worker

**`grain-tickets/public/style.css`** additions:
- `.settlement-sub-nav` — flex button group, active state matching tab style
- `.import-form` — card with border/padding matching existing form pattern
- `.column-mapping` — 2-column grid (1-col on mobile)
- `.map-row` — flex column for label + select
- `.preview-table` — small font table with primary-color header
- `.settlement-list` — reuses standard table styles
- `.settlement-status` — error/loading state styles
- `.commit-btn` — larger primary button for emphasis

## Success Criteria Verification

- [x] CSV and Excel files upload and parse correctly (headers extracted, 5-row preview shown) — XLSX.read with cellDates:true handles both formats
- [x] Column mapping UI has 8 SettlementLine field dropdowns populated with file headers — SETTLEMENT_FIELDS array drives renderColumnMapping
- [x] Commit creates SettlementLine records with all 8 fields captured — settlementLine.createMany with full field mapping
- [x] BuyerColumnMap saved on commit, pre-filled on next import for same buyer — upsert on buyerId_fieldName compound key
- [x] Settlement list shows all imports with delete capability — loadSettlements renders table with delete buttons
- [x] Files stored in uploads/settlements/ outside public/ — multer diskStorage destination confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| grain-tickets/public/settlements.js | FOUND |
| grain-tickets/prisma/schema.prisma | FOUND |
| grain-tickets/server.js | FOUND |
| grain-tickets/public/index.html | FOUND |
| grain-tickets/public/style.css | FOUND |
| Commit 73d5523 (Task 1) | FOUND |
| Commit 96d1d05 (Task 2) | FOUND |
