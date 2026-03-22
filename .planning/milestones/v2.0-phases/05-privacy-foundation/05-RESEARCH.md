# Phase 5: Privacy Foundation - Research

**Researched:** 2026-03-20
**Domain:** Next.js API authorization, RBAC field-stripping, NextAuth.js session handling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Financial Field Boundary**
- Visible to OFFICE: All direct production costs — seed costs (variety, brand, rate, acres, pricePerUnit, totalCost), material/input costs (name, category, rate, acres, unitCost, totalCost), operation/machinery costs (description, type, costPerAcre, acresWorked, totalCost), fuel costs, target yield (bu/acre)
- Hidden from OFFICE: Land rent, overhead, drying costs, interest, crop insurance, sale prices, revenue, projected revenue, gross margin, profit/acre
- Summary: The split is "direct production costs" vs "overhead + financial performance." OFFICE needs production cost detail for entering actuals in Phase 6.
- Full line-item detail visible (not just aggregates) — OFFICE sees every cost line item with unit prices, rates, and totals

**Budget Tab Appearance for OFFICE**
- Same "Budget" tab title — no heading change to signal filtered view
- Identical cost tables to what ADMIN sees (seed, materials, operations)
- Revenue/margin summary cards simply don't render — only Total Cost and Cost/Acre cards appear
- Revenue projection section absent entirely
- No indication to OFFICE that data was withheld — it looks like the data doesn't exist

**CREW Budget Access**
- Budget tab entirely hidden from CREW navigation — they don't see it at all
- CREW API requests to budget routes receive 403 Forbidden

**Access Denial Behavior**
- API response shape: financial fields completely absent from JSON keys (not present as null) — no trace in DevTools Network tab
- No UI indicators of restriction (no "restricted" badges, no lock icons, no "admin only" labels)
- Direct URL access to financial-only endpoints returns 403 Forbidden
- API routes return `{error: "Unauthorized", status: 401}` for unauthenticated requests
- Page routes redirect to /login for unauthenticated requests

**ADMIN Fallback Removal**
- Remove the ADMIN fallback in `getAuthContext()` globally — affects ALL routes, not just budget
- No dev-only bypass needed — user always logs in during local development
- This is a root cause fix: no route should ever fall back to ADMIN for unauthenticated requests

**RBAC Permission Changes**
- New `budget:read` permission (ADMIN + OFFICE) — gates access to cost data on budget routes
- New `budget:financial` permission (ADMIN only) — gates access to revenue, margin, overhead, sale price data
- Remove `sale:read` from OFFICE role (PRIV-04)

### Claude's Discretion
- Exact error message wording for 401/403 responses
- How to structure the API field-stripping logic (middleware vs per-route)
- TypeScript type handling for conditional response shapes

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRIV-01 | Budget API strips financial fields (revenue, margin, sale prices, profit/acre) from responses for non-ADMIN roles | API route currently has no auth at all; add getAuthContext() check + conditional field omission in budget-summary route |
| PRIV-02 | getAuthContext() ADMIN fallback is removed — unauthenticated requests return error, not admin access | The ADMIN fallback is clearly located in src/lib/auth.ts lines 93-108; replace with `return null` |
| PRIV-03 | New RBAC permissions `budget:read` (ADMIN + OFFICE) and `budget:financial` (ADMIN only) are enforced | rbac.ts permissions map is the single source; add new string permissions and update role sets |
| PRIV-04 | OFFICE role `sale:read` permission is removed | rbac.ts OFFICE set contains `sale:read`; remove it. Confirmed no current callers of hasPermission() so no UI breakage |
</phase_requirements>

---

## Summary

The organic-cert app (`/Users/glomalinguild/Desktop/my-project-one/organic-cert`) is a Next.js 16 app using NextAuth.js v5 (beta) with a custom `getAuthContext()` function in `src/lib/auth.ts`. This function has a critical security flaw: when no session exists (which is the normal state for the portal iframe), it falls back to returning the first active ADMIN user from the database. This means every unauthenticated request gets full ADMIN-level access, making all role filtering downstream completely ineffective.

