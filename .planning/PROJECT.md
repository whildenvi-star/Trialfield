# Farm Operations Platform

## What This Is

A modular agricultural operations platform for Hughes Farm. Currently includes: (1) an organic certification audit system that pulls Case IH FieldOps data and produces print-ready USDA NOP inspection reports with split-field enterprise support, and (2) a grain ticket traceability system that tracks every load from combine to settlement and catches discrepancies between farm records and buyer payments. Built for farm managers and office staff who need reliable, no-nonsense operational tools.

## Core Value

Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## Completed Milestone: v1.0 Data Ingestion & Reports (2026-02-26)

**Goal:** Pull all field operation data from Case IH and produce print-ready USDA NOP inspection reports — the core data-in, report-out pipeline.

**Delivered:** Case IH API integration (OAuth2 + mock mode), field records with 3-year history and manual entry, staged ops review with approve/reject, and 8-section PDF inspection reports. 4 phases, 11 plans, 15 requirements — all complete.

## Completed Milestone: v1.1 Split-Field Enterprises (2026-03-01)

**Goal:** A single physical field can carry multiple crop enterprises in the same season. Track each enterprise individually while presenting a coherent whole-field view. Reflect split-field reality in history views and PDF reports.

**Delivered:** Split-field schema with label/fallow/cost fields, acre reconciliation API with over-allocation warnings, consolidated field views with drill-down, enterprise creation with "Save & Add Another", and all PDF report sections updated for multi-enterprise fields. 4 phases, 8 plans, 16 requirements — all complete.

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

## Current Milestone: v2.0 Grain Traceability

**Goal:** Replace the paper-to-spreadsheet grain ticket workflow with a digital traceability system that tracks every load from combine to settlement, reconciles against buyer payments, and flags discrepancies immediately.

**Target features:**
- Database migration (Express + Prisma + PostgreSQL, preserving existing UI/PWA)
- Digital load entry replacing 31-sheet Excel spreadsheet
- Full chain-of-custody: field → buggy weight → truck → delivery → settlement
- Settlement import (CSV/Excel) and manual entry for paper-only buyers
- Automated reconciliation with discrepancy detection across 4+ destinations
- Farm registry integration for field lookups

### Active

(Requirements to be defined during milestone setup)

### Deferred (v2)

- Append-only audit store with tamper-evidence (signed/checksummed entries)
- Audit viewer with filtering by user/resource/time
- Audit log export for regulators
- Photo evidence attachment for field documentation
- Field record corrections/annotations by operators
- API middleware that emits audit events on every write
- Configurable retention/archive policy for compliance
- Background jobs for audit log snapshots and backups
- Mobile-friendly responsive design (prep for future mobile app)

### Out of Scope

- Native mobile app — deferred to v2, web-first with responsive design for now
- Real-time field notifications — not needed for audit prep workflow
- Inspector portal/login — inspectors receive print reports, not digital access
- Multi-certifier support (EU, state programs) — USDA NOP only for v1
- Automated compliance scoring — inspector makes the call, we provide the records
- GIS/map-based split definition — label-based is sufficient for NOP audit
- Enterprise-level organic status — NOP certifies at field level
- Automated split detection from Case IH data — Case IH doesn't report sub-field splits

## Context

Modular ag ecosystem with independent apps: organic-cert (~85K LOC, Next.js 16 + Prisma 6 + PostgreSQL), farm-budget, fsa-acres, grain-tickets, meristem-malt, farm-registry. All apps share PostgreSQL and the farm-registry for field data.

**Organic-cert** (v1.0 + v1.1 shipped): Case IH FieldOps API integration (OAuth2, mock mode active), split-field enterprises, print-ready USDA NOP PDF reports.

**Grain-tickets** (current focus): Working Express app on port 3000 with ticket entry, Claude Vision scanning, farm summary, PWA support, CSV export. Currently uses flat JSON data store (~160KB). 4 dependencies (express, multer, xlsx, @anthropic-ai/sdk). Calculation engine (calc.js) validated against original spreadsheet. Needs database migration and settlement reconciliation.

