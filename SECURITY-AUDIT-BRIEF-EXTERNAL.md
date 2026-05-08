# Security Audit Brief
## Hughes Farm Operations Platform

| | |
|---|---|
| **Client** | W. Hughes — Hughes Farm Operations |
| **Domain** | portal.whughesfarms.com |
| **Document date** | 2026-04-27 |
| **Prepared by** | Platform owner, in consultation with Claude Code |
| **Classification** | Confidential — Intended for authorized security review only |

---

## 1. Platform Overview

A self-hosted, multi-application agricultural operations platform deployed on a single DigitalOcean VPS. All applications run behind a **Caddy reverse proxy** with automatic Let's Encrypt HTTPS certificates. Process management is handled by **PM2**.

The intended user-facing entry point is **portal.whughesfarms.com** — a Next.js application that provides authentication, RBAC, and embeds the six Express sub-applications via iframes. Direct subdomain access to sub-apps is technically reachable but not the intended operational pattern.

The platform handles sensitive agricultural and financial data including FSA regulatory records, crop insurance policies, grain settlement records, and USDA organic certification documentation.

---

## 2. Application Inventory

| Application | Framework | Port | Purpose |
|---|---|---|---|
| glomalin-portal | Next.js 14, Supabase, Tailwind CSS | 3000 | Main portal: auth, RBAC, dashboards, FSA/insurance/claims modules |
| farm-budget | Express 4, vanilla JS, JSON file store | 3001 | Budget planning, field ops, procurement, FieldOps sync |
| fsa-acres | Express 4, vanilla JS, JSON file store | 3002 | FSA acreage records (legacy module) |
| meristem-malt | Express 4, vanilla JS, JSON file store | 3003 | Malt crop budgets |
| organic-cert | Next.js 16, Prisma 6, PostgreSQL | 3004 | USDA NOP organic certification audit system |
| farm-registry | Express 4, vanilla JS, JSON file store | 3005 | Canonical field and acreage registry |
| seed-inventory | Express 4, vanilla JS, JSON file store | 3006 | Seed lot tracking |
| grain-tickets | Express 4, Prisma 6, PostgreSQL, Claude AI | 3007 | Grain load traceability (527+ tickets) |
| field-app | PWA (scaffold/in progress) | TBD | Mobile field pass logger — offline-first |

---

## 3. Infrastructure

