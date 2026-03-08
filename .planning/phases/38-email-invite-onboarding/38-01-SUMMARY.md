---
phase: 38-email-invite-onboarding
plan: 01
subsystem: auth
tags: [supabase, invite, password-reset, rbac, next.js]

requires:
  - phase: 25-auth-middleware-route-protection
    provides: Auth callback route, middleware, admin panel
provides:
  - Production-aware invite emails via NEXT_PUBLIC_SITE_URL redirectTo
  - Callback route handling for invite and recovery token types
  - Module access granting at invite time
  - Production-aware password reset emails
affects: [38-02, deployment, team-onboarding]

tech-stack:
  added: []
  patterns: [NEXT_PUBLIC_SITE_URL fallback chain for production redirect URLs]

key-files:
  created: []
  modified:
    - glomalin-portal/src/app/api/admin/invite/route.ts
    - glomalin-portal/src/app/auth/callback/route.ts
    - glomalin-portal/src/app/actions/auth.ts
    - glomalin-portal/src/app/(protected)/admin/page.tsx

key-decisions:
  - "NEXT_PUBLIC_SITE_URL with origin fallback for all email redirect URLs"
  - "URL type param (not session.recovery_sent_at) to detect invite vs recovery flows"
  - "Admin client (not per-user client) for module_access inserts to bypass RLS"

patterns-established:
  - "Site URL resolution: NEXT_PUBLIC_SITE_URL || origin header || localhost fallback"
  - "Callback type routing: type=invite|recovery -> /reset-password, else -> /dashboard"

requirements-completed: [ONB-01, ONB-02, ONB-03]

duration: 2min
completed: 2026-03-08
---

# Phase 38 Plan 01: Email Invite & Onboarding Summary

**Production-aware invite/recovery email redirects via NEXT_PUBLIC_SITE_URL with module access granting at invite time**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T06:45:59Z
- **Completed:** 2026-03-08T06:47:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Invite emails now link to production domain (not localhost) using NEXT_PUBLIC_SITE_URL
- Auth callback handles both invite acceptance and password recovery via URL type param
- Admin can grant module access during invite (checkboxes in invite form)
- Password reset emails also use production-aware redirect URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Add production redirectTo to invite API and fix callback for invite tokens** - `3e8ed2e` (feat)
2. **Task 2: Update resetPassword action to use NEXT_PUBLIC_SITE_URL and add invite modules to admin UI** - `b14bf15` (feat)

## Files Created/Modified
- `glomalin-portal/src/app/api/admin/invite/route.ts` - Added redirectTo option and optional modules array to invite API
- `glomalin-portal/src/app/auth/callback/route.ts` - Simplified to use type param for invite/recovery routing
- `glomalin-portal/src/app/actions/auth.ts` - Updated resetPassword to use NEXT_PUBLIC_SITE_URL
- `glomalin-portal/src/app/(protected)/admin/page.tsx` - Added module access checkboxes to invite form

## Decisions Made
- Used NEXT_PUBLIC_SITE_URL with origin header fallback for all email redirect URLs (consistent across invite, recovery, and reset flows)
- Switched callback from session.recovery_sent_at check to URL type param (more reliable with PKCE flow)
- Used admin Supabase client for module_access inserts to bypass RLS (new user has no session yet)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - NEXT_PUBLIC_SITE_URL is already documented in .env.example. Set it to the production domain when deploying.

## Next Phase Readiness
- All three onboarding flows (invite, signup completion, password reset) are production-ready
- Admin can now invite users with pre-granted module access in a single step
- Ready for 38-02 (if applicable) or phase 39

---
*Phase: 38-email-invite-onboarding*
*Completed: 2026-03-08*
