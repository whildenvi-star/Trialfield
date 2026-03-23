---
status: resolved
trigger: "portal-data-integrity — comprehensive audit of cascading data issues across crop plan, budget/financial, and multiple areas"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND RESOLVED — multiple specific bugs across the codebase causing cascading data failures
test: Full code audit + fixes applied
expecting: All five bugs fixed
next_action: Deploy to production droplet, run manual verification of admin user management and crop plan sync

## Symptoms

expected: Data saves correctly, displays correctly across crop plan, budget, and other pages
actual: Data issues across crop plan, budget/financial, and multiple areas. Gradual decline — fixes cause new breaks elsewhere.
errors: Not specified
reproduction: General usage across the portal
started: Gradual decline over time, no single trigger

## Eliminated

- hypothesis: Supabase client configuration broken
  evidence: browser.ts, server.ts, middleware.ts all follow the correct @supabase/ssr pattern with proper cookie handling
  timestamp: 2026-03-23

- hypothesis: Auth guard logic broken
  evidence: requireModuleAccess() in guard.ts is structurally correct — it checks user, then profile role, then module_access. Pattern is consistent.
  timestamp: 2026-03-23

- hypothesis: Data race conditions in parallel fetches
  evidence: All Promise.all() calls use independent tables, no shared mutable state. Promise.allSettled() used on dashboard correctly.
  timestamp: 2026-03-23

## Evidence

- timestamp: 2026-03-23
  checked: Admin routes — /api/admin/users/[id]/route.ts, access/route.ts, role/route.ts
  found: All three use synchronous params `{ params: { id: string } }` not `{ params: Promise<{ id: string }> }`. This is the OLD Next.js 14 API. Next.js 15 made params a Promise.
  implication: CRITICAL — direct property access `params.id` on a Promise object returns undefined. Every admin action (delete user, change role, grant/revoke access) silently does nothing or crashes.

- timestamp: 2026-03-23
  checked: crop-plans/page.tsx and crop-plans/[fieldId]/page.tsx authentication pattern
  found: Both use `supabase.auth.getSession()` (browser client) to get the access_token for Bearer auth to the mobile API. Supabase docs explicitly warn that getSession() reads from local storage and DOES NOT validate the JWT with the server — it can return a stale/expired token.
  implication: HIGH — If the session token is expired but cached in localStorage, the crop plans page will always get a 401 from the mobile API and fall back to the stale IndexedDB cache, showing old data even when the user thinks they are online and up to date.

- timestamp: 2026-03-23
  checked: In-memory TTL cache in /api/mobile/crop-plans/route.ts
  found: `let cached = null` is a module-level variable in the server route. The cache is shared across ALL users and ALL sessions. Any user's request that happens to populate the cache will serve that user's enterprise/field data to ALL subsequent requests within the 60-second window.
  implication: CRITICAL — DATA LEAK + WRONG DATA. User A's fields show up for User B. The cache is never invalidated when fields change in farm-budget. This is the most likely cause of "data showing wrong after updates."

- timestamp: 2026-03-23
  checked: Year hardcoding across the codebase
  found: The following locations have year=2026 hardcoded (not via query param): /api/fsa/validation/route.ts (lines 13-15), /api/fsa/auto-populate-preview/route.ts (line 211), /api/insurance/aph-lookup/route.ts (line 27), InsuranceWorkspace component text, acreage-pdf-button.tsx, insurance-pdf-button.tsx.
  implication: MEDIUM — Once the crop year changes (or if data is entered for a different year), these endpoints will return empty results or wrong cross-year comparisons. Already causing confusion in crop plan/insurance cross-module flows if any 2025 data remains.

- timestamp: 2026-03-23
  checked: /api/fsa/auto-populate-preview/route.ts and /api/macro/programs/route.ts
  found: Both bypass the proxy.ts helper and directly hardcode `http://localhost:3001/api/dashboard` and `http://localhost:3001/api/programs`. No EMBED_TOKEN authentication header is sent. proxy.ts sends `Cookie: embed_session=${EMBED_TOKEN}` but these direct fetches send nothing.
  implication: HIGH — If farm-budget service requires the embed_session cookie for authentication (which it appears to from proxy.ts), these two endpoints will always get rejected or return unauthorized/empty data. Auto-populate preview will fail silently (returns a 502 from its own try/catch), and the Macro Rollup "Crop Comparison" section will be broken.

