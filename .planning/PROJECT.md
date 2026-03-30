# Farm Operations Platform

## What This Is

A modular agricultural operations platform for Hughes Farm. Includes: (1) an organic certification audit system that compiles field plans, inputs, seed, rotations, and harvest data from across the ecosystem and produces print-ready USDA NOP inspection reports, (2) a grain ticket traceability system that tracks every load from combine to settlement, reconciles against buyer payments, flags discrepancies, and includes an AI chat agent for natural language data queries, (3) a farm budget system with a full procurement pipeline (forecasts, orders, deliveries, print reports), and (4) a unified portal (Glomalin Portal) built with Next.js 14 + Supabase that serves as the authenticated entry point to all farm modules with role-based access control, module-level permissions, and an admin panel. Built for farm managers and office staff who need reliable, no-nonsense operational tools.

## Core Value

Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## Completed Milestone: v1.0 Data Ingestion & Reports (2026-02-26)

**Goal:** Pull all field operation data from Case IH and produce print-ready USDA NOP inspection reports — the core data-in, report-out pipeline.

**Delivered:** Case IH API integration (OAuth2 + mock mode), field records with 3-year history and manual entry, staged ops review with approve/reject, and 8-section PDF inspection reports. 4 phases, 11 plans, 15 requirements — all complete.

## Completed Milestone: v1.1 Split-Field Enterprises (2026-03-01)

**Goal:** A single physical field can carry multiple crop enterprises in the same season. Track each enterprise individually while presenting a coherent whole-field view. Reflect split-field reality in history views and PDF reports.

**Delivered:** Split-field schema with label/fallow/cost fields, acre reconciliation API with over-allocation warnings, consolidated field views with drill-down, enterprise creation with "Save & Add Another", and all PDF report sections updated for multi-enterprise fields. 4 phases, 8 plans, 16 requirements — all complete.

## Completed Milestone: v2.0 Grain Traceability + Chat Agent (2026-03-04)

**Goal:** Replace the paper-to-spreadsheet grain ticket workflow with a digital traceability system that tracks every load from combine to settlement, reconciles against buyer payments, and flags discrepancies immediately. Plus an AI-powered chat agent for natural language grain data queries.

**Delivered:** 527 tickets migrated JSON→PostgreSQL, buyer/destination registry with crop year scoping, settlement import (CSV/Excel + manual entry), automated reconciliation engine with dispute flagging and variance detection, and Glomalin AI chat agent with streaming responses, inline charts, CSV export, and learnable notes. 6 phases, 13 plans, 24 requirements — all complete.

## Completed Milestone: v3.0 Organic Cert Transparency + Procurement (2026-03-04)

**Goal:** Rewire organic-cert from a manual data-entry app into a live compilation engine that pulls field plans, inputs, seed, rotations, and harvest data from farm-budget, farm-registry, and grain-tickets — then compiles a complete NOP inspection packet with zero double-entry. Plus procurement pipeline redesign for farm-budget.

**Delivered:** Ecosystem client layer with graceful degradation, preview/commit compilation pipeline for enterprises/inputs/seeds/harvests, NOP compliance engine with material resolution, rotation snapshot for 3-year field history, PDF null-safety for all 8 report sections, and farm-budget procurement pipeline (Forecasts, Orders, Deliveries) with 5 print reports and day/night theme. 5 phases, 12 plans, 25 requirements — all complete.

## Completed Milestone: v4.0 Cross-Module Polish & Settlement Closure (2026-03-04)

**Goal:** Fix bugs, polish the farm-budget field editor, improve FSA crop sync from macro rollup, and close the settlement reconciliation loop in grain-tickets with configurable tolerances, fuzzy matching, dispute resolution, and multi-buyer summaries.

**Delivered:** Farm-registry save fix, farm-budget field editor polish (category totals, accounting parentheses, Orders/Deliveries tabs), FSA crop sync from macro rollup with side-by-side preview, and grain-tickets settlement closure (configurable tolerance, fuzzy matching, dispute resolution workflow, multi-buyer season summary). 4 phases, 7 plans, 14 requirements — all complete.

## Completed Milestone: v5.0 Glomalin Portal — Next.js + Supabase Scaffold (2026-03-05)

