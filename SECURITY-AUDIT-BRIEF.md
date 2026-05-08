# Security Audit Brief — Hughes Farm Operations Platform

**Date:** 2026-04-27  
**Prepared for:** External Security Review  
**Domain:** portal.whughesfarms.com  
**Platform owner:** W. Hughes / Whildenvi

---

## 1. Platform Overview

A self-hosted, multi-application agricultural operations platform deployed on a single DigitalOcean VPS. All apps run behind a **Caddy reverse proxy** with automatic Let's Encrypt HTTPS. Process management via **PM2**.

User-facing entry point: **portal.whughesfarms.com** — a Next.js "shell" that embeds the Express sub-apps in iframes.

---

## 2. Application Inventory

| App Name | Tech Stack | Local Port | Purpose |
|---|---|---|---|
| **glomalin-portal** | Next.js 14, Supabase, Tailwind | 3000 | Main portal — auth, RBAC, dashboards |
| **farm-budget** | Express + vanilla JS, JSON file store | 3001 | Budget planning, field ops, procurement |
| **fsa-acres** | Express + vanilla JS, JSON file store | 3002 | FSA acreage records (legacy) |
| **meristem-malt** | Express + vanilla JS, JSON file store | 3003 | Malt crop budgets |
| **organic-cert** | Next.js 16, Prisma, PostgreSQL | 3004 | USDA NOP organic audit system |
| **farm-registry** | Express + vanilla JS, JSON file store | 3005 | Canonical field/acre registry |
| **seed-inventory** | Express + vanilla JS, JSON file store | 3006 | Seed tracking |
| **grain-tickets** | Express, Prisma, PostgreSQL, Claude AI | 3007 | Grain load traceability, 527+ tickets |
| **field-app** | (PWA scaffold) | TBD | Mobile field pass logger (in progress) |

---

## 3. Infrastructure

