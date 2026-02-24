# Organic Audit System

## What This Is

A USDA NOP organic certification audit system that pulls field history data from Case IH Field Ops via API, structures it into inspector-ready records, and produces print-ready audit reports. It's the accountability backbone of a modular agricultural ecosystem — an append-only audit store that captures who did what, when, and from where. Built for farm managers who need to prep for organic inspections without the headache.

## Core Value

A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.

## Requirements

### Validated

<!-- Inferred from existing organic-cert codebase -->

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

### Active

- [ ] Case IH Field Ops API integration for pulling all field operation records
- [ ] Input application records (seed, fertilizer, pest control with dates/rates)
- [ ] 3-year field history and crop rotation tracking
- [ ] Harvest records (yield data, harvest dates, equipment per field)
- [ ] Tillage operation records from Case IH
- [ ] Append-only audit store with tamper-evidence (signed/checksummed entries)
- [ ] Print-ready USDA NOP inspection report generation
- [ ] Audit viewer with filtering by user/resource/time
- [ ] Audit log export for regulators
- [ ] Photo evidence attachment for field documentation
- [ ] Field record corrections/annotations by operators
- [ ] API middleware that emits audit events on every write
- [ ] Configurable retention/archive policy for compliance
- [ ] Background jobs for audit log snapshots and backups
- [ ] Mobile-friendly responsive design (prep for future mobile app)

### Out of Scope

- Native mobile app — deferred to v2, web-first with responsive design for now
- Real-time field notifications — not needed for audit prep workflow
- Inspector portal/login — inspectors receive print reports, not digital access
- Multi-certifier support (EU, state programs) — USDA NOP only for v1
- Automated compliance scoring — inspector makes the call, we provide the records

## Context

This system is part of a modular agricultural ecosystem with independent apps for budgeting (farm-budget), FSA tracking (fsa-acres), grain tickets (grain-tickets), malt costing (meristem-malt), and organic certification (organic-cert). Apps share patterns: Express + vanilla JS frontends for simple tools, Next.js for the more complex organic-cert app. Data flows between apps via shared JSON stores and APIs.

The organic-cert app (Next.js 16, React 19, Prisma 6, PostgreSQL) already has authentication, RBAC, field enterprise management, audit logging, lot generation, and mass balance calculations. The Case IH Field Ops API integration exists in farm-budget as OAuth2-based sync code but isn't fully active yet.

Primary users are farm managers/staff preparing for USDA NOP inspections. The UX must respect farming realities: limited time, often working from a truck or office between field work, need to get in and get out. "Get shit done" is the design philosophy.

Operators in the field will eventually use a mobile app to add photo evidence and correct/annotate records, but v1 is web-first with responsive design to make that transition smooth.

## Constraints

- **Tech stack**: Next.js + React + Prisma + PostgreSQL (existing organic-cert stack)
- **Data source**: Case IH Field Ops API (OAuth2, CNH Industrial endpoints)
- **Output format**: Print-ready PDF reports for on-site inspector review
- **UX philosophy**: Farming-first, minimal clicks, "get shit done" — no unnecessary complexity
- **Architecture**: Append-only audit store, immutable records for regulatory compliance
- **Ecosystem fit**: Must integrate with existing JSON-backed stores and shared API patterns
- **Mobile readiness**: Responsive design now, native mobile deferred to v2

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-first, defer native mobile | Get audit system working first; responsive design bridges the gap | — Pending |
| Print-ready PDF over digital inspector portal | Inspectors work on-site with paper; digital portal adds complexity without value for v1 | — Pending |
| USDA NOP only for v1 | Focus on one standard well before expanding to multi-certifier | — Pending |
| Build on existing organic-cert Next.js app | Already has auth, RBAC, Prisma, audit logging — don't rebuild | — Pending |
| Append-only audit with checksums | Regulatory compliance requires tamper-evident records | — Pending |
| Case IH API integration (not file export) | Real-time data pull is more reliable than manual CSV uploads | — Pending |

---
*Last updated: 2026-02-23 after initialization*