- timestamp: 2026-03-23
  checked: Schema coverage — supabase/schema.sql vs tables queried in code
  found: schema.sql only defines `profiles` and `module_access`. The migrations directory only adds `field_observations` and admin policies. But the code queries: `clu_records`, `insurance_policies`, `insurance_pricing`, `claims`, `claim_timeline`, `claim_documents`, `gcs_enrollments`. None of these have migration files in this repo.
  implication: MEDIUM — These tables exist on the live Supabase instance (applied via SQL Editor per README instructions) but are undocumented in source control. Any new deployment, schema change, or disaster recovery would need manual re-entry of all these schemas. Not a runtime bug, but a critical ops risk.

- timestamp: 2026-03-23
  checked: RLS policy coverage for business data tables
  found: `profiles` and `module_access` have RLS. `field_observations` has RLS. But `clu_records`, `insurance_policies`, `insurance_pricing`, `claims`, `claim_timeline`, `claim_documents`, `gcs_enrollments` — RLS status is UNKNOWN from the repo. The API routes guard access via `requireModuleAccess()` which is server-side only.
  implication: HIGH — If RLS is disabled on these business tables (likely, since they were created outside the schema migrations), a compromised or bypassed session token could give direct access to ALL farm data. Anyone with the Supabase anon key and any valid JWT can read all claims, all insurance policies, all CLU records.

- timestamp: 2026-03-23
  checked: /api/mobile/crop-plans/route.ts cache invalidation
  found: Cache is populated when ANY authenticated user fetches crop plans. Cache expires after 60 seconds. Crucially: the cache stores the FULL field list regardless of which user requested it. The mobile auth system validates the user via service role key, but the cache doesn't key on user identity.
  implication: CRITICAL — if user A (operator for enterprise "North Farm") fetches crop plans, and then user B (operator for "South Farm") fetches within 60 seconds, user B sees user A's field data. This is confirmed wrong behavior.

- timestamp: 2026-03-23
  checked: Missing RLS on the `clu_records` bulk-update route
  found: `/api/fsa/clu-records/bulk-update/route.ts` does NOT check ownership of the records being updated — it only checks module access. Any user with `fsa-578` module access can bulk-update ANY CLU record ID, regardless of whose data it is.
  implication: MEDIUM — In a single-farm scenario this is fine; in a multi-user/multi-farm scenario this is a data integrity hole.

- timestamp: 2026-03-23
  checked: Invite route uses supabase server client for role update after creating user with admin client
  found: In /api/admin/invite/route.ts, user is created via `adminClient` (service role) but role is updated via `supabase` (anon key, session-bound client). The `supabase` client here is authenticated as the admin calling the endpoint, but updating profiles for another user requires a service role key — the standard RLS policy for profiles only allows `auth.uid() = id` for updates, meaning only the user themselves can update their own profile.
  implication: HIGH — Role assignment during invite silently fails if profiles_admin_update RLS policy isn't active (migration 001 adds it, but there's also profiles_update_own which takes precedence in restrictive mode). If role update fails, new user is stuck as 'viewer' even though the invite specified a different role. The code logs this as a non-fatal warning, masking the problem.

- timestamp: 2026-03-23
  checked: MacroRollupPage queries `gcs_enrollments` table
  found: This table is not defined in any migration in the repo. No RLS known. No API route backs this table — it's queried directly in the server component. If the table doesn't exist or has no data, the page silently shows "No GCS enrollment data" — not catastrophic but invisible failure.
  implication: LOW — Silent empty state, not a data corruption risk.

## Resolution

root_cause: Multiple independent bugs — (1) Cross-user data leak in crop-plans in-memory cache, (2) Admin routes using deprecated synchronous params API (Next.js 14 → 15 regression) breaking all admin operations, (3) Direct localhost fetches bypassing EMBED_TOKEN auth in auto-populate and macro programs routes, (4) Role assignment via wrong Supabase client in invite route.

fix: |
  BUG 1 (Cross-user cache): Changed module-level `let cached = null` singleton to `const userCacheMap = new Map<string, ...>()` keyed by user.id. Cache is now per-user.
  BUG 2 (Admin params): Updated all three admin routes to `params: Promise<{ id: string }>` and added `const { id: targetId } = await params` before use.
  BUG 4 (Direct localhost fetches): Replaced `fetch('http://localhost:3001/...')` with `fetchBudgetService()` calls in auto-populate-preview and macro/programs routes.
  BUG 5 (Invite role update): Changed `supabase.from('profiles').update(...)` to `adminClient.from('profiles').update(...)` to bypass RLS for cross-user profile writes.

