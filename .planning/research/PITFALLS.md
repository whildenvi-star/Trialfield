# Pitfalls Research

**Domain:** Adding role-based budget filtering and projected vs actual actuals entry to an existing Next.js farm operations app
**Researched:** 2026-03-20
**Confidence:** HIGH — all pitfalls are grounded in direct inspection of the existing codebase at `~/Desktop/my-project-one/organic-cert/`; no speculative claims

---

## Critical Pitfalls

### Pitfall 1: `getAuthContext()` Falls Back to ADMIN — Making Role Filtering Pointless

**What goes wrong:**
Every API route and server component that calls `getAuthContext()` silently falls back to the first active ADMIN user when no session cookie is present. The app currently runs inside an iframe in the portal, where session cookies do not propagate. The result: any unauthenticated request (iframe load, API call from the portal context, or a CREW member accessing the app directly) gets treated as ADMIN. Adding role-conditional rendering in the UI while the session is always resolved as ADMIN means no filtering ever actually fires.

**Why it happens:**
The fallback was intentional for the iframe embedding scenario (see `src/lib/auth.ts` lines 78–109). It works fine when every user should see everything. It breaks the moment any response must differ by role.

**How to avoid:**
Before building any role-filtered view or API gate, resolve the auth fallback. Options in order of preference:
1. Pass the portal's session token in a request header (e.g., `X-Auth-Token`) when the cert-tracker loads inside the iframe. Read this header in `getAuthContext()` and validate it against the session store.
2. Use a signed embed token scoped to a specific user identity (not just "give admin"), so the iframe context carries a real role.
3. At minimum: change the fallback so it returns `null` and let API routes 401, rather than silently granting ADMIN. Then fix the iframe auth properly.

**Warning signs:**
- Sandy (OFFICE role) logs in and still sees the Budget tab with profit/margin data.
- API calls to `/api/field-enterprises/[id]/budget-summary` from the browser return `revenueProjection` with `targetPrice` and `projectedGrossMargin` regardless of who is logged in.
- `getAuthContext()` always returns `role: "ADMIN"` in server logs even when Sandy is the active user.

**Phase to address:**
Phase 1 (RBAC & Auth Foundation). Nothing else can be built correctly until this is fixed. All downstream role-filtering work assumes `getAuthContext()` returns the actual caller's role.

---

### Pitfall 2: The `budget-summary` API Route Has No Auth Check — It Returns All Financial Data to Any Caller

**What goes wrong:**
`/api/field-enterprises/[id]/budget-summary/route.ts` contains zero authentication or role checks. It computes and returns `targetPricePerUnit`, `projectedGrossRevenue`, `projectedGrossMargin`, and `projectedMarginPerAcre` to any HTTP client that can reach the server. The main enterprise GET route (`/api/field-enterprises/[id]/route.ts`) also has no auth check and returns the full `FieldEnterprise` row including `targetPricePerUnit` and `fallowCostAmount` directly from Prisma.

**Why it happens:**
These routes were built before role filtering was a requirement. The guard pattern exists in admin routes (`/api/admin/`) but was never applied to field-enterprise routes.

**How to avoid:**
Add `getAuthContext()` to every field-enterprise API route. For the `budget-summary` route specifically:
- If `role !== "ADMIN"`, strip `revenueProjection`, `operationCosts.costPerAcre`, `operationCosts.totalCost`, `totalCostOfProduction`, and `costPerAcre` from the response before returning.
- Do this at the API layer, not only in the UI. UI-only filtering is insufficient because the raw JSON is visible in DevTools network tab.

For the main enterprise GET route:
- Strip `targetPricePerUnit`, `targetPriceUnit`, `fallowCostAmount`, `fallowCostCategory` from the response for non-ADMIN roles.

**Warning signs:**
- Opening DevTools Network tab as Sandy and inspecting the `budget-summary` response shows `revenueProjection` object.
- `/api/field-enterprises/[id]` response contains `targetPricePerUnit` in the JSON payload for an OFFICE session.
- No `getAuthContext()` import in `budget-summary/route.ts`.

