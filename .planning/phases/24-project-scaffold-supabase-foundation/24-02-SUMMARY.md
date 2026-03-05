---
phase: 24-project-scaffold-supabase-foundation
plan: 02
subsystem: database
tags: [supabase, postgresql, rls, sql, auth]

requires: []
provides:
  - Supabase schema with profiles table (FK auth.users, role enum)
  - Module access grants table with unique user+module constraint
  - RLS policies for own-row and admin access
  - Auto-profile trigger on auth.users insert
  - Seed SQL for dev setup
affects: [24-03, 25, 26]

tech-stack:
  added: []
  patterns: [supabase-rls, auth-uid-pattern, security-definer-trigger]

key-files:
  created:
    - glomalin-portal/supabase/schema.sql
    - glomalin-portal/supabase/seed.sql
  modified: []

key-decisions:
  - "profiles.id is direct FK to auth.users(id) — NOT a serial"
  - "Auto-profile trigger uses security definer to bypass RLS for new users"
  - "module_access_admin_manage uses FOR ALL policy for full CRUD"

patterns-established:
  - "auth.uid() for all RLS policies (Supabase pattern)"
  - "security definer for trigger functions that need elevated access"
  - "Separate updated_at trigger function reused across tables"

requirements-completed: [SUP-01]

duration: 3min
completed: 2026-03-04
---

# Plan 24-02: Supabase Schema Summary

**Supabase schema with profiles/module_access tables, RLS policies, auto-profile trigger, and seed data**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- user_role enum (admin, agronomist, operator, viewer)
- profiles table with uuid PK FK to auth.users, role, full_name, timestamps
- module_access table with unique(user_id, module) constraint
- RLS enabled on both tables with 6 policies (own-row + admin access)
- Auto-profile trigger creates viewer profile on auth.users signup
- updated_at triggers on both tables
- Seed SQL promotes test user to admin with all 5 module grants

## Task Commits

1. **Tasks 1-2: Schema + seed SQL** - `09cb0bd` (feat)

## Files Created/Modified
- `glomalin-portal/supabase/schema.sql` - Complete schema with tables, RLS, triggers
- `glomalin-portal/supabase/seed.sql` - Test admin user + module grants

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
Supabase project must be created manually. See plan 24-03 for .env.local.example with setup instructions.

## Next Phase Readiness
- Schema ready to apply in Supabase Dashboard SQL Editor
- module IDs in schema match module registry (plan 24-03)

---
*Phase: 24-project-scaffold-supabase-foundation*
*Completed: 2026-03-04*
