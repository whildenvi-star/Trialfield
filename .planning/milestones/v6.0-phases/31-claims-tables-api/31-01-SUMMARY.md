---
phase: 31-claims-tables-api
plan: "01"
subsystem: glomalin-portal
tags: [claims, supabase, schema, api-routes, crud, timeline, module-registration]
dependency_graph:
  requires: [phase-29-insurance-tables, phase-27-fsa-data-foundation]
  provides: [claims-schema, claims-api, claims-module-nav, deadline-calc]
  affects: [phase-32-claims-lifecycle-ui, phase-33-integration]
tech_stack:
  added: []
  patterns: [claims-crud-routes, stage-transition-timeline, create-from-policy-prefill, deadline-auto-calc]
key_files:
  created:
    - glomalin-portal/scripts/migrate-31.ts
    - glomalin-portal/src/lib/claims/calc.ts
    - glomalin-portal/src/app/api/claims/route.ts
    - glomalin-portal/src/app/api/claims/[id]/route.ts
    - glomalin-portal/src/app/api/claims/[id]/timeline/route.ts
    - glomalin-portal/src/app/(protected)/app/claims/page.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts
decisions:
  - "claim_stage enum uses DO/EXCEPTION block for idempotency (CREATE TYPE does not support IF NOT EXISTS universally)"
  - "Timeline events written in application code (PATCH/POST handlers), not DB triggers — matches established project pattern"
  - "computeDeadline returns null for notice_of_loss (uses INITIAL_DEADLINE_DAYS from date_of_loss instead) and closed (no deadline)"
  - "Adjuster assignment detection: only fires timeline event when adjuster_name transitions from null/empty to a value"
  - "Deadline recompute on stage change skips if deadline_overridden=true on current claim OR in patch body"
  - "Storage bucket creation wrapped in try/catch with manual fallback instructions — duplicate is non-fatal on re-runs"
metrics:
  duration: "5 minutes"
  completed: "2026-03-05"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 31 Plan 01: Claims Tables + API Summary

**One-liner:** Supabase claims schema (3 tables + enum + Storage bucket + RLS) with create-from-policy CRUD routes and timeline auto-events using 15-day FCIC deadline calculation.

## What Was Built

### Task 1: Migration script + deadline calc helpers + module registration
- **`scripts/migrate-31.ts`** — Idempotent migration following the established migrate-29.ts pattern: inline .env.local parser, service_role client, prints SQL to console, attempts exec_sql RPC, falls back gracefully. Creates: `claim_stage` enum (6 values), `claims` table (FK to insurance_policies, NOT UNIQUE on policy_id for multi-claim support), `claim_documents` table (FK to claims, Storage path), `claim_timeline` table (append-only, no updated_at). RLS on all 3 tables + storage.objects policies scoped to `claim-documents` bucket. Trigger for updated_at on claims. 4 indexes.
- **`src/lib/claims/calc.ts`** — Pure functions: `addDays`, `INITIAL_DEADLINE_DAYS = 15` (FCIC-confirmed), `STAGE_DEADLINE_DAYS` (filed: 60, adjuster_assigned: 30, under_review: 45, settled: 30), `computeDeadline(stage, stageEnteredAt)` returning Date | null.
- **`src/lib/modules.ts`** — Claims module added after insurance entry with `status: 'live'`, route `/app/claims`.

### Task 2: Claims CRUD routes + timeline route + shell page
- **`src/app/api/claims/route.ts`** — GET (list, optional `?year=` filter) + POST create-from-policy (CLM-07). POST fetches policy by policy_id, carries over crop/plan_type→coverage_type/coverage_level/effective_guarantee, auto-sets 15-day deadline from date_of_loss, writes `created` timeline event.
- **`src/app/api/claims/[id]/route.ts`** — GET single + PATCH + DELETE. PATCH fetches current row first (Phase 29-02 pattern), detects 4 types of changes and auto-writes timeline events: `stage_change` (recalculates deadline via STAGE_DEADLINE_DAYS), `financial_update` (estimated_loss_bu, appraised_value, indemnity_amount, deductible_amount), `deadline_change` (when deadline_at set + deadline_overridden=true), `adjuster_assigned` (when adjuster_name transitions from null/empty to a value). DELETE cascades to claim_documents and claim_timeline.
- **`src/app/api/claims/[id]/timeline/route.ts`** — GET all events (ascending chronological order) + POST manual note (event_type='note').
- **`src/app/(protected)/app/claims/page.tsx`** — Server Component shell page. Fetches claims, renders 3 stat cards (Total Claims, Open Claims, Approaching Deadlines within 7 days), claims table with crop/stage/coverage/date_of_loss/deadline/effective_guarantee columns. Soil palette throughout. Tracking disclaimer on every render.

## Success Criteria Verification

- [x] `npx tsc --noEmit` passes cleanly in glomalin-portal
- [x] `migrate-31.ts` generates valid SQL for 3 tables, enum, RLS, indexes, Storage bucket creation
- [x] POST `/api/claims` fetches policy by policy_id and carries over crop, plan_type→coverage_type, coverage_level, effective_guarantee, auto-calculates 15-day deadline
- [x] PATCH `/api/claims/[id]` writes timeline events on stage transitions
- [x] Claims module registered in modules.ts with route /app/claims
- [x] Claims shell page renders stat cards and claim table with soil palette

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified to exist:
- glomalin-portal/scripts/migrate-31.ts — FOUND
- glomalin-portal/src/lib/claims/calc.ts — FOUND
- glomalin-portal/src/app/api/claims/route.ts — FOUND
- glomalin-portal/src/app/api/claims/[id]/route.ts — FOUND
- glomalin-portal/src/app/api/claims/[id]/timeline/route.ts — FOUND
- glomalin-portal/src/app/(protected)/app/claims/page.tsx — FOUND

Commits verified:
- 2d646a5: feat(31-01): migration script + deadline calc helpers + module registration
- d958181: feat(31-01): claims CRUD routes + timeline route + shell page
