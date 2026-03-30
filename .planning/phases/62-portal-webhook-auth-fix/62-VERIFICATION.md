---
phase: 62-portal-webhook-auth-fix
verified: 2026-03-29T21:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 62: Portal Webhook Auth Fix — Verification Report

**Phase Goal:** Restore end-to-end auto field propagation to the portal in production by appending the embed token to the portal webhook URL and setting the correct PORTAL_URL env var — fixing the 403 that blocks CLU record creation.
**Verified:** 2026-03-29
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `propagateField()` appends `?token=<EMBED_TOKEN>` to portal webhook URL | VERIFIED | `server.js` line 60: `PORTAL_URL + '/api/fsa/webhook/field-created' + tokenQuery` — matches farm-budget (line 41) and grain-tickets (line 51) exactly |
| 2  | `farm-registry/.env` contains `PORTAL_URL=https://portal.whughesfarms.com` | VERIFIED | Line 4 of `.env` confirmed; also line 22 of server.js reads `process.env.PORTAL_URL \|\| 'http://localhost:3010'` |
| 3  | `glomalin-portal/.env.local` contains `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com` | VERIFIED | Line 21 of `.env.local` confirmed; `marketing/page.tsx` line 138 consumes it via `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'` |
| 4  | E2E: portal webhook endpoint exists, auth-checks token, inserts clu_records row with registry_field_id | VERIFIED | `/api/fsa/webhook/field-created/route.ts` exists at 94 lines — full implementation: token check (lines 17-24), body parse, Supabase service-role insert with `registry_field_id`, duplicate guard, 201 on success |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `farm-registry/server.js` | `propagateField()` with `tokenQuery` on all three targets | VERIFIED | Line 60 contains `+ tokenQuery`. Committed at 0664fd7. |
| `farm-registry/.env` | `PORTAL_URL=https://portal.whughesfarms.com` | VERIFIED | Line 4 confirmed. Committed at 25f408c. |
| `glomalin-portal/.env.local` | `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com` | VERIFIED | Line 21 confirmed. Gitignored — must be synced to VPS manually at deploy time. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `farm-registry/server.js propagateField()` | `glomalin-portal /api/fsa/webhook/field-created` | `fetch` with `?token=` query param | WIRED | `PORTAL_URL + '/api/fsa/webhook/field-created' + tokenQuery` at line 60; PORTAL_URL resolves to `https://portal.whughesfarms.com` from `.env` |
| `glomalin-portal/src/app/(protected)/app/marketing/page.tsx` | `/api/marketing/cbot-prices` | `NEXT_PUBLIC_APP_URL` env var | WIRED | `page.tsx` line 138: `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010'`; var present in `.env.local` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTO-01 | 62-01-PLAN.md | Adding a field in farm-registry auto-creates corresponding records in portal | SATISFIED | `propagateField()` fires POST to portal webhook with `tokenQuery`; webhook endpoint creates `clu_records` row |
| AUTO-02 | 62-01-PLAN.md | Downstream records have correct `registry_field_id` for future syncs | SATISFIED | Webhook body includes `registry_field_id: field.id`; `route.ts` inserts it directly into `clu_records` |

REQUIREMENTS.md cross-reference: Both AUTO-01 and AUTO-02 are listed as `Phase 62 / Complete` in the coverage table. No orphaned phase-62 requirements found.

---

### Anti-Patterns Found

None. No TODOs, stubs, empty handlers, or placeholder returns found in any file modified by this phase.

---

### Human Verification Required

1. **Production smoke test — VPS deploy**

   **Test:** Deploy updated `farm-registry/.env` and `glomalin-portal/.env.local` to VPS, add a new field via farm-registry admin UI, wait ~2 seconds, open Supabase clu_records table.
   **Expected:** A new row appears with `field_name`, `registry_field_id`, and `fsa_acres` matching the field just created. No 403 in farm-registry propagation log.
   **Why human:** The `.env.local` file is gitignored and requires manual scp/rsync to VPS. The E2E test requires both servers running in production against the live Supabase instance — cannot verify programmatically from local codebase inspection.

---

### Gaps Summary

No gaps. All three code/config changes from the plan are present and substantive:

- `server.js` line 60 appends `tokenQuery` to the portal target, symmetric with the other two targets.
- `farm-registry/.env` has `PORTAL_URL=https://portal.whughesfarms.com` — production routing corrected.
- `glomalin-portal/.env.local` has `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com` — bonus MKT-02 fix included.

The webhook receiver (`route.ts`) is a full, non-stub implementation with token auth, duplicate guard, service-role Supabase insert, and correct `registry_field_id` storage. Both commits (0664fd7, 25f408c) are confirmed in git history with correct file diffs.

The one remaining item (VPS deploy of env files) is an operational step outside the scope of code verification.

---

_Verified: 2026-03-29_
_Verifier: Claude (gsd-verifier)_
