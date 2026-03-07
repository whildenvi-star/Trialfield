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
- [ ] **SEC-02**: Daily backup scripts run for JSON data files (7-day retention) and PostgreSQL (pg_dump)
- [ ] **SEC-03**: Each Express app exposes a `/health` endpoint returning 200
- [ ] **SEC-04**: Production secrets documented (what to rotate, where they go)

### Onboarding

- [ ] **ONB-01**: Admin can invite a coworker by email and they receive a signup link
- [ ] **ONB-02**: Invited user can set password, log in, and see dashboard with granted modules
- [ ] **ONB-03**: User can reset forgotten password via email link in production

## v8.0 Requirements

Requirements for ASCII Banner Strip & Design System milestone. Each maps to roadmap phases.

### Banner

- [x] **BANNER-01**: ASCIIBannerStrip component renders animated ASCII mycelial network at configurable height (default 72px)
- [x] **BANNER-02**: Canvas auto-measures on mount + resize with 150ms debounce, respects devicePixelRatio
- [x] **BANNER-03**: Character grid uses brightness-mapped ASCII ramp (" .·:;░▒▓█") with cyan-palette coloring
- [x] **BANNER-04**: Pure noise utility functions (noise2D, fbm, generateMycelium) with no external deps
- [x] **BANNER-05**: requestAnimationFrame loop targeting ~50fps with cleanup on unmount and tab-hidden throttle
- [x] **BANNER-06**: Bottom gradient overlay fades strip into page background seamlessly
- [x] **BANNER-07**: Random time offset per instance so banners on different pages don't synchronize

### Shell Integration

- [x] **SHELL-01**: Banner wired into protected layout between header and page content
- [x] **SHELL-02**: Mobile responsive — 48px height, 6 mycelium nodes at <768px
- [x] **SHELL-03**: prefers-reduced-motion renders single static ASCII frame, no animation loop
- [x] **SHELL-04**: User setting to disable banner entirely (stored in existing user prefs)
- [x] **SHELL-05**: CSS fade-in on mount (opacity 0→1 over 400ms)

### Design Tokens

- [x] **TOKEN-01**: Create src/styles/tokens.ts exporting canonical navy/cyan palette, fonts, and spacing
- [x] **TOKEN-02**: ASCIIBannerStrip imports all colors from shared tokens (no hardcoded hex)
- [x] **TOKEN-03**: Migrate tailwind.config.ts from soil palette to navy/cyan design tokens
- [x] **TOKEN-04**: Migrate existing portal components (header, cards, badges, nav) to token-based colors
- [x] **TOKEN-05**: Create DESIGN.md documenting token system, font stack, spacing, component patterns

### Scenes

- [x] **SCENE-01**: DRONE scene — procedural rolling landscape with fbm noise, cloud layer, crop rows, depth fog
- [x] **SCENE-02**: SEASONAL scene — auto-select animation by calendar month (planting/growth/harvest/dormant)
- [x] **SCENE-03**: Scene preference stored per-user, default mycelium
- [x] **SCENE-04**: 200ms opacity crossfade on scene switch
- [x] **SCENE-05**: Easter egg trigger — clicking a bright mycelium node cycles to next scene (no visible UI)

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
| SEC-02 | Phase 37 | Pending |
| SEC-04 | Phase 37 | Pending |
| ONB-01 | Phase 38 | Pending |
| ONB-02 | Phase 38 | Pending |
| ONB-03 | Phase 38 | Pending |
| SEC-03 | Phase 39 | Pending |
| BANNER-01 | Phase 40 | Complete |
| BANNER-02 | Phase 40 | Complete |
| BANNER-03 | Phase 40 | Complete |
| BANNER-04 | Phase 40 | Complete |
| BANNER-05 | Phase 40 | Complete |
| BANNER-06 | Phase 40 | Complete |
| BANNER-07 | Phase 40 | Complete |
| SHELL-01 | Phase 41 | Complete |
| SHELL-02 | Phase 41 | Complete |
| SHELL-03 | Phase 41 | Complete |
| SHELL-04 | Phase 41 | Complete |
| SHELL-05 | Phase 41 | Complete |
| TOKEN-01 | Phase 42 | Complete |
| TOKEN-02 | Phase 42 | Complete |
| TOKEN-03 | Phase 42 | Complete |
| TOKEN-04 | Phase 42 | Complete |
| TOKEN-05 | Phase 42 | Complete |
| SCENE-01 | Phase 43 | Complete |
| SCENE-02 | Phase 43 | Complete |
| SCENE-03 | Phase 43 | Complete |
| SCENE-04 | Phase 43 | Complete |
| SCENE-05 | Phase 43 | Complete |

**Coverage:**
- v7.0 requirements: 13 total (7 complete, 6 pending)
- v8.0 requirements: 22 total
- Mapped to phases: 35 total
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-07 after v8.0 requirements added*
