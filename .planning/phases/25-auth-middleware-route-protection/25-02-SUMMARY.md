---
phase: 25-auth-middleware-route-protection
plan: 02
subsystem: auth
tags: [next.js, middleware, supabase, rbac, session, cookies]

# Dependency graph
requires:
  - phase: 25-01
    provides: login page, forgot-password page, and auth flow for redirects to land on

provides:
  - Next.js middleware at src/middleware.ts enforcing auth + role + module access on all routes
  - Supabase middleware client factory at src/lib/supabase/middleware.ts with cookie forwarding

affects:
  - 25-03 (admin panel routes protected by this middleware)
  - 26-01 (dashboard and module routes protected by this middleware)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase middleware client: createClient(NextRequest) returns { supabase, response } for session refresh"
    - "Cookie forwarding: setAll() updates both request.cookies and supabaseResponse.cookies to keep Server Components in sync"
    - "Expired session detection: check for sb- prefixed cookies before redirecting to flag ?expired=true"

key-files:
  created:
    - glomalin-portal/src/lib/supabase/middleware.ts
    - glomalin-portal/src/middleware.ts
  modified: []

key-decisions:
  - "Admin route denial is silent (redirect to /dashboard with no query param) — non-admins must not know the admin panel exists"
  - "Module access denial includes ?denied={moduleId} query param so dashboard can show a specific toast (naming the module)"
  - "Public routes checked inside middleware function, not in matcher config — matcher is broad, logic is explicit"
  - "Expired session detected via presence of sb- prefixed cookies combined with failed getUser() call"

patterns-established:
  - "Middleware client pattern: distinct from server.ts client — uses NextRequest/NextResponse not next/headers cookies()"
  - "RBAC enforcement order: auth check first, then admin check, then module check, then pass-through for other protected routes"

requirements-completed: [AUTH-02, RBAC-01, RBAC-02, RBAC-03]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 25 Plan 02: Auth + Middleware + Route Protection — Middleware Summary

**Next.js middleware enforcing Supabase auth, admin role protection, and per-module access control via profiles and module_access DB queries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T02:32:04Z
- **Completed:** 2026-03-05T02:34:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Supabase middleware client factory that correctly forwards refreshed session cookies via both request and response mutation
- Next.js middleware covering all routes with a broad matcher, filtering public routes in code for clarity
- Admin routes protected with silent redirect (no query params, no hints) for non-admin users
- Module routes check module_access table and redirect with ?denied={moduleId} for dashboard toast
- TypeScript compiles clean and Next.js build passes (middleware shows as 74.8 kB)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase middleware client factory** - `5a0185d` (feat)
2. **Task 2: Create Next.js middleware with auth + RBAC route protection** - `409f514` (feat)

## Files Created/Modified

- `glomalin-portal/src/lib/supabase/middleware.ts` - Supabase client factory for middleware context, accepts NextRequest, returns { supabase, response } with proper setAll() cookie forwarding
- `glomalin-portal/src/middleware.ts` - Route protection middleware: auth check, admin RBAC, module RBAC, public pass-through, expired session detection

## Decisions Made

- Admin route denial is silent (redirect to /dashboard with no query param) — per CONTEXT.md: "non-admins shouldn't even know the admin panel exists as a concept"
- Module access denial uses /dashboard?denied={moduleId} — dashboard in Plan 25-03 will use this to show a named toast
- Expired session detection: if Supabase session cookies (sb- prefix) exist but getUser() returns null, user's session expired vs never authed
- Public routes list maintained explicitly in code rather than relying on matcher patterns — more readable and easier to extend

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled clean on both files immediately, Next.js build succeeded on first attempt.

## User Setup Required

None - no external service configuration required for middleware itself. Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) must already be set from Phase 24.

## Next Phase Readiness

- Middleware is live and will enforce auth on all protected routes as soon as Supabase credentials are configured
- Plan 25-03 (admin panel) routes /admin/* will be protected automatically by this middleware
- Phase 26 dashboard (/dashboard) and module shells (/app/*) will be protected automatically
- The /login redirect target from middleware will work once Plan 25-01 login page exists at /login

---
*Phase: 25-auth-middleware-route-protection*
*Completed: 2026-03-05*

## Self-Check: PASSED

- glomalin-portal/src/lib/supabase/middleware.ts — FOUND
- glomalin-portal/src/middleware.ts — FOUND
- .planning/phases/25-auth-middleware-route-protection/25-02-SUMMARY.md — FOUND
- Commit 5a0185d (feat(25-02): create Supabase middleware client factory) — VERIFIED
- Commit 409f514 (feat(25-02): create Next.js middleware with auth + RBAC route protection) — VERIFIED