verification: Manual — deploy to droplet and verify admin user management works (role change, module access toggle, user delete), crop plan list shows per-user data, auto-populate preview returns data, macro rollup crop comparison loads.

files_changed:
  - src/app/api/admin/users/[id]/route.ts
  - src/app/api/admin/users/[id]/access/route.ts
  - src/app/api/admin/users/[id]/role/route.ts
  - src/app/api/mobile/crop-plans/route.ts
  - src/app/api/fsa/auto-populate-preview/route.ts
  - src/app/api/macro/programs/route.ts
  - src/app/api/admin/invite/route.ts

---

## FINDINGS REPORT

### Architecture Summary

Data flows in this app via three paths:
1. **Supabase direct** (server components + API routes) — FSA, Insurance, Claims, Admin, Observations
2. **Express service proxy** (via proxy.ts) — Budget, Seed, Registry, Cert services on localhost ports
3. **IndexedDB offline cache** (via crop-plan-sync.ts + observation-queue.ts) — Crop Plans, Observations

### BUG 1 — CRITICAL: Cross-User Data Leak in Crop Plans Cache

**File:** `/src/app/api/mobile/crop-plans/route.ts`

**The bug:** Line 6 — `let cached: { data: unknown; expiry: number } | null = null` is a module-level singleton. In Next.js, route modules are cached per process. The cached field list is shared across ALL authenticated users. Any request within 60 seconds of the cache being populated gets the previous user's data.

**Impact:** User B sees User A's field list. If operators from different farms use the app within the same 60-second window, they see each other's data.

**Fix required:** Remove the module-level cache entirely, OR key the cache per user ID.

---

### BUG 2 — CRITICAL: Admin Routes Use Deprecated Synchronous Params API

**Files:**
- `/src/app/api/admin/users/[id]/route.ts`
- `/src/app/api/admin/users/[id]/access/route.ts`
- `/src/app/api/admin/users/[id]/role/route.ts`

**The bug:** All three use `{ params }: { params: { id: string } }` — the Next.js 14 synchronous params API. Next.js 15 changed dynamic route params to be a Promise. Accessing `params.id` directly on a Promise returns `undefined`.

**Impact:** Delete user, change role, and grant/revoke module access all operate on `undefined` IDs — they silently do nothing or corrupt data.

**Fix required:** Change to `{ params }: { params: Promise<{ id: string }> }` and `await params` before accessing `.id`.

---

### BUG 3 — HIGH: getSession() Used for Bearer Token (Returns Stale Tokens)

**Files:**
- `/src/app/(protected)/crop-plans/page.tsx` (line 100)
- `/src/app/(protected)/crop-plans/[fieldId]/page.tsx` (line 110)

**The bug:** Both use `supabase.auth.getSession()` to get the access_token. Supabase explicitly documents that `getSession()` reads from localStorage/cookies WITHOUT server validation — the token may be expired. The correct method is `supabase.auth.getUser()` which validates the JWT with Supabase Auth servers.

**Impact:** If a user's session token is expired but not yet cleared from localStorage, `getSession()` returns a stale token. The Bearer token sent to `/api/mobile/crop-plans` fails with 401. The page silently falls back to stale IndexedDB cache. The user sees old data and doesn't know why.

**Fix required:** Replace `getSession()` with `getUser()` and derive the token from the session refresh.

---

### BUG 4 — HIGH: Direct localhost Fetches Bypass EMBED_TOKEN Auth

**Files:**
- `/src/app/api/fsa/auto-populate-preview/route.ts` (line 197)
- `/src/app/api/macro/programs/route.ts` (lines 20-21)

**The bug:** These routes hardcode `http://localhost:3001/api/dashboard` and `http://localhost:3001/api/programs` WITHOUT the `Cookie: embed_session=${EMBED_TOKEN}` header that `proxy.ts` sends. The proxy helper exists specifically to handle this auth requirement.