**Goal:** Build a unified portal app (glomalin-portal/) using Next.js 14 App Router + Supabase that serves as the authenticated entry point to all farm modules, with role-based access control, module-level permissions, admin user management, and a React Flow node map on the landing page.

**Delivered:** Next.js 14 project with dark soil Tailwind palette, Supabase schema (profiles, module_access, RLS, auto-profile trigger), email/password auth with middleware route protection (auth + admin RBAC + module access), admin panel with user/role/module management, React Flow hub-and-spoke node map on public landing page, dashboard with access-aware module cards, and dynamic module shell pages. 3 phases, 9 plans, 15 requirements — all complete.

## Completed Milestone: v6.0 FSA Acres, Insurance & Claims (2026-03-06)

**Goal:** Transform the FSA Acres module from a flat spreadsheet into an intuitive, guided workflow — then extend with an interactive crop insurance decision tool and a structured claims tracking system. All built inside glomalin-portal/ (Next.js 14 + Supabase).

**Delivered:** Card-based CLU editor with bulk actions and validation, FSA acreage reporting PDF, insurance coverage matrix and payout simulator, claims Kanban with document upload and timeline, cross-module navigation (CLU→Policy→Claim), dashboard summary cards, APH auto-populate, yield sync, and file-claim flow. 8 phases, 15 plans, 27 requirements — all complete.

## Completed Milestone: v7.0 Public Deployment & Team Onboarding (Shipped: 2026-03-08)

**Goal:** Deploy the entire 8-app farm operations platform to a public URL with PM2, Caddy, auto-HTTPS, and team onboarding.

**Delivered:** PM2 ecosystem config, Caddy reverse proxy with subdomain routing and embed path proxying, production PostgreSQL for grain-tickets and organic-cert, daily backup scripts, health checks, email invite flow. 5 phases, 8 plans — all complete.

## Completed Milestone: v8.0 ASCII Banner Strip & Design System (2026-03-08)

**Goal:** Add an animated ASCII mycelial network banner strip as integrated design chrome across all portal module pages, unify the Glomalin design system with a canonical navy/cyan palette, and expand with additional ASCII animation scenes.

**Delivered:** ASCIIBannerStrip canvas component with pure noise functions (~50fps, retina, no external deps), app shell integration (mobile responsive, a11y, user disable toggle), canonical tokens.ts with navy/cyan palette (37 files migrated from soil-* to glomalin-*), multi-scene engine (drone, seasonal, mycelium) with 200ms crossfade and easter egg scene cycling. 4 phases, 9 plans, 22 requirements — all complete.

## Completed Milestone: v9.0 Mobile PWA + Field Operations Logger (2026-03-26)

**Goal:** PWA with offline crop plan viewer, field pass logger, offline sync engine, and grain-tickets offline entry.

**Delivered:** @serwist/next service worker with IndexedDB wrapper, mobile-first crop plan viewer, field pass logger writing to organic-cert, offline sync engine with Background Sync and conflict detection, grain-tickets offline entry with dashboard caching. 5 phases, 11 plans.

## Completed Milestone: v10.0 Platform Consolidation & Data Integrity (2026-03-26)

**Goal:** Eliminate scattered data, duplicate stores, and manual re-entry across the 8-app ecosystem.

**Delivered:** Canonical field IDs and crop registry across all apps, FSA/insurance data consolidated to Supabase, automatic yield pipeline (grain-tickets → insurance → budget), seed-inventory → organic-cert pipeline, meristem-malt → grain-tickets price pipeline, unified color tokens in platform-tokens.css, iframe embed breadcrumb navigation, cross-origin theme cascade. 6 phases, 20 plans, 25 requirements — all complete. Phases 55-61 (domain features) deferred to v11.0.

## Completed Milestone: v11.0 Domain Features & Workflow Automation (2026-03-30)

**Goal:** Build domain-specific views and workflow automation on top of the consolidated data platform — actionable dashboard, APH database, grain marketing, field timeline, prevented planting, settlement summaries, and auto field propagation.

**Delivered:** Actionable dashboard replacing static module cards (Promise.allSettled graceful degradation), structured APH database with computed APH and insurance guarantee auto-calc, grain marketing position with CBOT exposure and contract entry (6 types), unified field activity timeline from 4 sources, prevented planting indemnity calculator with PDF integration, settlement financial summary with contract price variance, auto field propagation (farm-registry → farm-budget + grain-tickets + portal), and production gap fixes (webhook auth 403, localhost autocomplete). 10 phases (55–63), 19 plans, 18 requirements — all complete.