The budget-summary route (`src/app/api/field-enterprises/[id]/budget-summary/route.ts`) currently has zero authentication — it calls `prisma` directly with no auth check at all. The RBAC system (`src/lib/rbac.ts`) defines a full permission matrix with `hasPermission()` and `canWrite()` functions, but these are not imported or called anywhere in the application outside `rbac.ts` itself. The permission system exists as dead code.

Phase 5 is a tight, well-bounded set of changes: (1) fix `getAuthContext()` to return null without session, (2) add auth+permission checks to the budget-summary route, (3) strip financial fields from the response for non-ADMIN callers, (4) add `budget:read`/`budget:financial` to rbac.ts, (5) remove `sale:read` from OFFICE, and (6) hide the Budget tab from CREW in the enterprise page UI. No new libraries are needed. The iframe cookie issue is the one open question — if the organic-cert app is embedded in an iframe from glomalin-portal, session cookies may still not be passed, which is the root cause of the original ADMIN fallback. This must be verified before the fix will work end-to-end.

**Primary recommendation:** Fix `getAuthContext()` first (PRIV-02), verify with curl that unauthenticated requests now return 401, then build all other role filtering on top of this working foundation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 | Session management, JWT auth | Already in use; `auth()` is the session accessor |
| @prisma/client | 6.19.2 | Database access; Role enum | Already in use; `Role` type used in rbac.ts |
| next | 16.1.6 | API route handler, NextResponse | Project framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Runtime validation of request shapes | Already installed; use if adding query param validation |
| typescript | 5.x | Typed response shapes for conditional fields | Use discriminated union types for ADMIN vs OFFICE responses |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-route field stripping | Middleware-based stripping | Middleware runs before route; harder to access DB context for role lookup. Per-route is simpler and explicit |
| Custom permission helper | Reuse existing `hasPermission()` | `hasPermission()` already exists in rbac.ts — just needs new permissions added and actual callers |

**Installation:**
No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── auth.ts              # getAuthContext() — remove ADMIN fallback here
│   └── rbac.ts              # Add budget:read, budget:financial; remove sale:read from OFFICE
├── app/
│   └── api/
│       └── field-enterprises/[id]/
│           └── budget-summary/
│               └── route.ts  # Add auth check + field stripping here
└── app/(app)/
    └── field-enterprises/[id]/
        └── page.tsx           # Hide Budget tab for CREW, strip revenueProjection render for OFFICE
```

### Pattern 1: Fix getAuthContext — Remove ADMIN Fallback

**What:** Replace the DB fallback with `return null` so unauthenticated callers get a null user, forcing all downstream routes to return 401.
**When to use:** This is a one-time fix — no conditional logic. A session either exists or it doesn't.
**Example:**
```typescript
// src/lib/auth.ts
// Source: existing file — modify the getAuthContext function

export async function getAuthContext() {
  const session = await auth();
  const sessionUser = session?.user as any;
  if (sessionUser?.farmId) {
    return {
      id: sessionUser.id as string,
      email: sessionUser.email as string,
      name: sessionUser.name as string,
      role: sessionUser.role as string,
      farmId: sessionUser.farmId as string,
      farmName: sessionUser.farmName as string,
    };
  }

  // Previously: fell back to first ADMIN user in DB.
  // Fix: return null — unauthenticated requests must be rejected by each route.
  return null;
}
```

### Pattern 2: RBAC Permission Addition

**What:** Add new permissions to rbac.ts permission sets for the two new budget permissions.
**When to use:** Any time a new access boundary is defined.
**Example:**
```typescript
// src/lib/rbac.ts — add to permission sets

