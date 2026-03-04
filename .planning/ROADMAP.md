# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Grain Traceability + Chat Agent** — Phases 9-14 (shipped 2026-03-04) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Organic Cert Transparency + Procurement** — Phases 15-19 (shipped 2026-03-04) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Cross-Module Polish & Settlement Closure** — Phases 20-23 (shipped 2026-03-04)
- 🚧 **v5.0 Glomalin Portal — Next.js + Supabase Scaffold** — Phases 24-26 (in progress)

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
- [x] Phase 14: Chat Agent — Glomalin (3/3 plans) — completed 2026-03-03

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

### 🚧 v5.0 Glomalin Portal — Next.js + Supabase Scaffold (In Progress)

**Milestone Goal:** Build a unified portal app (glomalin-portal/) using Next.js 14 App Router + Supabase that serves as the authenticated entry point to all farm modules, with role-based access control, module-level permissions, admin user management, and a React Flow node map on the landing page.

- [ ] **Phase 24: Project Scaffold + Supabase Foundation** - Next.js 14 project initialized with Tailwind dark soil config, Supabase schema deployed, and both browser/server clients wired for SSR
- [ ] **Phase 25: Auth + Middleware + Route Protection** - Login page functional, middleware redirects unauthenticated users, role checks block admin routes, module access checks block denied module routes
- [ ] **Phase 26: Portal UI** - Public landing page with React Flow node map, dashboard with access-aware module cards, admin panel for user/access management, and module shell pages

## Phase Details

### Phase 24: Project Scaffold + Supabase Foundation
**Goal**: A working Next.js 14 App Router project exists in glomalin-portal/ with Tailwind configured for the dark soil palette, all Supabase infrastructure deployed (schema, RLS, auto-profile trigger), and both browser and server clients operational for SSR
**Depends on**: Nothing (greenfield project in new directory)
**Requirements**: SCF-01, SCF-02, SCF-03, SUP-01, SUP-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` in glomalin-portal/ starts a Next.js 14 App Router project on a local port with no errors
  2. The dark soil color palette (bg #080604, surface #0e0c0b, accent #C8860A, font-mono) is applied globally via Tailwind config and visible on any page
  3. A Supabase schema with profiles and module_access tables, RLS policies, and auto-profile trigger is deployable from a schema.sql file and passes a smoke test (insert user, read profile)
  4. A .env.local.example file documents all required Supabase environment variables
  5. lib/modules.js defines all 5 portal modules (macro-rollup, farm-registry, org-cert, inputs-seeds, fsa-reporting) with id, label, sublabel, and route
**Plans**: 3 plans
Plans:
- [ ] 24-01-PLAN.md — Scaffold Next.js 14 App Router + Tailwind dark soil palette + JetBrains Mono
- [ ] 24-02-PLAN.md — Supabase schema SQL (profiles, module_access, RLS, trigger) + seed data
- [ ] 24-03-PLAN.md — Module registry + Supabase browser/server clients + env documentation

### Phase 25: Auth + Middleware + Route Protection
**Goal**: Users can log in with email and password, unauthenticated requests are redirected to /login by middleware, admin routes reject non-admin users, and module routes enforce per-user access grants
**Depends on**: Phase 24
**Requirements**: AUTH-01, AUTH-02, RBAC-01, RBAC-02, RBAC-03, RBAC-04
**Success Criteria** (what must be TRUE):
  1. User navigates to /login, enters valid email and password, and is redirected to /dashboard with an active session
  2. User navigates directly to /dashboard (or any protected route) without a session and is redirected to /login
  3. A user with role viewer or operator navigates to /admin and is redirected to /dashboard
  4. A user without access to a module navigates to /app/org-cert (or any module route) and is redirected to /dashboard?denied=true
  5. Admin opens the admin panel, toggles a user's module access or changes their role, and the change takes effect immediately on the next protected request
**Plans**: TBD

### Phase 26: Portal UI
**Goal**: The portal has a public landing page with the React Flow farm ecosystem node map, a dashboard with access-aware module cards, an admin panel for managing users and module access, and placeholder shell pages for all 5 modules
**Depends on**: Phase 25
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user visits the landing page and sees a React Flow node map of the farm ecosystem rendered with the dark soil aesthetic
  2. Authenticated user visits /dashboard and sees module cards — cards for modules they have access to link through, cards for modules they lack access to are visually locked/grayed
  3. Admin visits /admin and sees a user table with per-module toggle switches and a role dropdown; toggling a switch or changing a role persists the change
  4. User with access visits /app/macro-rollup (or any module route) and sees a shell page with the module name and a "coming soon" placeholder
**Plans**: TBD

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
| 24. Project Scaffold + Supabase Foundation | v5.0 | 0/TBD | Not started | - |
| 25. Auth + Middleware + Route Protection | v5.0 | 0/TBD | Not started | - |
| 26. Portal UI | v5.0 | 0/TBD | Not started | - |