## Requirements

### Validated

- ✓ NextAuth authentication with bcryptjs password hashing — existing
- ✓ Role-based access control (RBAC) for multi-user access — existing
- ✓ Prisma ORM with PostgreSQL for structured data — existing
- ✓ Field enterprise management with operations logging — existing
- ✓ Audit logger middleware tracking CREATE/UPDATE/DELETE events — existing
- ✓ Lot number auto-generation per NOP standard (cropYear-crop-fieldName) — existing
- ✓ Mass balance calculations for fertility inputs (C5.0 rules) — existing
- ✓ CSV import/export for organic cert data — existing
- ✓ PDF generation via @react-pdf/renderer — existing
- ✓ shadcn/Radix UI component library with Tailwind CSS — existing
- ✓ Case IH FieldOps API integration with OAuth2 and mock data mode — v1.0
- ✓ Input application records (material, date, rate, field, approval status) — v1.0
- ✓ 3-year field history and crop rotation tracking per parcel — v1.0
- ✓ Harvest records with yield, lot numbers, equipment, and data source — v1.0
- ✓ Tillage operation records from Case IH — v1.0
- ✓ Print-ready USDA NOP inspection report as 8-section PDF — v1.0
- ✓ Multiple enterprises per field per season (split planting, double-cropping) — v1.1
- ✓ Fallow/idle enterprise type with overhead cost tracking — v1.1
- ✓ Acre reconciliation (enterprise acres vs field total) — v1.1
- ✓ Consolidated field view with drill-down to per-enterprise detail — v1.1
- ✓ Multi-enterprise season cards in field history — v1.1
- ✓ Intuitive navigation — default consolidated view, drill into enterprise on demand — v1.1
- ✓ PDF reports reflect split-field reality (field list, history, mass balance) — v1.1
- ✓ JSON→PostgreSQL migration with zero data loss (527 tickets) — v2.0
- ✓ Ticket CRUD against PostgreSQL with calc.js parity — v2.0
- ✓ Buyer registry with destination selection and per-buyer column mapping — v2.0
- ✓ cropYear field for season scoping and buyer/destination filtering — v2.0
- ✓ Settlement import (CSV/Excel) with column mapping preview — v2.0
- ✓ Manual settlement entry for paper-only buyers — v2.0
- ✓ Automated ticket-settlement matching with dispute flagging — v2.0
- ✓ Unmatched loads view and settlement summary comparisons — v2.0
- ✓ Claude-powered AI chat agent (Glomalin) with streaming, charts, learnable notes — v2.0
- ✓ Ecosystem client layer with graceful degradation — v3.0
- ✓ Preview/commit compilation pipeline (enterprises, inputs, seeds, harvests) — v3.0
- ✓ NOP compliance engine with material resolution — v3.0
- ✓ Rotation snapshot for 3-year NOP field history — v3.0
- ✓ PDF null-safety for compiled ecosystem data — v3.0
- ✓ Procurement pipeline (Forecasts, Orders, Deliveries) with 5 print reports — v3.0
- ✓ Farm-registry field save fix (acres/ownership/growerId persistence) — v4.0
- ✓ Farm-budget field editor category totals and accounting parentheses — v4.0
- ✓ Farm-budget Orders and Deliveries tabs visible and functional — v4.0
- ✓ FSA crop sync from farm-budget macro rollup with side-by-side preview — v4.0
- ✓ Configurable weight discrepancy tolerance per crop — v4.0
- ✓ Multi-buyer season summary with totals, payment status, variance — v4.0
- ✓ Fuzzy settlement matching by date + weight — v4.0
- ✓ Disputed ticket resolution workflow with status, notes, date — v4.0
- ✓ Supabase auth with email/password login and session management — v5.0
- ✓ Role-based access control (admin, agronomist, operator, viewer) via Supabase profiles — v5.0
- ✓ Per-module access control with admin-managed grants — v5.0
- ✓ Admin panel for user + module access management — v5.0
- ✓ Dashboard with module cards reflecting access state — v5.0
- ✓ React Flow node map on public landing page — v5.0
- ✓ Middleware route protection (auth + role + module checks) — v5.0
- ✓ Module shell pages for macro-rollup, farm-registry, org-cert, inputs-seeds, fsa-reporting — v5.0
- ✓ Card-based FSA CLU editor with bulk actions, validation, and acreage reporting PDF — v6.0
- ✓ Insurance coverage matrix, payout simulator, and APH auto-populate — v6.0
- ✓ Claims Kanban with document upload, timeline feed, and cross-module navigation — v6.0
- ✓ PM2 ecosystem config, CORS lockdown, production env templates, Caddy reverse proxy — v7.0
- ✓ Daily backup scripts for JSON + PostgreSQL with secrets documentation — v7.0
- ✓ Email invite, signup, and password reset flows wired for production — v7.0
- ✓ ASCIIBannerStrip canvas component with pure noise functions (~50fps, retina, no deps) — v8.0
- ✓ App shell integration — banner in protected layout, mobile responsive, a11y, user toggle — v8.0
- ✓ Navy/cyan design token system (tokens.ts) replacing soil palette across 37 files — v8.0
- ✓ Multi-scene engine (drone, seasonal, mycelium) with crossfade and easter egg cycling — v8.0
- ✓ PWA infrastructure with service worker, manifest, install prompt, IndexedDB wrapper — v9.0
- ✓ Mobile crop plan viewer with offline caching — v9.0
- ✓ Field pass logger writing to organic-cert FieldOperation table — v9.0
- ✓ Offline sync engine with Background Sync, conflict detection, retry logic — v9.0
- ✓ Grain-tickets offline entry with dashboard caching and staleness indicators — v9.0
- ✓ Canonical field IDs (registry_field_id) across all apps with backfill scripts — v10.0
- ✓ Canonical crop registry in farm-registry with per-app aliases — v10.0
- ✓ FSA/insurance data consolidated to single Supabase store — v10.0
- ✓ Automatic yield pipeline (grain-tickets → insurance → budget) — v10.0
- ✓ Seed-inventory → organic-cert seed data pipeline — v10.0
- ✓ Meristem-malt grain cost from grain-ticket settlements — v10.0
- ✓ Unified color tokens (platform-tokens.css) across all 8 apps — v10.0
- ✓ Iframe embed breadcrumb navigation and cross-origin theme cascade — v10.0
- ✓ Actionable dashboard with live action items and graceful offline degradation — v11.0
- ✓ Structured APH database with computed APH and insurance guarantee auto-calc — v11.0
- ✓ Grain marketing position view (contracted vs unpriced bushels, CBOT exposure, 6 contract types) — v11.0
- ✓ Unified field activity timeline from 4 data sources with color-coded entries — v11.0
- ✓ Prevented planting indemnity calculator with PDF integration — v11.0
- ✓ Settlement financial summary with per-buyer per-crop revenue and contract variance — v11.0
- ✓ Auto field propagation (farm-registry → farm-budget + grain-tickets + portal, retry-once) — v11.0

