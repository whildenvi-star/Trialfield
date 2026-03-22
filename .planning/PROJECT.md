# W. Hughes Farms — Operations Suite

## What This Is

A suite of internal farm operations tools for W. Hughes Farms. Includes the glomalin portal (portal.whughesfarms.com) for mobile PWA access, and the organic-cert app (`~/Desktop/my-project-one/organic-cert/`) which manages crop planning, field enterprises, certification tracking, farm budget data via the Macro Rollup, and projected-vs-actual budget tracking with role-filtered views.

## Core Value

Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it.

## Requirements

### Validated

- ✓ Authentication (email/password, session persistence) — existing
- ✓ Module system with access control — existing
- ✓ PWA manifest and service worker — existing
- ✓ Offline IndexedDB caching for crop plans — existing
- ✓ Mobile API routes — existing
- ✓ FSA 578, Insurance, Claims, Macro Rollup modules — existing
- ✓ Guard pattern for API authorization — existing
- ✓ Role-filtered budget views hiding financial data from OFFICE/CREW roles — v2.0
- ✓ Actuals entry interface for OFFICE role (invoices, as-applied inputs, field ops, yields) — v2.0
- ✓ Projected vs actual comparison view for ADMIN — v2.0
- ✓ All-enterprise sync (organic + conventional) — v2.0
- ✓ Clean dual-layer layout (projected + actual) that doesn't overwhelm — v2.0

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
- Syncing actuals back to farm-budget service — farm-budget is source of truth for projections; organic-cert records actuals alongside, not inside it
- Approval workflow for actuals — actuals record immediately, no gate; AuditLog captures every change
- Invoice attachment / document storage — adds file storage complexity not needed for projected vs actual comparison
- Real-time multi-user editing — small team, low conflict probability
- Budget re-forecasting — that's the farm-budget service's job
- Per-acre profitability map / heat map — tabular farm-wide summary achieves same analytical goal

## Context

- Portal is live at portal.whughesfarms.com on DigitalOcean Droplet
- Organic-cert app: Next.js 16, PostgreSQL/Prisma, NextAuth v5 — at `~/Desktop/my-project-one/organic-cert/`
- Farm-budget service (Macro Rollup) runs on port 3001, organic-cert syncs from it via `/api/fields/sync-macro`
- Existing roles: ADMIN, OFFICE, CREW, AUDITOR — RBAC defined in `src/lib/rbac.ts`
- Sandy = OFFICE role. Farm manager = ADMIN role.
- v2.0 shipped: 19 files modified, +3,492 LOC across 12 commits
- Budget summary computed on-the-fly from FieldEnterprise relations with dual projected/actual/variance
- Sync pulls all enterprises (organic + conventional) with EnterpriseType-aware upsert
- Farm-wide budget summary page at `/budget-summary` aggregates across all enterprises

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
| Actuals as separate layer, not modifying projected | Admin's crop plan is source of truth; actuals record reality alongside | ✓ Good — clean separation, no data conflicts |
| No approval gate for actuals entry | Sandy's entries record immediately — admin trusts team | ✓ Good — zero friction, AuditLog provides accountability |
| Financial data hidden at API + UI level for OFFICE/CREW | Privacy: profit, rental rates, overhead, labor, sale prices are admin-only | ✓ Good — defense-in-depth with spread-conditional stripping |
| All enterprises (not just organic) | Farm budget covers entire operation | ✓ Good — EnterpriseType enum + type-aware upsert clean solution |
| Spread-conditional field stripping | Financial fields absent from JSON keys, not set to null — no trace in DevTools | ✓ Good — silent omission pattern works cleanly |
| Per-acre display with total-cost save | UI shows $/acre for readability, API stores total cost | ✓ Good — consistent with existing Macro Rollup display |
| Background sync never blocks render | Mount with existing DB data, update after sync completes | ✓ Good — no loading spinner on every page visit |

---
*Last updated: 2026-03-22 after v2.0 milestone*