### Hosting
- **Provider:** DigitalOcean (single VPS/droplet)
- **OS:** Linux (Ubuntu assumed)
- **Reverse proxy:** Caddy (auto-HTTPS via Let's Encrypt)
- **Process manager:** PM2 (8 processes, single-instance each, autorestart, 512M/256M memory caps)
- **DNS:** Wildcard A record `*.whughesfarms.com` pointing to droplet IP

### Caddy Subdomain Map
All subdomains proxy to localhost only. The portal is the **only intended user-facing entry point** per operational design:

| Subdomain | Target |
|---|---|
| portal.whughesfarms.com | :3000 (glomalin-portal) |
| budget.whughesfarms.com | :3001 (farm-budget) |
| fsa.whughesfarms.com | :3002 (fsa-acres) |
| malt.whughesfarms.com | :3003 (meristem-malt) |
| cert.whughesfarms.com | :3004 (organic-cert) |
| registry.whughesfarms.com | :3005 (farm-registry) |
| seed.whughesfarms.com | :3006 (seed-inventory) |
| tickets.whughesfarms.com | :3007 (grain-tickets) |

> **Note:** All 8 subdomains are publicly routable via DNS/HTTPS. The operational intent is that users only access via `portal.*`, but the other subdomains are technically reachable.

### Scripts
Located in `scripts/`:
- `deploy-vps.sh` — initial VPS setup
- `backup.sh` — daily cron at 2 AM, 7-day retention to `/var/backups/farm-ops/`
- `restore.sh` — restores from backup
- `health-check.sh` — polls `/health` on all 8 apps
- `sync-code.sh` — git pull + npm install + pm2 restart
- `finish-deploy.sh` — post-deploy verification

---

## 4. External Accounts & Third-Party Services

### Supabase (Cloud PostgreSQL + Auth)
- **Project URL:** `https://hmjmrdhwrzltckzuoaoh.supabase.co`
- **Auth method:** Email/password (Supabase Auth)
- **Key types present:**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-safe public key
  - `SUPABASE_SERVICE_ROLE_KEY` — **server-only, bypasses all RLS** — stored in `glomalin-portal/.env.local`
- **Databases owned:** Portal data (profiles, module_access, clu_records, insurance_policies, claims, field_boundaries, grain_contracts, APH records, etc.)
- **Storage buckets:** `claim-documents` (private, RLS-gated signed URLs)
- **Users/roles managed here:** All portal user accounts and module grants

### Anthropic (Claude AI API)
- **Key type:** `ANTHROPIC_API_KEY` (sk-ant-... format)
- **Location:** `grain-tickets/.env`
- **Usage:** Natural language grain query agent inside grain-tickets app
- **Kill switch:** `CHAT_AGENT_ENABLED` env var, optional `CHAT_DAILY_CAP` (default 50 requests/day)

### CNH Industrial / Case IH FieldOps API
- **Purpose:** Sync field application records and yield history
- **OAuth2 endpoints:** `identity.cnhind.com` (token), `ag.api.cnhind.com` (API)
- **Credentials present:**
  - `FIELDOPS_CLIENT_ID` — OAuth2 client ID
  - `FIELDOPS_CLIENT_SECRET` — OAuth2 client secret
  - `FIELDOPS_SUBSCRIPTION_KEY` — CNH API subscription key
- **Location:** `organic-cert/.env` (staging credentials), `farm-budget/.env.example`
- **Status:** Staging/development credentials — production credentials may differ

### DigitalOcean (VPS)
- **Resource type:** Single droplet (exact tier unknown, at least 2GB RAM based on PM2 limits)
- **Access:** SSH key-based (assumed)
- **Firewall status:** Not confirmed — ufw/iptables state unknown

### GitHub
- **Repository:** Private (implied by `git pull` in deploy workflow)
- **Branch model:** Main branch (direct deploy from `main`)
- **CI/CD:** None — fully manual deploy workflow

### Google Fonts (CDN)
- **Used by:** `platform-tokens.css` imports Outfit and DM Sans
- **Risk:** External font loading exposes user IP to Google

---

## 5. Authentication Systems

### Portal (glomalin-portal) — Supabase Auth
- Email/password authentication
- SSR session cookies (Supabase `@supabase/ssr` package)
- Middleware refreshes session on every request
- Password reset flow via email link (`/forgot-password` → `/reset-password`)
- Admin invite flow: admin creates user → Supabase sends signup email

### Organic-cert — NextAuth (legacy)
- Separate auth system from portal
- Session secret stored in `organic-cert/.env` (`NEXTAUTH_SECRET`)
- Dev placeholder value present (`glomalin-dev-secret-change-in-production`)
- Auth URL pointed at localhost in `.env` — production value must be set separately

### Express Apps (farm-budget, farm-registry, grain-tickets, fsa-acres, meristem-malt, seed-inventory)
- **No user auth** — access controlled entirely by shared `EMBED_TOKEN`
- Token verified two ways:
  1. Query param: `/?token=VALUE` → sets `embed_session` cookie
  2. Cookie: `embed_session` checked on every `/api/*` request
- Single token shared across all Express apps
- Cookie settings: `httpOnly: true`, `sameSite: 'lax'`

---

## 6. Role-Based Access Control (RBAC)

### Portal Roles (stored in `profiles.role` in Supabase)
| Role | Access |
|---|---|
| `admin` | Full platform, user management, all modules |
| `agronomist` | Modules explicitly granted via `module_access` table |
| `operator` | Modules explicitly granted via `module_access` table |
| `viewer` | Modules explicitly granted via `module_access` table (default on signup) |

### Module Grants (`module_access` table)
Each user can be individually granted/revoked access to:
- fsa-578
- insurance
- claims
- macro-rollup
- field-timeline
- settlement-summary
- grain-marketing
- field-operations
- compliance-hub
- maps

Admin role bypasses module grant checks entirely.

### Data-Level Isolation
- Supabase Row-Level Security (RLS) policies on all tables
- Service role key (used by server-side API routes) **bypasses RLS** — intended for admin operations only
- RLS policies documented as present but not independently audited

---

## 7. Data Stores & What They Hold

| Store | Type | Location | Contents |
|---|---|---|---|
| Supabase (cloud) | PostgreSQL | Supabase cloud | User profiles, roles, module grants, FSA CLU records, insurance policies, claims, field boundaries, grain contracts, APH yield history |
| `glomalin` DB | PostgreSQL (local on VPS) | `localhost:5432` | Organic cert: fields, farm plans, inputs, seeds, rotations, products |
| `grain_tickets` DB | PostgreSQL (local on VPS) | `localhost:5432` | 527+ grain load records, settlements, buyers |
| `data.json` files | JSON files on disk | Each Express app's `data/` dir | Fields, budgets, enterprises, products, seeds, deliveries, orders, FSA acres |
| `uploads/` dirs | Files on disk | grain-tickets | CSV/Excel settlement files uploaded by users |
| Supabase Storage | Cloud object storage | Supabase | Insurance claim documents (PDFs, photos) |

### Sensitive Data Present
- Farm field boundaries (GeoJSON) — competitive/operational value
- Crop plans, yields, input rates — business-sensitive
- Insurance policies and claim records — financial
- FSA acreage reports — regulatory
- 527+ grain load tickets — revenue/settlement data
- User accounts and access grants

---

## 8. Secret / Credential Inventory

> **AUDIT NOTE:** At time of review, `.env` files containing live production credentials were found **committed to the git repository**. See Section 10 (Findings) for full severity assessment.

| Secret | App | Risk Level | Status |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | glomalin-portal | CRITICAL | Bypasses all RLS; committed to repo |
| `ANTHROPIC_API_KEY` | grain-tickets | HIGH | Allows arbitrary API calls + cost overrun; committed to repo |
| `EMBED_TOKEN` | ALL Express apps + portal | HIGH | Single token gates all 6 Express apps; committed to repo and hardcoded in `ecosystem.config.js` |
| `FIELDOPS_CLIENT_SECRET` | organic-cert | MEDIUM | CNH Industrial staging OAuth secret; committed to repo |
| `FIELDOPS_SUBSCRIPTION_KEY` | organic-cert | MEDIUM | CNH API key; committed to repo |
| `NEXTAUTH_SECRET` | organic-cert | MEDIUM | Dev placeholder value committed; production value unclear |
| `SUPABASE_ANON_KEY` | glomalin-portal | LOW | Public by design, but tied to project ID |
| Local PostgreSQL credentials | grain-tickets, organic-cert | LOW | Unix socket auth, no password in URL |

---

## 9. Network & API Surface

### Publicly Routable Endpoints (via Caddy HTTPS)
All 8 subdomains are reachable over the internet with valid HTTPS certs.

### Express App API Routes (representative sample)
Each Express app exposes an unauthenticated surface unless the `embed_session` cookie or `?token=` param is present:
- `GET /health` — **no auth required** (intentional)
- `GET /api/*` — EMBED_TOKEN required
- `POST /api/*` — EMBED_TOKEN required

### Portal API Routes (40+ Next.js route handlers)
Auth checked server-side via Supabase session cookie + middleware. Notable routes:
- `/api/admin/*` — admin role required
- `/api/fsa/*` — FSA module grant required
- `/api/insurance/*` — insurance module grant required
- `/api/claims/[id]/upload-url` — generates signed Supabase Storage upload URLs
- `/api/mobile/*` — separate bearer token auth (PWA endpoints)
- `/api/marketing/cbot-prices` — scrapes CBOT price data from external source
- `/api/insurance/pricing/scrape` — scrapes insurance pricing data from external source

### Webhook (Internal)
- `POST /api/fsa/webhook/field-created` — triggered by farm-registry when a field is created; authenticated via `EMBED_TOKEN` as query param

### CORS Configuration
Express apps: `PORTAL_ORIGIN` env var (defaults to `http://localhost:3000` if not set).  
No documented Content-Security-Policy, X-Content-Type-Options, or X-Frame-Options headers.

---

## 10. Security Findings Summary

### CRITICAL

**C1 — Live production secrets committed to git repository**  
`.env` and `.env.local` files containing live credentials are tracked in version control. Affected files: `glomalin-portal/.env.local`, `grain-tickets/.env`, `organic-cert/.env`, `farm-budget/.env`, and `ecosystem.config.js`. Git history retains these even after file removal without history rewriting. Secrets affected: Supabase service role key, Anthropic API key, EMBED_TOKEN, CNH credentials.

**C2 — Supabase service role key exposure**  
The service role key grants unrestricted read/write access to all Supabase data, bypassing all RLS policies. Exposure allows complete data exfiltration or destruction of: user accounts, FSA records, insurance policies, claim documents, field boundaries.

**C3 — Anthropic API key exposure**  
Exposed key allows any actor to make arbitrary Claude API calls billed to this account with no per-user limits.

---

### HIGH

**H1 — Single shared EMBED_TOKEN across all Express apps**  
One token gates six separate applications. Compromise of any single app's config exposes all apps simultaneously. Token also hardcoded in `ecosystem.config.js` (PM2 config), compounding exposure.

**H2 — CNH Industrial FieldOps credentials committed**  
OAuth2 client secret and subscription key committed to repo. Allows unauthorized access to FieldOps API under this account.

**H3 — Supabase backup likely non-functional**  
`scripts/backup.sh` expects `SUPABASE_DB_URL` (direct PostgreSQL connection string) but this is not documented anywhere in the project. If not configured, Supabase data (the most sensitive store) is not being backed up. 7-day local backups only cover JSON files and local PostgreSQL databases.

**H4 — No firewall state confirmed**  
No `ufw` or `iptables` rules documented. All 8 ports (3000–3007) may be directly reachable on the VPS's public IP, bypassing Caddy entirely.

**H5 — Sub-apps directly routable via subdomains**  
All 8 subdomains are publicly accessible. The EMBED_TOKEN is the only gate on the Express apps. If that token is known (it is, from the git repo), any user can directly hit budget.*, tickets.*, etc. without going through the portal or Supabase RBAC.

---

### MEDIUM

**M1 — NextAuth secret is a dev placeholder**  
`organic-cert/.env` contains `NEXTAUTH_SECRET=glomalin-dev-secret-change-in-production`. If this is running in production with this value, session tokens can be forged.

**M2 — Webhook auth via query parameter**  
The `field-created` webhook appends `?token=EMBED_TOKEN` to requests. Tokens in query params appear in server logs, proxy logs, and browser history. Should use `Authorization` header instead.

**M3 — File upload lacks content validation**  
grain-tickets `/api/settlements/upload` accepts `.csv`/`.xlsx`/`.xls` by extension only. No magic-byte verification. Excel files could contain formula injection (CSV injection) or macro payloads.

**M4 — No rate limiting documented**  
No Caddy rate limiting rules, no per-user API rate limits. Scraping endpoints (`/api/marketing/cbot-prices`, `/api/insurance/pricing/scrape`) and AI chat endpoint have no request throttling beyond the global daily cap.

**M5 — IndexedDB unencrypted (PWA)**  
`field-app` PWA caches crop plan data and queues offline operations in IndexedDB with no encryption. Physical device access exposes cached farm data.

**M6 — CORS fallback to localhost**  
If `PORTAL_ORIGIN` is not set in any Express app's environment, CORS defaults to `http://localhost:3000`. On production this could mean cross-origin requests are rejected or improperly configured.

**M7 — No MFA on any user account**  
Supabase supports TOTP 2FA but it is not enabled or documented. Organic-cert (NextAuth) also has no MFA. Single-factor email/password on all accounts.

---

### LOW

**L1 — No CI/CD pipeline**  
Deployment is fully manual (`git pull` → `npm install` → `pm2 restart`). No automated testing before deploy. No rollback strategy documented.

**L2 — No dependency vulnerability scanning**  
No `npm audit` in deploy workflow. No Dependabot or Snyk configured.

**L3 — PM2 single-instance, no clustering**  
Each app runs as one process. Crash = downtime until PM2 autorestart (~5s delay). No zero-downtime deploy strategy.

**L4 — Application logs not centralized**  
PM2 logs go to `~/.pm2/logs/`. No centralized logging, no alerting on error spikes, no audit trail of who accessed what data.

**L5 — Google Fonts CDN**  
`platform-tokens.css` loads fonts from Google Fonts. Every page load by any user sends an HTTP request to Google, leaking user IP addresses.

**L6 — Supabase project ID exposed in public URL**  
`NEXT_PUBLIC_SUPABASE_URL` contains the Supabase project ID and is shipped to the browser. This is by design for the anon key, but confirms the target for any attacker.

---

## 11. Immediate Actions Required

In priority order:

1. **Rotate all credentials NOW** (before this document is shared externally)
   - Supabase service role key → Supabase dashboard → Settings → API
   - Anthropic API key → console.anthropic.com → API Keys
   - EMBED_TOKEN → generate new random 32-byte value, update all `.env` files and `ecosystem.config.js`
   - CNH FieldOps client secret → CNH developer portal
   - NextAuth secret → generate proper `openssl rand -base64 32` value

2. **Remove `.env` files from git tracking**
   - Add all `.env*` files (except `.env.example`) to `.gitignore`
   - Use `git rm --cached` to untrack without deleting
   - Rewrite git history with BFG Repo-Cleaner to remove historical secret values
   - Force-push clean history (coordinate with any collaborators)

3. **Verify Supabase backup**
   - Obtain direct PostgreSQL connection string from Supabase dashboard (Settings → Database → Connection string → URI)
   - Add as `SUPABASE_DB_URL` in VPS environment
   - Run `scripts/backup.sh` manually and verify Supabase dump completes
   - Test restore from backup

4. **Confirm VPS firewall rules**
   - Verify only ports 80, 443, and 22 (SSH) are open on the VPS's public interface
   - Ports 3000–3007 should be localhost-only (Caddy handles external traffic)
   - `sudo ufw status` or `iptables -L` to confirm

---

## 12. Recommended Scope for Full Audit

The following areas warrant deeper investigation beyond this brief:

- [ ] Supabase RLS policy review — verify each table's policies are correct and tested
- [ ] Auth flow testing — session fixation, token leakage, logout/revocation
- [ ] RBAC bypass testing — can a `viewer` role access admin endpoints?
- [ ] Module grant bypass — can a user access a module they were not granted?
- [ ] File upload exploitation — test CSV injection and malformed Excel
- [ ] CORS and CSRF testing on Express apps
- [ ] Webhook replay attack testing
- [ ] Dependency audit — `npm audit` across all 9 package.json files
- [ ] SSH access review — key-based only? Root login disabled? Fail2ban configured?
- [ ] Caddy header security review — HSTS, CSP, X-Frame-Options
- [ ] Service worker security — scope, fetch event handling, cache poisoning
- [ ] Supabase Storage bucket permissions — confirm private bucket ACLs
- [ ] API route authorization completeness — all 40+ portal routes verified
- [ ] Mobile auth token lifecycle — how are PWA bearer tokens issued and revoked?

---

## 13. Technology Stack Summary

| Layer | Technology |
|---|---|
| Primary portal framework | Next.js 14 (App Router) |
| Organic cert framework | Next.js 16 (App Router) |
| Express apps (6) | Node.js 20, Express 4 |
| ORM | Prisma 6 (grain-tickets, organic-cert) |
| Cloud database | Supabase (PostgreSQL + Auth + Storage) |
| Local databases | PostgreSQL 15 (2 databases) |
| File stores | JSON files on disk (5 apps) |
| Reverse proxy | Caddy |
| Process manager | PM2 |
| AI integration | Anthropic Claude (claude-sonnet-4-6) |
| External OAuth | CNH Industrial (Case IH FieldOps) |
| PWA | @serwist/next, IndexedDB, Background Sync API |
| Hosting | DigitalOcean VPS (single droplet) |

---

*Document generated 2026-04-27. Contains no actual secret values — see VPS `.env` files for credential inventory.*
