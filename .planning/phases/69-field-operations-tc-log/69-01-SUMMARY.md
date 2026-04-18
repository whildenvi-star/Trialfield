---
phase: 69-field-operations-tc-log
plan: "01"
subsystem: glomalin-portal
tags: [api, field-ops, organic-cert, tc-log, proxy]
dependency_graph:
  requires: [46-field-pass-logger]
  provides: [field-ops-tcs-api, field-ops-operators-api]
  affects: [organic-cert/FieldOperation]
tech_stack:
  added: []
  patterns: [SSR-cookie-auth, cert-bridge-proxy, resolveFieldEnterpriseId, FULL_OP_TYPE_MAP-local-spread]
key_files:
  created:
    - glomalin-portal/src/app/api/field-ops/tcs/route.ts
    - glomalin-portal/src/app/api/field-ops/tcs/[id]/route.ts
    - glomalin-portal/src/app/api/field-ops/operators/route.ts
  modified: []
decisions:
  - SSR cookie auth via createClient (lib/supabase/server) for all three routes — not Bearer token (mobile pattern)
  - FULL_OP_TYPE_MAP spreads OP_TYPE_MAP from cert-bridge and adds No-Till and Hauling locally — cert-bridge.ts unchanged
  - noEnterprise:true response for conventional fields (GET returns empty array, not an error)
  - Operators route omits cert_user_id filter — TC log allows sign-off by any operator regardless of cert account linkage
  - Admin client (service role) used for profile reads in POST and DELETE to bypass RLS
metrics:
  duration_min: 12
  completed_date: "2026-04-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 69 Plan 01: Field Operations TC Log — API Layer Summary

**One-liner:** Portal API layer for TC log — three routes proxy to organic-cert FieldOperation with plannedSource="field-ops-tc" using cert-bridge and SSR cookie auth.

## What Was Built

Three Next.js API route files under `/api/field-ops/` that provide CRUD for TC (Transaction Complete) records:

1. **GET /api/field-ops/tcs** — Lists FieldOperations filtered to `plannedSource="field-ops-tc"` and the requested year. Returns `{ tcs, year, fieldId }`. Conventional fields (no organic-cert enterprise) return `{ tcs: [], noEnterprise: true }` — not an error.

2. **POST /api/field-ops/tcs** — Creates a TC record. Validates operationType against 9 allowed values, maps to cert FieldOpType via `FULL_OP_TYPE_MAP` (local spread of cert-bridge's `OP_TYPE_MAP` with `No-Till` and `Hauling` additions). Resolves fieldEnterpriseId via `resolveFieldEnterpriseId`. Posts to cert with `plannedSource="field-ops-tc"`, `dataSource="MANUAL"`, `status="CONFIRMED"`. Supports `tcByOverrideCertUserId` for sign-off-on-behalf-of.

3. **DELETE /api/field-ops/tcs/[id]** — Deletes a TC. Admin role can delete any TC; other roles may only delete TCs they created (ownership check via `cert_user_id === tcByCertUserId` query param). Proxies DELETE to cert `/api/field-enterprises/{enterpriseId}/operations/{id}`.

4. **GET /api/field-ops/operators** — Returns all profiles with `operator`, `agronomist`, or `admin` roles. Unlike the mobile operators endpoint, no `cert_user_id IS NOT NULL` filter — TC log allows selecting any user regardless of cert account linkage.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | 345736f | feat(69-01): add GET + POST /api/field-ops/tcs route |
| 2 | 2ea74ce | feat(69-01): add DELETE /api/field-ops/tcs/[id] and GET /api/field-ops/operators |

## Decisions Made

- **SSR cookie auth** throughout (not Bearer token) — these are portal API routes, not mobile endpoints.
- **FULL_OP_TYPE_MAP local spread** — did not modify cert-bridge.ts; new types (No-Till, Hauling) added only in the tcs/route.ts scope.
- **Admin client for profile reads** — supabaseAdmin (service role) bypasses RLS in POST and DELETE to safely read any user's `cert_user_id` and `role`.
- **noEnterprise:true pattern** — conventional fields gracefully return empty TC list, not 422/404.
- **Operators without cert account** — intentional design decision per context: TC sign-off by office staff (Sandy) who may not have a cert account.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| glomalin-portal/src/app/api/field-ops/tcs/route.ts | FOUND |
| glomalin-portal/src/app/api/field-ops/tcs/[id]/route.ts | FOUND |
| glomalin-portal/src/app/api/field-ops/operators/route.ts | FOUND |
| Commit 345736f | FOUND |
| Commit 2ea74ce | FOUND |
