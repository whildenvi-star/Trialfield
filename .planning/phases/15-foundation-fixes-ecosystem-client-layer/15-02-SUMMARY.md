---
phase: 15-foundation-fixes-ecosystem-client-layer
plan: 02
subsystem: api
tags: [ecosystem, http-client, abort-controller, promise-allsettled, nextjs, compile-page]

# Dependency graph
requires:
  - phase: 15-01
    provides: "FIX-01/02/03 blocking bugs resolved — sync-registry, enterprise truncation, partial unique index"
provides:
  - "Typed ecosystem client layer: budget-client, registry-client, tickets-client with 3s AbortController timeout"
  - "checkAllSources() using Promise.allSettled for independent per-source failure handling"
  - "GET /api/compile/sources — returns SourceStatus[] array"
  - "GET /api/compile/fields-preview — parallel budget + registry fetch with partial failure handling"
  - "SourceStatusBar component: green/red dots, Refresh button with spinner, expandable error details"
  - "Compile page at /compile: status bar + organic field/acre preview table + placeholder NOP sections"
  - "Compile nav item in sidebar (Layers icon, between reports and c2.0 crop overview)"
affects:
  - "16-field-enterprise-compile"
  - "17-input-seed-nop"
  - "18-rotation-harvest-pdf"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EcosystemError class with source/technicalDetail/friendlyMessage/suggestedFix fields"
    - "fetchWithTimeout: AbortController 3s timeout wrapper for all ecosystem HTTP calls"
    - "checkAllSources: Promise.allSettled over ping functions — one down source never blocks others"
    - "Partial compile: API returns null + error payload per source, client renders available sections"

key-files:
  created:
    - organic-cert/src/lib/ecosystem/types.ts
    - organic-cert/src/lib/ecosystem/budget-client.ts
    - organic-cert/src/lib/ecosystem/registry-client.ts
    - organic-cert/src/lib/ecosystem/tickets-client.ts
    - organic-cert/src/lib/ecosystem/index.ts
    - organic-cert/src/app/api/compile/sources/route.ts
    - organic-cert/src/app/api/compile/fields-preview/route.ts
    - organic-cert/src/components/compile/source-status-bar.tsx
    - organic-cert/src/app/(app)/compile/page.tsx
  modified:
    - organic-cert/src/components/layout/sidebar.tsx
    - organic-cert/.env

key-decisions:
  - "organic-cert is a nested git repo — commits go to organic-cert/.git, not project root"
  - "BUDGET_API_URL env var strips /api suffix from existing sync-macro pattern to keep base URL consistent"
  - "Registry ping uses /api/fields (not a dedicated /health) since registry has no lightweight health endpoint"
  - "Tickets ping uses /api/stats (confirmed present in grain-tickets server.js)"
  - "SourceStatusBar uses HTML <details> for expandable tech error per CONTEXT.md discretion decision"

patterns-established:
  - "Ecosystem client pattern: per-source FRIENDLY + FIX constants, EcosystemError on any failure"
  - "API route pattern: Promise.allSettled with extractError() helper for partial-result responses"
  - "Compile page pattern: loadSources() + loadPreview() in parallel on mount, Refresh rechecks sources only"

requirements-completed:
  - ECO-01
  - ECO-02
  - ECO-05

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 15 Plan 02: Ecosystem Client Layer Summary

**Typed HTTP client layer for farm-budget, farm-registry, and grain-tickets with 3s AbortController timeouts and Promise.allSettled independent failure handling, plus Compile page with horizontal status bar and organic field/acre preview table**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T02:51:45Z
- **Completed:** 2026-03-03T02:57:51Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — paused for user verification)
- **Files modified:** 10

## Accomplishments
- Built `src/lib/ecosystem/` with 5 files: shared types, 3 typed HTTP clients (budget, registry, tickets), and index with `checkAllSources()` via `Promise.allSettled`
- Built Compile page at `/compile` with horizontal source status bar (green/red dots, Refresh button, expandable error details), organic field/acre preview table joining budget + registry data by name, graceful degradation messages, and placeholder NOP sections
- Added Compile nav item (Layers icon) to sidebar between reports and c2.0 crop overview

