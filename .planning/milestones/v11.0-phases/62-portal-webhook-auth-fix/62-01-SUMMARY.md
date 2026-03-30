---
phase: 62-portal-webhook-auth-fix
plan: 01
subsystem: farm-registry, glomalin-portal
tags: [webhook, auth, env-config, propagation, fix]
dependency_graph:
  requires: [61-02]
  provides: [AUTO-01-production, AUTO-02-production]
  affects: [farm-registry/server.js, farm-registry/.env, glomalin-portal/.env.local]
tech_stack:
  added: []
  patterns: [tokenQuery symmetric across all propagation targets, env var for webhook base URL]
key_files:
  modified:
    - farm-registry/server.js
    - farm-registry/.env
    - glomalin-portal/.env.local
decisions:
  - propagateField() portal target now appends tokenQuery — symmetric with farm-budget and grain-tickets
  - PORTAL_URL and PORTAL_ORIGIN coexist in farm-registry/.env — CORS origin check vs fetch base URL are different code paths
  - glomalin-portal/.env.local is gitignored — NEXT_PUBLIC_APP_URL must be applied on VPS directly
metrics:
  duration: "1 minute"
  completed: "2026-03-30"
  tasks: 2
  files_modified: 3
---

# Phase 62 Plan 01: Portal Webhook Auth Fix Summary

One-liner: Appended `?token=` query param to portal propagation target and added production `PORTAL_URL` env var, fixing silent 403 failures on every field-add from farm-registry in production.

## What Was Done

Fixed the two-gap failure mode that caused CLU placeholder creation (AUTO-01/AUTO-02) to work only in local dev, not production.

**Gap 1 (code):** `propagateField()` in `farm-registry/server.js` was not appending `tokenQuery` to the portal webhook URL. The webhook at `/api/fsa/webhook/field-created` checks `searchParams.get('token')` against `EMBED_TOKEN` and returns 403 when the param is absent. Farm-budget and grain-tickets targets already used `tokenQuery` — portal was missing it.

**Gap 2 (env):** `farm-registry/.env` was missing `PORTAL_URL`, so `propagateField()` always fetched from `http://localhost:3010` (the fallback default), which is unreachable from VPS production. Adding `PORTAL_URL=https://portal.whughesfarms.com` routes the webhook call to the correct host.

**Bonus fix (env):** `glomalin-portal/.env.local` was missing `NEXT_PUBLIC_APP_URL`, causing `marketing/page.tsx` SSR self-fetch to fall back to `http://localhost:3010` in production. Added `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com` to fix CBOT price degradation flagged in v11.0 audit (MKT-02).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Append tokenQuery to portal target in propagateField() | 0664fd7 | farm-registry/server.js |
| 2 | Add PORTAL_URL and NEXT_PUBLIC_APP_URL env vars | 25f408c | farm-registry/.env, glomalin-portal/.env.local |

## Verification Results

All three plan checks passed:
1. `grep "webhook/field-created.*tokenQuery" farm-registry/server.js` — line 60 confirmed
2. `grep "^PORTAL_URL=" farm-registry/.env` — `PORTAL_URL=https://portal.whughesfarms.com` confirmed
3. `grep "^NEXT_PUBLIC_APP_URL=" glomalin-portal/.env.local` — `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com` confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Notes

`glomalin-portal/.env.local` is gitignored — the `NEXT_PUBLIC_APP_URL` line is present locally and must be synced to the VPS manually (scp/rsync as part of normal deploy). The farm-registry `.env` was untracked (new file committed for the first time in this plan).

## Self-Check: PASSED

- `farm-registry/server.js` — FOUND, line 60 contains `+ tokenQuery`
- `farm-registry/.env` — FOUND, `PORTAL_URL=https://portal.whughesfarms.com`
- `glomalin-portal/.env.local` — FOUND, `NEXT_PUBLIC_APP_URL=https://portal.whughesfarms.com`
- Commit 0664fd7 — FOUND
- Commit 25f408c — FOUND
