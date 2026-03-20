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

## v9.0 Requirements

Requirements for Mobile PWA + Field Operations Logger milestone.

### PWA Infrastructure

- [x] **PWA-01**: Service worker registered via @serwist/next with web app manifest (add-to-home-screen, Glomalin branding)
- [x] **PWA-02**: Offline shell — portal loads and is navigable without network; static assets cached by service worker
- [x] **PWA-03**: IndexedDB wrapper (via idb) providing read/write API for offline operation queue and cached crop plan data

### Crop Plan Viewer

- [x] **CPV-01**: Portal API route that aggregates field + enterprise + input + seed + planned pass data from farm-budget and farm-registry with 60s TTL cache and graceful fallback
- [ ] **CPV-02**: Mobile-optimized field list with search/filter, big tap targets, grouped by crop/enterprise
- [ ] **CPV-03**: Field detail page showing crop, variety, population, planned inputs with rates, and planned pass checklist with pass status (planned vs confirmed)
- [ ] **CPV-04**: Crop plan data cached in IndexedDB on each successful sync, displayed from cache when offline; stale-data indicator shows last sync time

### Field Pass Logger

- [ ] **FPL-01**: Operator can confirm a planned pass (tap checkbox → date picker defaults today + operator selector → CONFIRMED status written to organic-cert FieldOperation table)
- [ ] **FPL-02**: Operator can add an unplanned pass (pick field, operation type, date, operator, optional notes → new CONFIRMED FieldOperation row)
- [ ] **FPL-03**: Operator selector populated from Supabase profiles with operator role or above
- [ ] **FPL-04**: All portal-logged operations written to organic-cert FieldOperation table via portal API route with `plannedSource: "mobile-logger"` audit tag

### Offline Sync Engine

- [ ] **OSE-01**: Pass confirmations and additions queued to IndexedDB when offline; queue persists across browser sessions
- [ ] **OSE-02**: Background Sync API replays queued operations to portal API automatically on reconnect
- [ ] **OSE-03**: Conflict detection when a pass was already confirmed (by FieldOps API or another user) — skip with notification rather than duplicating
- [ ] **OSE-04**: Sync status UI shows queued count, last sync timestamp, per-item error state, and manual force-sync button

### Grain Tickets PWA Extension

- [ ] **GTP-01**: Grain tickets offline entry — new ticket form available offline with IndexedDB queue and sync-on-reconnect (same pattern as field pass logger)
- [ ] **GTP-02**: Dashboard read-only caching — budget, FSA, and insurance summary views served from IndexedDB cache when offline

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
| Native mobile app (iOS/Android) | PWA covers the field crew use case |
| GPS/location tracking of field passes | Not needed for NOP records |
| Photo attachment on passes | Deferred (would need Supabase Storage scope) |
| Push notifications | Deferred (requires VAPID setup + notification permission UX) |
| Equipment/implement selection on mobile | Operators confirm pass type, not which tractor |

## Traceability

### v7.0

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

### v9.0

| Requirement | Phase | Status |
|-------------|-------|--------|
| PWA-01 | Phase 44 | Complete |
| PWA-02 | Phase 44 | Complete |
| PWA-03 | Phase 44 | Complete |
| CPV-01 | Phase 45 | Complete |
| CPV-02 | Phase 45 | Pending |
| CPV-03 | Phase 45 | Pending |
| CPV-04 | Phase 45 | Pending |
| FPL-01 | Phase 46 | Pending |
| FPL-02 | Phase 46 | Pending |
| FPL-03 | Phase 46 | Pending |
| FPL-04 | Phase 46 | Pending |
| OSE-01 | Phase 47 | Pending |
| OSE-02 | Phase 47 | Pending |
| OSE-03 | Phase 47 | Pending |
| OSE-04 | Phase 47 | Pending |
| GTP-01 | Phase 48 | Pending |
| GTP-02 | Phase 48 | Pending |

**Coverage:**
- v7.0 requirements: 13 total (13 complete)
- v9.0 requirements: 17 total (0 complete, 17 pending)
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*v9.0 requirements added: 2026-03-15*
*Last updated: 2026-03-15 after v9.0 roadmap creation*