### Active

(None — v11.0 shipped. Run `/gsd:new-milestone` to define v12.0 requirements.)

### Deferred

- Append-only audit store with tamper-evidence (signed/checksummed entries)
- Audit viewer with filtering by user/resource/time
- Audit log export for regulators
- Photo evidence attachment for field documentation
- Multi-certifier support (EU, state programs) — USDA NOP only
- Inspector portal/login — inspectors receive print reports, not digital access
- Crop Year Accounting & QBO Integration (see .planning/v5.0-VISION.md)

### Out of Scope

- Native mobile app — PWA approach chosen instead (v9.0)
- Real-time field notifications — not needed for audit prep workflow
- Automated compliance scoring — inspector makes the call, we provide the records
- GIS/map-based split definition — label-based is sufficient for NOP audit
- Enterprise-level organic status — NOP certifies at field level
- Automated split detection from Case IH data — Case IH doesn't report sub-field splits
- Rewriting farm-budget or grain-tickets — organic-cert reads from them, doesn't modify them
- Elevator-side software — Hughes Farm is the seller, not the elevator
- Real-time futures price integration — prices come from contracts already signed
- Automated PDF settlement parsing — PDF formats vary wildly
- User signup/registration flow — admin creates users; no self-registration

## Context

Modular ag ecosystem with independent apps: organic-cert (~85K LOC, Next.js 16 + Prisma 6 + PostgreSQL), farm-budget (Express + JSON, port 3001), fsa-acres, grain-tickets (Express + Prisma + PostgreSQL, port 3000), meristem-malt, farm-registry (Express + JSON, port 3005), glomalin-portal (Next.js 14 + Supabase, navy/cyan design system). All apps share the farm-registry for field data. Glomalin Portal is the unified auth entry point with animated ASCII banner, multi-scene rendering, and RBAC-gated modules (FSA, Insurance, Claims, Grain Marketing, Field Timeline, Settlement Summary).

