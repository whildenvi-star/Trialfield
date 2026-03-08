---
phase: 23-settlement-closure
plan: "01"
subsystem: grain-tickets
tags: [reconciliation, tolerance, crop-config, settlement]
dependency_graph:
  requires: []
  provides: [per-crop-tolerance-config, tolerance-aware-reconciliation-summary, tolerance-settings-ui]
  affects: [grain-tickets/reconciliation, grain-tickets/crop-config]
tech_stack:
  added: []
  patterns: [tolerance-threshold-at-read-time, collapsible-panel-with-localstorage-state, auto-save-on-blur]
key_files:
  created:
    - grain-tickets/prisma/migrations/20260304221838_add_crop_tolerance/migration.sql
  modified:
    - grain-tickets/prisma/schema.prisma
    - grain-tickets/server.js
    - grain-tickets/public/settlements.js
decisions:
  - "tolerancePct takes precedence over toleranceLbs when both are > 0 (percentage wins)"
  - "withinTolerance evaluated at read time in summary endpoint — no new SettlementLine schema column needed"
  - "withinTolerance=true when variance=0 and no tolerance configured (zero is always acceptable)"
  - "Falls back to legacy 1% threshold in UI when server withinTolerance field is absent"
  - "Tolerance panel collapsed by default; expand/collapse state persisted in localStorage"
metrics:
  duration: "3m 10s"
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 4
requirements_satisfied: [REC-01]
---

# Phase 23 Plan 01: Configurable Weight Tolerance Summary

Per-crop weight discrepancy tolerance configuration for the grain-tickets reconciliation system. CropConfig model extended with tolerancePct/toleranceLbs fields, CRUD API added, reconciliation summary now evaluates withinTolerance at read time using configured thresholds, and a collapsible settings panel in the reconciliation view lets users tune per-crop tolerances.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add tolerance fields to CropConfig and create tolerance CRUD API | 95de669 | schema.prisma, server.js, migration.sql |
| 2 | Build tolerance settings UI in reconciliation view | 5e17706 | settlements.js |

## What Was Built

### Task 1: Schema + API (95de669)

**Schema changes** (`prisma/schema.prisma`):
- Added `tolerancePct Float @default(0)` to CropConfig — percentage-based tolerance (1.5 = 1.5%)
- Added `toleranceLbs Float @default(0)` to CropConfig — fixed-lbs fallback tolerance
- Migration `20260304221838_add_crop_tolerance` applied cleanly

**New API endpoints** (`server.js`):
- `GET /api/crop-config/tolerances?cropYear=N` — returns all CropConfig rows for the year with id, cropName, tolerancePct, toleranceLbs sorted by cropName
- `PUT /api/crop-config/:id/tolerance` — validates both fields are non-negative numbers, updates and returns the row

**Updated reconciliation summary** (`server.js` — `GET /api/reconciliation/summary`):
- Loads CropConfig tolerances for the crop year
- Computes threshold per crop: tolerancePct > 0 → percentage of farmLbs; else toleranceLbs > 0 → fixed value; else 0
- Adds `withinTolerance`, `tolerancePct`, `toleranceLbs` to each summary row
- withinTolerance = true when abs(varianceLbs) <= threshold, or when varianceLbs = 0 and no tolerance configured

### Task 2: Tolerance Settings UI (5e17706)

**Collapsible panel** in `loadReconciliation()`:
- Inserted between filter bar and results area
- Header shows "Tolerance Settings" with expand/collapse toggle button
- Expand/collapse state persisted in `localStorage` key `recon-tolerance-expanded`
- Default: collapsed

**Panel content** (loaded from `GET /api/crop-config/tolerances`):
- Table with columns: Crop Name, Tolerance % (step 0.1), Tolerance Lbs (step 1)
- Both inputs styled to match dark theme (var(--card), var(--border), var(--text))
- Auto-save on input blur or Enter key via `PUT /api/crop-config/:id/tolerance`
- Brief "Saved" (green) indicator per row, clears after 2 seconds
- Empty state: "No crop configurations found for {year}. Add crops in the admin panel first."

**Refreshed on Load** — when Load button clicked and panel is expanded, tolerance settings reload for the selected crop year

**Summary table updates** (`renderReconSummary()`):
- Replaced hardcoded `Math.abs(variancePct) <= 1` with `withinTolerance` from server response
- `variance-ok` class applied when withinTolerance=true, `variance-warn` when false
- Variance cell gets `title` tooltip: "Within tolerance: 1.5% tolerance" or "Exceeds tolerance: 500 lbs tolerance"
- Backward-compatible: falls back to 1% threshold if server sends no withinTolerance

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `grain-tickets/prisma/schema.prisma` contains tolerancePct and toleranceLbs
- [x] Migration file exists: `grain-tickets/prisma/migrations/20260304221838_add_crop_tolerance/migration.sql`
- [x] `grain-tickets/server.js` contains `/api/crop-config/tolerances`, `tolerancePct`, `toleranceLbs`, `withinTolerance`
- [x] `grain-tickets/public/settlements.js` contains tolerance panel, auto-save, withinTolerance UI logic
- [x] Commit 95de669 exists (Task 1)
- [x] Commit 5e17706 exists (Task 2)

## Self-Check: PASSED
