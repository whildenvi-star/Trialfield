# Phase 3: Mobile Dashboard - Research

**Researched:** 2026-05-22
**Domain:** Next.js App Router · mobile-first dashboard · offline-first data · role-based module filtering
**Confidence:** HIGH (all findings verified directly from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card Layout & Content**
- Summary card style: module name, 1-2 key data points, one quick-action button — clean and scannable on small screens
- All modules the user has access to get a card (no curated subset — access tiers control what appears)
- Cards in fixed order by module type — consistent and predictable for daily use
- Cards show live data when online, fall back to last-cached data (with timestamp) when offline — uses Phase 2 sync infrastructure

**Card Empty State**
- Cards are never empty — they show the projected plan data (crop, variety, input targets, expected units) from the winter budget planning even before actuals are entered
- The plan IS the content; "no actuals yet" is a valid and useful card state, not an error

**Quick-Actions**
- Primary action: mark a task or step complete — inline optimistic update, card reflects change without navigation
- Secondary: Claude's discretion on whether a short note/annotation action fits (simple updates only, not full actuals editing)
- Inline interaction — no bottom sheet, no navigation away from dashboard
- Scope: simple field corrections (mark done, note a change). Full input/pass/seed quantity editing is a separate future phase.

**Access Filtering**
- Use existing user tiers (admin / office / operator) already in the system — no new access logic
- Admin: full dashboard, all module cards
- Office: operational cards (crop plan, inputs, field obs) — no marketing or financial cards
- Operators/field crew: field-relevant cards per their access
- Access filtering is data-driven from existing permission system

**Navigation & Entry Point**
- Dashboard replaces the current home/first tab in the mobile bottom nav (built in Phase 1)
- Dashboard is the default landing screen when opening the portal on mobile
- Tapping a card body → navigate into full module view (same destination as tapping the nav tab)
- Tapping the quick-action button → inline update, stay on dashboard

### Claude's Discretion
- Specific modules included and their fixed ordering (infer from codebase module structure)
- Whether a note/annotation quick-action is added alongside mark-complete
- Loading skeleton design for cards
- Exact spacing, typography, card shadow treatment
- Error state handling (failed data fetch)

### Deferred Ideas (OUT OF SCOPE)
- Full actuals editing from the field (changing input quantities, passes, seed rates) — deeper actuals correction workflow, future phase
- Visual projected-vs-actual comparison chart or delta indicator on cards — a richer "plan over reality" visualization, future phase
- Dashboard personalization / card reordering by user preference — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User sees a dashboard page on their phone with data cards from their accessible modules | Dashboard replaces current `/dashboard` FieldMap page; server component fetches data per module; `cropPlanCache` + `fetchBudgetService` provide data |
| DASH-02 | User only sees module cards for modules their account has access to | `module_access` table + `profiles.role` already used in protected layout; same pattern applies to card rendering; financial cards gated by `role === 'admin' \|\| role === 'office'` |
| DASH-03 | User can tap a quick-action on a dashboard card (e.g., mark task done) without navigating away | `offlineQueue.add({ type: 'confirm-pass', ... })` is the exact IDB write path; optimistic state update in client component; no navigation required |
</phase_requirements>

---

## Summary

Phase 3 replaces the current `/dashboard` page (which today renders a full-screen `FieldMap`) with a vertically-scrolling list of module summary cards. The infrastructure from Phases 1 and 2 is completely in place: the `MobileBottomNav` Home tab already points to `/dashboard`, the `SyncStatusProvider` and `ConflictDrawer` are mounted in the protected layout, and the `useSyncStatus` hook exposes `isOnline` for offline/online branching.

Data for cards comes from two sources. Offline-first crop-plan data lives in `cropPlanCache` (IDB, populated by `syncCropPlans()`). Enterprise-level budget projections are fetched from the embedded `farm-budget` Express service via `fetchBudgetService()`. The `CachedCropPlan` record already contains everything needed for a card: `fieldName`, `crop`, `variety`, `acres`, `enterprise`, `inputs[]`, and `passes[]` with their `PLANNED`/`CONFIRMED` status. When offline, cards render stale IDB data and show the `cachedAt` timestamp.

The quick-action (mark pass complete) writes to `offlineQueue` via `offlineQueue.add({ type: 'confirm-pass', ... })` — the same mechanism already used in the Field Ops module — and applies an optimistic local state update so the card reflects the change immediately. No new infrastructure is needed for the quick-action path.

**Primary recommendation:** Build the dashboard as a client component that reads `cropPlanCache` on mount (IDB, always fast), attempts a background live fetch if online, and renders a `DashboardCard` per accessible module. The protected layout already supplies `role` and `grantedModuleIds` — pass them as props or re-fetch inline (both patterns exist in the codebase).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.2.35 | Page routing, server components | Project baseline |
| React | 18 | UI rendering | Project baseline |
| Tailwind CSS | 3.4.1 | Styling with design tokens | All existing components use it |
| `idb` | (in node_modules) | IndexedDB abstraction | Already used in `db.ts`, `observation-queue.ts` |
| `@supabase/ssr` | 0.9.0 | Auth + DB client | Project baseline |
| Serwist | 9.5.7 | PWA service worker | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `recharts` | 3.8.1 | Charts (already in deps) | Only if a mini sparkline is added to a card — deferred per CONTEXT.md |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native bottom sheet (translate-y) | `@radix-ui/react-dialog` | Radix Dialog NOT in project deps — confirmed in 02-02 decision. Always use native fixed-position sheet with translate-y transition. |
| Inline SVG icons | Lucide/Heroicons | No icon library in project deps. All existing components use inline SVG 24x24 stroke-based icons. Continue the same pattern. |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(protected)/dashboard/
│   └── page.tsx               # Replace FieldMap — render DashboardShell or DashboardGrid
│
├── components/dashboard/
│   ├── DashboardCard.tsx       # Generic card shell (name, quick-action slot, children)
│   ├── CropPlanCard.tsx        # Card for field-history / crop-plan module
│   ├── FieldOpsCard.tsx        # Card for field-ops — shows pending passes, mark-complete action
│   ├── WeatherCard.tsx         # Card for weather module (if accessible)
│   ├── dashboard-card-skeleton.tsx  # Pulse skeleton matching card dimensions
│   └── use-dashboard-data.ts   # Client hook — IDB read + optional background fetch
```

### Pattern 1: Server Component for Role/Access, Client Component for Data
**What:** `dashboard/page.tsx` is a server component that fetches `role` and `grantedModuleIds` from Supabase, then renders a `<DashboardGrid role={role} grantedModuleIds={grantedModuleIds} />` client component that reads IDB and live endpoints.
**When to use:** Whenever you need both auth context (server) and IDB (client). Matches the pattern used in `(protected)/layout.tsx`.
**Example:**
```typescript
// src/app/(protected)/dashboard/page.tsx (server component)
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('module_access').select('module, granted').eq('user_id', user.id),
  ])

  const role = profile?.role ?? 'viewer'
  const grantedModuleIds = role === 'admin'
    ? MODULES.map((m) => m.id)
    : (accessRows ?? []).filter((r) => r.granted).map((r) => r.module as string)

  return <DashboardGrid role={role} grantedModuleIds={grantedModuleIds} />
}
```

### Pattern 2: IDB-First with Background Refresh
**What:** On mount, read `cropPlanCache.getAll()` immediately (synchronous-feeling, ~1ms). If online, kick off `syncCropPlans(token)` in the background; update state when it resolves. Matches exactly the pattern in `crop-plans/page.tsx`.
**When to use:** Every card that shows crop plan data.
**Example:**
```typescript
// Inside DashboardGrid (client component)
'use client'
import { useEffect, useState } from 'react'
import { cropPlanCache } from '@/lib/offline/db'
import { syncCropPlans } from '@/lib/offline/crop-plan-sync'

