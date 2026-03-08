# Milestones

## v1.0 Data Ingestion & Reports (Shipped: 2026-02-26)

**Phases completed:** 4 phases, 11 plans
**Timeline:** 3 days (2026-02-24 → 2026-02-26)
**Stats:** 53 files changed, 11,287 insertions, 1,194 deletions

**Key accomplishments:**
- Case IH FieldOps API integration with OAuth2 client, Zod-validated normalizer, and mock data mode
- Admin sync hub with cmdk field matching, staged ops review, approve/reject workflow
- Field records with 3-year history timeline, season grouping, filter bar, and activity stats
- Manual entry forms (tillage, application, harvest) with equipment selector and batch entry
- Print-ready USDA NOP inspection reports as 8-section PDF (cover through mass balance)
- Synced harvest CropLot wiring with atomic lot creation and lot numbers in all reports

**Archive:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---


## v1.1 Split-Field Enterprises (Shipped: 2026-03-01)

**Delivered:** A single physical field can carry multiple crop enterprises in the same season — split planting, double-cropping, and fallow tracking all reflected accurately in history views and PDF reports.

**Phases completed:** 5-8 (8 plans total)
**Timeline:** 3 days (2026-02-27 → 2026-03-01)
**Stats:** 10 files changed, 2,683 insertions, 77 deletions (~85K LOC TypeScript total)

**Key accomplishments:**
- Split-field schema: FieldEnterprise with label, isFallow, and fallow cost fields; composite unique constraint enabling multiple enterprises per field per season
- Acre reconciliation API: acreWarning on over-allocation, acreUtilization for multi-enterprise fields, fallow remainder calculation
- Multi-enterprise field views: consolidated field cards with enterprise count badge, drill-down season cards, breadcrumb navigation, enterprise creation with "Save & Add Another"
- PDF reports updated for split-field reality: parent+sub-row field list, enterprise-filtered history, labeled harvest and application logs, correct mass balance aggregation
- Fallow enterprise edit fix: openEdit() pre-fill and handleSave() serialization to prevent silent cost data loss (INT-01 closure)

**Git range:** `feat(05-01)` → `fix(08-01)` (10 commits in organic-cert)

**What's next:** TBD — grain ticket enhancements or next organic-cert feature milestone

