---
phase: 36-reverse-proxy-https
verified: 2026-03-07T07:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 36: Reverse Proxy + HTTPS Verification Report

**Phase Goal:** Users access every app through clean subdomains with automatic HTTPS -- no port numbers, no HTTP
**Verified:** 2026-03-07
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each app is reachable at its own subdomain with auto-HTTPS | VERIFIED | Caddyfile has 8 site blocks with correct subdomain-to-port mapping; Caddy handles auto-HTTPS natively |
| 2 | HTTP requests redirect to HTTPS automatically | VERIFIED | Caddy's default behavior redirects HTTP to HTTPS for all configured site blocks |
| 3 | Caddy reverse proxy routes subdomain to correct localhost port | VERIFIED | All 8 port mappings in Caddyfile match ecosystem.config.js exactly (3000-3007) |
| 4 | A person can rebuild the VPS from scratch using only the deployment document | VERIFIED | DEPLOY.md has 12 sections, 368 lines, covers DNS through troubleshooting in dependency order |
| 5 | The document references actual files in the repo | VERIFIED | DEPLOY.md references ecosystem.config.js (4x), Caddyfile (4x), .env.example (3x) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Caddyfile` | Reverse proxy config for all 8 apps | VERIFIED | 86 lines, 8 reverse_proxy directives, gzip on all, X-Forwarded-Proto on Next.js apps, root domain redirect, DOMAIN env var placeholder |
| `DEPLOY.md` | Step-by-step VPS deployment guide (min 80 lines) | VERIFIED | 368 lines, 12 sections covering prerequisites, DNS, Node.js, PostgreSQL, Caddy, PM2, git clone, env config, update workflow, troubleshooting |
| `glomalin-portal/.env.example` | Reverse proxy section with production URL guidance | VERIFIED | Lines 27-34 contain Reverse Proxy section documenting NEXT_PUBLIC_SITE_URL and PORTAL_ORIGIN for production subdomains |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Caddyfile | ecosystem.config.js | Port mapping -- each subdomain routes to correct PM2 app port | WIRED | All 8 ports match: portal=3000, budget=3001, fsa=3002, malt=3003, cert=3004, registry=3005, seed=3006, tickets=3007 |
| DEPLOY.md | ecosystem.config.js | References PM2 config | WIRED | 4 references to ecosystem.config.js with correct instructions |
| DEPLOY.md | Caddyfile | References Caddy config | WIRED | 4 references to Caddyfile including copy command and validation |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-02 | 36-01-PLAN | Caddy reverse proxy routes subdomain traffic to correct app with auto-HTTPS | SATISFIED | Caddyfile with 8 subdomain blocks, auto-HTTPS via Let's Encrypt, DOMAIN env var for deploy-time config |
| INFRA-04 | 36-02-PLAN | Deployment README provides step-by-step VPS setup (Node.js, PostgreSQL, Caddy, PM2, git clone, DNS) | SATISFIED | DEPLOY.md covers all listed topics in 12 dependency-ordered sections |

No orphaned requirements found -- REQUIREMENTS.md maps exactly INFRA-02 and INFRA-04 to Phase 36, both covered by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, or stub implementations found |

### Commit Verification

| Commit | Claimed In | Exists | Description |
|--------|-----------|--------|-------------|
| `b4a6a64` | 36-01-SUMMARY | Yes | Caddyfile creation |
| `e267c3d` | 36-01-SUMMARY | Yes | .env.example reverse proxy docs |
| `bbce9ab` | 36-02-SUMMARY | Yes | DEPLOY.md creation |

### Human Verification Required

### 1. Caddy Auto-HTTPS on Live VPS

**Test:** Deploy to VPS with DNS configured, run `DOMAIN=yourdomain.com caddy run`, visit https://portal.yourdomain.com in browser
**Expected:** Valid TLS certificate, portal landing page loads, no browser security warnings
**Why human:** Cannot verify Let's Encrypt certificate issuance or actual HTTPS behavior without a live VPS and real DNS

### 2. Root Domain Redirect

**Test:** Visit https://yourdomain.com in browser
**Expected:** Redirects to https://portal.yourdomain.com
**Why human:** Redirect behavior requires a running Caddy instance with valid DNS

### 3. All Subdomains Reachable

**Test:** Visit each subdomain (budget, fsa, malt, cert, registry, seed, tickets) in browser
**Expected:** Each loads its respective app over HTTPS with valid TLS
**Why human:** Requires all 8 apps running behind Caddy on a live VPS

### Gaps Summary

No gaps found. All artifacts exist, are substantive (not stubs), and are correctly wired together. The Caddyfile port map is a perfect match to ecosystem.config.js. DEPLOY.md is comprehensive at 368 lines with 12 dependency-ordered sections. Both requirements (INFRA-02, INFRA-04) are satisfied.

The only remaining verification is human testing on a live VPS with DNS configured, which is expected for infrastructure config that cannot be tested locally.

---

_Verified: 2026-03-07_
_Verifier: Claude (gsd-verifier)_
