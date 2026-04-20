---
phase: 71-unified-field-operations-view
plan: "01"
subsystem: farm-budget
tags: [field-ops, classifier, html-scaffold, vanilla-js]
dependency_graph:
  requires: []
  provides: [FieldOpsGroups-module, fieldops-unified-panel-skeleton]
  affects: [farm-budget/public/field-editor.js]
tech_stack:
  added: []
  patterns: [window-module-IIFE, lowercase-pattern-matching, agronomic-group-classifier]
key_files:
  created:
    - farm-budget/public/field-ops-groups.js
  modified:
    - farm-budget/public/index.html
decisions:
  - Spinner implement classified as Pre-emerge (spinner-disc sprayer used for pre/PPI applications) — standalone 'spinner' pattern added separate from 'application - spinner' custom type
  - Rotary Hoe classified as Post-emerge (mechanical weed control deployed post-emergence) — consistent with agronomic timing
  - BioActive, BioRepel, Boost, Mint castings classified as Fertility (biological soil amendments) — matches plan spec broadly
  - Adjuvants (Crop Oil, NIS, Meth Oil) classified as Post-emerge — applied with post-emerge herbicides as tank-mix partners
metrics:
  duration: "133s"
  completed: "2026-04-20"
  tasks: 2
  files: 2
---

# Phase 71 Plan 01: Field Ops Classifier + HTML Skeleton Summary

Group classifier module and Field Ops panel HTML skeleton built from real data.json product/implement names — provides the two foundations Plan 02 builds on.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create field-ops-groups.js classifier module | bddf6b3 | farm-budget/public/field-ops-groups.js (created) |
| 2 | Add Field Ops panel HTML skeleton to index.html | 162d447 | farm-budget/public/index.html (modified) |

## What Was Built

### field-ops-groups.js

`window.FieldOpsGroups` IIFE module exposing:
- `GROUP_ORDER` array: `['Tillage', 'Fertility', 'Planting', 'Pre-emerge', 'Post-emerge', 'Fungicide', 'Harvest', 'Other']`
- `classifyItem(name, itemType)` — pattern-matching classifier returning a GROUP_ORDER string, never null

Pattern rules derived from every real product and implement name in data.json (61 products, 14 implements). Rules evaluated in GROUP_ORDER sequence; first match wins; unmatchable items fall to 'Other'.

### index.html changes

1. New `<li data-section="fieldops-unified">Field Ops</li>` nav item added after Seed in editor sidebar
2. Field Ops panel HTML skeleton with:
   - `#ed-fieldops-unified-body` container div
   - Expand/collapse toolbar buttons (`#fo-expand-all`, `#fo-collapse-all`)
   - `#fo-groups-container` — mount point for Plan 02 group rendering
   - `#fo-grand-total` row (hidden until populated)
3. `<script src="field-ops-groups.js"></script>` added before `field-editor.js`
4. Existing Inputs and Machinery nav items and panels left untouched

## Verification

```
fieldops-unified count in index.html: 3  (nav item + panel div + badge ID)
field-ops-groups.js count in index.html: 1
classifyItem('Combine + Buggy', 'pass') => 'Harvest'  ✓
```

All 9 plan test cases pass plus 20 additional real-data name tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spinner implement did not match Pre-emerge**
- **Found during:** Task 1 verification (post-write test run)
- **Issue:** Plan specified `'application - spinner'` pattern but the standalone implement name "Spinner" needs its own direct pattern since it has no "application - " prefix
- **Fix:** Added `'spinner'` pattern directly to Pre-emerge rule patterns alongside `'application - spinner'`
- **Files modified:** farm-budget/public/field-ops-groups.js
- **Commit:** bddf6b3 (included in original task commit — fix discovered and applied before commit)

## Self-Check: PASSED

- [x] `farm-budget/public/field-ops-groups.js` exists
- [x] `farm-budget/public/index.html` contains `data-section="fieldops-unified"` (3 occurrences)
- [x] `farm-budget/public/index.html` contains `field-ops-groups.js` script tag
- [x] commit bddf6b3 exists
- [x] commit 162d447 exists