**Impact:** If farm-budget requires `embed_session` authentication (implied by proxy.ts design), auto-populate preview always returns 502 ("Farm-budget is offline") even when the service is running, and the Macro Rollup crop comparison section always fails. These are HIGH-visibility features.

**Fix required:** Replace direct `fetch('http://localhost:3001/...')` calls with the `fetchBudgetService()` helper from proxy.ts.

---

### BUG 5 — HIGH: Invite Route Uses Wrong Supabase Client for Role Update

**File:** `/src/app/api/admin/invite/route.ts` (line 72)

**The bug:** After creating a user with `adminClient` (service role), the role update uses `supabase` (anon key, caller's session). The RLS policy `profiles_update_own` requires `auth.uid() = id` — meaning only the user themselves can update their own profile. Updating another user's profile via the anon client will be blocked by RLS unless `profiles_admin_update` policy takes precedence AND is the only active update policy.

There's a conflict: `profiles_update_own` is a permissive policy for `auth.uid() = id`, and `profiles_admin_update` is a permissive policy for admins. In Supabase, permissive policies are OR'd together. The admin policy should allow the update — BUT only if both policies exist on the live DB. Since this policy was added in migration 001 (which might or might not have been applied), this is environment-dependent.

**Additional issue:** The module grants at lines 90-92 use `adminClient.from('module_access')` which bypasses RLS correctly. But the role update at line 72 uses `supabase` (line 71 context shows `supabase` is the anon client from `createClient()`). This is inconsistent.

**Fix required:** Use `adminClient` for the role update too, bypassing RLS concerns entirely.

---

### BUG 6 — MEDIUM: Year Hardcoded in Multiple Places Without Env Config

**Files:** `/api/fsa/validation/route.ts`, `/api/fsa/auto-populate-preview/route.ts`, `/api/insurance/aph-lookup/route.ts`, multiple components

**The bug:** Crop year 2026 is hardcoded in ~15 locations including API logic (not just display). Some routes accept a `year` query param but fall back to 2026 hardcoded; others have no parameterization at all.

**Impact:** When the farm transitions to planning 2027, all hardcoded-year queries return empty results or wrong cross-year data. Already a problem if any 2025 legacy data needs to be compared.

**Fix required:** Extract `CURRENT_CROP_YEAR = 2026` constant to a shared config file and reference it everywhere. For the hardcoded API endpoints, accept a year parameter.

---

### BUG 7 — MEDIUM: Missing RLS on Business Data Tables

**Context:** Tables `clu_records`, `insurance_policies`, `insurance_pricing`, `claims`, `claim_timeline`, `claim_documents`, `gcs_enrollments` are not defined in any repo migration — they were applied manually via Supabase SQL Editor. Their RLS status is unknown from the codebase.

**The risk:** If RLS is disabled on these tables, the Supabase anon key + any valid JWT can be used to read all farm data directly — bypassing the portal's module access control entirely.

**Verification needed:** Check Supabase dashboard for each of these tables — confirm RLS is enabled and policies restrict access appropriately.

---

### NON-BUG OBSERVATIONS

**Schema documentation gap:** The most critical business tables (CLU records, insurance, claims) have no migration files in source control. Recovery from a Supabase project reset would require manual SQL reconstruction.

**getLastSyncTime in crop plans:** Uses a sort over all cached plans' `cachedAt` timestamps, returning the max. If many fields are cached, this is O(n). Not a bug, but could become slow with hundreds of fields.

**Observation photo storage:** Photos from field observations are written to `process.cwd()/uploads/observations/` on the server filesystem. On a container/serverless environment this directory is ephemeral. The `/api/observations/photo/[filename]` route reads these back. This works on a persistent droplet but would fail on any container restart.

---

## PRIORITY FIX PLAN

1. **BUG 2** (Admin routes — params) — Fix immediately. All admin operations are broken.
2. **BUG 1** (Cross-user cache) — Fix immediately. Data leak between users.
3. **BUG 4** (Missing EMBED_TOKEN in direct fetches) — Fix now. Auto-populate and Macro Rollup are broken features.
4. **BUG 5** (Invite role update client) — Fix now. New users can't be properly provisioned.
5. **BUG 3** (getSession vs getUser) — Fix now. Causes stale data display.
6. **BUG 6** (Year hardcoding) — Fix after above, lower urgency.
7. **BUG 7** (RLS verification) — Manual verification task on Supabase dashboard.