**Phase to address:**
Phase 1 (RBAC & Auth Foundation). Must be locked down before Phase 2 touches any UI.

---

### Pitfall 3: Removing the Organic-Only Filter From `sync-macro` Creates Duplicate Enterprises for Existing Organic Fields

**What goes wrong:**
The current sync at `/api/fields/sync-macro` filters to organic enterprises only (line 165–169 of `sync-macro/route.ts`). It matches budget fields to local `FieldEnterprise` rows using `{ fieldId, cropYear, crop, label: null }`. When the filter is removed to allow conventional enterprises, the match query is unchanged. A conventional budget field named "Kopp" with crop "Corn" will look for an existing enterprise on that field for that year and crop. If no match exists, it creates one. This is correct. But if the organic enterprise on that same field has a different `organicStatus` value, the upsert logic will create a second enterprise instead of recognizing it. Worse, if a field was previously synced as organic and the budget service now categorizes it differently, the enterprise is not updated — a new one is created alongside the old one, duplicating the crop plan.

**Why it happens:**
The match key `{ fieldId, cropYear, crop, label: null }` does not include `organicStatus`. Organic and conventional crops of the same type on the same field in the same year are indistinguishable by the current key.

**How to avoid:**
Before removing the organic filter:
1. Update the upsert match key to include `organicStatus` derived from the budget enterprise's `category` field.
2. Add a dry-run option that returns what would be created vs updated without committing — run it against the current dataset to see collisions before going live.
3. Wrap the expanded sync in a database transaction with a rollback condition if duplicate-key violations are detected.

**Warning signs:**
- After running expanded sync, a field shows two `FieldEnterprise` rows with the same `fieldId`, `cropYear`, and `crop` but different `organicStatus` values.
- The `@@unique([fieldId, cropYear, crop, label])` constraint on `FieldEnterprise` throws a Prisma unique constraint violation error during sync.
- Sync result counts show unexpectedly high `enterprises.created` numbers.

**Phase to address:**
Phase 3 (All-Enterprise Sync Expansion). Do not expand the sync until the match key issue is resolved.

---

### Pitfall 4: Budget Summary Is Computed From Relations That Mix PLANNED and CONFIRMED Operations — Actuals Entry Will Break the Existing Totals

**What goes wrong:**
`budget-summary/route.ts` computes `totalOperationCost` by iterating `enterprise.fieldOperations` without filtering by `passStatus`. It sums `costPerAcre * acresWorked` for both `PLANNED` budget-imported operations and `CONFIRMED` actual operations. When Sandy enters actuals (CONFIRMED passes), they will be added on top of the PLANNED projected costs, inflating the total. The admin will see a combined number that is neither the projection nor the reality — it is both doubled.

**Why it happens:**
The `passStatus` field exists and was built for exactly this purpose, but the `budget-summary` computation does not use it. The UI on lines 246 and 396 of the detail page already filters by `passStatus` in some places, but the API route does not.

**How to avoid:**
Split `budget-summary` into two computation paths before any actuals are entered:
- **Projected:** filters `fieldOperations` where `passStatus === "PLANNED"`, uses projected `costPerAcre` from budget import.
- **Actual:** filters `fieldOperations` where `passStatus === "CONFIRMED"`, uses costs recorded at confirmation time.
- Return both paths in the response (`projected: {...}, actual: {...}`), not a merged total.

Similarly split seed and material costs: projected = synced values, actual = values entered by Sandy.

The schema already supports this via `passStatus` and `plannedSource`. The computation just needs to use them.

**Warning signs:**
- `totalCostOfProduction` in the budget summary grows unexpectedly after Sandy confirms a field pass.
- The admin's budget tab shows a total higher than either the projected plan or Sandy's actuals alone.
- `budget-summary` route does not filter `fieldOperations` by `passStatus`.

**Phase to address:**
Phase 2 (Actuals Entry + Dual-Layer Computation). Must be addressed before actuals entry goes live.

---

### Pitfall 5: The UI Budget Tab Has No Role Check — It Will Show Financial Data to Sandy by Default