const permissions: Record<Role, Set<string>> = {
  ADMIN: new Set([
    // ... existing permissions ...
    "budget:read",       // new — gates cost data access
    "budget:financial",  // new — gates revenue, margin, overhead, sale price
  ]),
  OFFICE: new Set([
    // ... existing permissions (minus sale:read) ...
    "budget:read",       // new — OFFICE can see cost data
    // budget:financial NOT added — OFFICE cannot see financial performance
    // sale:read REMOVED per PRIV-04
  ]),
  CREW: new Set([
    // ... existing permissions ...
    // Neither budget:read nor budget:financial — 403 on all budget routes
  ]),
  AUDITOR: new Set([
    // ... existing permissions ...
    // Auditor keeps sale:read (no change in this phase)
  ]),
};
```

### Pattern 3: Budget-Summary Route — Auth + Field Stripping

**What:** Add `getAuthContext()` call at the top of the route, check `budget:read` permission to allow access, then strip `revenueProjection` and financial fields from the response JSON when the caller lacks `budget:financial`.
**When to use:** Any API route that serves mixed-sensitivity data to different role levels.
**Example:**
```typescript
// src/app/api/field-enterprises/[id]/budget-summary/route.ts

import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check — PRIV-02 fix ensures this is a real user, not ADMIN fallback
  const user = await getAuthContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.role as Role;

  // Permission check — PRIV-03
  if (!hasPermission(role, "budget:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... existing computation logic unchanged ...

  // Field stripping — PRIV-01
  const canSeeFinancial = hasPermission(role, "budget:financial");

  return NextResponse.json({
    seedCosts,
    materialCosts,
    operationCosts,
    fallowCost: enterprise.isFallow
      ? { amount: enterprise.fallowCostAmount, category: enterprise.fallowCostCategory }
      : null,
    totalSeedCost: Math.round(totalSeedCost * 100) / 100,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    totalOperationCost: Math.round(totalOperationCost * 100) / 100,
    totalCostOfProduction: Math.round(totalCostOfProduction * 100) / 100,
    costPerAcre,
    acres,
    // Only include revenueProjection for ADMIN — field absent entirely for OFFICE
    ...(canSeeFinancial && revenueProjection ? { revenueProjection } : {}),
  });
}
```

**Critical:** The `fallowCost` field requires attention (see Pitfall 2 below).

### Pattern 4: UI — Conditional Budget Tab Visibility

**What:** The enterprise detail page (`field-enterprises/[id]/page.tsx`) is a client component. To hide the Budget tab from CREW and hide the revenue section from OFFICE, the session must be accessible on the client. Use Next.js `useSession()` from `next-auth/react`.
**When to use:** Client components needing role-based rendering.
**Example:**
```typescript
// In the "use client" component — add session check
import { useSession } from "next-auth/react";

// Inside the component:
const { data: session } = useSession();
const role = (session?.user as any)?.role ?? null;
const canSeeBudget = role === "ADMIN" || role === "OFFICE";
const canSeeFinancial = role === "ADMIN";

// Tab trigger — hide for CREW:
{canSeeBudget && (
  <TabsTrigger value="budget">Budget</TabsTrigger>
)}

// Revenue section — only render for ADMIN:
{canSeeFinancial && budgetSummary.revenueProjection && (
  <RevenueProjectionSection ... />
)}
```

**Note:** The UI filtering is defense-in-depth only — the API field stripping (PRIV-01) is the authoritative enforcement layer. The UI must never render data that wasn't sent by the API.

### Anti-Patterns to Avoid

- **Returning null fields instead of omitting them:** `{ revenueProjection: null }` is visible in DevTools as a key. The decision is to omit the key entirely — use spread-conditional `...(condition ? { key: value } : {})`.
- **Relying on UI-only hiding:** A user can call the API directly with curl. The API must strip fields independent of UI state.
- **Using `user.role === "ADMIN"` inline strings everywhere:** Use `hasPermission(role, "budget:financial")` so the permission matrix is the single source of truth.
- **Applying getAuthContext fix only to budget routes:** The fix is global — every route using `getAuthContext()` was silently running as ADMIN for unauthenticated requests. The fix resolves this globally across ~20 routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session access in client components | Custom auth state management | `useSession()` from `next-auth/react` | Already bundled; handles SSR hydration |
| Permission checking | Inline `role === "ADMIN"` strings | `hasPermission(role, permission)` from rbac.ts | Single source of truth; rbac.ts already exists |
| Response field filtering | Custom serializer / transformer middleware | Spread-conditional in route handler | No extra abstraction needed; three fields to strip |

**Key insight:** This phase has no complex new abstractions. The hard work is the auth fix — everything else is straightforward use of existing patterns.

---

## Common Pitfalls

### Pitfall 1: iframe Session Cookies Not Forwarded
**What goes wrong:** After removing the ADMIN fallback, `getAuthContext()` returns null for all requests, including authenticated users, because the organic-cert app runs inside an iframe from glomalin-portal and session cookies have `SameSite=Lax` by default — not sent in cross-origin iframe navigation.
**Why it happens:** NextAuth.js v5 beta sets `SameSite=Lax` on its session cookie. Lax cookies are not sent with iframe navigation (which counts as cross-origin "navigation"). The original ADMIN fallback was put in place because of this exact problem.
**How to avoid:** Test immediately after removing the fallback by opening organic-cert directly (port 3004) and logging in — this proves the auth flow works. For the iframe deployment scenario, the STATE.md notes a preferred fix: X-Auth-Token header from the portal. This must be confirmed working before the fallback is removed in production. For Phase 5, the fix can land with the understanding that the portal must pass auth credentials.
**Warning signs:** After the fix, ALL requests return 401 including from logged-in users — this means the session cookie is not being sent.

### Pitfall 2: fallowCost Overhead Category Exposure
**What goes wrong:** The `fallowCostCategory` field on `FieldEnterprise` stores values like `"Overhead"`, `"Land Rent"`, `"Insurance"` — these are financial position data that OFFICE should not see, per the decision that "overhead, rent, insurance, interest, drying" are hidden.
**Why it happens:** The `fallowCost` object is returned unconditionally in the current route response as `{ amount: ..., category: ... }`. Even though fallow enterprises are edge cases, `fallowCostCategory: "Land Rent"` in the response would violate the privacy boundary.
**How to avoid:** Apply the same `canSeeFinancial` gate to the `fallowCost` field, or strip the `category` sub-field: `{ amount: enterprise.fallowCostAmount }` without category for non-ADMIN.
**Warning signs:** Test with a fallow enterprise as OFFICE — check DevTools for `fallowCostCategory` in the response.

### Pitfall 3: sale:read Removal Side Effects
**What goes wrong:** Removing `sale:read` from OFFICE could break screens Sandy currently uses if any UI checks `hasPermission(role, "sale:read")` before rendering a sale-related view.
**Why it happens:** Research finding: `hasPermission()` is not called anywhere in the current codebase outside of rbac.ts — the function is dead code with no callers. The permission matrix is defined but not enforced. This means removing `sale:read` from OFFICE has no immediate runtime effect on any existing UI.
**How to avoid:** Safe to remove. Verify by grep for `sale:read` after the change — it should appear only in rbac.ts. Document in the commit message that no callers exist.
**Warning signs:** If a future phase adds `hasPermission(role, "sale:read")` checks, OFFICE will be blocked — which is the intended behavior.

### Pitfall 4: CREW Navigation Tab Hiding vs. Direct URL Access
**What goes wrong:** Hiding the Budget tab from CREW in the sidebar/navigation prevents casual discovery but does not prevent a CREW user who knows the URL from navigating to `/field-enterprises/[id]` and clicking the Budget tab directly.
**Why it happens:** The enterprise page is a single-page component with all tabs rendered — tab visibility is controlled by CSS/conditional rendering, not route-level auth.
**How to avoid:** The API-level 403 for CREW on `budget:read` is the real protection. The UI tab hide is defense-in-depth and improves UX. Both layers are needed: API returns 403, UI hides the tab. Verify by loading the page as CREW and inspecting the DOM for the Budget tab trigger.

### Pitfall 5: TypeScript Type Errors on Conditional Response Shape
**What goes wrong:** The existing `BudgetSummary` interface in the client page (`field-enterprises/[id]/page.tsx`) includes `revenueProjection` as a typed field. If the API omits it entirely, TypeScript may error on access in the UI.
**Why it happens:** The interface expects `revenueProjection: { ... } | null` but the API now sends `revenueProjection` as absent (not null). The runtime behavior is correct (`undefined` is falsy), but TypeScript type assertions may fail.
**How to avoid:** Mark `revenueProjection` as optional in the client-side interface: `revenueProjection?: { ... } | null`. Existing null checks (`budgetSummary.revenueProjection && ...`) already handle this correctly at runtime.

---

## Code Examples

### Current getAuthContext (shows the ADMIN fallback to remove)
```typescript
// Source: /src/lib/auth.ts lines 78-109 — current broken implementation
export async function getAuthContext() {
  const session = await auth();
  const sessionUser = session?.user as any;
  if (sessionUser?.farmId) {
    return { /* session user fields */ };
  }

  // THIS BLOCK IS THE BUG — remove it entirely
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    include: { farm: true },
  });
  if (!user) return null;
  return { /* admin user fields */ };
}
```

### Current rbac.ts (shows where to add/remove permissions)
```typescript
// Source: /src/lib/rbac.ts — current state
// ADMIN has: sale:read, sale:write (keep both)
// OFFICE has: sale:read, sale:write (remove sale:read per PRIV-04)
// CREW has: neither sale:read nor sale:write (no change)

