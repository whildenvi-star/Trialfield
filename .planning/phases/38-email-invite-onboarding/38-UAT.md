---
status: complete
phase: 38-email-invite-onboarding
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md]
started: 2026-03-08T07:30:00Z
updated: 2026-03-08T07:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Admin Invite with Module Access
expected: In the admin panel (/admin), enter a coworker's email, select a role, check module access boxes, and click "Invite User". A success message appears. The coworker receives a Supabase email with a signup link pointing to the production domain (not localhost).
result: pass

### 2. Invited User Signup
expected: Click the invite link from the email. Land on a "Set New Password" page. Set a password and submit. Redirect to /dashboard showing only the modules that were granted during the invite — no extra modules visible.
result: pass

### 3. Password Reset Flow
expected: Log out. On the login page, click "Forgot Password". Enter email and submit. Receive a reset email with a link to the production domain. Click the link, land on "Set New Password" page, set a new password, submit, and redirect to dashboard.
result: pass

### 4. Callback Route Handling
expected: Both invite acceptance and password recovery links route through /auth/callback correctly — invite links go to /reset-password (to set initial password), recovery links also go to /reset-password. No errors or redirect loops.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