**What goes wrong:**
The field enterprise detail page (`src/app/(app)/field-enterprises/[id]/page.tsx`) fetches and renders `budgetSummary` including `revenueProjection.targetPrice`, `projectedGrossMargin`, `projectedGrossRevenue`, and `projectedMarginPerAcre` with no role check anywhere in the component. The component does not call `getAuthContext()` or `useSession()`. The role shown in the header is passed as a prop from the layout (`role={user?.role || "ADMIN"}`), but the detail page does not receive that prop and does not use it.

**Why it happens:**
Role-based view filtering was not a requirement when the budget tab was built. The page is a client component — it fetches data on mount and renders what the API returns.

**How to avoid:**
Two layers are required:
1. **API layer** (see Pitfall 2): strip financial fields from the `budget-summary` response for non-ADMIN.
2. **UI layer**: pass the user's role down to the detail page (from layout or a session hook), then conditionally render the Budget tab, tab badge, and all `$` figures only when `role === "ADMIN"`.

Do not rely on API filtering alone — the tab and its badge should not appear in Sandy's navigation at all. Do not rely on UI filtering alone — never trust client-side hiding for sensitive data.

**Warning signs:**
- The Budget tab appears in Sandy's tab bar.
- No `role` variable in `src/app/(app)/field-enterprises/[id]/page.tsx`.
- No conditional rendering around `<TabsTrigger value="budget">` or `<TabsContent value="budget">`.

**Phase to address:**
Phase 1 (RBAC & Auth Foundation) for the gate; Phase 2 for the dual-layer view that replaces the hidden tab with Sandy's actuals entry view.

---

### Pitfall 6: OFFICE Role Currently Has `sale:read` — Sale Prices May Leak Through Other Routes

**What goes wrong:**
`src/lib/rbac.ts` grants OFFICE the `sale:read` and `sale:write` permissions. If any sale route or component joins or returns `pricePerUnit`, `totalRevenue`, or similar fields, Sandy can read sale prices through those routes independently of the budget tab. Hiding the budget tab does not help if `/api/sales` returns per-unit prices in the response.

**Why it happens:**
`sale:read` was granted to OFFICE for recording loadouts and sales (operational data), not for viewing financial performance. The permission is the right one for the action but does not distinguish between "can record a sale" and "can see the margin on that sale."

**How to avoid:**
Audit every route protected by `sale:read` and `sale:write`. For routes that return financial performance fields (`pricePerUnit`, `totalRevenue`, `grossMargin`), apply the same stripping logic used for the budget summary: if `role !== "ADMIN"`, omit those fields. Consider adding a new permission `budget:read` distinct from `sale:read` and gating financial performance fields exclusively on it.

**Warning signs:**
- `/api/field-enterprises/[id]/route.ts` GET response includes `targetPricePerUnit` without a role check.
- Sale-related API routes return `pricePerUnit` or margin figures to OFFICE sessions.

