---
phase: quick
plan: 1
subsystem: farm-budget
tags: [bug-fix, field-ops, calc, ui]
dependency_graph:
  requires: []
  provides: [accessible-programs-toolbar, passStatus-aware-calc, actualQuantity-aware-calc]
  affects: [farm-budget/public/index.html, farm-budget/public/calc.js]
tech_stack:
  added: []
  patterns: [passStatus guard, effectiveQuantity derived field]
key_files:
  created: []
  modified:
    - farm-budget/public/index.html
    - farm-budget/public/calc.js
key_decisions:
  - Programs toolbar moved to fieldops-unified panel using flex-wrap second row — no JS changes needed since field-editor.js binds IDs on DOMContentLoaded
  - effectiveQuantity derived at calc time — confirmed uses actualQuantity, disregarded uses 0, planned uses quantity
  - machineryDetails costPerAcre returned as 0 for disregarded items (not filtered out) — preserves array shape for UI rendering
metrics:
  duration: 5m
  completed: 2026-04-23
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 1: Fix 3 Field Ops Bugs (Program Apply Button + passStatus/actualQuantity Calc)

One-liner: Moved Apply/Save Program toolbar into Field Ops panel and made budget calc respect passStatus (disregarded=$0) and actualQuantity (confirmed uses actual not planned).

## Tasks Completed

### Task 1: Surface programs toolbar in Field Ops panel (index.html)
**Commit:** c05798c

Removed the `<div class="mach-tmpl-bar">` programs block from `data-section="inputs"` (unreachable after Phase 71 removed the Inputs nav link) and added it as a second flex row inside the `fo-toolbar` div within `data-section="fieldops-unified"`. Added `flex-wrap:wrap` to the toolbar so the two rows stack naturally. Element IDs `ed-apply-program`, `ed-apply-program-btn`, and `ed-save-as-program` are preserved exactly — no changes to field-editor.js listener bindings needed.

### Task 2: Fix calc.js — respect passStatus and actualQuantity in field cost
**Commit:** d63bc9d

In `computeFieldBudget`, the `inputDetails` map now:
- Sets `effectiveQty = 0` when `passStatus === 'disregarded'` (Bug 2)
- Uses `actualQuantity` when `passStatus === 'confirmed' && actualQuantity != null` (Bug 3)
- Only accumulates spring/fall/unassigned fert totals when not disregarded
- Returns `effectiveQuantity` and `passStatus` on each detail object

The `machineryDetails` map now guards `machCostPerAcre`, `fuelGallonsPerAcre`, and labor accumulation behind `!mIsDisregarded`. Returns `passStatus` field on each detail object.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] farm-budget/public/index.html modified — programs toolbar in fieldops-unified
- [x] farm-budget/public/calc.js modified — passStatus + actualQuantity guards
- [x] Exactly 3 occurrences of program element IDs in index.html, all in fieldops-unified
- [x] No duplicate element IDs
- [x] passStatus appears 5 times in calc.js
- [x] Both task commits exist: c05798c, d63bc9d

## Self-Check: PASSED
