# W. Hughes Farms — Operations Suite

## What This Is

A suite of internal farm operations tools for W. Hughes Farms. Includes the glomalin portal (portal.whughesfarms.com) for mobile PWA access, and the organic-cert app (`~/Desktop/my-project-one/organic-cert/`) which manages crop planning, field enterprises, certification tracking, and farm budget data via the Macro Rollup.

## Core Value

Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it.

## Current Milestone: v2.0 Projected vs Actual Farm Budget

**Goal:** Enable the office manager and team members to enter actual agronomic data (invoices, as-applied inputs, field ops, yields) against the farm manager's projected crop plan, while keeping financial performance data private to admin.

**Target features:**
- Role-filtered views: admin sees everything, OFFICE sees agronomic data only (no rental rates, overhead, labor, sale prices, profit/acre)
- Actuals entry: OFFICE role records invoices, as-applied rates, actual field passes, actual yields against projected plan
- Projected vs actual comparison view for admin
- All-enterprise sync (organic + conventional, expanding current organic-only sync)
- Clean, thoughtful layout that handles doubled information without overwhelming the user
- Sandy's view mirrors Macro Rollup layout stylistically

**Codebase:** `~/Desktop/my-project-one/organic-cert/` (Next.js 16, PostgreSQL/Prisma, NextAuth)

## Requirements

### Validated

- ✓ Authentication (email/password, session persistence) — existing
- ✓ Module system with access control — existing
- ✓ PWA manifest and service worker — existing
- ✓ Offline IndexedDB caching for crop plans — existing
- ✓ Mobile API routes — existing
- ✓ FSA 578, Insurance, Claims, Macro Rollup modules — existing
- ✓ Guard pattern for API authorization — existing

### Active (v2.0 — Projected vs Actual)

- [ ] Role-filtered budget views hiding financial data from OFFICE/CREW roles
- [ ] Actuals entry interface for OFFICE role (invoices, as-applied inputs, field ops, yields)
- [ ] Projected vs actual comparison view for ADMIN
- [ ] All-enterprise sync (organic + conventional)
- [ ] Clean dual-layer layout (projected + actual) that doesn't overwhelm

### Paused (v1.0 — Mobile PWA)

- [ ] Mobile-responsive layouts for all core module pages
- [ ] Touch-friendly forms for field data entry
- [ ] Reliable offline mode with sync-on-reconnect
- [ ] Push data from field back to office (observations, notes, updates)
- [ ] Quick-access dashboard optimized for phone screens
- [ ] Improved PWA install experience

### Out of Scope

- Native app (App Store / Play Store) — PWA approach is cheaper and reuses existing code
- Public-facing features — this is an internal team tool
- Syncing actuals back to farm-budget service — TBD for future milestone
- Approval workflow for actuals — actuals record immediately, no gate

## Context

- Portal is live at portal.whughesfarms.com on DigitalOcean Droplet
- Organic-cert app: Next.js 16, PostgreSQL/Prisma, NextAuth v5 — at `~/Desktop/my-project-one/organic-cert/`
- Farm-budget service (Macro Rollup) runs on port 3001, organic-cert syncs from it via `/api/fields/sync-macro`
- Existing roles: ADMIN, OFFICE, CREW, AUDITOR — RBAC defined in `src/lib/rbac.ts`
- Sandy = OFFICE role. Farm manager = ADMIN role.
- FieldOperation already has PLANNED vs CONFIRMED status — foundation for projected vs actual
- Budget summary is computed on-the-fly (not stored) from FieldEnterprise relations
- Current sync only pulls organic enterprises — needs expansion to all enterprises
- Budget tab on field enterprise detail page shows: seed costs, material costs, equipment costs, revenue projection, gross margin

## Constraints

- **Budget**: Minimal — enhance existing codebase, no new infrastructure
- **Tech stack**: Next.js 16, PostgreSQL/Prisma, NextAuth v5, shadcn/ui (organic-cert app)
- **Team**: Small team — Sandy (OFFICE), farm manager (ADMIN), occasional CREW members
- **Privacy**: Financial performance data (profit, rental rates, overhead, labor, sale prices) must be invisible to non-ADMIN roles
- **Deploy target**: Same DigitalOcean Droplet running the portal

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Enhance PWA over native app | Cheaper, reuses existing code, no app store overhead | — Pending |
| Build on existing offline layer | IndexedDB + sync already working for crop plans | — Pending |
| Actuals as separate layer, not modifying projected | Admin's crop plan is source of truth; actuals record reality alongside | — Pending |
| No approval gate for actuals entry | Sandy's entries record immediately — admin trusts team | — Pending |
| Financial data hidden at API + UI level for OFFICE/CREW | Privacy: profit, rental rates, overhead, labor, sale prices are admin-only | — Pending |
| All enterprises (not just organic) | Farm budget covers entire operation | — Pending |

---
*Last updated: 2026-03-20 after v2.0 milestone start*
