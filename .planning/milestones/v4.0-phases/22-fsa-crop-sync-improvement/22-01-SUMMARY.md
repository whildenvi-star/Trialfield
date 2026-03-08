---
phase: 22-fsa-crop-sync-improvement
plan: "01"
subsystem: fsa-acres
tags: [fsa-acres, crop-sync, enterprise-preview, dashboard-integration]
dependency_graph:
  requires: [farm-budget /api/dashboard endpoint]
  provides: [/api/sync-crops/enterprise-preview, enterprise-preview UI panel]
  affects: [fsa-acres FSA Data tab]
tech_stack:
  added: []
  patterns: [cachedFetch proxy, normName crop normalization, sync-table CSS reuse]
key_files:
  created: []
  modified:
    - fsa-acres/server.js
    - fsa-acres/public/index.html
    - fsa-acres/public/fsa-entry.js
key_decisions:
  - "Used cachedFetch (60s TTL, 5s timeout) for /api/dashboard — consistent with existing cross-app fetch pattern"
  - "NON_CROP_NAMES list includes alfalfa and intermediate wheatgrass per FSA-03 spec"
  - "budgetGrandTotal prefers dash.grandTotals.acres if available, falls back to sum of row budgetAcres"
  - "Coding conventions: var declarations, string concatenation, util.esc() for all user text in HTML"
metrics:
  duration_seconds: 153
  completed_date: "2026-03-04"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
requirements_satisfied: [FSA-01, FSA-02, FSA-03, FSA-04]
---

# Phase 22 Plan 01: FSA Enterprise Crop Sync Improvement Summary

**One-liner:** Enterprise-level crop acre comparison fetching farm-budget dashboard data with compound CLU filtering (non-crop, reported, forage) displayed in a color-coded side-by-side table.

## What Was Built

Added a new enterprise-level macro view to the FSA acres app that compares farm-budget enterprise acres vs FSA CLU acres by crop. Previously the FSA sync only offered field-level CLU matching (Sync from Macro). This adds a high-level crop acre reconciliation so the user can immediately see whether FSA total acres by crop align with the budget plan before drilling into individual CLU assignments.

### Server Endpoint (FSA-01, FSA-03, FSA-04)

New `GET /api/sync-crops/enterprise-preview` in `fsa-acres/server.js`:

- Fetches farm-budget dashboard via `cachedFetch('http://localhost:3001/api/dashboard')` with 60s TTL and 5s timeout
- Builds budget-side totals from `dash.enterpriseSummaries[].cropRows[]` — groups by `normName(cr.crop)`, sums acres, collects enterprise details
- Builds FSA-side filtered totals from `store.cluRecords` with compound filter:
  - Excludes `r.reported === true` (FSA-04)
  - Excludes `landClass` in `['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC']` (FSA-03)
  - Excludes `r.use === 'forage'` (FSA-03)
  - Excludes crop names (lowercased/trimmed) in `['', 'nc', 'gls', 'crp', 'idle', 'mixed forage / hay', 'alfalfa', 'grass', 'intermediate wheatgrass']` (FSA-03)
- Merges all unique normalized keys from both sides into comparison rows: `{ crop, budgetAcres, fsaAcres, diff, cluCount, enterprises[] }`
- Sorts rows by `budgetAcres` descending
- Returns `{ rows, budgetGrandTotal, fsaGrandTotal }` — returns 502 if farm-budget unavailable

### Frontend UI (FSA-02)

`fsa-acres/public/index.html`:
- New "Enterprise Acres Preview" button (`id="fsa-enterprise-preview-btn"`) in FSA Data tab toolbar
- New collapsible panel (`id="enterprise-preview-panel"`, class `panel hidden`) above table-wrap with body, totals divs, and close button

`fsa-acres/public/fsa-entry.js`:
- Button handler: disables button, sets "Loading...", calls `api.get('/api/sync-crops/enterprise-preview')`, shows panel on success, restores button on completion or error
- `renderEnterprisePreview(data)` function: builds `.sync-table` HTML with columns Crop / Budget Acres / FSA Acres / Difference / CLU Records / Enterprises
- Difference column color-coded: `color:var(--danger)` for >10ac, `color:var(--orange,#e88c30)` for 2-10ac, prefix `+` for positive diffs
- Grand totals row with double top border showing `data.budgetGrandTotal` and `data.fsaGrandTotal`
- Close button handler hides panel
- All user text HTML-escaped via `util.esc()`, numbers formatted via `util.comma()`
- Follows fsa-entry.js coding style: `var`, string concatenation, `forEach`, no template literals

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All automated checks pass:
- Endpoint present and fetches from `localhost:3001/api/dashboard`
- Non-crop filters implemented (landClass, use, crop name list, reported)
- Frontend button, panel, render function, close handler all present
- Existing `/api/sync-crops/preview` endpoint untouched (no regression)
- Coding conventions followed (var, string concat, util.esc, util.comma)
- Server syntax valid (`node --check` passes)

## Self-Check: PASSED

Files verified:
- fsa-acres/server.js: contains enterprise-preview endpoint
- fsa-acres/public/index.html: contains enterprise-preview-panel and fsa-enterprise-preview-btn
- fsa-acres/public/fsa-entry.js: contains renderEnterprisePreview function

Commits verified:
- 710034c: feat(22-01): add /api/sync-crops/enterprise-preview endpoint
- 9700a82: feat(22-01): add enterprise acres preview panel and button handler
