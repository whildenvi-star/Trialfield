# Farm Operations Platform

## What This Is

A modular agricultural operations platform for Hughes Farm. Currently includes: (1) an organic certification audit system that compiles field plans, inputs, seed, rotations, and harvest data from across the ecosystem and produces print-ready USDA NOP inspection reports, (2) a grain ticket traceability system that tracks every load from combine to settlement, reconciles against buyer payments, flags discrepancies, and includes an AI chat agent for natural language data queries, and (3) a farm budget system with a full procurement pipeline (forecasts, orders, deliveries, print reports). Built for farm managers and office staff who need reliable, no-nonsense operational tools.

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

## Current Milestone: v5.0 Glomalin Portal — Next.js + Supabase Scaffold

**Goal:** Build a unified portal app (glomalin-portal) using Next.js 14 App Router + Supabase that serves as the authenticated entry point to all farm modules, with role-based access control, module-level permissions, admin user management, and a React Flow node map on the landing page.

**Target features:**
- Supabase auth with email/password login
- Role-based access (admin, agronomist, operator, viewer)
- Per-module access control (granted/denied per user per module)
- Admin panel for user management and module access toggling
- Dashboard with module cards (locked/unlocked based on access)
- React Flow node map on public landing page (dark soil aesthetic)
- Module shell pages ready for future content
- Middleware-based route protection with role and module checks

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

### Active

- [ ] Supabase auth with email/password login and session management
- [ ] Role-based access control (admin, agronomist, operator, viewer)
- [ ] Per-module access control with admin-managed grants
- [ ] Admin panel for user + module access management
- [ ] Dashboard with module cards reflecting access state
- [ ] React Flow node map on public landing page
- [ ] Middleware route protection (auth + role + module checks)
- [ ] Module shell pages for macro-rollup, farm-registry, org-cert, inputs-seeds, fsa-reporting

### Deferred

- Append-only audit store with tamper-evidence (signed/checksummed entries)
- Audit viewer with filtering by user/resource/time
- Audit log export for regulators
- Photo evidence attachment for field documentation
- Multi-certifier support (EU, state programs) — USDA NOP only
- Inspector portal/login — inspectors receive print reports, not digital access
- Mobile-friendly responsive design (prep for future mobile app)
- Crop Year Accounting & QBO Integration (see .planning/v5.0-VISION.md — deferred to v6.0+)

### Out of Scope

- Native mobile app — web-first, responsive design for now
- Real-time field notifications — not needed for audit prep workflow
- Automated compliance scoring — inspector makes the call, we provide the records
- GIS/map-based split definition — label-based is sufficient for NOP audit
- Enterprise-level organic status — NOP certifies at field level
- Automated split detection from Case IH data — Case IH doesn't report sub-field splits
- Rewriting farm-budget or grain-tickets — organic-cert reads from them, doesn't modify them
- Elevator-side software — Hughes Farm is the seller, not the elevator
- Real-time futures price integration — prices come from contracts already signed
- Automated PDF settlement parsing — PDF formats vary wildly

## Context

Modular ag ecosystem with independent apps: organic-cert (~85K LOC, Next.js 16 + Prisma 6 + PostgreSQL), farm-budget (Express + JSON, port 3001), fsa-acres, grain-tickets (Express + Prisma + PostgreSQL, port 3000), meristem-malt, farm-registry (Express + JSON, port 3005). All apps share the farm-registry for field data.

**Port map:** 3000 grain-tickets, 3001 farm-budget, 3002 fsa-acres, 3003 meristem-malt, 3004 organic-cert, 3005 farm-registry

**Total shipped:** 51 plans across 23 phases in 5 milestones (v1.0, v1.1, v2.0, v3.0, v4.0).

Primary users are farm office staff (daily ticket entry) and farm manager (farm planning, certification, settlement reconciliation).

## Constraints

- **Tech stack**: Next.js + React + Prisma + PostgreSQL (organic-cert); Express + vanilla JS (grain-tickets, farm-budget)
- **Data source**: Case IH Field Ops API (OAuth2, CNH Industrial endpoints)
- **Output format**: Print-ready PDF reports for on-site inspector review
- **UX philosophy**: Farming-first, minimal clicks, "get shit done" — no unnecessary complexity
- **Ecosystem fit**: Must integrate with existing modular farm app ecosystem

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

---
*Last updated: 2026-03-04 after v5.0 milestone started*