## Task Commits

Each task was committed atomically (in organic-cert repo):

1. **Task 1: Build ecosystem client layer** - `622d34e` (feat)
2. **Task 2: Build compile page, status bar, API routes, sidebar** - `49c5dac` (feat)
3. **Task 3: Verify compile page** — checkpoint:human-verify (paused)

## Files Created/Modified

- `organic-cert/src/lib/ecosystem/types.ts` — SourceName/SourceStatus/EcosystemError/BudgetEnterprise/BudgetField/RegistryField + fetchWithTimeout with AbortController
- `organic-cert/src/lib/ecosystem/budget-client.ts` — pingBudget, getBudgetEnterprises, getBudgetFields, getBudgetOrganicFields (filters to organic category)
- `organic-cert/src/lib/ecosystem/registry-client.ts` — pingRegistry, getRegistryFields
- `organic-cert/src/lib/ecosystem/tickets-client.ts` — pingTickets (Phase 18 will add data-pull functions)
- `organic-cert/src/lib/ecosystem/index.ts` — checkAllSources() + re-exports
- `organic-cert/src/app/api/compile/sources/route.ts` — GET /api/compile/sources
- `organic-cert/src/app/api/compile/fields-preview/route.ts` — GET /api/compile/fields-preview with partial results
- `organic-cert/src/components/compile/source-status-bar.tsx` — SourceStatusBar component
- `organic-cert/src/app/(app)/compile/page.tsx` — CompilePage with status bar, field table, placeholder sections
- `organic-cert/src/components/layout/sidebar.tsx` — Added Compile nav item with Layers icon
- `organic-cert/.env` — Added BUDGET_API_URL, FARM_REGISTRY_URL, GRAIN_TICKETS_URL

## Decisions Made

- **Nested git repo:** organic-cert has its own `.git` directory — commits go into `organic-cert`'s repo, not the project root. All per-task commits use `cd organic-cert && git commit`.
- **BUDGET_API_URL base URL:** sync-macro uses `BUDGET_API_URL || "http://localhost:3001/api"` (with `/api` suffix). Ecosystem client uses the base URL only (`http://localhost:3001`) and appends `/api/...` per endpoint. The env var strips `/api` suffix if present to avoid double-path issue.
- **Registry ping endpoint:** `/api/fields` used as health probe since farm-registry has no dedicated `/health` endpoint. Works correctly — only checks `res.ok`.
- **Tickets ping endpoint:** `/api/stats` confirmed in grain-tickets `server.js`. Correct health probe.
- **`<details>` for expandable errors:** Used native HTML `<details>`/`<summary>` per CONTEXT.md discretion decision on expandable error UI.

## Deviations from Plan

None — plan executed exactly as written. Note: the plan specified `BUDGET_API_URL` env var to follow the pattern from sync-macro route. The sync-macro route uses `"http://localhost:3001/api"` (with `/api` suffix) while the ecosystem client needs the base URL. Handled by stripping `/api` suffix in budget-client.ts if present — no design change needed.

## Issues Encountered

- **Nested git repos:** organic-cert, farm-budget, and other app modules each have their own `.git` directories. The project root git cannot track them as regular files. Resolved by committing within `organic-cert`'s git repo directly (`cd organic-cert && git commit`).

## User Setup Required

None — no external service configuration required. Env vars added to `organic-cert/.env` use default localhost ports that work without any setup.

## Next Phase Readiness

- Ecosystem client layer is ready for Phases 16-18 to import `getBudgetOrganicFields`, `getRegistryFields`, and future data-pull functions
- Task 3 checkpoint paused for human verification of compile page, status bar, and field preview
- After verification: Phase 15 complete, proceed to Phase 16 (Field + Enterprise Compile)

## Self-Check: PASSED

All 9 created files confirmed present on disk. Both task commits (622d34e, 49c5dac) confirmed in organic-cert git log.

---
*Phase: 15-foundation-fixes-ecosystem-client-layer*
*Completed: 2026-03-03*
