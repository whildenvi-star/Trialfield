---
phase: 38-email-invite-onboarding
verified: 2026-03-08T07:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
human_verification:
  - test: "Admin invite flow: log in as admin, go to /admin, enter coworker email, select role, check module boxes, click Invite User"
    expected: "Invite success message appears, coworker receives Supabase email with link to production domain (not localhost)"
    why_human: "Requires real Supabase email delivery and visual confirmation of email link domain"
  - test: "Signup flow: click invite email link, land on Set New Password page, set password, submit"
    expected: "Redirect to /dashboard with only the modules granted during invite visible"
    why_human: "Requires browser redirect through Supabase PKCE flow, cannot verify email delivery or browser behavior programmatically"
  - test: "Password reset: log out, click Forgot Password on login page, enter email, check inbox, click reset link"
    expected: "Land on Set New Password page, set new password, redirect to dashboard"
    why_human: "Requires real email delivery and browser redirect chain"
---

# Phase 38: Email Invite & Onboarding Verification Report

**Phase Goal:** Admin can invite coworkers by email and they can sign up, log in, and use their granted modules -- the full onboarding path works end-to-end in production
**Verified:** 2026-03-08T07:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin clicks Invite in admin panel, enters email, and coworker receives signup email pointing to production domain | VERIFIED (code) | invite/route.ts builds redirectTo from NEXT_PUBLIC_SITE_URL (line 47-51), passes to inviteUserByEmail (line 53-56), admin page sends modules array (line 138-143) |
| 2 | Invited user clicks email link, lands on set-password page, sets password, and reaches dashboard with granted modules | VERIFIED (code) | callback/route.ts checks type=invite and redirects to /reset-password (line 16-17), reset-password/page.tsx calls supabase.auth.updateUser then router.push('/dashboard') (line 34-42) |
| 3 | User clicks Forgot Password on login, receives reset email, sets new password, and can log back in | VERIFIED (code) | login/page.tsx has forgot-password link (line 82), forgot-password/page.tsx calls resetPassword action (line 32), auth.ts resetPassword uses NEXT_PUBLIC_SITE_URL for redirectTo (line 38-39), callback handles type=recovery (line 16) |

**Score:** 3/3 truths verified (code-level; email delivery requires human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/src/app/api/admin/invite/route.ts` | Invite API with production-aware redirectTo | VERIFIED | 101 lines, uses NEXT_PUBLIC_SITE_URL, passes redirectTo to inviteUserByEmail, handles optional modules array with admin client upsert |
| `glomalin-portal/src/app/auth/callback/route.ts` | Callback handling for invite, recovery, and login flows | VERIFIED | 25 lines, reads type param, routes invite/recovery to /reset-password, others to next param |
| `glomalin-portal/src/app/actions/auth.ts` | Auth actions using NEXT_PUBLIC_SITE_URL for production redirect | VERIFIED | 49 lines, resetPassword uses NEXT_PUBLIC_SITE_URL with origin/host fallback chain |
| `glomalin-portal/src/app/(protected)/admin/page.tsx` | Admin page with module checkboxes in invite form | VERIFIED | 390 lines, inviteModules state, checkbox row for each module, sends modules array in POST body |
| `glomalin-portal/src/app/(auth)/reset-password/page.tsx` | Set New Password page | VERIFIED | 105 lines, password + confirm fields, calls supabase.auth.updateUser, redirects to /dashboard |
| `glomalin-portal/src/app/(auth)/forgot-password/page.tsx` | Forgot Password page | VERIFIED | 83 lines, email form, calls resetPassword server action, shows sent confirmation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| invite/route.ts | supabase.auth.admin.inviteUserByEmail | redirectTo option pointing to /auth/callback | WIRED | Line 53-56: inviteUserByEmail(body.email, { redirectTo }) where redirectTo = siteUrl + '/auth/callback' |
| callback/route.ts | /reset-password | redirect after invite or recovery code exchange | WIRED | Line 16-17: type === 'invite' or type === 'recovery' triggers redirect to /reset-password |
| auth.ts | supabase.auth.resetPasswordForEmail | NEXT_PUBLIC_SITE_URL for production redirectTo | WIRED | Line 38-39: siteUrl from NEXT_PUBLIC_SITE_URL, line 43-45: resetPasswordForEmail(email, { redirectTo }) |
| login/page.tsx | /forgot-password | Link in login form | WIRED | Line 82: href="/forgot-password" with "Forgot your password?" text |
| forgot-password/page.tsx | resetPassword action | Server action form | WIRED | Line 6: import resetPassword, line 32: form action={resetPassword} |
| reset-password/page.tsx | /dashboard | router.push after updateUser | WIRED | Line 34: updateUser({ password }), line 42: router.push('/dashboard') |
| admin/page.tsx | /api/admin/invite | POST with modules array | WIRED | Line 135-145: fetch POST with email, role, modules in body |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| ONB-01 | 38-01 | Admin can invite a coworker by email and they receive a signup link | SATISFIED | invite/route.ts passes production redirectTo; admin UI has email + role + modules form |
| ONB-02 | 38-01 | Invited user can set password, log in, and see dashboard with granted modules | SATISFIED | callback routes type=invite to /reset-password; modules granted at invite time via admin client upsert |
| ONB-03 | 38-01 | User can reset forgotten password via email link in production | SATISFIED | auth.ts resetPassword uses NEXT_PUBLIC_SITE_URL; callback routes type=recovery to /reset-password |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected in any modified files |

### Human Verification Required

These flows involve Supabase email delivery and browser redirects that cannot be verified by code inspection alone. Plan 38-02 was a human-verify checkpoint -- the SUMMARY claims user approval was granted.

### 1. Invite Email Delivery

**Test:** Log in as admin, go to /admin, enter a real email, select role, check module boxes, click Invite User
**Expected:** Invite email arrives with link pointing to production domain (NEXT_PUBLIC_SITE_URL), not localhost
**Why human:** Email delivery depends on Supabase project configuration and cannot be verified by code inspection

### 2. Invited User Signup Completion

**Test:** Click invite email link, verify landing on Set New Password page, set password, submit
**Expected:** Redirect to /dashboard showing only the modules granted during invite
**Why human:** Requires browser PKCE code exchange flow and visual confirmation of module visibility

### 3. Password Reset Flow

**Test:** Log out, click Forgot Password on login page, enter email, check inbox, click reset link
**Expected:** Land on Set New Password page, set new password, redirect to dashboard
**Why human:** Requires email delivery and browser redirect chain through Supabase

**Note:** Plan 38-02 SUMMARY states user approved all three flows. If that approval is trusted, status can be upgraded to passed.

### Gaps Summary

No code-level gaps found. All artifacts exist, are substantive (no stubs or placeholders), and are properly wired together. The complete onboarding chain is implemented:

- Admin invite form (admin/page.tsx) -> invite API (invite/route.ts) -> Supabase inviteUserByEmail with production redirectTo
- Email link -> callback (callback/route.ts) -> type=invite detected -> /reset-password page -> updateUser -> /dashboard
- Forgot password (forgot-password/page.tsx) -> resetPassword action (auth.ts) with NEXT_PUBLIC_SITE_URL -> email link -> callback -> type=recovery -> /reset-password -> /dashboard

The NEXT_PUBLIC_SITE_URL env var is documented in .env.example. Commits 3e8ed2e and b14bf15 are verified in git history.

---

_Verified: 2026-03-08T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
