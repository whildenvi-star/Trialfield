# Requirements: Farm Operations Platform

**Defined:** 2026-03-06
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.

## v7.0 Requirements

Requirements for public deployment milestone. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: All 8 apps run under PM2 with auto-restart, defined in a single ecosystem config
- [x] **INFRA-02**: Caddy reverse proxy routes subdomain traffic to correct app with auto-HTTPS
- [x] **INFRA-03**: Production `.env` templates exist for every app with documented placeholder values
- [x] **INFRA-04**: Deployment README provides step-by-step VPS setup (Node.js, PostgreSQL, Caddy, PM2, git clone, DNS)
- [x] **INFRA-05**: grain-tickets port configurable via PORT env var (avoids conflict with portal on 3000)
- [x] **INFRA-06**: Both Next.js apps (portal, organic-cert) build and start in production mode

### Security

- [x] **SEC-01**: All Express apps restrict CORS to portal domain only
- [x] **SEC-02**: Daily backup scripts run for JSON data files (7-day retention) and PostgreSQL (pg_dump)
- [x] **SEC-03**: Each Express app exposes a `/health` endpoint returning 200
- [x] **SEC-04**: Production secrets documented (what to rotate, where they go)

### Onboarding

- [x] **ONB-01**: Admin can invite a coworker by email and they receive a signup link
- [x] **ONB-02**: Invited user can set password, log in, and see dashboard with granted modules
- [x] **ONB-03**: User can reset forgotten password via email link in production

## Future Requirements

### v9.0+ Candidates

- **MON-01**: Uptime monitoring with email alerts when an app goes down
- **CI-01**: Automated deployment pipeline (git push → build → restart)
- **LOG-01**: Centralized logging across all 8 apps
- **SCALE-01**: Migrate JSON-backed apps to PostgreSQL for multi-instance support

## Out of Scope

| Feature | Reason |
|---------|--------|
| Docker/containerization | Adds complexity; PM2 on bare metal is simpler for 6-15 users |
| CI/CD pipeline | Manual deploy is fine for now; automate in v9.0+ |
| Load balancer / multi-instance | Single VPS handles 6-15 users; JSON apps can't multi-instance anyway |
| CDN for static assets | Not needed at this scale |
| Database migration (JSON to PostgreSQL) | Would require app rewrites; defer to future milestone |
| Custom domain email (SMTP) | Supabase default mailer works for invite volume |
| Green/earth-tone palette | Glomalin design system is navy/cyan — no organic color schemes |
| External animation libraries | Canvas-only rendering with pure TypeScript noise functions |
| Visible scene toggle UI | Scene switching is an easter egg, not a prominent UI feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 35 | Complete |
| INFRA-03 | Phase 35 | Complete |
| INFRA-05 | Phase 35 | Complete |
| SEC-01 | Phase 35 | Complete |
| INFRA-06 | Phase 35 | Complete |
| INFRA-02 | Phase 36 | Complete |
| INFRA-04 | Phase 36 | Complete |
| SEC-02 | Phase 37 | Complete |
| SEC-04 | Phase 37 | Complete |
| ONB-01 | Phase 38 | Complete |
| ONB-02 | Phase 38 | Complete |
| ONB-03 | Phase 38 | Complete |
| SEC-03 | Phase 39 | Complete |

**Coverage:**
- v7.0 requirements: 13 total (12 complete, 1 pending)
- Mapped to phases: 13 total
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-08 after v8.0 archived (v7.0 requirements only)*
