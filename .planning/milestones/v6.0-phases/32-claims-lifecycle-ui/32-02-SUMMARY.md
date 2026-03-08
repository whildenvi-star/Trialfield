---
phase: 32-claims-lifecycle-ui
plan: "02"
subsystem: glomalin-portal/claims-drawer
tags: [slide-over, timeline, document-upload, signed-url, react-dropzone, optimistic-update]
dependency_graph:
  requires: [32-01-SUMMARY.md, api/claims/[id]/timeline/route.ts, api/claims/[id]/documents/route.ts, api/claims/[id]/upload-url/route.ts]
  provides: [ClaimDrawer, TimelineFeed, DocumentUpload]
  affects: [glomalin-portal/src/components/claims/claims-workspace.tsx]
tech_stack:
  added: []
  patterns: [slide-over-drawer, optimistic-note-append, three-step-signed-url-upload, parallel-promise-all-fetch, tab-active-state]
key_files:
  created:
    - glomalin-portal/src/components/claims/claim-drawer.tsx
    - glomalin-portal/src/components/claims/timeline-feed.tsx
    - glomalin-portal/src/components/claims/document-upload.tsx
  modified:
    - glomalin-portal/src/components/claims/claims-workspace.tsx
decisions:
  - "ClaimDrawer uses direct import (not dynamic) — no browser-only DnD APIs, SSR is safe"
  - "Timeline and document state owned by ClaimDrawer, passed to child components as props"
  - "refetchDocuments called by DocumentUpload onUploadComplete — ClaimDrawer re-GETs /documents"
  - "Stage dropdown PATCH mirrors drag-and-drop flow; optimistic stage_change appended to timeline"
  - "FileRejection typed from react-dropzone import — readonly errors[] resolves TS2322"
  - "Timeline feed: newest at bottom (natural chat order), overflow-y-auto, append-only notes"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-06"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 32 Plan 02: Claim Detail Drawer — Summary

**One-liner:** Slide-over ClaimDrawer (PolicyDrawer pattern) with tabbed Timeline/Documents/Financials, optimistic note append, react-dropzone three-step signed URL document upload, and stage dropdown wired to PATCH API.

## What Was Built

### Task 1: ClaimDrawer + claims-workspace wiring

**claim-drawer.tsx** (`'use client'`):
- Slide-over panel: `fixed inset-y-0 right-0 z-50 w-full sm:w-[520px]` — responsive full-width on mobile, 520px on sm+ (Claude discretion per CONTEXT.md)
- Backdrop: `fixed inset-0 z-40 bg-black/40`, onClick=onClose — same pattern as PolicyDrawer
- Header (always visible): crop name (bold lg), date of loss + cause of loss (muted), stage dropdown, close button
- Stage dropdown: selects from `STAGE_ORDER` with `STAGE_LABELS` display names; on change: PATCH `/api/claims/[id]` → `onClaimUpdated(updated)` + optimistic `stage_change` timeline entry
- 3 tabs: Timeline | Documents | Financials — active tab has `border-b-[#C8860A] text-[#C8860A]`
- Data fetch on open: `Promise.all([GET timeline, GET documents])` — parallel, reset on claim change
- Exports `TimelineEvent` and `ClaimDocument` interfaces (used by timeline-feed + document-upload)

**claims-workspace.tsx** additions:
- `import { ClaimDrawer } from './claim-drawer'` (direct import — not dynamic)
- `handleClaimUpdated(updated)`: `setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))`
- `selectedClaim` derived from `claims.find(c => c.id === selectedClaimId) ?? null`
- `<ClaimDrawer open={drawerOpen} claim={selectedClaim} onClose={() => setDrawerOpen(false)} onClaimUpdated={handleClaimUpdated} />`

Commit: `a45edee`

### Task 2: TimelineFeed + DocumentUpload + ClaimDrawer refactor

**timeline-feed.tsx** (`'use client'`):
- Props: `{ claimId, timeline, setTimeline, onSwitchTab }` — state owned by ClaimDrawer, passed down
- Timeline rendering: maps events by `event_type`
  - `note`: accent left border (`border-l-2 border-l-[#C8860A] pl-3`), `text-[#e8d8c0]`
  - `stage_change`: gray dot + "Stage changed: {from} → {to}" using `STAGE_LABELS`
  - `doc_upload`: gray dot + "Document uploaded: {filename}" + "View" link calls `onSwitchTab`
  - System events (`financial_update`, `adjuster_assigned`, `created`, `deadline_change`): gray dot + label
- Timestamp: relative (just now / Xm ago / Xh ago / Xd ago / Mar 5)
- Inline note input (always-visible): `<textarea>` Enter=submit (Shift+Enter=newline), "Add Note" button
- Optimistic flow: append → POST `/api/claims/${claimId}/timeline` → replace last `_optimistic` note with server event (real id + actor_id) on success; remove + restore textarea on failure
- Append-only: no edit/delete controls (audit integrity per CONTEXT.md)

**document-upload.tsx** (`'use client'`):
- Props: `{ claimId, documents, onUploadComplete }` — documents state read-only here, owned by ClaimDrawer
- Document list: filename linked via `signedUrl` to open in new tab, file size (KB/MB), upload date
- `useDropzone({ accept: ALLOWED_TYPES, maxSize: 25MB, maxFiles: 1 })` from react-dropzone
- Three-step signed URL upload:
  1. POST `/api/claims/${claimId}/upload-url` with `{ filename, mimeType }` → `{ path, token }`
  2. `supabase.storage.from('claim-documents').uploadToSignedUrl(path, token, file, { contentType })`
  3. POST `/api/claims/${claimId}/documents` with `{ storagePath, filename, fileSize, mimeType }`
  4. `onUploadComplete()` → ClaimDrawer re-fetches documents
- Drop zone UI: dashed border, accent border + bg on drag-active, disabled+opacity when uploading
- ALLOWED_TYPES: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `.xlsx`, `text/csv`

**claim-drawer.tsx refactored** to import `TimelineFeed` and `DocumentUpload` from their standalone files. Removed inline duplicate implementations. Inline `FinancialsTab` kept (simpler — no external component needed).

Commit: `aea0d39`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: FileRejection errors readonly type mismatch**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `onDrop` callback typed `rejectedFiles: { errors: { message: string }[] }[]` — `FileRejection.errors` is `readonly FileError[]`, not assignable to mutable `{ message: string }[]`
- **Fix:** Imported `FileRejection` type from `react-dropzone` and typed parameter as `FileRejection[]`
- **Files modified:** `document-upload.tsx`
- **Commit:** included in `aea0d39`

## Requirements Satisfied

| Requirement | Evidence |
|-------------|----------|
| CLM-03 | ClaimDrawer shows full Timeline (system events + notes), Documents (list + upload), and Financials (guarantee, loss, indemnity, deductible) |
| CLM-06 | TimelineFeed always-visible inline textarea, Enter to submit, optimistic append, appears immediately without page refresh |

## Self-Check: PASSED

### Files created/exist
- FOUND: glomalin-portal/src/components/claims/claim-drawer.tsx
- FOUND: glomalin-portal/src/components/claims/timeline-feed.tsx
- FOUND: glomalin-portal/src/components/claims/document-upload.tsx
- FOUND: glomalin-portal/src/components/claims/claims-workspace.tsx

### Commits verified
- FOUND: a45edee (Task 1 — ClaimDrawer + claims-workspace wiring)
- FOUND: aea0d39 (Task 2 — TimelineFeed + DocumentUpload + ClaimDrawer refactor)

### TypeScript
- npx tsc --noEmit: CLEAN (no errors)
