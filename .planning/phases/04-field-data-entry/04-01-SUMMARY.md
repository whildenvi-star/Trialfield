---
phase: 04-field-data-entry
plan: 01
subsystem: field-observations
tags: [prisma, api, mobile, photo-upload, rbac]
dependency_graph:
  requires: []
  provides: [FieldObservation model, POST /api/observations, GET /api/observations, GET /api/observations/photo/[filename], ObservationForm component, /app/observations/new page]
  affects: [prisma/schema.prisma, Farm model, Field model, User model]
tech_stack:
  added: []
  patterns: [multipart/form-data upload, canvas resize client-side, RBAC role filter, path traversal sanitize, disk write to uploads/observations/]
key_files:
  created:
    - prisma/schema.prisma (modified — FieldObservation model + inverse relations)
    - src/app/api/observations/route.ts
    - src/app/api/observations/photo/[filename]/route.ts
    - src/components/observations/ObservationForm.tsx
    - src/app/(app)/observations/new/page.tsx
  modified:
    - prisma/schema.prisma
decisions:
  - Route group is (app) not (protected) — used existing (app) group to match project structure
  - Photo serve route guards with getAuthContext() — consistent with API pattern; UUIDs are not secret but auth guard is belt-and-suspenders
  - ObservationForm submits JSON when no photo, multipart when photo attached — avoids FormData overhead for text-only submissions
  - CREW RBAC filter on GET uses submittedById = ctx.id — prevents crew from seeing each other's observations; ADMIN and OFFICE see all farm observations
metrics:
  duration: ~8 minutes
  completed: 2026-03-22
  tasks_completed: 2
  files_created: 4
  files_modified: 1
requirements_completed: [FIELD-01, FIELD-02]
---

# Phase 4 Plan 1: Field Observations — Model, API, and Mobile Form Summary

**One-liner:** FieldObservation Prisma model with multipart photo upload API, canvas client-side resize, and mobile-first form at /app/observations/new.

## What Was Built

Farm crew can open `/app/observations/new`, type a field observation note, optionally attach a photo from their phone camera, and submit. The observation is persisted to the database; the photo (resized client-side to max 1200px at 0.8 JPEG quality) is stored to disk at `uploads/observations/`. A sonner toast confirms success.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FieldObservation Prisma model and API routes | 25ff57d | prisma/schema.prisma, src/app/api/observations/route.ts, src/app/api/observations/photo/[filename]/route.ts |
| 2 | Mobile observation form with photo capture | a20e7f1 | src/components/observations/ObservationForm.tsx, src/app/(app)/observations/new/page.tsx |

## Verification Results

- `npx prisma db push` — success, database in sync
- `npx tsc --noEmit` — no type errors
- POST /api/observations accepts JSON and multipart/form-data with auth guard
- GET /api/observations returns observations filtered by role (CREW = own only, ADMIN/OFFICE = all farm)
- Photo serve route sanitizes filename with path.basename() and returns 404 if not found
- Unauthenticated requests to all endpoints return 401

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Used (app) route group instead of (protected)**
- **Found during:** Task 2
- **Issue:** Plan specified `src/app/(protected)/app/observations/new/page.tsx` but the actual project uses `(app)` as the protected route group — `(protected)` does not exist in this codebase.
- **Fix:** Created page at `src/app/(app)/observations/new/page.tsx` — matches existing convention (all protected pages live in `(app)`).
- **Files modified:** src/app/(app)/observations/new/page.tsx
- **Commit:** a20e7f1

## Self-Check: PASSED

- prisma/schema.prisma: FOUND (FieldObservation model present)
- src/app/api/observations/route.ts: FOUND
- src/app/api/observations/photo/[filename]/route.ts: FOUND
- src/components/observations/ObservationForm.tsx: FOUND
- src/app/(app)/observations/new/page.tsx: FOUND
- Commit 25ff57d: FOUND
- Commit a20e7f1: FOUND
