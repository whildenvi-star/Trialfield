---
phase: 25-auth-middleware-route-protection
plan: 01
subsystem: auth
tags: [supabase, next-auth, server-actions, login, password-reset, tailwind, dark-soil]

# Dependency graph
requires:
  - phase: 24-scaffold-supabase-foundation
    provides: createClient() server/browser helpers, dark soil Tailwind tokens, globals.css body styling
provides:
  - Login page at /login with centered card, email+password fields, error/expiry banners
  - Forgot password page at /forgot-password with Supabase resetPasswordForEmail
  - Server actions: login (signInWithPassword), logout (signOut), resetPassword (resetPasswordForEmail)
  - Auth route group layout (auth) that centers content on full viewport
affects: [25-02-middleware, 25-03-rbac, 25-04-admin-panel, 26-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'use server' server actions for auth mutations (login/logout/resetPassword)"
    - "redirect() called outside try/catch to avoid redirect-as-exception issues"
    - "revalidatePath('/', 'layout') before redirect on login/logout to clear cached data"
    - "'use client' + Suspense wrapper for useSearchParams() in Next.js 14 App Router"
    - "Generic error messages — no credential field hints to prevent user enumeration"
    - "Auth route group (auth) with shared layout for centering"

key-files:
  created:
    - glomalin-portal/src/app/actions/auth.ts
    - glomalin-portal/src/app/(auth)/layout.tsx
    - glomalin-portal/src/app/(auth)/login/page.tsx
    - glomalin-portal/src/app/(auth)/forgot-password/page.tsx
  modified: []

key-decisions:
  - "Generic error banner on login — does not reveal which field failed (per CONTEXT.md security decision)"
  - "Suspense wrapper required around useSearchParams() components in Next.js 14 to avoid static rendering issues"
  - "resetPassword uses dynamic origin from request headers for redirectTo URL — works in both local dev and production"
  - "Forgot password confirmation is deliberately vague: 'If an account exists...' — prevents email enumeration"

patterns-established:
  - "Auth route group: (auth)/layout.tsx centers all auth pages without affecting root layout"
  - "Server actions pattern: 'use server' at top of file, import createClient from @/lib/supabase/server"
  - "Error routing pattern: redirect to same page with ?error= or ?sent= query params, client reads via useSearchParams"

requirements-completed: [AUTH-01]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 25 Plan 01: Login Page and Auth Server Actions Summary

**Email+password login flow with Supabase signInWithPassword, server actions for login/logout/resetPassword, centered dark soil card UI at /login and /forgot-password**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T02:32:04Z
- **Completed:** 2026-03-05T02:33:59Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments
- Auth server actions file with login, logout, and resetPassword using Supabase SSR client
- Login page with dark soil card aesthetic, error/expiry banners, and GLOMALIN branding
- Forgot password page with success banner and deliberately vague confirmation message
- Auth route group layout that centers all auth pages on the full viewport
- Next.js build passes cleanly: all 4 routes generate successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth server actions (login, logout, password reset)** - `9e88d64` (feat)
2. **Task 2: Create login page, forgot password page, and auth layout** - `2e0bad6` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `glomalin-portal/src/app/actions/auth.ts` - Server actions: login (signInWithPassword → /dashboard), logout (signOut → /login), resetPassword (resetPasswordForEmail → /forgot-password?sent=true)
- `glomalin-portal/src/app/(auth)/layout.tsx` - Centering layout wrapping all (auth) route group pages
- `glomalin-portal/src/app/(auth)/login/page.tsx` - Login card with branding, email+password fields, error/expiry banners, forgot password link
- `glomalin-portal/src/app/(auth)/forgot-password/page.tsx` - Password reset form with success banner and back-to-login link

## Decisions Made
- Used Suspense wrapper around useSearchParams() components — required in Next.js 14 App Router to prevent static rendering errors at build time
- resetPassword reads origin from request headers dynamically rather than hardcoding, enabling correct redirectTo in both dev and production
- Generic error messaging preserved throughout — login error says "Invalid email or password" (not "wrong password" or "no account found"), forgot password says "If an account exists..." — consistent with CONTEXT.md security decisions

## Deviations from Plan

None — plan executed exactly as written. One implementation detail added beyond the plan spec: wrapped both client components in Suspense boundaries (required by Next.js 14 for useSearchParams() in pages that need to be statically renderable). This is a Next.js requirement, not scope creep.

## Issues Encountered
None — TypeScript compiled cleanly, Next.js build succeeded on first attempt.

## User Setup Required
None — no external service configuration required for this plan. Auth actions will require Supabase credentials in .env.local (already scoped to Phase 24 setup).

## Next Phase Readiness
- Login and forgot password pages are fully built and styled
- Server actions are ready for middleware and route protection to connect to
- Phase 25 Plan 02 (middleware + route protection) can now redirect unauthenticated users to /login
- Phase 25 Plan 03 (RBAC) can use the auth actions as the auth foundation

---
*Phase: 25-auth-middleware-route-protection*
*Completed: 2026-03-05*