// On mount: read IDB immediately, then background-refresh if online
useEffect(() => {
  cropPlanCache.getAll().then(setPlans)   // fast IDB read — show immediately
  if (navigator.onLine) {
    getToken().then(token => {
      if (token) syncCropPlans(token).then(r => setPlans(r.fields as any))
    })
  }
}, [])
```

### Pattern 3: Optimistic Quick-Action via offlineQueue
**What:** Tapping "Mark done" on a pass writes to `offlineQueue` first, updates local React state optimistically, and lets `useSyncStatus.drainQueue()` handle replay when online.
**When to use:** Any quick-action that modifies a `QueuedOperation`-compatible record.
**Example:**
```typescript
// Source: src/lib/offline/db.ts — offlineQueue.add() signature
async function markPassDone(fieldId: string, passId: string, operationDate: string, operatorId: string, operatorName: string) {
  await offlineQueue.add({
    type: 'confirm-pass',
    fieldId,
    passId,
    operationDate,
    operatorId,
    operatorName,
  })
  // Optimistic: update local state immediately — do NOT wait for sync
}
```

### Pattern 4: Role-Gated Card Visibility
**What:** Use `grantedModuleIds` prop to filter which `DashboardCard` components render. Financial data within cards gated on `role === 'admin' || role === 'office'`. Matches enterprise-summary mobile card pattern exactly.
**When to use:** Any card that might contain financial or sensitive data.

### Pattern 5: Design Token Usage (CRITICAL)
**What:** All UI elements must use the `glomalin-*` Tailwind design tokens. Do not use default Tailwind color classes (`bg-gray-*`, `text-blue-*`, `border-gray-*`, etc.) on any new components — the codebase uses custom tokens throughout.
**Tokens confirmed in codebase:**
- `bg-glomalin-bg` — page background
- `bg-glomalin-surface` — card surface
- `border-glomalin-border` — all borders
- `text-glomalin-text` — primary text
- `text-glomalin-muted` — secondary/metadata text
- `text-glomalin-accent` — highlight/active color
- `text-glomalin-success` — positive values
- `text-glomalin-warning` — warning state
- `font-mono` — used for all data labels, values, status indicators

### Anti-Patterns to Avoid
- **Radix Dialog for quick-action:** No `@radix-ui/react-dialog` in deps. Use native fixed `div` with `translate-y` transition as the More sheet does.
- **Lucide or any icon library:** No icon libraries installed. Copy inline SVG pattern from `mobile-bottom-nav.tsx`.
- **Navigator access outside useEffect:** SSR will crash. Always read `navigator.onLine` inside `useEffect` — matches `useSyncStatus` pattern.
- **Multiple `useSyncStatus` instances:** Hook is singleton-scoped — instantiated once in `SyncStatusProvider`. Don't instantiate it again in dashboard. Read sync state from a context or re-use `isOnline` from `navigator.onLine` in a local `useState`.
- **Fetching profiles.role twice:** Protected layout already fetches role. The dashboard page.tsx server component should fetch it independently (simpler than prop drilling through layout) — this is the established codebase pattern.
- **Using default Tailwind token classes:** Always use `glomalin-*` tokens.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IDB access | Custom IndexedDB wrapper | `cropPlanCache.getAll()` from `@/lib/offline/db` | Already tested, handles SSR guard, consistent API |
| Queuing pass confirmation | Custom mutation queue | `offlineQueue.add({ type: 'confirm-pass', ... })` | Wire-compatible with existing sync-engine replay |
| Skeleton loading | Custom animation | Inline `animate-pulse` + `bg-glomalin-surface` div blocks | Matches codebase; no extra CSS needed |
| Offline fallback with timestamp | Custom logic | `cropPlanCache.getLastSyncTime()` + `formatRelativeTime()` pattern from crop-plans page | Already proven pattern, copy it |
| Auth token for background refresh | New auth logic | `supabase.auth.getUser()` + `supabase.auth.getSession().data.session?.access_token` | Established pattern in crop-plans page; validates then reads token |

---

## Module-to-Card Mapping (Claude's Discretion)

Based on codebase module registry and CONTEXT.md user decisions:

**Field-crew visible modules (accessible to operators + all):**
1. `field-ops` — Field Ops TC Log — Show pending/confirmed passes for current fields; primary quick-action is "mark pass done"
2. `field-history` — Field History — Show crop/variety/acres per enterprise from crop plan cache; read-only card
3. `maps` — Field Map — Show field count or last-viewed field; tap goes to `/app/maps`
4. `weather` — Precipitation — Show today's forecast summary (if weather API available); tap goes to `/app/weather`
5. `observations` — Field Observations — Show count of pending unsynced observations; quick-action "add note" (optional per CONTEXT.md discretion)

**Office/Admin-only modules (gated by `role === 'office' || role === 'admin'`):**
6. `enterprise-summary` — Enterprise Summary — Show enterprise count and total acres; financial costs shown only to admin/office
7. `compliance` — Compliance — Show FSA/insurance status summary; tap goes to `/app/compliance`
8. `marketing` — Grain Marketing — Show open contract position; financial data, admin/office only

**Embed-only modules (show graceful "open on desktop" card on mobile):**
9. `farm-budget` — Enterprise Planner — Note: embed type; on mobile show projected plan data from `fetchBudgetService()` if available, or crop-plan-cache fallback; no iframe
10. Others (`grain-tickets`, `farm-registry`, `meristem-malt`, `seed-inventory`) — Show "Available on desktop" card with tap-to-navigate affordance

**Recommended fixed order:** field-ops, field-history, weather, maps, observations, enterprise-summary, compliance, marketing, farm-budget

---

## Data Sources Per Card

| Card | Online Source | Offline Fallback | Key Fields |
|------|---------------|-----------------|------------|
| Field Ops | `/api/mobile/crop-plans` via `syncCropPlans()` | `cropPlanCache.getAll()` | `passes[].status`, `passes[].type`, pending count |
| Field History | `cropPlanCache.getAll()` (always IDB) | same | `fieldName`, `crop`, `variety`, `acres`, `enterprise` |
| Weather | `/app/weather` page data (if available) | "Last data: N days ago" | Temperature, precip summary |
| Enterprise Summary | `fetchBudgetService('/api/budget-field-details')` | stale or "farm-budget offline" | enterprise names, total acres, cost/ac (admin/office only) |
| Field Observations | `observationQueue.getPending()` from IDB | same (local data) | unsynced count |

---

## Common Pitfalls

### Pitfall 1: Replacing Dashboard Breaks the FieldMap (Desktop)
**What goes wrong:** Current `/dashboard` renders `<FieldMap />` full-screen — this is the desktop landing page too. If the new dashboard page only renders mobile cards, desktop users lose the map.
**Why it happens:** `dashboard/page.tsx` is shared across screen sizes; bottom nav is mobile-only.
**How to avoid:** The new dashboard page should render mobile cards on small screens AND the existing FieldMap on desktop, OR redirect desktop users differently. Use `md:hidden` / `hidden md:block` layout classes. Simplest approach: render mobile card grid inside `<div className="md:hidden">` and keep FieldMap inside `<div className="hidden md:block">` — same pattern used for SideNav vs MobileBottomNav in the layout.

### Pitfall 2: Multiple IDB Reads on Mount
**What goes wrong:** Each `DashboardCard` component independently calls `cropPlanCache.getAll()` on mount — N cards × 1 IDB open = slow and redundant.
**Why it happens:** IDB is async but each call still adds latency.
**How to avoid:** Read `cropPlanCache.getAll()` once in the parent `DashboardGrid` component, then pass the relevant slice as props to each card. One IDB read per render cycle.

### Pitfall 3: Optimistic Quick-Action Not Reflected in Card
**What goes wrong:** User taps "Mark done" → `offlineQueue.add()` writes to IDB but React state doesn't update → card still shows pass as pending.
**Why it happens:** IDB write is fire-and-forget; state update must happen separately.
**How to avoid:** After `offlineQueue.add()`, immediately call the local state setter: `setPasses(prev => prev.map(p => p.id === passId ? { ...p, status: 'CONFIRMED' } : p))`. This is the optimistic update pattern — the IDB/server are eventually consistent.

### Pitfall 4: `fetchBudgetService` Fails Silently
**What goes wrong:** farm-budget Express app is down or not yet started — `fetchBudgetService()` throws. Card renders with no data and no user feedback.
**Why it happens:** `fetchBudgetService` throws on connection refused; there's no default empty state.
**How to avoid:** Wrap in try/catch with `offline = true` flag (see enterprise-summary page pattern). Show "Plan data unavailable" instead of empty. Never let an uncaught error crash the whole dashboard page.

### Pitfall 5: SSR-Crashing navigator Access
**What goes wrong:** Reading `navigator.onLine` at module scope or component top-level crashes SSR with "navigator is not defined".
**Why it happens:** Server components execute in Node.js context — no browser APIs.
**How to avoid:** Always read `navigator.onLine` inside a `useEffect` hook. Initialize state to `true` (optimistic default) and set actual value after mount — this is exactly how `useSyncStatus` does it.

### Pitfall 6: Wrong Auth Pattern for Background Fetch
**What goes wrong:** Using `supabase.auth.getSession()` alone can return a stale cached token. The background crop-plan sync will fail with 401.
**Why it happens:** `getSession()` doesn't re-validate with the server.
**How to avoid:** Use the established two-step pattern from `crop-plans/page.tsx`: `await supabase.auth.getUser()` first (validates session), then `(await supabase.auth.getSession()).data.session?.access_token`.

---

## Code Examples

### Reading Crop Plan Cache and Syncing
```typescript
// Source: src/app/(protected)/crop-plans/page.tsx (verified)
// Pattern for IDB-first with background refresh
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null

