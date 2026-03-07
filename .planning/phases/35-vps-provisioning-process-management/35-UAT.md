---
status: complete
phase: 35-vps-provisioning-process-management
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md
started: 2026-03-07T05:00:00Z
updated: 2026-03-07T05:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. PM2 Ecosystem Config Exists
expected: ecosystem.config.js exists at repo root with 8 apps configured (ports 3000-3007), each with name, script, cwd, port env, and memory limits (512M for Next.js, 256M for Express)
result: pass

### 2. Grain-Tickets Port Changed to 3007
expected: grain-tickets/server.js uses port 3007 (not 3000). Running `grep -i port grain-tickets/server.js` shows 3007 as default.
result: pass

### 3. Next.js Production Scripts
expected: glomalin-portal/package.json and organic-cert/package.json each have a "prod" convenience script. organic-cert start script uses -p 3004.
result: pass

### 4. CORS Lockdown on Express Apps
expected: All 6 Express server.js files (grain-tickets, farm-budget, fsa-acres, meristem-malt, farm-registry, seed-inventory) use PORTAL_ORIGIN env var for CORS origin restriction. Default fallback is http://localhost:3000.
result: pass

### 5. Env Example Templates
expected: All 8 apps have .env.example files with documented section headers and placeholder values. Check that grain-tickets/.env.example, farm-budget/.env.example, glomalin-portal/.env.example (and 5 others) exist.
result: pass

### 6. Portal Embed URL Updated
expected: glomalin-portal references grain-tickets at port 3007 (not 3000) in its embed/iframe configuration or .env.example.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
