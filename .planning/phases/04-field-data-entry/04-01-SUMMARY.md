---
phase: 04-field-data-entry
plan: 01
subsystem: field-observations
tags: [supabase, api, mobile, photo-upload, next-api-route]
---

# Plan 04-01: Field Observation Model, API & Form

## What was built

Field observation submission feature: Supabase migration, API routes, and mobile observation form with photo capture.

## Key files

### Created
- `supabase/migrations/003-field-observations.sql` — field_observations table with RLS policies
- `src/app/api/observations/route.ts` — POST (create with optional photo) and GET (list by farm) endpoints
- `src/app/api/observations/photo/[filename]/route.ts` — Authenticated photo serve route with path traversal protection
- `src/components/observations/ObservationForm.tsx` — Mobile form with textarea, camera capture, canvas resize to 1200px/0.8 JPEG, preview thumbnail
- `src/app/(protected)/app/observations/new/page.tsx` — Page route rendering ObservationForm

## Commits
- `a14a019` feat(04-01): create field_observations Supabase table migration and API routes
- `87906d5` feat(04-01): build ObservationForm component and page route

## Decisions
- Used Supabase (not Prisma) per project conventions
- Photo stored on disk at uploads/observations/ with UUID filenames
- Canvas resize client-side to max 1200px at 0.8 JPEG quality
- capture=environment for rear camera on mobile devices

## Blockers
- Migration SQL must be run manually in Supabase dashboard SQL editor (no Docker/CLI available)

## Self-Check: PASSED