**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) | [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

---


## v2.0 Grain Traceability + Chat Agent (Shipped: 2026-03-04)

**Delivered:** Digital grain traceability from combine to settlement — 527 tickets migrated to PostgreSQL, buyer registry with destination tracking, settlement import (CSV/Excel + manual entry), automated reconciliation engine with discrepancy detection, and Glomalin AI chat agent for natural language grain data queries.

**Phases completed:** 9-14 (6 phases, 13 plans)
**Timeline:** 8 days (2026-02-23 → 2026-03-02)
**Stats:** 84 files changed, 47,228 insertions, 1,497 deletions
**Requirements:** 24/24 complete (DB-01..04, BUY-01..03, TKT-01..02, SET-01..04, REC-01..05, CHT-01..02, AGT-01..04)

**Key accomplishments:**
- Migrated 527 grain tickets from JSON flat-file to PostgreSQL with zero data loss (Prisma 6.19.2)
- Buyer/destination registry with dropdown selection, crop year scoping, and per-buyer column mapping
- Settlement import system — CSV/Excel with column mapping preview + manual entry for paper-only buyers
- Reconciliation engine — automated ticket-settlement matching, dispute flagging, unmatched load detection, settlement summary comparisons
- Glomalin AI chat agent — Claude-powered conversational interface with SSE streaming, inline Chart.js charts, CSV export, learnable notes, and kill switch

**Git range:** `feat(09-01)` → `feat(14-03)`

**Archive:** [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) | [milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) | [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md)

---


## v3.0 Organic Cert Transparency + Procurement (Shipped: 2026-03-04)

**Delivered:** Organic-cert rewired from manual data-entry to a live compilation engine pulling from farm-budget, farm-registry, and grain-tickets. Farm-budget extended with procurement pipeline (Forecasts, Orders, Deliveries) and 5 print reports.

**Phases completed:** 15-19 (5 phases, 12 plans)
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Stats:** ~56 files changed, ~14,800 insertions, ~599 deletions
**Requirements:** 25/25 complete (FIX-01..03, ECO-01..05, CMP-01..05, ROT-01..03, HRV-01..02, PDF-01..02, INV-01..05)

**Key accomplishments:**
- Fixed 3 blocking bugs (sync-registry crash, enterprise truncation, partial unique index)
- Ecosystem client layer connecting organic-cert to farm-budget, farm-registry, and grain-tickets with graceful degradation
- Preview/commit compilation pipeline for enterprises, inputs, seeds, and harvests — zero double-entry
- NOP compliance engine with material resolution and compliance badges
- Rotation snapshot for 3-year NOP field history (calendar-gated for season rebuild)
- PDF null-safety for all 8 NOP inspection report sections from compiled ecosystem data
- Farm-budget procurement pipeline — Forecast Hub, Orders, Deliveries with 5 print reports and day/night theme

**Git range:** `fix(15-01)` → `feat(19-03)` (organic-cert + grain-tickets main)

**Archive:** [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) | [milestones/v3.0-REQUIREMENTS.md](milestones/v3.0-REQUIREMENTS.md)

---


## v4.0 Cross-Module Polish & Settlement Closure (Shipped: 2026-03-04)

**Delivered:** Bug fixes, field editor polish, FSA crop sync from macro rollup, and settlement reconciliation closure with configurable tolerances, fuzzy matching, dispute resolution, and multi-buyer season summaries.

**Phases completed:** 20-23 (4 phases, 7 plans)
**Requirements:** 14/14 complete (FIX-01..02, BUD-01..04, FSA-01..04, REC-01..04)

**Key accomplishments:**
- Farm-registry field save fix — reportingAcres, organicAcres, ownership, growerId all persist correctly
- Farm-budget field editor polish — category subtotals, COP coloring, accounting parentheses, Orders/Deliveries tabs
- FSA crop sync from farm-budget macro rollup with enterprise-level side-by-side acres preview
- Grain-tickets settlement closure — configurable tolerance, fuzzy matching by date+weight, dispute resolution workflow, multi-buyer season summary

**Git range:** `feat(20-01)` → `feat(23-02)` (17 commits)

**Archive:** (inline in ROADMAP.md)

---

## v5.0 Glomalin Portal — Next.js + Supabase Scaffold (Shipped: 2026-03-05)

**Delivered:** Unified portal app (glomalin-portal/) built with Next.js 14 App Router + Supabase. Authenticated entry point to all farm modules with role-based access control, module-level permissions, admin user management, and a React Flow farm ecosystem node map on the public landing page.

**Phases completed:** 24-26 (3 phases, 9 plans)
**Timeline:** 1 day (2026-03-04 → 2026-03-05)
**Stats:** 57 files changed, 10,891 insertions, 35 deletions (~1,848 LOC TypeScript/CSS)
**Requirements:** 15/15 complete (SCF-01..03, SUP-01..02, AUTH-01..02, RBAC-01..04, UI-01..04)

**Key accomplishments:**
- Next.js 14 App Router project with dark soil Tailwind palette (7 color tokens), JetBrains Mono, and Supabase SSR clients
- Supabase schema with profiles, module_access, RLS policies, auto-profile trigger, and admin write migration
- Email/password auth with login page, forgot password, server actions, and session management
- Middleware route protection — auth redirect, admin RBAC (silent denial), module access checks with denied toast
- Admin panel with user table, role dropdowns, module toggle switches, and email invite flow
- React Flow hub-and-spoke node map (12 nodes, 11 animated edges, hover tooltips) on public landing page
- Dashboard with access-aware module cards (locked/unlocked) and dynamic module shell pages

**Git range:** `feat(24-01)` → `feat(26-02)` (17 commits in glomalin-portal)

**Known tech debt:** browser.ts Supabase client unused, no admin nav link in header, REQUIREMENTS.md traceability stale

**Archive:** [milestones/v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) | [milestones/v5.0-REQUIREMENTS.md](milestones/v5.0-REQUIREMENTS.md) | [milestones/v5.0-MILESTONE-AUDIT.md](milestones/v5.0-MILESTONE-AUDIT.md)

---


## v6.0 FSA Acres, Insurance & Claims (Shipped: 2026-03-06)

**Delivered:** FSA planting workflow, crop insurance decision tool, and claims lifecycle — all inside Glomalin Portal with cross-module navigation and dashboard integration.

**Phases completed:** 27-34 (8 phases, 15 plans)
**Requirements:** 27/27 complete (FSA-01..08, INS-01..08, CLM-01..07, INT-01..04)

**Key accomplishments:**
- FSA Data Foundation: Supabase tables (clu_records, insurance_policies, claims) with Express migration bridge
- Card-based CLU editor with bulk actions, validation, and acreage reporting PDF
- Insurance coverage matrix, payout simulator, and APH auto-populate
- Claims Kanban with document upload, timeline feed, and dispute tracking
- Cross-module integration dashboard with summary cards and CLU→Policy→Claim navigation

**Archive:** (inline in ROADMAP.md)

---

## v8.0 ASCII Banner Strip & Design System (Shipped: 2026-03-08)

**Delivered:** Animated ASCII mycelial network banner with multi-scene rendering (drone, seasonal, mycelium), unified navy/cyan design token system replacing the soil palette, and app shell integration with mobile responsive, a11y, and user controls.

**Phases completed:** 40-43 (4 phases, 9 plans)
**Timeline:** 1 day (2026-03-07)
**Stats:** 74 files changed, 5,716 insertions, 522 deletions (1,241 LOC new TypeScript)
**Requirements:** 22/22 complete (BANNER-01..07, SHELL-01..05, TOKEN-01..05, SCENE-01..05)

**Key accomplishments:**
- ASCIIBannerStrip canvas component with pure noise functions, tendril growth, node lifecycle, white highlights, ~50fps animation
- App shell integration — banner in protected layout, mobile responsive (48px/6 nodes), prefers-reduced-motion, user disable toggle
- Canonical tokens.ts with navy/cyan palette — migrated 37 portal files from soil-* to glomalin-* Tailwind classes, zero hardcoded hex
- Multi-scene engine: drone landscape (terrain/crops/clouds/fog), seasonal animations (4 month-based scenes), 200ms crossfade transitions
- Easter egg scene cycling via bright-node click, localStorage persistence for both scene preference and banner disabled state

**Git range:** `feat(40-01)` → `feat(42-03)` (14 commits in glomalin-portal)

**Archive:** [milestones/v8.0-ROADMAP.md](milestones/v8.0-ROADMAP.md) | [milestones/v8.0-REQUIREMENTS.md](milestones/v8.0-REQUIREMENTS.md) | [milestones/v8.0-MILESTONE-AUDIT.md](milestones/v8.0-MILESTONE-AUDIT.md)

---