if (token && navigator.onLine) {
  const result = await syncCropPlans(token)
  // result.fields: CropPlanListItem[]
  // result.syncTimestamp: string (ISO)
} else {
  const cached = await getCachedCropPlans()
  // cached: CachedCropPlan[]
  const lastSync = await getLastSyncTime() // string | null
}
```

### Adding to Offline Queue (Quick-Action)
```typescript
// Source: src/lib/offline/types.ts + src/lib/offline/db.ts (verified)
await offlineQueue.add({
  type: 'confirm-pass',
  fieldId: 'abc123',
  passId: 'pass-uuid',
  passType: 'CULTIVATION',
  fieldOperationId: 'existing-op-id', // optional
  operationDate: new Date().toISOString().split('T')[0],
  operatorId: user.id,
  operatorName: profile.full_name ?? user.email ?? 'Unknown',
  description: 'Marked complete from dashboard',
})
// Then: setLocalState(optimistic update)
```

### Role-Gated Rendering
```typescript
// Source: enterprise-summary/page.tsx (verified)
{(role === 'admin' || role === 'office') && (
  <span className="text-xs font-mono text-glomalin-muted">
    Cost: ${totalCostPerAcre.toFixed(0)}/ac
  </span>
)}
```

### Card Surface Pattern (from enterprise-summary mobile cards)
```typescript
// Source: enterprise-summary/page.tsx md:hidden mobile cards (verified)
<div className="bg-glomalin-surface border border-glomalin-border rounded p-3">
  <div className="flex items-center justify-between mb-1">
    <span className="text-sm font-mono text-glomalin-text font-semibold">
      {fieldName}
    </span>
    <span className="text-xs font-mono text-glomalin-muted">
      {acres.toFixed(1)} ac
    </span>
  </div>
  <div className="text-xs font-mono text-glomalin-muted">{crop}</div>
