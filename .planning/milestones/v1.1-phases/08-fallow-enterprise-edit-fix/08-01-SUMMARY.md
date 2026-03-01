---
phase: 08-fallow-enterprise-edit-fix
plan: "01"
subsystem: organic-cert
tags: [bug-fix, fallow-enterprise, form-prefill, data-loss]
dependency_graph:
  requires: []
  provides: [fallow-edit-prefill-fix, fallow-cost-serialization-fix]
  affects: [field-enterprises-page]
tech_stack:
  added: []
  patterns: [null-check-ternary, parseFloat-fallback]
key_files:
  created: []
  modified:
    - organic-cert/src/app/(app)/field-enterprises/page.tsx
decisions:
  - "Null fallowCostAmount defaults to 0.00 in openEdit() form (never blank) — uses != null ternary to avoid coercing zero to empty string"
  - "Cleared cost amount saves as 0 (not null) — always a numeric value per locked decision"
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_modified: 1
  completed_date: "2026-03-01"
---

# Phase 8 Plan 01: Fallow Enterprise Edit Fix Summary

**One-liner:** Fixed fallow enterprise edit path so cost fields pre-fill from stored values and preserve 0 instead of null on save.

## What Was Built

Three targeted edits in a single file (`organic-cert/src/app/(app)/field-enterprises/page.tsx`) that close the silent data-loss bug in the fallow enterprise edit flow:

1. **FieldEnterprise interface extended** — Added `fallowCostAmount: number | null` and `fallowCostCategory: string | null`. Without these fields, TypeScript had no awareness of the stored cost data, making the pre-fill impossible.

2. **openEdit() pre-fill fixed** — Replaced the hardcoded empty-string fallback for fallow cost fields with a proper null-safe pre-fill:
   ```typescript
   fallowCostAmount: ent.fallowCostAmount != null
     ? ent.fallowCostAmount.toFixed(2)
     : "0.00",
   fallowCostCategory: ent.fallowCostCategory || "",
   ```
   Using `!= null` (not `||`) is critical — `0 || ""` would coerce a stored value of `$0.00` to an empty string, silently discarding it.

3. **handleSave() serialization fixed** — Changed `parseFloat(form.fallowCostAmount) || null` to `parseFloat(form.fallowCostAmount) || 0`. A cleared or empty cost amount field now saves as `0` instead of `null`, keeping the database value always numeric.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend FieldEnterprise interface and fix openEdit() pre-fill | da789d3 | field-enterprises/page.tsx |
| 2 | Fix handleSave() serialization to store 0 not null on cleared cost | 85f4f29 | field-enterprises/page.tsx |

## Verification

- TypeScript `npx tsc --noEmit` passes with no errors (verified after both tasks)
- FieldEnterprise interface includes `fallowCostAmount: number | null` and `fallowCostCategory: string | null`
- `openEdit()` uses `ent.fallowCostAmount != null ? ent.fallowCostAmount.toFixed(2) : "0.00"` (not empty string)
- `handleSave()` uses `parseFloat(form.fallowCostAmount) || 0` (not `|| null`)
- No other files modified — fix contained to `page.tsx`
- Create flow, non-fallow enterprises, PDF reports, API routes all unaffected

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy discovery was that `organic-cert/` has its own nested git repository (not tracked in the outer project repo). Commits were made in the organic-cert inner repo following the established commit convention. This is consistent with how previous phase commits in the plan history are structured.

## Requirements Addressed

- SCHEMA-03: FieldEnterprise interface now correctly types fallow cost fields
- VIEW-05: Edit form now pre-fills and preserves fallow cost data through edit round-trip

## Self-Check: PASSED

- File exists: `organic-cert/src/app/(app)/field-enterprises/page.tsx` — FOUND
- Commit da789d3 exists in organic-cert repo — FOUND
- Commit 85f4f29 exists in organic-cert repo — FOUND
