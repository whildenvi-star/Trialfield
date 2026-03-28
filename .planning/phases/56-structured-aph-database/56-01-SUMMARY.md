---
phase: 56-structured-aph-database
plan: "01"
subsystem: glomalin-portal/insurance
tags: [aph, insurance, supabase, api, migration]
dependency_graph:
  requires: [insurance_policies table (Phase 29), requireModuleAccess guard (Phase 25)]
  provides: [aph_records table, APH CRUD API, computeAphFromRecords, computeGuarantee]
  affects: [glomalin-portal insurance module]
tech_stack:
  added: []
  patterns: [Supabase RLS migration script, Next.js App Router API routes, pure function calc library]
key_files:
  created:
    - glomalin-portal/scripts/migrate-56.ts
    - glomalin-portal/src/app/api/insurance/aph/route.ts
    - glomalin-portal/src/app/api/insurance/aph/[id]/route.ts
  modified:
    - glomalin-portal/src/lib/insurance/calc.ts
decisions:
  - "computeAphFromRecords uses simple average (not acre-weighted) — consistent with computeAphFromClus pattern in same file"
  - "PATCH [id] sets updated_at = now() server-side — client cannot set arbitrary timestamps"
  - "DELETE returns 404 if no rows deleted — Supabase delete returns empty array when no match"
metrics:
  duration: "2 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  files_changed: 4
---

# Phase 56 Plan 01: APH Records Table and CRUD API Summary

APH records Supabase table with multi-year yield storage, source tracking, disaster-year exclusion, CRUD API routes, and pure calc functions for APH average and insurance guarantee computation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | APH records migration and calc functions | 167f7a9 | migrate-56.ts, calc.ts |
| 2 | APH CRUD API routes | 1bb1874 | aph/route.ts, aph/[id]/route.ts |

## What Was Built

### Task 1: Migration Script + Calc Functions

**migrate-56.ts** — Supabase migration following the established migrate-52.ts pattern (manual .env parse, exec_sql RPC with fallback instructions, verify select):
- `CREATE TABLE IF NOT EXISTS aph_records` with all required columns
- `UNIQUE(policy_id, crop_year)` constraint — one APH record per policy per year
- `ON DELETE CASCADE` from `insurance_policies(id)` — records removed when policy deleted
- `CREATE INDEX aph_records_policy_id_idx` — efficient per-policy lookups
- RLS: `authenticated_read` (SELECT) and `authenticated_write` (INSERT/UPDATE/DELETE) policies with idempotent `DO $$ IF NOT EXISTS` guards
- `--dry-run` flag prints SQL without executing

**calc.ts additions:**
- `AphRecord` interface — matches Supabase row shape exactly
- `computeAphFromRecords(records)` — simple average excluding disaster years and zero/negative yields; returns `{aph, includedCount, excludedCount, totalCount}` for UI display
- `computeGuarantee(aph, coverageLevel)` — `round2(aph * coverageLevel / 100)`

### Task 2: CRUD API Routes

**GET /api/insurance/aph?policyId=xxx:**
- Requires `policyId` query param (400 if missing)
- Queries `aph_records` ordered by `crop_year DESC`
- Fetches parent policy for `coverage_level`
- Returns `{records, computedAph, includedCount, excludedCount, totalCount, guarantee, coverageLevel}`

**POST /api/insurance/aph:**
- Validates `policy_id` (string), `crop_year` (integer), `actual_yield` (number >= 0)
- Defaults `source` to `'manual'`, `is_disaster_year` to `false`
- Returns 409 on duplicate `(policy_id, crop_year)` with clear message
- Returns 201 with `{record}` on success

**PATCH /api/insurance/aph/[id]:**
- Accepts partial: `actual_yield`, `is_disaster_year`, `notes`, `source`
- Only sets provided fields + `updated_at = now()`
- Returns `{record}` with updated row

**DELETE /api/insurance/aph/[id]:**
- Returns 200 `{deleted: true}` on success
- Returns 404 if no rows matched

All routes guarded with `requireModuleAccess('insurance')`.

## Verification

1. `migrate-56.ts --dry-run` prints CREATE TABLE SQL without errors — PASSED
2. `calc.ts` exports `computeAphFromRecords` and `computeGuarantee` — PASSED
3. Route files exist at correct paths with 2 exported async functions each — PASSED
4. `npx tsc --noEmit` — no TypeScript errors — PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created/exist:
- FOUND: glomalin-portal/scripts/migrate-56.ts
- FOUND: glomalin-portal/src/app/api/insurance/aph/route.ts
- FOUND: glomalin-portal/src/app/api/insurance/aph/[id]/route.ts

Commits exist:
- 167f7a9 feat(56-01): APH records migration script and calc functions
- 1bb1874 feat(56-01): APH CRUD API routes