</div>
```

### Inline SVG Icon Pattern
```typescript
// Source: mobile-bottom-nav.tsx (verified) — 24x24, stroke-based, no fill
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `/dashboard` renders full-screen FieldMap | Phase 3 replaces with module card grid (mobile) + keeps FieldMap (desktop) | Dashboard becomes the front-line crew's window |
| No offline data on dashboard | `cropPlanCache` IDB read on mount | Dashboard always shows plan data even without connectivity |
| Passes marked from within Field Ops module | Quick-action button on dashboard card | Fewer taps for common field action |

---

## Open Questions

1. **What data does `fetchBudgetService('/api/budget-field-details')` return when farm-budget is offline?**
   - What we know: enterprise-summary wraps the call in try/catch and sets `budgetOffline = true` on failure
   - What's unclear: Is the `farm-budget` service always running on the droplet, or does it need to be separately started?
   - Recommendation: Always treat this as potentially failing; card must gracefully degrade to IDB crop-plan-cache data or show "projected plan unavailable"

2. **Is there a `role === 'crew'` or is operator access called something else?**
   - What we know: `guard.ts` checks `role === 'admin'` for bypass; enterprise-summary gates on `role === 'admin' || role === 'office'`. CONTEXT.md mentions "admin / office / operator" tiers.
   - What's unclear: The `profiles` table `role` column values — is it literally `'operator'` or `'crew'`?
   - Recommendation: Check `profiles` table in Supabase or in a migration file. For now, treat non-admin/non-office as field crew. The guard already works this way.