**Port map:** 3000 grain-tickets, 3001 farm-budget, 3002 fsa-acres, 3003 meristem-malt, 3004 organic-cert, 3005 farm-registry, 3006 glomalin-portal (Next.js dev)

**Total shipped:** 134 plans across 63 phases in 11 milestones (v1.0 through v11.0). Production deployed (PM2 + Caddy + Supabase on VPS). All portal→Express cross-module calls use server-side `fetchRegistryService`/`fetchBudgetService`/etc. proxy pattern (no localhost in client code).

Primary users are farm office staff (daily ticket entry) and farm manager (farm planning, certification, settlement reconciliation).

## Constraints

- **Tech stack**: Next.js + React + Prisma + PostgreSQL (organic-cert); Express + vanilla JS (grain-tickets, farm-budget); Next.js 14 + Supabase (glomalin-portal)
- **Data source**: Case IH Field Ops API (OAuth2, CNH Industrial endpoints)
- **Output format**: Print-ready PDF reports for on-site inspector review
- **UX philosophy**: Farming-first, minimal clicks, "get shit done" — no unnecessary complexity
- **Ecosystem fit**: Must integrate with existing modular farm app ecosystem
- **Auth**: Supabase for glomalin-portal; NextAuth for organic-cert (legacy)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-first, defer native mobile | Get audit system working first; responsive design bridges the gap | ✓ Good — shipped v1.0 web-only |
| Print-ready PDF over digital inspector portal | Inspectors work on-site with paper; digital portal adds complexity without value | ✓ Good — 8-section PDF covers NOP needs |
| USDA NOP only for v1 | Focus on one standard well before expanding to multi-certifier | ✓ Good — kept scope tight |
| Build on existing organic-cert Next.js app | Already has auth, RBAC, Prisma, audit logging — don't rebuild | ✓ Good — leveraged existing 70K+ LOC |
| Case IH API integration (not file export) | Real-time data pull is more reliable than manual CSV uploads | ✓ Good — OAuth2 flow works; mock mode bridges staging gap |
| v1.0 focused on data pipeline + reports | Get Case IH data in, inspection reports out — defer audit infrastructure to v2 | ✓ Good — delivered core value in 3 days |
| Mock data mode for staging API gap | CNH staging has no API audience registered; mock data lets development continue | ⚠️ Revisit — need production credentials |
| Manual data wins over synced data | 409 conflict on approve when manual record exists for same date/type | ✓ Good — protects manual corrections |
| Nullable label (not required) for enterprise splits | Single-enterprise fields keep working with label=null, no migration needed | ✓ Good — backward compatible |
| Keep Express for grain-tickets | Working PWA with solid UI — rewrite adds no user value | ✓ Good — shipped v2.0 without framework change |
| Prisma 6 + PostgreSQL for grain-tickets | Settlement reconciliation is relational; flat JSON can't handle cross-entity queries | ✓ Good — enabled reconciliation engine |
| Reconcile on net weight in pounds | Each buyer computes bushels differently (shrink methods vary) | ✓ Good — clean variance detection |
| Organic-cert as compilation engine | Farm-budget is source of truth; duplicating data entry is wasteful | ✓ Good — zero double-entry achieved |
| Yearly rotation snapshots | Farm-budget is single-season; organic-cert must accumulate rotation history | ✓ Good — NOP 3-year history works |
| claude-haiku for Glomalin agent | Cost-effective for high-frequency grain queries | ✓ Good — responsive and affordable |
| Glomalin Portal as separate Next.js 14 project | Greenfield in glomalin-portal/ — don't modify existing working modules | ✓ Good — clean separation, no regressions |
| Supabase over NextAuth for portal | Supabase provides auth + DB + RLS in one; portal is new project, no legacy constraint | ✓ Good — simpler than Prisma + NextAuth combo |
| No self-registration for v5.0 | Admin creates users; small team doesn't need signup flow | ✓ Good — kept scope minimal |
| Dark soil aesthetic for portal | Farm-first branding (#080604 bg, #C8860A accent, JetBrains Mono) | ⚠️ Revisit — replaced by navy/cyan in v8.0 |
| React Flow for landing page node map | Visual representation of farm ecosystem; hub-and-spoke layout shows data flow | ✓ Good — 12-node map with animated edges |
| Build FSA/Insurance/Claims inside glomalin-portal | Existing fsa-acres/ is Express+JSON; portal has Next.js 14 + Supabase + auth already | ✓ Good — shipped v6.0, all 27 reqs met |
| All three modules in one v6.0 milestone | Large scope but cohesive — FSA, insurance, and claims are tightly interconnected | ✓ Good — cohesion justified; shipped in 2 days |
| Supabase for FSA/Insurance/Claims data | Consistent with portal architecture; RLS for access control already in place | ✓ Good — RLS + FK chains work well |
| PM2 on bare metal VPS (not Docker) | Simpler for 6-15 users; no container orchestration needed | ✓ Good — all 8 apps running in production |
| Navy/cyan palette replacing soil aesthetic | Glomalin identity — distinctive, professional, cohesive with ASCII banner art | ✓ Good — 37 files migrated, zero hardcoded hex |
| Canvas-only ASCII rendering (no external animation deps) | Pure TypeScript noise functions; no bundle bloat | ✓ Good — 1,241 LOC, ~50fps, retina support |
| Easter egg scene toggle (not visible UI) | Discovery mechanic; keeps banner chrome clean | ✓ Good — bright-node click cycling works well |
| localStorage for banner/scene prefs (not Supabase) | No schema changes; instant toggle; orthogonal controls | ✓ Good — simpler, no migration needed |
| @serwist/next for PWA service worker | Framework-aligned SW tooling for Next.js; handles precaching and routing | ✓ Good — clean offline shell |
| IndexedDB for offline queue (not localStorage) | Structured data, async API, no 5MB limit; stores pending ops and cached crop plans | ✓ Good — handles conflict detection |
| Background Sync API for replay | Browser-native retry when connectivity returns; degrades gracefully | ✓ Good — reliable offline→online transition |
| Canonical field IDs via registry_field_id FK | Eliminates fragile string-name matching across 8 apps | ✓ Good — enables clean cross-module joins |
| Crop registry in farm-registry (not portal) | farm-registry is already the field authority; natural home for crop canonical list | ✓ Good — Express apps can fetch without Supabase |
| Consolidate FSA/insurance to portal Supabase | Eliminates JSON duplication in fsa-acres; RLS for access control | ✓ Good — single source of truth achieved |
| postMessage for cross-origin theme sync | organic-cert is cross-origin; localStorage events don't cross origins | ✓ Good — instant theme cascade |
| Defer phases 55-61 to v11.0 | Domain features (dashboards, calculators) build on top of consolidation, not part of it | ✓ Good — shipped as v11.0 |
| Promise.allSettled for dashboard aggregation | Dashboard must stay up when Express apps are offline — partial data > blank screen | ✓ Good — graceful degradation confirmed |
| grain_contracts in portal Supabase (not grain-tickets) | Portal is the grain marketing home; keeps contract data with RBAC access control | ✓ Good — enables cross-module variance calc |
| `fetchRegistryService` proxy pattern for all portal→Express calls | Prevents localhost URLs from escaping to client browser; server-side proxying is the correct pattern | ✓ Good — applied consistently across 5+ routes |
| Auto field propagation as fire-and-forget + retry once | Farm-registry save should never be blocked by downstream failures | ✓ Good — field adds work even when apps are offline |
| Gap phases (57.1, 62, 63) for production breaks | Hardcoded localhost URLs in client code silently fail in production — requires dedicated fix phases | ✓ Good — all three production breaks resolved |

---
*Last updated: 2026-03-30 after v11.0 milestone shipped*
