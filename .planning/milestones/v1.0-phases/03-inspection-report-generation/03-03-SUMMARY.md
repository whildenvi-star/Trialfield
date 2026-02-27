---
phase: 03-inspection-report-generation
plan: 03
subsystem: api, ui
tags: [next.js, react-pdf, prisma, pdf-generation, file-system]

# Dependency graph
requires:
  - phase: 03-01
    provides: GeneratedReport schema, report data assembler, shared PDF components
  - phase: 03-02
    provides: All 8 NOP PDF section components and InspectionReport Document
provides:
  - POST /api/reports/generate endpoint (assemble -> render -> save -> persist)
  - GET /api/reports endpoint (report history listing)
  - GET /api/reports/[id] endpoint (PDF file download with tenant isolation)
  - Reports page UI (crop year selector, generate button, report history table)
  - End-to-end user workflow: select crop year -> generate -> auto-download -> see in history
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - renderToBuffer pattern for server-side PDF generation in Next.js API route
    - fs.mkdir + fs.writeFile pattern for local file persistence under uploads/reports/
    - window.location.href for client-triggered file downloads
    - Tenant isolation check at download route (report.farmId !== farmId -> 404)

key-files:
  created:
    - organic-cert/src/app/api/reports/generate/route.ts
    - organic-cert/src/app/api/reports/route.ts
    - organic-cert/src/app/api/reports/[id]/route.ts
    - organic-cert/src/app/(app)/reports/page.tsx
  modified: []

key-decisions:
  - "window.location.href for PDF download — triggers browser download without needing blob URL management"
  - "Tenant isolation on download route via report.farmId !== farmId check before file read — prevents cross-farm file access"
  - "File-not-found 404 separate from record-not-found 404 — distinguishes DB miss from disk miss"
  - "Optional field filter defaults to all fields — fieldIds absent from POST body means assembleReportData uses all farm fields"

patterns-established:
  - "Pattern 1: Server-side PDF generation — renderToBuffer(React.createElement(Doc, props)) in API route, write to uploads/, return metadata with 201"
  - "Pattern 2: Download route pattern — DB lookup with tenant check, fs.readFile, NextResponse with Content-Disposition attachment header"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-04]

# Metrics
duration: 25min
completed: 2026-02-25
---

# Phase 3 Plan 03: API Routes + Reports UI Summary

**Three API routes (generate, list, download) and a polished Reports page delivering the complete end-to-end workflow: select crop year, click Generate, receive PDF download, see report in history**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-25T07:20:00Z
- **Completed:** 2026-02-25T07:45:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- POST /api/reports/generate connects the data assembler and PDF renderer to produce and persist a real PDF file on the server
- GET /api/reports and GET /api/reports/[id] provide complete report history listing and download with tenant isolation
- Reports page UI delivers the full user workflow with crop year selector, optional field filter, loading states, error toasts, and report history table
- Human verification (checkpoint Task 3) confirmed the complete pipeline works: PDF downloads automatically, all 8 NOP sections present, report appears in history

## Task Commits

Each task was committed atomically in the `organic-cert` sub-repository:

1. **Task 1: API Routes (Generate, List, Download)** - `ffdddcc` (feat)
2. **Task 2: Reports Page UI** - `433e8ec` (feat)
3. **Task 3: End-to-End Report Generation Verification** - Human-approved checkpoint (no code commit)

**Plan metadata:** committed in parent repo docs commit (docs)

## Files Created/Modified
- `organic-cert/src/app/api/reports/generate/route.ts` - POST endpoint: auth check, cropYear validation, assembleReportData call, renderToBuffer, fs.writeFile, GeneratedReport.create, returns {id, filename, cropYear} with 201
- `organic-cert/src/app/api/reports/route.ts` - GET endpoint: auth check, findMany ordered by createdAt desc, returns report list
- `organic-cert/src/app/api/reports/[id]/route.ts` - GET endpoint: auth check, findUnique with tenant isolation, fs.readFile, NextResponse with Content-Disposition attachment header
- `organic-cert/src/app/(app)/reports/page.tsx` - Client component: crop year selector (current year to current-3), optional field filter loaded from /api/fields, Generate button with Loader2 spinner, error toast via sonner, report history list with Download buttons

## Decisions Made

- **window.location.href for PDF download** — triggers browser native download dialog without needing Blob URL management on the client
- **Tenant isolation on download route** — report.farmId !== farmId returns 404 (same as not-found) to avoid leaking existence of other farms' reports
- **Separate 404s for DB miss vs disk miss** — record not found returns generic 404; file read failure returns { error: "Report file not found" } to surface disk issues distinctly
- **Optional field filter defaults to all fields** — fieldIds absent from POST body passes undefined to assembleReportData, which includes all farm fields by default

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all API routes type-checked cleanly, React.createElement wrapper used instead of JSX in API route to avoid needing JSX transform in server context.

## User Setup Required

None - no external service configuration required. Reports are written to `uploads/reports/` within the organic-cert app directory (excluded from git by .gitignore).

## Next Phase Readiness

This is the final plan of Phase 3, completing all 4 RPT requirements and the v1.0 milestone.

**v1.0 Milestone complete:** Farm manager can pull Case IH field data and hand an inspector a complete, print-ready USDA NOP audit report with zero manual data assembly.

All 14 requirements across API (5), FIELD (6), and RPT (4) are now implemented.

---
*Phase: 03-inspection-report-generation*
*Completed: 2026-02-25*