3. **Does `syncCropPlans()` return passes with `PLANNED`/`CONFIRMED` status suitable for the quick-action?**
   - What we know: `CachedCropPlan.passes[]` contains `{ id, type, passNumber, status: 'PLANNED' | 'CONFIRMED', ... }` per `types.ts`
   - What's unclear: Whether `passId` in the cache corresponds to the `passId` needed for `offlineQueue.add({ type: 'confirm-pass', passId })`
   - Recommendation: Verify by reading `crop-plan-sync.ts` field mapping. The `passes[].id` should be the budget implement ID needed for confirm-pass replay.

4. **Does the dashboard page need to handle the `'use client'` boundary differently for the MobileHeader title?**
   - What we know: `MobileHeader` receives `pageTitle` as a prop from the protected layout. Currently it always shows "Portal".
   - What's unclear: Whether the layout's `MobileHeader` should show "Dashboard" when on `/dashboard`, or if this is acceptable as-is.
   - Recommendation: The layout can detect pathname and set a more specific title if desired, but "Portal" is acceptable. Out of scope for Phase 3.

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/offline/types.ts` — IDB schema, `CachedCropPlan`, `QueuedOperation`, `ConflictRecord`
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/offline/db.ts` — `cropPlanCache` and `offlineQueue` APIs; DB_VERSION=4
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/hooks/useSyncStatus.ts` — sync hook interface and singleton warning
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/supabase/guard.ts` — role check pattern (`admin` bypass)
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/modules.ts` — all 14 modules with IDs, routes, types
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/components/layout/mobile-bottom-nav.tsx` — 4-tab structure, Home → `/dashboard`, inline SVG pattern, design tokens
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/layout.tsx` — role/access fetch pattern; `SyncStatusProvider` mount point
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/dashboard/page.tsx` — current state: `FieldMap` full-screen; needs replacement
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/app/enterprise-summary/page.tsx` — mobile card pattern, design tokens, `fetchBudgetService`, role-gated financials
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/crop-plans/page.tsx` — IDB-first with background refresh pattern; auth token two-step; skeleton; pull-to-refresh
- `/Users/glomalinguild/.planning/STATE.md` — 02-01..02-04 decisions: no Radix Dialog, `getUser()+getSession()` auth pattern, `QueueDetailSheet` native bottom sheet
- `/Users/glomalinguild/.planning/phases/03-mobile-dashboard/03-CONTEXT.md` — locked decisions, discretion areas, deferred ideas

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by direct file reads of package.json, components
- Architecture: HIGH — all patterns verified from existing production code
- Module list: HIGH — read directly from `modules.ts`
- IDB data shape: HIGH — read directly from `types.ts` and `db.ts`
- Role values: MEDIUM — `admin` and `office` confirmed in code; `operator`/`crew` distinction not verified in profiles schema
- Pitfalls: HIGH — each comes from a verified decision in STATE.md or actual observed pattern in codebase

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable codebase — no dependency churn expected)
