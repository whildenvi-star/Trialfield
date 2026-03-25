---
phase: 46-field-pass-logger
plan: 01
subsystem: glomalin-portal/mobile-api
tags: [mobile, field-pass-logger, organic-cert, api, passes, operators]
dependency_graph:
  requires:
    - 45-crop-plan-viewer (mobile auth lib, fetchBudgetService proxy)
    - organic-cert FieldOperation table (Prisma schema, operations route)
  provides:
    - POST /api/mobile/passes/confirm
    - POST /api/mobile/passes/add
    - PUT /api/mobile/passes/[passId]
    - GET /api/mobile/operators
    - enhanced GET /api/mobile/crop-plans/[fieldId] with confirmed pass merging
  affects:
    - 46-02 (field pass logger UI will consume all 4 new endpoints)
tech_stack:
  added: []
  patterns:
    - cert-bridge helper pattern (resolveFieldEnterpriseId for cross-service field ID mapping)
    - OP_TYPE_MAP constant for UI-to-organic-cert type translation
    - plannedSource "mobile-logger" audit tag on all writes
    - Graceful fallback to planned-only when organic-cert unavailable
key_files:
  created:
    - glomalin-portal/src/app/api/mobile/_lib/cert-bridge.ts
    - glomalin-portal/src/app/api/mobile/passes/confirm/route.ts
    - glomalin-portal/src/app/api/mobile/passes/add/route.ts
    - glomalin-portal/src/app/api/mobile/passes/[passId]/route.ts
    - glomalin-portal/src/app/api/mobile/operators/route.ts
  modified:
    - glomalin-portal/src/app/api/mobile/crop-plans/[fieldId]/route.ts
decisions:
  - "resolveFieldEnterpriseId fetches all fields then filters by registryId — simple but makes two cert calls; acceptable given low field count (56 fields)"
  - "crop-plans/[fieldId] wraps cert resolution in try/catch for graceful degradation — planned-only fallback ensures mobile works offline or when cert is down"
  - "OP_TYPE_MAP handles both UI-friendly names (Herbicide -> SPRAYING) and pass-through of raw enum values for flexibility"
  - "Unplanned passes identified by plannedSource='mobile-logger' AND null budgetImplementId — distinguishes from budget-import ops"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-25"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 46 Plan 01: Field Pass Logger — Portal API Routes Summary

Portal API routes bridging mobile pass confirmation/addition to organic-cert's FieldOperation table, with cross-service field ID resolution and graceful offline fallback.

## What Was Built

### cert-bridge.ts — Cross-service helper
- `resolveFieldEnterpriseId(registryFieldId)`: Resolves farm-budget registryId to organic-cert fieldEnterpriseId by fetching cert fields list and matching registryId, then finding current-year FieldEnterprise
- `OP_TYPE_MAP`: Maps UI-friendly operation types (Tillage, Planting, Herbicide, Fertilizer, Harvest, Scouting, Other) to organic-cert FieldOpType enum values (SPRAYING for Herbicide/Fertilizer, OTHER for Scouting)

### POST /api/mobile/passes/confirm
- Requires certUserId (403 if no linked cert account)
- Accepts `fieldId, passId, passType, operationDate?, operatorCertUserId?`
- Resolves fieldEnterpriseId via cert-bridge, proxies POST to organic-cert with `plannedSource: "mobile-logger"` and `budgetImplementId: passId`
- Returns `{ success, fieldOperationId, confirmedAt }`

### POST /api/mobile/passes/add
- Accepts `fieldId, operationType, operationDate?, notes?, operatorCertUserId?`
- Maps UI operation type through OP_TYPE_MAP before proxying to cert
- Creates unplanned pass with `dataSource: "MANUAL"` and `plannedSource: "mobile-logger"`
- Returns `{ success, fieldOperationId, pass: { id, type, status, operationDate, operatorName } }`

### PUT /api/mobile/passes/[passId]
- Accepts `fieldEnterpriseId, operationDate?, operatorCertUserId?`
- Proxies PUT to organic-cert `/api/field-enterprises/{id}/operations` with `{ id: passId, ...updates }`
- Returns `{ success: true }`

### GET /api/mobile/operators
- Uses service-role supabase client to bypass RLS
- Filters profiles to role IN ('operator', 'agronomist', 'admin') AND cert_user_id IS NOT NULL
- Returns `{ operators: [{ supabaseId, certUserId, fullName, role }] }` sorted by full_name

### Enhanced GET /api/mobile/crop-plans/[fieldId]
- Added organic-cert pass merging on top of existing farm-budget planned passes
- Resolves fieldEnterpriseId and fetches FieldEnterprise detail (includes fieldOperations with operator join)
- Matches confirmed ops to planned passes by budgetImplementId
- Includes unplanned passes (plannedSource=mobile-logger, no budgetImplementId) with isUnplanned=true flag
- Each pass now includes `fieldEnterpriseId` and `fieldOperationId` for edit UI
- Graceful fallback: if cert unavailable, returns planned-only passes (no error to client)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] cert-bridge.ts created at correct path
- [x] passes/confirm/route.ts created and exports POST
- [x] passes/add/route.ts created and exports POST
- [x] passes/[passId]/route.ts created and exports PUT
- [x] operators/route.ts created and exports GET
- [x] crop-plans/[fieldId]/route.ts modified to merge cert passes
- [x] TypeScript: no errors in new files (`npx tsc --noEmit` clean on new files)
- [x] All writes include `plannedSource: "mobile-logger"`
- [x] All endpoints use getMobileUser for auth

## Self-Check: PASSED
