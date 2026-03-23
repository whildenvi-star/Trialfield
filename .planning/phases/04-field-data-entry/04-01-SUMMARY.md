---
phase: 04-field-data-entry
plan: 01
subsystem: api
tags: [supabase, next.js, file-upload, rls, mobile, react, canvas]

# Dependency graph
requires: []
provides:
  - POST /api/observations — accepts JSON (text-only) or multipart FormData (text+photo)
  - GET /api/observations — returns current user's observations ordered by date desc
  - GET /api/observations/photo/[filename] — authenticated photo serve with traversal protection
  - ObservationForm component with camera capture, canvas resize, preview, fetch submit
  - Page route at /app/observations/new
  - Supabase field_observations table migration (003-field-observations.sql)
affects: [04-02-offline-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Supabase direct auth pattern in API routes (createClient + auth.getUser, no requireModuleAccess)
    - multipart/form-data branch on content-type header for photo upload vs JSON for text-only
    - Client-side canvas resize to 1200px JPEG 0.8 before upload via createImageBitmap + canvas.toBlob
    - path.basename() sanitization for file serve routes to prevent path traversal

key-files:
  created:
    - src/app/api/observations/route.ts
    - src/app/api/observations/photo/[filename]/route.ts
    - src/components/observations/ObservationForm.tsx
    - src/app/(protected)/app/observations/new/page.tsx
    - supabase/migrations/003-field-observations.sql
  modified: []

key-decisions:
  - "field_observations uses Supabase RLS — users see only their own observations via auth.uid() = submitted_by"
  - "Photo filename (not full path) stored in DB — full path reconstructed at serve time from process.cwd()"
  - "JSON for text-only submit, multipart FormData for text+photo — avoids FormData overhead for text-only"
  - "uploads/ directory created with fs.mkdir recursive — does not exist at deploy time"
  - "Migration SQL created at supabase/migrations/003-field-observations.sql — applied manually (no DB password in env, Docker not running)"

patterns-established:
  - "Direct Supabase auth in observations API: createClient() + auth.getUser() without requireModuleAccess"
  - "Photo resize pattern: createImageBitmap + canvas.toBlob(JPEG 0.8) client-side before upload"
  - "Path traversal protection: path.basename(filename) in file serve routes"

requirements-completed: [FIELD-01, FIELD-02]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 04 Plan 01: Field Observations Summary

**Supabase field_observations table, POST/GET/photo API routes with RLS, and mobile ObservationForm with canvas resize and camera capture**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T00:24:29Z
- **Completed:** 2026-03-23T00:27:54Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- POST /api/observations accepts JSON for text-only or multipart for text+photo, inserts into Supabase field_observations, stores photo on disk
- GET /api/observations/photo/[filename] serves photos with auth check and path.basename() traversal protection
- ObservationForm (175 lines) with camera trigger, createImageBitmap canvas resize to 1200px JPEG 0.8, preview thumbnail, and loading/feedback state
- Supabase migration file for field_observations table with RLS policies and created_at index

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase field_observations table and API routes** - `a14a019` (feat)
2. **Task 2: Build ObservationForm component and page route** - `87906d5` (feat)

**Plan metadata:** (created below)

## Files Created/Modified

- `src/app/api/observations/route.ts` - POST and GET endpoints with Supabase auth, disk photo write
- `src/app/api/observations/photo/[filename]/route.ts` - Authenticated photo serve with path traversal sanitization
- `src/components/observations/ObservationForm.tsx` - Mobile form: textarea, camera input, canvas resize, preview, fetch submit
- `src/app/(protected)/app/observations/new/page.tsx` - Page route rendering ObservationForm
- `supabase/migrations/003-field-observations.sql` - Table schema with RLS policies and index

## Decisions Made

- **Supabase, not Prisma.** The codebase has zero Prisma — all DB via @supabase/supabase-js as required by plan.
- **Migration file only** — Supabase CLI could not apply migration directly (no DB password in env, Docker not running). File created at `supabase/migrations/003-field-observations.sql` for manual application.
- **Buffer cast** — TypeScript 5 requires `buffer as unknown as BodyInit` for `new Response(buffer)` in the photo serve route.
- **RLS: users see only their own observations** — submitted_by policy uses auth.uid() = submitted_by.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript Buffer type error in photo serve route**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `new Response(buffer)` errors as `Buffer<ArrayBufferLike>` not assignable to `BodyInit` in TS5
- **Fix:** Cast `buffer as unknown as BodyInit`
- **Files modified:** `src/app/api/observations/photo/[filename]/route.ts`
- **Verification:** `npx tsc --noEmit` passes for all observations files
- **Committed in:** `a14a019` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type bug)
**Impact on plan:** Fix necessary for compilation. No scope creep.

## Issues Encountered

- Supabase migration could not be applied automatically — no database password in `.env.local` and Docker (required for `npx supabase db push` to local) is not running. Migration SQL file created at `supabase/migrations/003-field-observations.sql` for the user to apply via Supabase dashboard SQL editor.

## User Setup Required

The field_observations table must be created in Supabase before the feature works. Run the following SQL in the Supabase dashboard SQL editor (Project: hmjmrdhwrzltckzuoaoh):

```sql
CREATE TABLE IF NOT EXISTS field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  note text NOT NULL,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE field_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own observations"
  ON field_observations FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can read own observations"
  ON field_observations FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE INDEX IF NOT EXISTS idx_field_obs_user_date
  ON field_observations(submitted_by, created_at DESC);
```

## Next Phase Readiness

- API routes and form complete — ready for Plan 02 (offline queue)
- Plan 02 will replace the direct fetch in ObservationForm with an IndexedDB queue-first pattern
- uploads/observations/ directory created on first photo submit (no pre-creation needed)

---
*Phase: 04-field-data-entry*
*Completed: 2026-03-23*
