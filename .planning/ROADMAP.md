# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Grain Traceability + Chat Agent** — Phases 9-14 (shipped 2026-03-04) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Organic Cert Transparency + Procurement** — Phases 15-19 (shipped 2026-03-04) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Cross-Module Polish & Settlement Closure** — Phases 20-23 (shipped 2026-03-04)
- ✅ **v5.0 Glomalin Portal — Next.js + Supabase Scaffold** — Phases 24-26 (shipped 2026-03-05) — [archive](milestones/v5.0-ROADMAP.md)
- ✅ **v6.0 FSA Acres, Insurance & Claims** — Phases 27-34 (shipped 2026-03-06)
- 🚧 **v7.0 Public Deployment & Team Onboarding** — Phases 35-39 (in progress)
- 🚧 **v8.0 ASCII Banner Strip & Design System** — Phases 40-43 (in progress, parallel with v7.0)

## Phases

<details>
<summary>✅ v1.0 Data Ingestion & Reports (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Case IH API Integration (3/3 plans) — completed 2026-02-24
- [x] Phase 2: Field Records & History (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Inspection Report Generation (3/3 plans) — completed 2026-02-25
- [x] Phase 4: Synced Harvest CropLot Wiring (2/2 plans) — completed 2026-02-26

</details>

<details>
<summary>✅ v1.1 Split-Field Enterprises (Phases 5-8) — SHIPPED 2026-03-01</summary>

- [x] Phase 5: Split-Field Schema & Acre Reconciliation (2/2 plans) — completed 2026-02-27
- [x] Phase 6: Multi-Enterprise Field Views (2/2 plans) — completed 2026-02-28
- [x] Phase 7: Split-Field PDF Reports (3/3 plans) — completed 2026-02-28
- [x] Phase 8: Fallow Enterprise Edit Fix (1/1 plan) — completed 2026-03-01

</details>

<details>
<summary>✅ v2.0 Grain Traceability + Chat Agent (Phases 9-14) — SHIPPED 2026-03-04</summary>

- [x] Phase 9: Database Foundation (1/1 plan) — completed 2026-03-02
- [x] Phase 10: Migration & Cutover (2/2 plans) — completed 2026-03-02
- [x] Phase 11: Buyer Registry & Ticket Extensions (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Settlement Import & Manual Entry (2/2 plans) — completed 2026-03-02
- [x] Phase 13: Reconciliation Engine & Discrepancy UI (3/3 plans) — completed 2026-03-02
- [x] Phase 14: Chat Agent (Glomalin) (3/3 plans) — completed 2026-03-03

</details>

<details>
<summary>✅ v3.0 Organic Cert Transparency + Procurement (Phases 15-19) — SHIPPED 2026-03-04</summary>

- [x] Phase 15: Foundation Fixes & Ecosystem Client Layer (2/2 plans) — completed 2026-03-03
- [x] Phase 16: Field & Enterprise Compilation (2/2 plans) — completed 2026-03-03
- [x] Phase 17: Input & Seed Compilation + NOP Compliance (2/2 plans) — completed 2026-03-03
- [x] Phase 18: Rotation Snapshot & Harvest Compilation & PDF (3/3 plans) — completed 2026-03-03
- [x] Phase 19: Seed & Input Inventory Redesign (3/3 plans) — completed 2026-03-04

</details>

<details>
<summary>✅ v4.0 Cross-Module Polish & Settlement Closure (Phases 20-23) — SHIPPED 2026-03-04</summary>

- [x] Phase 20: Farm-Registry Bug Fix (1/1 plan) — completed 2026-03-04
- [x] Phase 21: Farm-Budget Field Editor Polish (2/2 plans) — completed 2026-03-04
- [x] Phase 22: FSA Crop Sync Improvement (1/1 plan) — completed 2026-03-04
- [x] Phase 23: Settlement Closure (3/3 plans) — completed 2026-03-04

</details>

<details>
<summary>✅ v5.0 Glomalin Portal — Next.js + Supabase Scaffold (Phases 24-26) — SHIPPED 2026-03-05</summary>

- [x] Phase 24: Project Scaffold + Supabase Foundation (3/3 plans) — completed 2026-03-05
- [x] Phase 25: Auth + Middleware + Route Protection (4/4 plans) — completed 2026-03-05
- [x] Phase 26: Portal UI (2/2 plans) — completed 2026-03-05

</details>

<details>
<summary>✅ v6.0 FSA Acres, Insurance & Claims (Phases 27-34) — SHIPPED 2026-03-06</summary>

- [x] Phase 27: FSA Data Foundation + Migration (2/2 plans) — completed 2026-03-05
- [x] Phase 28: FSA Planting Workflow UI (2/2 plans) — completed 2026-03-05
- [x] Phase 29: Insurance Tables + Calculation Engine (2/2 plans) — completed 2026-03-05
- [x] Phase 30: Insurance Decision Tool UI (2/2 plans) — completed 2026-03-05
- [x] Phase 31: Claims Tables + API (2/2 plans) — completed 2026-03-05
- [x] Phase 32: Claims Lifecycle UI (2/2 plans) — completed 2026-03-06
- [x] Phase 34: Insurance & Claims UI Wiring (1/1 plan) — completed 2026-03-06
- [x] Phase 33: Cross-Module Integration + Dashboard (2/2 plans) — completed 2026-03-06

</details>

### v7.0 Public Deployment & Team Onboarding (In Progress)

**Milestone Goal:** Deploy the entire 8-app farm operations platform to a public URL so 6-15 coworkers can access it with role-based permissions and email-invite onboarding. Infrastructure milestone — no new features.

- [x] **Phase 35: VPS Provisioning + Process Management** - PM2 ecosystem config, production env templates, CORS lockdown, port configuration, and Next.js production builds (completed 2026-03-07)
- [x] **Phase 36: Reverse Proxy + HTTPS** - Caddy reverse proxy with auto-HTTPS subdomain routing and deployment README (completed 2026-03-07)
- [ ] **Phase 37: Database + Backups** - Production PostgreSQL setup, daily backup scripts, and secrets documentation
- [ ] **Phase 38: Email Invite + Onboarding** - Production email invite flow, invited user signup, and password reset
- [ ] **Phase 39: Production Hardening** - Health check endpoints on all Express apps

### v8.0 ASCII Banner Strip & Design System (In Progress — Parallel Track)

**Milestone Goal:** Add an animated ASCII mycelial network banner strip as integrated design chrome across all portal module pages, unify the Glomalin design system with a canonical navy/cyan palette, and expand with additional ASCII animation scenes.

- [x] **Phase 40: ASCIIBannerStrip Component** - Standalone animated ASCII mycelial network canvas component at ~50fps with no external deps (completed 2026-03-07)
- [x] **Phase 41: App Shell Integration** - Banner wired into protected layout with mobile responsive, a11y, and user disable setting (completed 2026-03-07)
- [x] **Phase 42: Design Token Alignment & Palette Swap** - Portal-wide navy/cyan design system replacing soil palette with canonical token file (completed 2026-03-07)
- [x] **Phase 43: Scene Expansion** - Additional ASCII scenes (drone, seasonal) with easter egg toggle and crossfade transitions (completed 2026-03-07)

## Phase Details

### Phase 35: VPS Provisioning + Process Management
**Goal**: All 8 apps start, restart on crash, and run in production mode from a single PM2 ecosystem config with CORS locked to the portal domain
**Depends on**: Phase 34 (v6.0 complete — all apps feature-complete)
**Requirements**: INFRA-01, INFRA-03, INFRA-05, INFRA-06, SEC-01
**Success Criteria** (what must be TRUE):
  1. Running `pm2 start ecosystem.config.js` launches all 8 apps and they stay up (verified by `pm2 status` showing "online" for each)
  2. Each app has a `.env.example` file with every required variable documented and placeholder values
  3. grain-tickets starts on a configurable PORT (not hardcoded 3000) so it coexists with the portal
  4. Both Next.js apps (glomalin-portal, organic-cert) run via `next start` in production mode (not `next dev`)
  5. Express apps reject cross-origin requests from any domain other than the portal origin
**Plans**: 3 plans
Plans:
- [x] 35-01-PLAN.md — PM2 ecosystem config, grain-tickets port fix, Next.js production builds
- [x] 35-02-PLAN.md — CORS lockdown on Express apps, .env.example templates for all 8 apps

### Phase 36: Reverse Proxy + HTTPS
**Goal**: Users access every app through clean subdomains with automatic HTTPS — no port numbers, no HTTP
**Depends on**: Phase 35 (apps must be running on localhost ports before proxy can route to them)
**Requirements**: INFRA-02, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can open `portal.farm-domain.com` in a browser and see the Glomalin Portal landing page over HTTPS
  2. Each app is reachable at its own subdomain (e.g., `tickets.farm-domain.com`, `budget.farm-domain.com`) with a valid TLS certificate
  3. A deployment README exists with step-by-step instructions covering DNS, Caddy, PM2, Node.js, PostgreSQL, and git clone — enough for someone to rebuild the VPS from scratch
**Plans**: 3 plans
Plans:
- [x] 36-01-PLAN.md — Caddyfile with subdomain-to-port routing and auto-HTTPS for all 8 apps
- [x] 36-02-PLAN.md — DEPLOY.md step-by-step VPS setup guide (DNS, Node.js, PostgreSQL, Caddy, PM2)

### Phase 37: Database + Backups
**Goal**: Production data is safe — PostgreSQL databases run with correct credentials and daily backups protect against data loss
**Depends on**: Phase 35 (env templates define DB connection strings)
**Requirements**: SEC-02, SEC-04
**Success Criteria** (what must be TRUE):
  1. A daily cron job backs up all JSON data files and PostgreSQL databases (grain-tickets, organic-cert) with 7-day retention
  2. A backup can be restored to a fresh database and the app works correctly (verified manually at least once)
  3. A secrets document lists every production secret (Supabase keys, DB passwords, API tokens), where each one goes, and how to rotate it
**Plans**: TBD

### Phase 38: Email Invite + Onboarding
**Goal**: Admin can invite coworkers by email and they can sign up, log in, and use their granted modules — the full onboarding path works end-to-end in production
**Depends on**: Phase 36 (production domain with HTTPS required for Supabase email links)
**Requirements**: ONB-01, ONB-02, ONB-03
**Success Criteria** (what must be TRUE):
  1. Admin clicks "Invite" in the admin panel, enters a coworker email, and the coworker receives an email with a signup link pointing to the production domain
  2. Invited user clicks the link, sets a password, and lands on the dashboard showing only their granted modules
  3. User can click "Forgot password" on the login page, receive a reset email, set a new password, and log back in
**Plans**: TBD

### Phase 39: Production Hardening
**Goal**: Every Express app exposes a health check endpoint for monitoring and uptime verification
**Depends on**: Phase 35 (apps must be running under PM2)
**Requirements**: SEC-03
**Success Criteria** (what must be TRUE):
  1. Each of the 6 Express apps responds to `GET /health` with HTTP 200 and a JSON body indicating the app name and status
  2. PM2 or a simple curl script can hit all health endpoints and report which apps are up or down
**Plans**: TBD

### Phase 40: ASCIIBannerStrip Component
**Goal**: Standalone component renders an animated ASCII mycelial network on a canvas element at ~50fps with retina support, pure noise functions, and no external dependencies
**Depends on**: Nothing (greenfield component in glomalin-portal)
**Requirements**: BANNER-01, BANNER-02, BANNER-03, BANNER-04, BANNER-05, BANNER-06, BANNER-07
**Success Criteria** (what must be TRUE):
  1. Importing ASCIIBannerStrip and rendering it in any page shows a smoothly animating ASCII mycelial network at the configured height (default 72px)
  2. Resizing the browser window causes the canvas to re-measure and re-render within 150ms without visual glitch or memory leak
  3. The animation runs at ~50fps on a standard laptop, pauses when the browser tab is hidden, and cleans up all timers/RAF on unmount
  4. The bottom edge of the strip fades seamlessly into the page background via gradient overlay — no hard line visible
  5. Two ASCIIBannerStrip instances on the same page animate out of sync with each other (random time offset)
**Plans**: 3 plans
Plans:
- [x] 40-01-PLAN.md -- Extract noise utilities, refactor component API (height/className/paused)
- [x] 40-02-PLAN.md -- Enhance visual behavior: tendril growth, node lifecycle, white highlights, clock-based resume

### Phase 41: App Shell Integration
**Goal**: The ASCII banner appears on every protected page between the header and content, with mobile responsive sizing, accessibility support, and a user toggle to disable it
**Depends on**: Phase 40 (ASCIIBannerStrip component must exist)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05
**Success Criteria** (what must be TRUE):
  1. Navigating to any protected route (dashboard, module pages, admin) shows the ASCII banner between the header and page content
  2. On a mobile viewport (<768px), the banner renders at 48px height with reduced node count (6 mycelium nodes) — no horizontal scroll or layout break
  3. With prefers-reduced-motion enabled in OS settings, the banner shows a single static ASCII frame with no animation loop running
  4. A user can disable the banner entirely via their settings, and it stays disabled across page navigations and sessions
  5. On initial page load, the banner fades in smoothly (opacity 0 to 1 over 400ms) rather than popping in abruptly
**Plans**: 3 plans
Plans:
- [x] 41-01-PLAN.md — Mobile responsive nodeCount + accessibility attributes
- [x] 41-02-PLAN.md — User banner disable toggle with localStorage persistence

### Phase 42: Design Token Alignment & Palette Swap
**Goal**: The entire Glomalin Portal uses a unified navy/cyan design system defined in a canonical token file, replacing the original soil palette across all components
**Depends on**: Phase 40 (tokens inform banner colors — BANNER component must import from tokens)
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05
**Success Criteria** (what must be TRUE):
  1. A src/lib/tokens.ts file exists exporting named color constants, font stack, and spacing values — and is the single source of truth for the design system
  2. The ASCIIBannerStrip component imports all color values from tokens.ts with zero hardcoded hex strings in the component file
  3. The portal header, dashboard cards, navigation, and badges all render in the navy/cyan palette — no remnants of the old soil palette (#080604, #C8860A, #2a2218) visible
  4. tailwind.config.ts references the token values so Tailwind utility classes produce navy/cyan colors
  5. A DESIGN.md file documents the token system, font stack, spacing scale, and component color patterns — enough for a developer to build a new component in the correct style
**Plans**: 3 plans
Plans:
- [ ] 42-01-PLAN.md — Create tokens.ts, migrate Tailwind config to glomalin-* namespace, wire ASCIIBannerStrip to tokens
- [ ] 42-02-PLAN.md — Batch rename soil-* to glomalin-* across all portal components, create DESIGN.md
- [ ] 42-03-PLAN.md — Gap closure: wire remaining hardcoded hex values to tokens.ts

### Phase 43: Scene Expansion
**Goal**: Multiple ASCII animation scenes are available (mycelium, drone landscape, seasonal) with an easter egg toggle and smooth crossfade transitions between scenes
**Depends on**: Phase 40 (base rendering engine), Phase 41 (shell integration for scene display)
**Requirements**: SCENE-01, SCENE-02, SCENE-03, SCENE-04, SCENE-05
**Success Criteria** (what must be TRUE):
  1. Switching to the DRONE scene shows a procedural rolling landscape with visible cloud layer, crop rows, and depth fog — distinctly different from the mycelium scene
  2. In SEASONAL mode, the banner automatically renders a planting animation in spring, growth in summer, harvest in fall, and dormant in winter based on the current calendar month
  3. A user's scene preference persists across sessions (stored per-user), and defaults to mycelium for new users
  4. Switching scenes triggers a 200ms opacity crossfade — no flash or hard cut between the old and new scene
  5. Clicking a bright mycelium node in the banner cycles to the next scene with no visible button or toggle UI (easter egg discovery)
**Plans**: 3 plans
Plans:
- [ ] 43-01-PLAN.md — Scene engine architecture, drone landscape renderer, crossfade transitions
- [ ] 43-02-PLAN.md — Seasonal scene renderer, scene preference persistence, easter egg click-to-cycle

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Case IH API Integration | v1.0 | 3/3 | Complete | 2026-02-24 |
| 2. Field Records & History | v1.0 | 3/3 | Complete | 2026-02-25 |
| 3. Inspection Report Generation | v1.0 | 3/3 | Complete | 2026-02-25 |
| 4. Synced Harvest CropLot Wiring | v1.0 | 2/2 | Complete | 2026-02-26 |
| 5. Split-Field Schema & Acre Reconciliation | v1.1 | 2/2 | Complete | 2026-02-27 |
| 6. Multi-Enterprise Field Views | v1.1 | 2/2 | Complete | 2026-02-28 |
| 7. Split-Field PDF Reports | v1.1 | 3/3 | Complete | 2026-02-28 |
| 8. Fallow Enterprise Edit Fix | v1.1 | 1/1 | Complete | 2026-03-01 |
| 9. Database Foundation | v2.0 | 1/1 | Complete | 2026-03-02 |
| 10. Migration & Cutover | v2.0 | 2/2 | Complete | 2026-03-02 |
| 11. Buyer Registry & Ticket Extensions | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Settlement Import & Manual Entry | v2.0 | 2/2 | Complete | 2026-03-02 |
| 13. Reconciliation Engine & Discrepancy UI | v2.0 | 3/3 | Complete | 2026-03-02 |
| 14. Chat Agent (Glomalin) | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. Foundation Fixes & Ecosystem Client Layer | v3.0 | 2/2 | Complete | 2026-03-03 |
| 16. Field & Enterprise Compilation | v3.0 | 2/2 | Complete | 2026-03-03 |
| 17. Input & Seed Compilation + NOP Compliance | v3.0 | 2/2 | Complete | 2026-03-03 |
| 18. Rotation Snapshot & Harvest Compilation & PDF | v3.0 | 3/3 | Complete | 2026-03-03 |
| 19. Seed & Input Inventory Redesign | v3.0 | 3/3 | Complete | 2026-03-04 |
| 20. Farm-Registry Bug Fix | v4.0 | 1/1 | Complete | 2026-03-04 |
| 21. Farm-Budget Field Editor Polish | v4.0 | 2/2 | Complete | 2026-03-04 |
| 22. FSA Crop Sync Improvement | v4.0 | 1/1 | Complete | 2026-03-04 |
| 23. Settlement Closure | v4.0 | 3/3 | Complete | 2026-03-04 |
| 24. Project Scaffold + Supabase Foundation | v5.0 | 3/3 | Complete | 2026-03-05 |
| 25. Auth + Middleware + Route Protection | v5.0 | 4/4 | Complete | 2026-03-05 |
| 26. Portal UI | v5.0 | 2/2 | Complete | 2026-03-05 |
| 27. FSA Data Foundation + Migration | v6.0 | 2/2 | Complete | 2026-03-05 |
| 28. FSA Planting Workflow UI | v6.0 | 2/2 | Complete | 2026-03-05 |
| 29. Insurance Tables + Calculation Engine | v6.0 | 2/2 | Complete | 2026-03-05 |
| 30. Insurance Decision Tool UI | v6.0 | 2/2 | Complete | 2026-03-05 |
| 31. Claims Tables + API | v6.0 | 2/2 | Complete | 2026-03-05 |
| 32. Claims Lifecycle UI | v6.0 | 2/2 | Complete | 2026-03-06 |
| 34. Insurance & Claims UI Wiring | v6.0 | 1/1 | Complete | 2026-03-06 |
| 33. Cross-Module Integration + Dashboard | v6.0 | 2/2 | Complete | 2026-03-06 |
| 35. VPS Provisioning + Process Management | v7.0 | 2/2 | Complete | 2026-03-07 |
| 36. Reverse Proxy + HTTPS | v7.0 | 2/2 | Complete | 2026-03-07 |
| 37. Database + Backups | v7.0 | 0/? | Not started | - |
| 38. Email Invite + Onboarding | v7.0 | 0/? | Not started | - |
| 39. Production Hardening | v7.0 | 0/? | Not started | - |
| 40. ASCIIBannerStrip Component | v8.0 | 2/2 | Complete | 2026-03-07 |
| 41. App Shell Integration | v8.0 | 2/2 | Complete | 2026-03-07 |
| 42. Design Token Alignment & Palette Swap | 2/2 | Complete   | 2026-03-07 | - |
| 43. Scene Expansion | 2/2 | Complete    | 2026-03-07 | - |