### Hosting & Runtime
- **Provider:** DigitalOcean — single VPS droplet
- **OS:** Linux (Ubuntu)
- **Node.js:** v20
- **Reverse proxy:** Caddy (auto-HTTPS, Let's Encrypt)
- **Process manager:** PM2 — 8 single-instance processes, autorestart enabled, 512M (Next.js) / 256M (Express) memory caps
- **DNS:** Wildcard A record `*.whughesfarms.com` pointing to droplet IP

### Public Subdomain Map

All 8 subdomains are publicly routable with valid TLS certificates. Caddy proxies each to localhost. Sub-app ports (3001–3007) are intended to be accessible only via Caddy — firewall confirmation is pending (see Finding H4).

| Public Subdomain | Internal Target | Application |
|---|---|---|
| portal.whughesfarms.com | :3000 | glomalin-portal |
| budget.whughesfarms.com | :3001 | farm-budget |
| fsa.whughesfarms.com | :3002 | fsa-acres |
| malt.whughesfarms.com | :3003 | meristem-malt |
| cert.whughesfarms.com | :3004 | organic-cert |
| registry.whughesfarms.com | :3005 | farm-registry |
| seed.whughesfarms.com | :3006 | seed-inventory |
| tickets.whughesfarms.com | :3007 | grain-tickets |

### Operational Scripts (`scripts/`)
- `deploy-vps.sh` — initial VPS provisioning
- `backup.sh` — daily cron at 2 AM, 7-day retention to `/var/backups/farm-ops/`
- `restore.sh` — backup restoration
- `health-check.sh` — polls `/health` on all 8 apps
- `sync-code.sh` — git pull, npm install, pm2 restart
- `finish-deploy.sh` — post-deploy verification

---

## 4. External Accounts & Third-Party Services

### Supabase — Cloud PostgreSQL + Auth
- **Project URL:** `https://[redacted].supabase.co`
- **Authentication method:** Email/password via Supabase Auth
- **Credential types in use:**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-safe public key (intentionally client-side)
  - `SUPABASE_SERVICE_ROLE_KEY` — server-only privileged key, **bypasses all RLS policies**
- **Data stored:** User profiles, role assignments, module access grants, FSA CLU records, insurance policies and pricing, claim records and documents, field boundaries (GeoJSON), grain contracts, APH yield history
- **Storage:** `claim-documents` bucket (private, RLS-protected, signed URL access)
- **Account management:** All portal user accounts and module grants live here

### Anthropic — Claude AI API
- **Credential:** `ANTHROPIC_API_KEY`
- **Usage:** Natural language query agent within the grain-tickets application
- **Controls:** `CHAT_AGENT_ENABLED` kill switch; optional `CHAT_DAILY_CAP` (default: 50 requests/day)
- **Exposure status:** Key committed to version control (see Finding C1)

### CNH Industrial / Case IH FieldOps API
- **Purpose:** OAuth2 integration to sync field application records and yield history
- **Endpoints:** `identity.cnhind.com` (token), `ag.api.cnhind.com` (API)
- **Credentials in repo:** `FIELDOPS_CLIENT_ID`, `FIELDOPS_CLIENT_SECRET`, `FIELDOPS_SUBSCRIPTION_KEY`
- **Status:** Staging/development credentials present — production credential status unclear
- **Exposure status:** Credentials committed to version control (see Finding C1)

### DigitalOcean — VPS
- **Resource:** Single droplet (minimum ~2 GB RAM based on PM2 memory caps)
- **Access method:** SSH key-based (assumed)
- **Firewall state:** Unconfirmed — see Finding H4

### GitHub — Source Code
- **Repository:** Private
- **Branch model:** Single `main` branch, direct production deploy
- **CI/CD:** None — fully manual deploy workflow

### Google Fonts — CDN
- `platform-tokens.css` loads Outfit and DM Sans from Google Fonts
- Every page load sends a request to Google's CDN, exposing user IP addresses

---

## 5. Authentication Systems

### Portal (glomalin-portal) — Supabase Auth
- Email/password; no MFA implemented
- SSR session cookie management via `@supabase/ssr`; middleware refreshes on every request
- Password reset via email link; admin-initiated invite flow for new users

### Organic-cert — NextAuth (separate, legacy)
- Entirely separate auth stack from the portal
- Session secret (`NEXTAUTH_SECRET`) stored in `.env`; a development placeholder string is currently committed
- Auth URL in `.env` points to localhost — production URL must be configured separately

### Express Sub-Apps (6 apps) — Shared EMBED_TOKEN
- No per-user authentication
- Access gated by a single shared secret (`EMBED_TOKEN`) verified as:
  1. `?token=VALUE` query parameter → sets `embed_session` httpOnly cookie
  2. `embed_session` cookie checked on every `/api/*` request
- One token is shared across all six Express apps
- Cookie flags: `httpOnly: true`, `sameSite: 'lax'`

---

## 6. Role-Based Access Control (RBAC)

### Portal User Roles (stored in Supabase `profiles.role`)

| Role | Access |
|---|---|
| `admin` | Full platform access, user management, all modules — bypasses module grant table |
| `agronomist` | Individually granted modules only |
| `operator` | Individually granted modules only |
| `viewer` | Individually granted modules only — default role on signup |

### Module Grants (`module_access` table)
Per-user toggle for each of: fsa-578, insurance, claims, macro-rollup, field-timeline, settlement-summary, grain-marketing, field-operations, compliance-hub, maps.

### Data-Level Isolation
- Supabase RLS policies are present on all tables
- Server-side API routes that use the service role key bypass RLS by design — limited to admin-privileged operations
- RLS policy correctness has not been independently verified

---

## 7. Data Stores & Sensitive Data

| Store | Type | Location | Contents |
|---|---|---|---|
| Supabase | Cloud PostgreSQL | Supabase cloud | User profiles, RBAC, FSA CLU records, insurance policies, claims, field GeoJSON, grain contracts, APH history |
| `glomalin` database | PostgreSQL | VPS localhost:5432 | Organic cert: fields, farm plans, inputs, seeds, crop rotations, products |
| `grain_tickets` database | PostgreSQL | VPS localhost:5432 | 527+ grain load records, settlements, buyer records |
| `data.json` files (×5) | Flat JSON files | Each Express app `data/` dir | Fields, budgets, enterprises, products, seeds, deliveries, orders, FSA acres |
| `uploads/` directories | Files on disk | grain-tickets | Uploaded CSV/Excel settlement files |
| Supabase Storage | Cloud object storage | Supabase | Insurance claim documents (PDFs, photos) |

### Data Sensitivity Classification
- **Regulatory:** FSA acreage reports, USDA organic certification documentation
- **Financial:** Insurance policies, claim records, grain settlement data (527+ loads), revenue contracts
- **Operational:** Field boundaries (GeoJSON), crop plans, input rates, yield history
- **Identity:** User accounts, role assignments, access grants

---

## 8. Credential Inventory

| Credential | Application | Risk Level | Current Status |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | glomalin-portal | **CRITICAL** | Bypasses all RLS; committed to git repository |
| `ANTHROPIC_API_KEY` | grain-tickets | **HIGH** | Arbitrary API access + billing exposure; committed to git repository |
| `EMBED_TOKEN` | All 6 Express apps + portal | **HIGH** | Single token gates all Express apps; committed to git and hardcoded in PM2 config |
| `FIELDOPS_CLIENT_SECRET` | organic-cert | **MEDIUM** | CNH Industrial OAuth2 secret; committed to git repository |
| `FIELDOPS_SUBSCRIPTION_KEY` | organic-cert | **MEDIUM** | CNH API key; committed to git repository |
| `NEXTAUTH_SECRET` | organic-cert | **MEDIUM** | Development placeholder value; committed to git repository |
| `SUPABASE_ANON_KEY` | glomalin-portal | LOW | Public by design but tied to Supabase project |
| Local PostgreSQL credentials | grain-tickets, organic-cert | LOW | Unix socket auth; no password in connection URL |

---

## 9. Network & API Surface

### Publicly Routable Attack Surface
All 8 subdomains are reachable over the internet with valid HTTPS certs. Port accessibility on the VPS's public IP is unconfirmed (see Finding H4).

### Express App API Pattern
Each Express app is unauthenticated unless `embed_session` cookie or `?token=` param is present:
- `GET /health` — no auth (intentional health check)
- `GET /api/*` — EMBED_TOKEN required
- `POST /api/*` — EMBED_TOKEN required

### Portal API Routes (40+ Next.js route handlers)
Auth enforced server-side via Supabase session cookie + middleware guard function. Notable surface:
- `/api/admin/*` — admin role required
- `/api/fsa/*` — FSA module grant required
- `/api/insurance/*` — insurance module grant required
- `/api/claims/[id]/upload-url` — generates signed Supabase Storage upload URLs
- `/api/mobile/*` — separate bearer token auth (PWA/offline endpoints)
- `/api/marketing/cbot-prices` — scrapes external CBOT pricing source
- `/api/insurance/pricing/scrape` — scrapes external insurance pricing source

### Internal Webhook
- `POST /api/fsa/webhook/field-created` — field registry propagation; authenticated via `EMBED_TOKEN` as query parameter (see Finding M2)

### CORS
Express apps lock CORS to `PORTAL_ORIGIN` env var; fallback default is `http://localhost:3000` if unset. No documented Content-Security-Policy, X-Content-Type-Options, or X-Frame-Options headers present.

---

## 10. Security Findings

### CRITICAL

**C1 — Live production secrets committed to version control**
`.env` and `.env.local` files containing live credentials are tracked in git. Git history retains these values even after files are removed without a history rewrite. Affected files include `glomalin-portal/.env.local`, `grain-tickets/.env`, `organic-cert/.env`, `farm-budget/.env`, and `ecosystem.config.js`. Exposed secrets span: Supabase service role key, Anthropic API key, shared EMBED_TOKEN, and CNH Industrial credentials.

**C2 — Supabase service role key exposed**
The service role key grants unrestricted read/write access to all Supabase data, bypassing all Row-Level Security policies entirely. Exposure enables complete data exfiltration or destruction of all portal data: user accounts, FSA records, insurance policies, claim documents, and field boundaries.

**C3 — Anthropic API key exposed**
An exposed key allows any actor to make arbitrary API calls billed to this account. No per-request user attribution or rate limit exists beyond a global daily cap environment variable.

---

### HIGH

**H1 — Single EMBED_TOKEN shared across all six Express apps**
Compromise of any single app's configuration exposes all six applications simultaneously. The token is also hardcoded directly in `ecosystem.config.js` (the PM2 process config), compounding the blast radius.

**H2 — CNH Industrial FieldOps OAuth2 credentials exposed**
OAuth2 client secret and API subscription key committed to the repository. Allows unauthorized access to FieldOps API under this account.

**H3 — Supabase backup likely non-functional**
`scripts/backup.sh` expects a `SUPABASE_DB_URL` environment variable (direct PostgreSQL connection string) that is not documented or confirmed present on the VPS. If absent, Supabase — the most sensitive data store — is not being included in backups. The 7-day retention covers only the two local PostgreSQL databases and flat JSON files.

**H4 — VPS firewall state unconfirmed**
No `ufw` or `iptables` rules have been verified. Ports 3000–3007 may be directly accessible on the VPS's public IP, allowing unauthenticated requests to bypass Caddy and reach the Express apps without TLS or the embed token layer.

**H5 — Sub-app subdomains publicly accessible with known EMBED_TOKEN**
All eight subdomains resolve publicly. The EMBED_TOKEN committed to the git repository is the only barrier between an external actor and direct API access to `budget.*`, `tickets.*`, `registry.*`, etc. — completely bypassing portal RBAC.

---

### MEDIUM

**M1 — NextAuth session secret is a weak development placeholder**
`organic-cert/.env` contains a non-random development string as the `NEXTAUTH_SECRET`. If this value is running in production, NextAuth session tokens can be forged by any actor who reads the repository.

**M2 — Webhook authentication via URL query parameter**
The field-created webhook appends the EMBED_TOKEN as a `?token=` query parameter. Tokens in query parameters appear in web server access logs, reverse proxy logs, and browser history, increasing exposure surface beyond what cookie or header-based auth would create.

**M3 — File upload lacks content validation**
The grain-tickets settlement upload endpoint (`/api/settlements/upload`) accepts `.csv`, `.xlsx`, and `.xls` files based on extension only. No magic-byte content verification is performed. Excel files with embedded formulas or macros could constitute a CSV/formula injection vector.

**M4 — No rate limiting**
No rate limiting is configured at the Caddy layer or within any application. Scraping endpoints (`/api/marketing/cbot-prices`, `/api/insurance/pricing/scrape`) and the AI chat endpoint have no per-IP or per-user throttling beyond the global daily cap environment variable.

**M5 — IndexedDB storage unencrypted (PWA)**
The field-app PWA caches crop plan data and queues pending operations in IndexedDB with no encryption at rest. Physical access to a device running the PWA would expose cached farm operational data.

**M6 — CORS origin fallback to localhost**
If `PORTAL_ORIGIN` is not set in any Express app's production environment, CORS defaults to `http://localhost:3000`. In production this could result in all cross-origin requests being rejected or allowed from an unintended origin.

**M7 — No multi-factor authentication**
Supabase Auth supports TOTP 2FA but it is not enabled or configured. The NextAuth system on organic-cert also lacks MFA. All accounts across the platform are single-factor (email/password).

---

### LOW

**L1 — No CI/CD pipeline**
All deployments are performed manually via SSH (`git pull` → `npm install` → `npm run build` → `pm2 restart`). No automated testing is executed prior to deployment. No rollback strategy is documented.

**L2 — No dependency vulnerability scanning**
`npm audit` is not part of the deploy workflow. No Dependabot or Snyk integration is configured. Dependency vulnerabilities across nine `package.json` files are not monitored.

**L3 — Single-process, no zero-downtime deploy**
Each application runs as a single PM2 process. A crash results in downtime until autorestart completes (~5 second delay). No cluster mode or zero-downtime rolling restart strategy is in place.

**L4 — No centralized logging or audit trail**
Application logs exist only in `~/.pm2/logs/`. No centralized log aggregation, no error alerting, and no audit trail of user data access or modification.

**L5 — Third-party font CDN leaks user IPs**
`platform-tokens.css` loads fonts from Google Fonts CDN on every page render. Each user's IP address is sent to Google's infrastructure as a result.

**L6 — Supabase project identifier in client bundle**
`NEXT_PUBLIC_SUPABASE_URL` is shipped to the browser as intended. The project identifier embedded in this URL confirms the target for any attacker attempting to enumerate the Supabase instance.

---

## 11. Recommended Remediation Priorities

### Immediate (before any further work proceeds)
1. **Rotate all exposed credentials** — Supabase service role key, Anthropic API key, EMBED_TOKEN (all six apps + ecosystem.config.js), CNH FieldOps client secret, NextAuth secret
2. **Remove `.env` files from git tracking** — add to `.gitignore`, `git rm --cached`, rewrite history with BFG Repo-Cleaner, coordinate a force-push with all collaborators
3. **Verify Supabase backup** — obtain direct connection string from Supabase dashboard and confirm backup script completes successfully; test restore
4. **Confirm VPS firewall** — verify only ports 22, 80, 443 are open to public; ports 3000–3007 must be localhost-only

### Short-term (Week 1–2)
5. Generate per-app EMBED_TOKENs to eliminate shared-secret blast radius
6. Enable Supabase TOTP MFA for all admin accounts; require for new admin invites
7. Review and document all Supabase RLS policies per table; test with non-admin session
8. Add `Authorization` header to webhook requests; remove token from query param
9. Add file content validation (magic bytes) to settlement upload endpoint
10. Configure Caddy security headers: HSTS, CSP, X-Content-Type-Options, X-Frame-Options

### Medium-term (Month 1–2)
11. Implement per-user rate limiting on API routes and per-IP limiting at Caddy
12. Integrate `npm audit` into deploy workflow; configure Dependabot
13. Add structured request logging (Winston or Pino) with audit trail for data access
14. Establish a documented rollback procedure for production deployments
15. Evaluate CI/CD pipeline (GitHub Actions) with test gate before production merge

---

## 12. Suggested Audit Scope

The following areas are recommended for hands-on testing:

- [ ] Supabase RLS policy validation — row-level isolation per table, per role
- [ ] Auth flow testing — session fixation, token leakage, logout and revocation behavior
- [ ] RBAC bypass — can a `viewer` reach admin endpoints? Can module grants be circumvented?
- [ ] File upload — CSV formula injection, malformed Excel, MIME type bypass
- [ ] CORS and CSRF — Express app token flow, SameSite policy adequacy
- [ ] Webhook replay — timestamp validation absent; replay attack surface
- [ ] SSH hardening — key-only auth, root login disabled, fail2ban
- [ ] Service worker security — fetch event scope, cache poisoning vectors
- [ ] Supabase Storage ACLs — bucket policy, signed URL expiry, RLS at upload
- [ ] Full API route authorization sweep — all 40+ portal routes verified by role
- [ ] Mobile bearer token lifecycle — issuance, expiry, revocation for PWA endpoints
- [ ] VPS firewall and port exposure confirmation

---

## 13. Technology Stack Reference

| Layer | Technology |
|---|---|
| Primary portal | Next.js 14 (App Router), React 18 |
| Organic cert module | Next.js 16 (App Router), React 19 |
| Six sub-applications | Node.js 20, Express 4 |
| ORM | Prisma 6 (grain-tickets, organic-cert) |
| Cloud database + auth | Supabase (PostgreSQL, Supabase Auth, Supabase Storage) |
| Local databases | PostgreSQL (2 instances on VPS) |
| Flat file stores | JSON on disk (5 Express apps) |
| Reverse proxy | Caddy 2 |
| Process manager | PM2 |
| AI integration | Anthropic Claude API (claude-sonnet-4-6) |
| External OAuth2 | CNH Industrial — Case IH FieldOps API |
| PWA framework | @serwist/next, IndexedDB, Background Sync API |
| Hosting | DigitalOcean — single VPS droplet |

---

*Hughes Farm Operations Platform — Security Audit Brief v1.0 — 2026-04-27*  
*Confidential. This document is intended solely for the authorized security reviewer named above.*  
*It contains no live credential values.*