**Grain workflow today:** Combine → grain buggy (has scale) → radio net weight + field + crop to semi driver → semi driver writes Hughes Blue Ticket → delivers to co-op → co-op prints grain ticket → both forms to office → manual Excel entry → reconcile against settlement sheets (arrive ~1 week later, from 4+ buyers, mixed paper/CSV/PDF formats). 100-500 loads per season.

Primary users are farm office staff (daily ticket entry) and farm manager (settlement reconciliation, reporting).

**Known tech debt (from v1.1 audit — organic-cert):**
- Sync Acres button has a pre-existing runtime crash (data.unmatched undefined)
- Partial unique index not captured in schema.prisma (environment rebuild risk)
- take:3 enterprise query limit could undercount at 4+ enterprises per field
- API routes lack auth() calls (deferred per design)

## Constraints

- **Tech stack**: Next.js + React + Prisma + PostgreSQL (existing organic-cert stack)
- **Data source**: Case IH Field Ops API (OAuth2, CNH Industrial endpoints)
- **Output format**: Print-ready PDF reports for on-site inspector review
- **UX philosophy**: Farming-first, minimal clicks, "get shit done" — no unnecessary complexity
- **Ecosystem fit**: Must integrate with existing modular farm app ecosystem
- **Mobile readiness**: Responsive design now, native mobile deferred to v2

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-first, defer native mobile | Get audit system working first; responsive design bridges the gap | ✓ Good — shipped v1.0 web-only |
| Print-ready PDF over digital inspector portal | Inspectors work on-site with paper; digital portal adds complexity without value | ✓ Good — 8-section PDF covers NOP needs |
| USDA NOP only for v1 | Focus on one standard well before expanding to multi-certifier | ✓ Good — kept scope tight |
| Build on existing organic-cert Next.js app | Already has auth, RBAC, Prisma, audit logging — don't rebuild | ✓ Good — leveraged existing 70K+ LOC |
| Case IH API integration (not file export) | Real-time data pull is more reliable than manual CSV uploads | ✓ Good — OAuth2 flow works; mock mode bridges staging gap |
| v1.0 focused on data pipeline + reports | Get Case IH data in, inspection reports out — defer audit infrastructure to v2 | ✓ Good — delivered core value in 3 days |
| Mock data mode for staging API gap | CNH staging has no API audience registered; mock data lets development continue | ⚠️ Revisit — need production credentials or staging audience from CNH |
| Manual data wins over synced data | 409 conflict on approve when manual record exists for same date/type | ✓ Good — protects manual corrections |
| Append-only audit with checksums | Regulatory compliance requires tamper-evident records | — Deferred to v2 |
| Nullable label (not required) for enterprise splits | Single-enterprise fields keep working with label=null, no migration needed | ✓ Good — backward compatible |
| isFallow as Boolean (not enum) | Binary distinction is simpler; avoids enum migration complexity | ✓ Good — clean schema |
| Acre over-allocation: warning only, save allowed | Farmers need flexibility; blocking saves would frustrate real workflows | ✓ Good — yellow toast, never blocks |
| formatFieldLabel utility in report-assembler | Shared across harvest log, application log, and mass balance — single source | ✓ Good — DRY, consumed by 3 PDF sections |
| Fallow edit: store 0 not null for cleared cost | Always keep a numeric value, avoid null/undefined ambiguity in forms | ✓ Good — no data loss |
| Keep Express for grain-tickets (not migrate to Next.js) | Working app with solid UI, PWA, Claude Vision — rewrite adds no user value | — Pending |
| Add PostgreSQL via Prisma to grain-tickets | Settlement reconciliation is relational; flat JSON can't handle cross-entity queries | — Pending |
| Farm registry integration for grain-ticket fields | Consistent field names across ecosystem; already partially integrated | — Pending |

---
*Last updated: 2026-03-01 after v2.0 milestone start*