// Add to ADMIN set: "budget:read", "budget:financial"
// Add to OFFICE set: "budget:read" (NOT budget:financial)
// Add to CREW set: nothing (403 on all budget routes)
```

### Current budget-summary route (shows the no-auth gap)
```typescript
// Source: /src/app/api/field-enterprises/[id]/budget-summary/route.ts lines 1-10
// Current: no auth check, no permission check, no field stripping
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const enterprise = await prisma.fieldEnterprise.findUnique({ ... });
    // Immediate DB query with zero auth — this is what must be fixed
```

### Spread-conditional pattern for absent JSON keys
```typescript
// Pattern for omitting a field entirely (not setting to null)
// Source: standard TypeScript/ES2018 spread pattern

// WRONG — field appears as null in DevTools:
return NextResponse.json({ revenueProjection: canSeeFinancial ? data : null });

// RIGHT — field absent from response entirely:
return NextResponse.json({
  /* ...other fields... */
  ...(canSeeFinancial && revenueProjection ? { revenueProjection } : {}),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADMIN fallback for iframe | Direct session auth; iframe passes X-Auth-Token | Phase 5 | Unauthenticated requests return 401 |
| No auth on budget-summary | Auth + permission check on every budget route | Phase 5 | CREW gets 403, OFFICE gets stripped response |
| Unused RBAC permission matrix | `hasPermission()` called at route boundary | Phase 5 | First actual enforcement of the existing rbac.ts |

**Deprecated/outdated:**
- ADMIN fallback in `getAuthContext()`: The original comment says it was added because "the portal handles authentication and the cert tracker runs inside an iframe where session cookies don't work." This workaround must be replaced with a real auth solution (X-Auth-Token header or direct login).

---

## Open Questions

1. **Iframe Session Cookie — Will the fix break the current iframe deployment?**
   - What we know: The ADMIN fallback was explicitly added because session cookies don't work in the iframe context. The portal embeds organic-cert via iframe. `SameSite=Lax` cookies are not sent in cross-origin iframe context.
   - What's unclear: Whether the X-Auth-Token header approach from STATE.md has been implemented in the portal. STATE.md says "Confirm iframe auth token mechanism before Phase 5 planning — preferred fix for getAuthContext() ADMIN fallback is X-Auth-Token header from portal iframe; confirm portal can emit per-user signed token."
   - Recommendation: Before implementing PRIV-02, verify that direct login at port 3004 works (proving auth works when session cookies ARE sent). Document that the portal iframe integration will need updating. The planner should include a task to verify the deployment path before removing the fallback.

2. **Does fallowCostCategory expose financial data to OFFICE?**
   - What we know: `fallowCostCategory` stores strings like `"Land Rent"`, `"Insurance"`, `"Overhead"` per the Prisma schema comment. The budget-summary route returns `fallowCost: { amount, category }`.
   - What's unclear: Whether any current enterprises actually use fallow with one of the sensitive category strings.
   - Recommendation: Strip `fallowCostCategory` from the `fallowCost` response object for non-ADMIN callers, or apply the `budget:financial` gate to the entire `fallowCost` object if its `category` field could reveal financial position.

---

## Implementation Notes for Planner

### Codebase Reality

**organic-cert is the target app.** All changes are in:
`/Users/glomalinguild/Desktop/my-project-one/organic-cert/`

**Key file locations:**
- Auth fix: `src/lib/auth.ts` — `getAuthContext()` function, lines 78-109
- RBAC changes: `src/lib/rbac.ts` — permission matrix, lines 1-91
- Budget API: `src/app/api/field-enterprises/[id]/budget-summary/route.ts`
- Budget UI: `src/app/(app)/field-enterprises/[id]/page.tsx` — client component, ~1300 lines
- App layout: `src/app/(app)/layout.tsx` — uses `getAuthContext()` for Header name/role display

**No test framework exists in organic-cert.** The glomalin-portal has vitest, but organic-cert has no test scripts or test files. All verification for this phase must be manual: curl commands and browser DevTools inspection.

**The `hasPermission()` function in rbac.ts has zero callers.** It is safe to add the new permissions and begin using `hasPermission()` in the budget-summary route without any risk of breaking existing code. The RBAC system has been defined but never enforced.

**~20 routes use `getAuthContext()`.** The fallback removal affects all of them. Routes that already check `if (!user)` (like `src/app/api/admin/staged-ops/route.ts` which checks `!user || user.role !== "ADMIN"`) will correctly return 403 after the fix. Routes that call `getAuthContext()` but don't null-check (like `layout.tsx`) will need to handle the null case — the layout currently does `user?.name || "Admin"` which is already safe.

**The sidebar has no role-based filtering.** `src/components/layout/sidebar.tsx` renders all nav items for all roles. Budget tab is not in the sidebar — it's a tab within the field enterprise detail page. The CREW hide for Budget is an in-page tab suppression, not sidebar navigation.

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/auth.ts` — Full getAuthContext() implementation read directly
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/rbac.ts` — Full permission matrix read directly
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/budget-summary/route.ts` — Full route implementation read directly
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` — Budget tab UI structure read via grep
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` — Data model confirmed: fallowCostCategory, targetPricePerUnit, targetYieldPerAcre fields
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/types/next-auth.d.ts` — Confirmed Role type extended into Session
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/package.json` — Confirmed next-auth v5 beta, next 16, no test framework

### Secondary (MEDIUM confidence)
- NextAuth.js v5 `SameSite=Lax` cookie behavior in iframes — known behavior from auth library documentation, explains the original ADMIN fallback decision

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from package.json and existing files
- Architecture: HIGH — read from actual route, auth, and RBAC files
- Pitfalls: HIGH (cookie/iframe), HIGH (fallowCost), HIGH (hasPermission callers) — all verified directly from codebase
- Open questions: MEDIUM — iframe token mechanism not confirmed from portal side

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase; no fast-moving dependencies for this phase)
