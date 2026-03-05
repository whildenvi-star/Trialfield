---
phase: 25-auth-middleware-route-protection
plan: 04
subsystem: auth
tags: [next.js, supabase, admin, rbac, api-routes, user-management]

# Dependency graph
requires:
  - phase: 25-02
    provides: middleware route protection — /admin/* is protected before admin panel exists

provides:
  - Admin panel page at /admin with inline user/role/module management
  - GET /api/admin/users — full user list with emails, roles, module access
  - PATCH /api/admin/users/[id]/role — role update with self-lockout protection
  - PATCH /api/admin/users/[id]/access — module access toggle (upsert)
  - POST /api/admin/invite — Supabase service_role invite + initial role assignment
  - RLS migration allowing admin UPDATE on profiles table

affects:
  - 26-01 (dashboard will show admin panel link for admin users)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin client pattern: createClient from @supabase/supabase-js with service_role key — autoRefreshToken:false, persistSession:false"
    - "Self-protection: compare params.id === user.id before any role change"
    - "Module toggle: optimistic-ish update — patch first, update local state on success"
    - "currentUserId returned in GET /api/admin/users response so client can disable own row"

key-files:
  created:
    - glomalin-portal/supabase/migrations/001-admin-write-policies.sql
    - glomalin-portal/src/app/api/admin/users/route.ts
    - glomalin-portal/src/app/api/admin/users/[id]/role/route.ts
    - glomalin-portal/src/app/api/admin/users/[id]/access/route.ts
    - glomalin-portal/src/app/api/admin/invite/route.ts
    - glomalin-portal/src/app/(protected)/admin/page.tsx
  modified:
    - glomalin-portal/.env.local.example

key-decisions:
  - "Service role admin client created inline in route handlers (not a shared factory) — avoids accidental client-side bundling"
  - "GET /api/admin/users merges profiles + auth.users (for email) + module_access and returns currentUserId in same response"
  - "Invite flow: service_role inviteUserByEmail + immediate role patch if role != viewer (trigger creates viewer profile)"
  - "Toggle switch implemented as <button> with CSS translate transform — no external component library needed"
  - "Admin cannot change own role: both enforced in API (403) and UI (disabled dropdown)"

# Metrics
duration: 15min
completed: 2026-03-05
---

# Phase 25 Plan 04: Admin Panel — API Routes + UI Summary

**Complete admin panel delivering user table with inline role dropdowns, module toggle switches, invite form, and four supporting API routes backed by Supabase service_role**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-03-05
- **Tasks:** 2 auto + 1 checkpoint (human-verify)
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- Schema migration adds `profiles_admin_update` RLS policy so admins can update any user's role
- GET `/api/admin/users`: fetches all profiles, merges auth.users emails via service_role admin client, combines with module_access records, returns merged list + currentUserId
- PATCH `/api/admin/users/[id]/role`: validates role, blocks self-role-change (403), updates profiles table
- PATCH `/api/admin/users/[id]/access`: upserts module_access with `onConflict: 'user_id,module'`
- POST `/api/admin/invite`: sends Supabase invite email via `inviteUserByEmail`, patches profile role if non-viewer
- Admin panel page (client component): user table with name, email, role dropdown, 5 module toggle switches, last login — all inline saving (no save button)
- Invite form: email + role select + submit — shows success/error inline, refreshes user list
- Self-lockout protection: own role dropdown is disabled with opacity-40 + title tooltip
- Toggle switch: `<button>` with `translate-x-5` / `translate-x-1` CSS — bg-soil-accent (on) vs bg-soil-border (off)
- SUPABASE_SERVICE_ROLE_KEY added to `.env.local.example` with location instructions

## Task Commits

Note: Bash access was unavailable for git operations. Files were created — commits must be staged manually or via next session.

1. **Task 1: Schema migration + admin API routes** — pending commit
   - `glomalin-portal/supabase/migrations/001-admin-write-policies.sql`
   - `glomalin-portal/src/app/api/admin/users/route.ts`
   - `glomalin-portal/src/app/api/admin/users/[id]/role/route.ts`
   - `glomalin-portal/src/app/api/admin/users/[id]/access/route.ts`
   - `glomalin-portal/src/app/api/admin/invite/route.ts`
   - `glomalin-portal/.env.local.example`

2. **Task 2: Admin panel page** — pending commit
   - `glomalin-portal/src/app/(protected)/admin/page.tsx`

## Files Created/Modified

- `glomalin-portal/supabase/migrations/001-admin-write-policies.sql` — RLS update policy for admin → profiles
- `glomalin-portal/src/app/api/admin/users/route.ts` — GET users list (profiles + emails + module access + currentUserId)
- `glomalin-portal/src/app/api/admin/users/[id]/role/route.ts` — PATCH role with self-lockout
- `glomalin-portal/src/app/api/admin/users/[id]/access/route.ts` — PATCH module access (upsert)
- `glomalin-portal/src/app/api/admin/invite/route.ts` — POST invite user via service_role
- `glomalin-portal/src/app/(protected)/admin/page.tsx` — Full admin panel page (client component, 270+ lines)
- `glomalin-portal/.env.local.example` — Added SUPABASE_SERVICE_ROLE_KEY with location instructions

## Decisions Made

- Service role admin client instantiated inline per request handler — not shared module — to prevent any path to client bundling
- GET response includes `currentUserId` so the page can disable the admin's own role dropdown without a separate fetch
- Toggle switch is a styled `<button>` using Tailwind translate utilities — no additional component dependencies
- Module access upserts use `{ onConflict: 'user_id,module' }` matching the unique constraint in schema.sql
- Invite: if role is not viewer, a profile patch runs after invite succeeds — handles the auto-trigger creating viewer default

## Deviations from Plan

None — plan executed exactly as written. The linter removed unused `NextRequest` import from `users/route.ts` GET handler (GET takes no request params), which is correct.

## User Setup Required

Before the admin panel works at runtime:

1. **`SUPABASE_SERVICE_ROLE_KEY`** — Add to `.env.local`:
   - Go to: Supabase Dashboard → Project Settings → API → service_role key (secret)
   - Copy the "secret" key (not the anon key)
   - Add to `glomalin-portal/.env.local`: `SUPABASE_SERVICE_ROLE_KEY=eyJ...`

2. **Apply migration** — Run in Supabase SQL Editor:
   - Copy contents of `glomalin-portal/supabase/migrations/001-admin-write-policies.sql`
   - Paste and run in: Supabase Dashboard → SQL Editor

## Next Phase Readiness

- Admin panel at /admin is complete — middleware from 25-02 already protects it
- Phase 26 can add the admin panel link in the header/sidebar for admin users
- All RBAC requirements complete: AUTH-01, AUTH-02, RBAC-01, RBAC-02, RBAC-03, RBAC-04

---
*Phase: 25-auth-middleware-route-protection*
*Completed: 2026-03-05*

## Self-Check

Files verified present (via Glob/Read tool — Bash unavailable for git hash verification):

- glomalin-portal/supabase/migrations/001-admin-write-policies.sql — FOUND
- glomalin-portal/src/app/api/admin/users/route.ts — FOUND
- glomalin-portal/src/app/api/admin/users/[id]/role/route.ts — FOUND
- glomalin-portal/src/app/api/admin/users/[id]/access/route.ts — FOUND
- glomalin-portal/src/app/api/admin/invite/route.ts — FOUND
- glomalin-portal/src/app/(protected)/admin/page.tsx — FOUND
- glomalin-portal/.env.local.example — FOUND (updated)

Commits: PENDING — Bash access was denied during execution. Files exist on disk; git commits need to be staged.
