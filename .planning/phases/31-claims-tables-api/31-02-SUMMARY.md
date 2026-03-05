---
phase: 31-claims-tables-api
plan: "02"
subsystem: api
tags: [claims, supabase-storage, signed-url, document-upload, file-management, timeline]

dependency_graph:
  requires:
    - phase: 31-01
      provides: claims schema (claim_documents table, claim_timeline table, claims table, claim-documents Storage bucket)
  provides:
    - signed-upload-url endpoint (POST /api/claims/[id]/upload-url)
    - document metadata CRUD (GET + POST /api/claims/[id]/documents)
    - signed download URLs for document list
    - doc_upload timeline event on metadata save
  affects: [phase-32-claims-lifecycle-ui, phase-33-integration]

tech_stack:
  added: []
  patterns: [three-step-signed-url-upload, createSignedUploadUrl-vs-createSignedUrl, file-type-validation, storage-path-sanitization]

key_files:
  created:
    - glomalin-portal/src/app/api/claims/[id]/upload-url/route.ts
    - glomalin-portal/src/app/api/claims/[id]/documents/route.ts
  modified: []

key_decisions:
  - "upload-url uses createSignedUploadUrl (not createSignedUrl) — distinct Supabase Storage methods for upload vs download"
  - "File bytes never route through Next.js API routes — three-step pattern: server generates URL → client PUT to Storage → client POST metadata"
  - "Filename sanitization: spaces to hyphens, strip non-alphanumeric except dots and hyphens — storage path safe for all clients"
  - "Supabase Storage enforces 50MB size limit natively — no server-side size check needed; Phase 32 UI adds 25MB client-side check for UX"
  - "doc_upload timeline event is non-fatal: document metadata saved successfully even if timeline insert fails (same pattern as POST /api/claims)"
  - "Signed download URLs use 3600-second (1 hour) expiry — balances link longevity against security for Phase 32 UI rendering"
  - "category defaults to 'other' if omitted from POST body — no breaking requirement for callers to know categories upfront"

patterns_established:
  - "Three-step upload flow: POST /upload-url → client PUT signedUrl → POST /documents (never route file bytes through server)"
  - "createSignedUploadUrl for server-side URL generation; createSignedUrl for download URL generation in GET list"
  - "Promise.all for batch signed URL generation in document list — parallel requests per document"

requirements_completed: [CLM-04]

duration: 4min
completed: 2026-03-05
---

# Phase 31 Plan 02: Claims Document Upload API Summary

**Signed URL document upload pattern (CLM-04): server generates upload token, client PUTs directly to Supabase Storage, client POSTs metadata — file bytes never route through Next.js.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T21:06:45Z
- **Completed:** 2026-03-05T21:10:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `POST /api/claims/[id]/upload-url` generates signed upload URL via `createSignedUploadUrl` with file type validation (PDF, JPG, PNG, WebP, XLSX, CSV) and claim existence check
- `POST /api/claims/[id]/documents` saves metadata to `claim_documents` table and writes `doc_upload` event to `claim_timeline` for audit trail
- `GET /api/claims/[id]/documents` returns all documents with 1-hour signed download URLs via `createSignedUrl` for Phase 32 UI rendering
- STATE.md blocker "spike signed upload URL + RLS behavior" is resolved by this implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Signed URL upload endpoint + document metadata CRUD** - `3c6e9b8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `glomalin-portal/src/app/api/claims/[id]/upload-url/route.ts` — POST: validates file type + claim existence, generates signed upload URL via createSignedUploadUrl, returns { path, token, signedUrl }
- `glomalin-portal/src/app/api/claims/[id]/documents/route.ts` — GET: lists documents with signed download URLs; POST: inserts claim_documents row + writes doc_upload timeline event

## Decisions Made

- `createSignedUploadUrl` (not `createSignedUrl`) is the correct Supabase Storage method for generating upload tokens — these are distinct API methods
- Storage path pattern: `claims/{id}/{timestamp}-{sanitizedFilename}` ensures uniqueness and safe characters
- File size validation deferred to Storage layer (50MB Supabase limit) + Phase 32 UI (25MB client check) — no server-side check needed
- `doc_upload` timeline event is non-fatal: same pattern as `created` event in POST `/api/claims` from Phase 31-01
- `category` field defaults to `'other'` if absent, validated against 5 enum values if provided

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required beyond the Supabase project already configured in Phase 31-01 (claim-documents bucket created by migrate-31.ts).

## Next Phase Readiness

- Document upload API complete — Phase 32 Claims Lifecycle UI can implement react-dropzone upload flow using the three-step pattern
- Phase 32 UI should: (1) call POST /upload-url, (2) PUT to signedUrl using uploadToSignedUrl from @supabase/storage-js, (3) POST metadata to /documents
- Phase 32 can add a client-side 25MB size check before calling /upload-url for better UX
- Signed download URLs (1-hour expiry) are suitable for document list rendering in Phase 32 UI

---
*Phase: 31-claims-tables-api*
*Completed: 2026-03-05*
