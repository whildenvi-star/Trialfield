# W. Hughes Farms — Operations Suite

## What This Is

A suite of internal farm operations tools for W. Hughes Farms. Includes the glomalin portal (portal.whughesfarms.com) — a mobile-first PWA with offline sync, role-gated dashboard, and field observation submission — backed by the organic-cert app (`~/Desktop/my-project-one/organic-cert/`) for crop planning, certification tracking, and projected-vs-actual budget tracking. OWL Orin (`~/Projects/owl-orin/`) handles corn-specialized weed detection with stem avoidance for the inter-row actuator.

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

- ✓ Touch-friendly navigation shell (MobileHeader + MobileBottomNav, 44px+ targets) — v1.0
- ✓ Mobile-responsive layouts for all native module pages (375px single-column, human-verified) — v1.0
- ✓ Reliable offline mode with sync-on-reconnect and visible conflict resolution — v1.0
- ✓ Field observation submission from phone with photo capture and offline queue — v1.0
- ✓ Role-gated mobile dashboard with quick-actions (Mark Done) — v1.0
- ✓ Corn-specialized weed detection pipeline for OWL Orin with stem avoidance — v1.0

### Active

- [ ] Improved PWA install experience (Add to Home Screen prompting)
- [ ] Production deploy verification for Phase 4 field data entry
- [ ] sync-macro endpoint auth guard (medium tech debt from v2.0)

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

- Portal is live at portal.whughesfarms.com on DigitalOcean Droplet (PM2: glomalin-portal at /var/www/glomalin-portal)
- Organic-cert app: Next.js 16, PostgreSQL/Prisma, NextAuth v5 — at `~/Desktop/my-project-one/organic-cert/`
- Farm-budget service (Macro Rollup) runs on port 3001, organic-cert syncs from it via `/api/fields/sync-macro`
- Existing roles: ADMIN, OFFICE, CREW, AUDITOR — RBAC defined in `src/lib/rbac.ts`
- Sandy = OFFICE role. Farm manager = ADMIN role.
- OWL Orin: OpenWeedLocator fork at `~/Projects/owl-orin/` — local only, separate from portal
- v1.0 shipped: portal 42 files modified, +1,601 / -123 TypeScript/TSX; OWL Orin 15 files, +1,250 Python
- v2.0 shipped: 19 files modified, +3,492 LOC across 12 commits
- IDB schema at v4 with conflicts store; offline sync covers crop plans, field ops queue, observation queue
- Mobile dashboard at `/dashboard` with CSS-only desktop/mobile split (md:hidden / hidden md:block)
- Budget summary computed on-the-fly from FieldEnterprise relations with dual projected/actual/variance
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
| Enhance PWA over native app | Cheaper, reuses existing code, no app store overhead | ✓ Good — mobile shell + offline layer shipped without native complexity |
| Build on existing offline layer | IndexedDB + sync already working for crop plans | ✓ Good — IDB v4 with conflicts store and dual-queue support built on existing foundation |
| Actuals as separate layer, not modifying projected | Admin's crop plan is source of truth; actuals record reality alongside | ✓ Good — clean separation, no data conflicts |
| No approval gate for actuals entry | Sandy's entries record immediately — admin trusts team | ✓ Good — zero friction, AuditLog provides accountability |
| Financial data hidden at API + UI level for OFFICE/CREW | Privacy: profit, rental rates, overhead, labor, sale prices are admin-only | ✓ Good — defense-in-depth with spread-conditional stripping |
| All enterprises (not just organic) | Farm budget covers entire operation | ✓ Good — EnterpriseType enum + type-aware upsert clean solution |
| Spread-conditional field stripping | Financial fields absent from JSON keys, not set to null — no trace in DevTools | ✓ Good — silent omission pattern works cleanly |
| Per-acre display with total-cost save | UI shows $/acre for readability, API stores total cost | ✓ Good — consistent with existing Macro Rollup display |
| Background sync never blocks render | Mount with existing DB data, update after sync completes | ✓ Good — no loading spinner on every page visit |
| CSS-only dual shell (md:hidden) | No UA detection, no JS branching for mobile/desktop split | ✓ Good — clean, zero-cost at runtime, easy to maintain |
| Queue-first IDB write before upload | Guarantees no data loss even if network dies mid-submission | ✓ Good — proven in both offline sync and observation queue |
| CustomEvent pub/sub for sync state | Decouples useSyncStatus from drawer/banner without prop drilling | ✓ Good — SyncStatusProvider, ConflictDrawer, and banner all independently subscribed |
| CornDetector with GreenOnGreen-compatible return signature | OWL hoot() loop requires drop-in replacement | ✓ Good — algorithm=corn branch activates transparently |
| FP16 export over INT8 for TensorRT | ~26ms/frame on Orin Nano, avoids mAP drop for crop-protection | ✓ Good — right precision/performance tradeoff for safety-critical actuation |

---
*Last updated: 2026-06-05 after v1.0 milestone*