**Phase to address:**
Phase 1 (RBAC & Auth Foundation). Audit should be a deliverable of Phase 1 before any new views are built.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| UI-only role filtering (hide the tab, don't gate the API) | Faster to implement | API remains open; any developer or curious user with DevTools can read financial data | Never — financial data requires API-layer enforcement |
| Keep `getAuthContext()` ADMIN fallback, add role checks that depend on it | No iframe auth work needed | All role checks are vacuous; filtering never fires | Never for this milestone |
| Compute projected+actual as one merged total | Simpler summary route | Inflates totals once Sandy starts entering actuals; breaks admin comparison view | Never once actuals entry is live |
| Remove organic filter from sync without updating the match key | Enables all-enterprise sync quickly | Creates duplicate enterprises for fields that were already synced | Never — run the dry-run first |
| Store actuals by overwriting projected fields | No schema changes needed | Admin loses the projected plan; no comparison possible | Never — actuals must be a separate layer |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `farm-budget` service (port 3001) — expanded sync | Assume enterprise `category` field maps cleanly to `organicStatus` on `FieldEnterprise` | Explicitly test the category values the budget service returns for conventional enterprises; the current filter checks for `"organic"` and `"ORG"` system codes — conventional may use different values entirely |
| `budget-summary` route — dual-layer response | Add a `type=projected\|actual` query param and branch inside the same route | Keep projected and actual as separate named fields in one response object; the admin comparison view needs both simultaneously |
| `fieldOperations` — actuals entry | Reuse the existing CONFIRMED flow by just letting Sandy edit any operation | CONFIRMED ops with `plannedSource: "budget-import"` are the projected plan; Sandy should create new CONFIRMED ops without `plannedSource`, not edit the budget-imported ones |
| `sync-macro` — re-run after expansion | Assume re-running is safe because it deletes and recreates PLANNED ops | `deleteMany` where `passStatus: "PLANNED" AND plannedSource: "budget-import"` is safe; but if the conventional expansion creates enterprises that match existing organic enterprises incorrectly, re-running will delete organic PLANNED ops for those fields |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Computing budget summary on every page load with N+1 relation queries | Slow tab render for large enterprises with many material usages or field operations | The current `budget-summary` route loads all relations in one Prisma `include` call — this is correct; maintain this pattern when adding actuals layer | At ~50+ materialUsages per enterprise the query is still fast; not a concern at farm scale |
| Running expanded sync without batching (current sync is already N individual Prisma calls per field) | Sync timeout on large field counts | The registry sync already uses a single `$transaction`; the macro sync does not — this is a pre-existing debt, acceptable for farm scale (~50 fields) | Not a blocker; document as known debt |
| Fetching both projected and actual budget summaries as two separate API calls in the admin comparison view | Double network round trips; UI flicker | Return `{ projected: {...}, actual: {...} }` from a single enhanced `budget-summary` route | Not a performance concern at farm scale; more a code quality issue |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `getAuthContext()` ADMIN fallback active while role-based filtering is in production | Any unauthenticated request (cron, embed, misconfigured browser) reads financial data as ADMIN | Fix iframe auth before Phase 2 goes live; change fallback to return `null` and 401 |
| Financial fields returned in the main enterprise GET response (`targetPricePerUnit`, `fallowCostAmount`) | Sandy can read sale prices by inspecting network traffic even if the budget tab is hidden | Strip financial fields from enterprise GET response for non-ADMIN roles at the route level |
| Actuals write route not checking that the caller has OFFICE or ADMIN role | CREW member or unauthenticated caller can write actuals | All mutation routes for actuals must check `role === "ADMIN" || role === "OFFICE"` after fixing the auth fallback |
| `sale:read` on OFFICE grants access to any sale-adjacent data without per-field financial filtering | Sale price becomes visible through a non-budget route | Introduce `budget:read` permission gated to ADMIN only; audit all routes that join or return price/margin fields |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing Sandy an empty Budget tab or a "No access" message | Confusing — Sandy doesn't know why the tab is empty or what she's supposed to do | Hide the Budget tab entirely for OFFICE; replace it with an "Actuals Entry" tab that shows Sandy's workflow |
| Dual projected/actual view that shows both columns always | Admin overwhelmed by doubled rows for every line item | Default to projected-only view; let admin toggle "Show Actuals" or use a side-by-side mode only when actuals exist |
| Displaying currency symbols and totals in Sandy's actuals entry form | Sandy questions whether she's entering costs or viewing the budget; role confusion | Sandy's form shows quantities (rate, acres, passes) and unit costs for her own invoices — not aggregate financial totals or margins |
| Sync button available to Sandy triggers expanded sync that pulls conventional enterprises | Sandy inadvertently creates unreviewed conventional enterprises | Scope the sync button by role; OFFICE can trigger actuals sync but not the crop-plan import sync |
| Projected vs actual comparison shows "0" actuals before Sandy has entered anything | Admin sees an alarming view with all actuals at $0 | Show comparison view only when at least one actual exists; otherwise show projected-only with a status indicator |

---

## "Looks Done But Isn't" Checklist

- [ ] **Role-filtered budget tab:** Often missing API-layer stripping — verify that `/api/field-enterprises/[id]/budget-summary` returns no `revenueProjection`, no `costPerAcre`, and no `totalCostOfProduction` in an OFFICE session (not just that the tab is hidden in the UI)
- [ ] **Auth fallback fix:** Often declared fixed when only the UI path is gated — verify that a `curl` request with no session cookie to `/api/field-enterprises/[id]/budget-summary` returns `401` rather than financial data
- [ ] **Dual-layer computation:** Often "done" when the UI shows two columns — verify that projected totals do not change after Sandy confirms a field pass (projected layer must be frozen to PLANNED ops only)
- [ ] **All-enterprise sync expansion:** Often done when conventional enterprises appear — verify that no existing organic `FieldEnterprise` rows were duplicated by running a query for `GROUP BY fieldId, cropYear, crop, label HAVING COUNT(*) > 1`
- [ ] **Actuals entry form:** Often done when Sandy can save a record — verify that submitting an actuals record does not modify any field on the budget-imported PLANNED operation (actuals and projected must remain separate rows)
- [ ] **Financial field audit:** Often done when the budget tab is gated — verify that `targetPricePerUnit` is absent from the `/api/field-enterprises/[id]` GET response for an OFFICE session

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ADMIN fallback bypasses all role filters after launch | HIGH | Immediately disable iframe embed until proper token auth is implemented; all role-filtered views are compromised until then |
| Duplicate enterprises created by expanded sync | MEDIUM | Write a migration script to identify duplicates (`GROUP BY fieldId, cropYear, crop, label`); merge actuals from the duplicate onto the canonical enterprise; delete the duplicate; re-run sync with the fixed match key |
| Projected totals inflated by actuals entries | MEDIUM | Patch `budget-summary` to filter by `passStatus`; totals will self-correct on next page load — no data migration required since the underlying records are correct |
| Financial fields in API response exposed to OFFICE | LOW | Add role stripping to the route handler; no data migration required; fix is a one-file change |
| Sandy's actuals overwrote projected PLANNED operations | HIGH | Restore PLANNED operations from the last sync run or from the `farm-budget` service via a fresh sync; any actuals stored as mutations on PLANNED rows are lost |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `getAuthContext()` ADMIN fallback | Phase 1: RBAC & Auth Foundation | `curl` with no session returns 401 on budget routes |
| `budget-summary` no auth check | Phase 1: RBAC & Auth Foundation | OFFICE session API call omits all financial fields |
| Main enterprise GET returns financial fields | Phase 1: RBAC & Auth Foundation | OFFICE session response has no `targetPricePerUnit` |
| UI budget tab has no role check | Phase 1: RBAC & Auth Foundation | Sandy's UI shows no Budget tab and no `$` badge |
| `sale:read` leaks prices through other routes | Phase 1: RBAC & Auth Foundation | Audit log confirms no price fields in OFFICE-accessible routes |
| Dual-layer computation merges projected + actual | Phase 2: Actuals Entry + Dual-Layer Computation | Projected total unchanged after Sandy confirms a pass |
| Expanded sync creates duplicate enterprises | Phase 3: All-Enterprise Sync Expansion | No duplicate `(fieldId, cropYear, crop, label)` after sync |
| Organic match key collision with conventional | Phase 3: All-Enterprise Sync Expansion | Dry-run reports zero collisions before live sync |

---

## Sources

- Direct code inspection: `src/lib/auth.ts` — `getAuthContext()` fallback behavior, lines 78–109
- Direct code inspection: `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — no auth check
- Direct code inspection: `src/app/api/field-enterprises/[id]/route.ts` — no auth check, full row returned
- Direct code inspection: `src/app/api/fields/sync-macro/route.ts` — organic filter lines 165–169, match key pattern
- Direct code inspection: `src/lib/rbac.ts` — OFFICE role includes `sale:read`, `sale:write`
- Direct code inspection: `src/app/(app)/field-enterprises/[id]/page.tsx` — no role variable, no budget tab gate
- Direct code inspection: `src/app/(app)/layout.tsx` — `role={user?.role || "ADMIN"}` default
- Direct code inspection: `prisma/schema.prisma` — `FieldEnterprise.targetPricePerUnit`, `PassStatus` enum, `@@unique` constraint

---
*Pitfalls research for: v2.0 Projected vs Actual Farm Budget — role-based filtering and actuals entry on existing organic-cert app*
*Researched: 2026-03-20*
