---
phase: 35-vps-provisioning-process-management
verified: 2026-03-07T05:10:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 35: VPS Provisioning + Process Management Verification Report

**Phase Goal:** All 8 apps start, restart on crash, and run in production mode from a single PM2 ecosystem config with CORS locked to the portal domain
**Verified:** 2026-03-07T05:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running pm2 start ecosystem.config.js launches all 8 apps and they stay up | VERIFIED | ecosystem.config.js has 8 apps, all with autorestart:true, max_restarts:10, unique ports 3000-3007, NODE_ENV:production. Validated programmatically: 8 apps, 8 unique ports. |
| 2 | Each app has a .env.example file with every required variable documented | VERIFIED | All 8 .env.example files exist: grain-tickets, farm-budget, fsa-acres, meristem-malt, farm-registry, seed-inventory, glomalin-portal, organic-cert. Spot-checked: glomalin-portal has NEXT_PUBLIC_SUPABASE vars, organic-cert has DATABASE_URL, grain-tickets has PORTAL_ORIGIN. |
| 3 | grain-tickets starts on configurable PORT (not hardcoded 3000) | VERIFIED | grain-tickets/server.js line 47: `const PORT = process.env.PORT \|\| 3007`. ecosystem.config.js sets PORT:3007. |
| 4 | Both Next.js apps run via next start in production mode | VERIFIED | glomalin-portal/package.json: "start": "next start", "prod": "next build && next start". organic-cert/package.json: "start": "next start -p 3004", "prod": "next build && next start -p 3004". ecosystem.config.js uses script: node_modules/.bin/next, args: "start" (portal) and "start -p 3004" (organic-cert). |
| 5 | Express apps reject cross-origin requests from domains other than portal origin | VERIFIED | All 6 Express server.js files contain corsOptions with `origin: process.env.PORTAL_ORIGIN \|\| 'http://localhost:3000'` and `app.use(cors(corsOptions))`. cors dependency added to package.json for grain-tickets, farm-budget, fsa-acres, meristem-malt. farm-registry and seed-inventory already had cors. |
| 6 | CORS origin controlled by single PORTAL_ORIGIN env var, not hardcoded | VERIFIED | All 6 Express apps read `process.env.PORTAL_ORIGIN` with localhost fallback for dev. .env.example files document PORTAL_ORIGIN=https://portal.farm.example.com using the placeholder domain per user decision. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ecosystem.config.js` | PM2 config for all 8 apps | VERIFIED | 163 lines, 8 apps, unique ports, auto-restart, production NODE_ENV, well-documented header with port map and deploy workflow |
| `grain-tickets/server.js` | CORS lockdown + port 3007 | VERIFIED | Contains PORTAL_ORIGIN cors config and PORT default 3007 |
| `farm-budget/server.js` | CORS lockdown | VERIFIED | Contains `const cors = require('cors')` and PORTAL_ORIGIN corsOptions |
| `fsa-acres/server.js` | CORS lockdown | VERIFIED | Contains PORTAL_ORIGIN corsOptions with cors middleware |
| `meristem-malt/server.js` | CORS lockdown | VERIFIED | Contains PORTAL_ORIGIN corsOptions with cors middleware |
| `farm-registry/server.js` | CORS lockdown (replaces open cors()) | VERIFIED | Contains PORTAL_ORIGIN corsOptions (replaced previously open cors()) |
| `seed-inventory/server.js` | CORS lockdown (replaces open cors()) | VERIFIED | Contains PORTAL_ORIGIN corsOptions (replaced previously open cors()) |
| `glomalin-portal/.env.example` | Documented env template | VERIFIED | Contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `organic-cert/.env.example` | Documented env template | VERIFIED | Contains DATABASE_URL |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ecosystem.config.js | glomalin-portal/package.json | script reference to next start | WIRED | ecosystem uses `node_modules/.bin/next` with args `start`; package.json has `"start": "next start"` |
| ecosystem.config.js | organic-cert/package.json | script reference to next start with port | WIRED | ecosystem uses args `start -p 3004`; package.json has `"start": "next start -p 3004"` |
| grain-tickets/server.js | PORTAL_ORIGIN env var | cors middleware origin config | WIRED | `origin: process.env.PORTAL_ORIGIN \|\| 'http://localhost:3000'` with `app.use(cors(corsOptions))` |
| farm-budget/server.js | PORTAL_ORIGIN env var | cors middleware origin config | WIRED | Same pattern as grain-tickets |
| farm-registry/server.js | PORTAL_ORIGIN env var | cors middleware origin config | WIRED | Same pattern, replaced open cors() |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 35-01 | All 8 apps run under PM2 with auto-restart in single ecosystem config | SATISFIED | ecosystem.config.js validated: 8 apps, unique ports, autorestart:true |
| INFRA-03 | 35-02 | Production .env templates exist for every app with documented placeholder values | SATISFIED | All 8 .env.example files exist with documented variables and farm.example.com placeholders |
| INFRA-05 | 35-02 | grain-tickets port configurable via PORT env var | SATISFIED | `process.env.PORT \|\| 3007` in server.js; PORT in .env.example |
| INFRA-06 | 35-01 | Both Next.js apps build and start in production mode | SATISFIED | build + start + prod scripts in both package.json files; ecosystem.config.js uses next start |
| SEC-01 | 35-02 | All Express apps restrict CORS to portal domain only | SATISFIED | All 6 Express apps use PORTAL_ORIGIN-driven corsOptions |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| farm-budget/server.js | 973 | TODO comment about delivery window | Info | Pre-existing, unrelated to phase 35 |

No blocker or warning-level anti-patterns found in phase 35 deliverables.

### Human Verification Required

### 1. PM2 Process Startup

**Test:** Run `pm2 start ecosystem.config.js` on the VPS and verify `pm2 status` shows all 8 apps as "online"
**Expected:** All 8 apps listed with status "online", correct ports, no error logs
**Why human:** Requires actual PM2 installation and running processes; cannot be verified by static analysis

### 2. CORS Rejection

**Test:** From a browser console on a non-portal domain, attempt `fetch('http://vps-ip:3007/api/data')` and verify CORS error
**Expected:** Browser rejects the request with CORS policy error
**Why human:** Requires running Express apps and making actual cross-origin requests

### 3. Next.js Production Build

**Test:** Run `npm run build` in glomalin-portal/ and organic-cert/, then verify `npm start` serves production bundles
**Expected:** Both apps build without errors and serve on their assigned ports (3000 and 3004)
**Why human:** Requires actual build execution with all dependencies installed

### Gaps Summary

No gaps found. All 6 observable truths verified, all 9 artifacts pass existence + substantive + wiring checks, all 5 key links confirmed wired, and all 5 requirement IDs (INFRA-01, INFRA-03, INFRA-05, INFRA-06, SEC-01) are satisfied. No orphaned requirements detected.

The phase goal -- "All 8 apps start, restart on crash, and run in production mode from a single PM2 ecosystem config with CORS locked to the portal domain" -- is achieved at the configuration/code level. Runtime verification (human items above) requires actual deployment.

---

_Verified: 2026-03-07T05:10:00Z_
_Verifier: Claude (gsd-verifier)_
