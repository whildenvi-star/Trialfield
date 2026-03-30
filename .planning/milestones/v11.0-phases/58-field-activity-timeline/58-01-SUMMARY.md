---
phase: 58-field-activity-timeline
plan: 01
subsystem: glomalin-portal/timeline-api
tags: [timeline, aggregation, farm-budget, organic-cert, fieldops, grain-tickets, api]
dependency_graph:
  requires: []
  provides: [timeline-types, timeline-fetch-sources, timeline-api-aggregated, timeline-api-per-source]
  affects: [glomalin-portal/api/timeline]
tech_stack:
  added: []
  patterns: [Promise.allSettled, graceful-degradation-200, per-source-progressive-loading, proxy-service-helpers]
key_files:
  created:
    - glomalin-portal/src/lib/timeline/types.ts
    - glomalin-portal/src/lib/timeline/fetch-sources.ts
    - glomalin-portal/src/app/api/timeline/[fieldId]/route.ts
    - glomalin-portal/src/app/api/timeline/[fieldId]/[source]/route.ts
  modified: []
decisions:
  - "Per-source endpoint always returns HTTP 200 with error field — client treats source failure as degraded, not network error (matches partial-data-with-warnings pattern)"
  - "fetchFieldOpsActivities returns [] when no cert enterprise exists — avoids errors for non-organic fields"
  - "Budget machinery and inputs produce separate TimelineEntry records — inputs as 'Input Application' activityType distinct from pass activityType"
  - "mergeTimeline pairs budget+cert entries bidirectionally: cert.pairedWith points to budget ID, and budget.pairedWith is updated to point back to cert entry ID"
  - "SOURCE_PRIORITY sort order: cert > fieldops > budget > grain — confirmed operations sort before planned for same date"
metrics:
  duration_seconds: 184
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 58 Plan 01: Timeline Aggregation API Summary

**One-liner:** Timeline aggregation API with 4-source fetch functions, Promise.allSettled merging, and per-source progressive-loading endpoints — all type-safe, auth-gated, with graceful degradation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Timeline types and per-source fetch functions | ac0e4fa | types.ts, fetch-sources.ts |
| 2 | Timeline API route with Promise.allSettled aggregation | 49687b3 | api/timeline/[fieldId]/route.ts |
| 3 | Per-source timeline API routes for progressive UI loading | 8aa73eb | api/timeline/[fieldId]/[source]/route.ts |

## What Was Built

### Types (`types.ts`)
- `TimelineSource`: union of 4 source names
- `TimelineEntry`: unified activity record with `id`, `source`, `date`, `sortDate`, `activityType`, `summary`, `detail`, `status`, `pairedWith`, `sourceLink`
- `TimelineResponse`: aggregated API shape with `entries[]`, `warnings[]`, `fieldId`, `fieldName`, `year`
- `SingleSourceResponse`: per-source shape with `entries[]` and `error` field (null on success)

### Fetch Functions (`fetch-sources.ts`)
- `fetchBudgetActivities`: reads all fields, finds by `registryFieldId`, extracts machinery passes + input applications as planned entries with `sortDate: '9999-12-31'`
- `fetchCertActivities`: resolves cert field enterprise via `resolveFieldEnterpriseId`, maps `fieldOperations` to confirmed entries with operator/acres detail; `pairedWith` carries `budgetImplementId`
- `fetchFieldOpsActivities`: fetches CaseIH `SyncedOperations` via `/api/admin/staged-ops`, handles 404/405 gracefully (returns [] when FieldOps not configured)
- `fetchGrainActivities`: finds farm by `registryId`, fetches tickets by `cropYear`, maps to delivery entries with bushel calculation and `sourceLink: '/app/grain-tickets'`
- `mergeTimeline`: collects fulfilled entries, adds rejected sources to warnings, sorts by `sortDate` + source priority, back-fills budget `pairedWith` from cert entries

### API Routes
- `GET /api/timeline/:fieldId` — Supabase auth, registry name lookup, `Promise.allSettled([4 sources])`, `mergeTimeline`, returns `TimelineResponse`
- `GET /api/timeline/:fieldId/:source` — validates source param, calls correct fetch function, always HTTP 200 with `{ source, entries, error }` shape

## Verification

- `npx tsc --noEmit` passes with 0 errors across full project
- All 4 fetch functions exported from `fetch-sources.ts`
- `mergeTimeline` exported and used in aggregated route
- Auth guard present on both API routes
- Per-source route returns HTTP 200 even on source failure (graceful degradation)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `glomalin-portal/src/lib/timeline/types.ts` — exists
- [x] `glomalin-portal/src/lib/timeline/fetch-sources.ts` — exists
- [x] `glomalin-portal/src/app/api/timeline/[fieldId]/route.ts` — exists
- [x] `glomalin-portal/src/app/api/timeline/[fieldId]/[source]/route.ts` — exists
- [x] Commits ac0e4fa, 49687b3, 8aa73eb — verified in git log

## Self-Check: PASSED
