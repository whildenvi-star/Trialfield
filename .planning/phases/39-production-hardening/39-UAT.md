---
status: testing
phase: 39-production-hardening
source: 39-01-SUMMARY.md
started: 2026-03-08T08:30:00Z
updated: 2026-03-08T08:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: grain-tickets /health endpoint
expected: |
  GET http://localhost:3000/health returns JSON: {"status":"ok","app":"grain-tickets","uptime":<number>}
awaiting: user response

## Tests

### 1. grain-tickets /health endpoint
expected: GET http://localhost:3000/health returns JSON with status "ok", app "grain-tickets", and uptime in seconds
result: [pending]

### 2. farm-budget /health endpoint
expected: GET http://localhost:3001/health returns JSON with status "ok", app "farm-budget", and uptime in seconds
result: [pending]

### 3. fsa-acres /health endpoint
expected: GET http://localhost:3002/health returns JSON with status "ok", app "fsa-acres", and uptime in seconds
result: [pending]

### 4. meristem-malt /health endpoint
expected: GET http://localhost:3003/health returns JSON with status "ok", app "meristem-malt", and uptime in seconds
result: [pending]

### 5. farm-registry /health endpoint
expected: GET http://localhost:3005/health returns JSON with status "ok", app "farm-registry", and uptime in seconds
result: [pending]

### 6. seed-inventory /health endpoint
expected: GET http://localhost:3006/health returns JSON with status "ok", app "seed-inventory", and uptime in seconds
result: [pending]

### 7. Aggregate health-check.sh script
expected: Running `bash scripts/health-check.sh` checks all 8 apps (6 Express + 2 Next.js) and shows colored pass/fail output for each
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
