# Phase 33: Cross-Module Integration + Dashboard - Research

**Researched:** 2026-03-06
**Domain:** Next.js 14 App Router cross-module navigation, Supabase multi-table aggregation, React client-side state integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation decisions are Claude's Discretion.

### Claude's Discretion
User gave full discretion on all implementation decisions for this phase. Claude should make choices that:
- Follow existing portal UI patterns (dark soil aesthetic, card components, module-gating)
- Prioritize simplicity and consistency over novel interactions
- Use patterns already established in phases 28, 30, and 32 (cards, modals, navigation)
- Match the cross-app fetch pattern (Promise.allSettled, AbortSignal.timeout) already documented

Specific discretion areas:
- Navigation style (page jump vs slide-out panel vs other)
- Breadcrumb trail vs simple back navigation
- Whether CLU→Policy link always shows (with "Create Policy" fallback) or only when linked
- Claim creation flow from Insurance (navigate to Claims module vs inline modal)
- Prompt presentation for prevented planting (modal, toast, inline banner, or other)
- Multi-policy selection vs auto-select primary policy
- Dismiss behavior and recoverability of the prevented planting prompt
- Dashboard card density (numbers only, numbers + mini visual, numbers + breakdown)
- Click-through targets (module landing vs filtered view)
- Refresh strategy (auto-polling vs page-load only)
- Visibility rules (module-gated vs all-visible with access prompts)
- Missing policy handling when user navigates from CLU
- Stale/offline data display on dashboard cards
- Zero-count card visibility
- No-access user dashboard experience

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | User can navigate from FSA CLU to related insurance policy | CLU has `policy_number` field + InsurancePolicy has `policy_number`; link by matching `farm_number` + `crop` OR `policy_number` |
| INT-02 | User can navigate from insurance policy to create a claim | `/api/claims` POST already supports `policy_id` prefill (CLM-07 in route.ts); just need UI trigger in InsuranceWorkspace |
| INT-03 | User sees prompted claim creation when CLU marked Prevented Planting | PATCH `/api/fsa/clu-records/[id]` whitelist includes editable fields; need to add `prevented_planting` + client-side prompt trigger |
| INT-04 | User can see FSA, Insurance, and Claims summary cards on portal dashboard | Dashboard currently shows static module cards; need new server-side summary API or Supabase queries in dashboard page |
</phase_requirements>

---

## Summary

Phase 33 is a pure integration and orchestration phase — no new modules, no new data tables. All the raw data is already in Supabase (`clu_records`, `insurance_policies`, `claims`). The work is threefold: (1) adding navigation links between existing module UIs, (2) wiring up the prevented planting trigger as a client-side prompt in `CluCard`, and (3) upgrading the portal dashboard page with live summary cards.

The FK chain is deliberately soft in this project — CLU records link to insurance policies via `farm_number` + `crop` matching (not a hard FK), and insurance policies link to claims via `policy_id` UUID FK. The `policy_number` field exists on both `CluRecord` and `InsurancePolicy` but is nullable and legacy-sourced. The most reliable join for INT-01 is `farm_number` + `crop` on the insurance table, queried client-side or via a lightweight API. For INT-02 and INT-03, `/api/claims POST` already accepts `policy_id` for prefill (CLM-07 route already written), so the UI just needs to call it with the right payload.

The dashboard (INT-04) currently renders static module cards from the `MODULES` constant. The upgrade is to add three live summary cards above the module grid — FSA reporting progress, Insurance coverage status, Claims pipeline count — fetched in the same server component using `Promise.all` Supabase queries, no new API routes required. Summary data is simple enough for Supabase direct queries in the server component (count reported CLUs, count claim alerts, count open claims).

**Primary recommendation:** Add cross-navigation links in existing client workspaces using Next.js `router.push()` with query params for pre-selection; implement prevented planting prompt as an inline banner below the expanded CluCard (not a modal); add summary cards to the existing dashboard server component using Promise.all Supabase queries.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.35 | App Router navigation with `useRouter` + `router.push()` | Already installed; cross-module navigation is just URL changes |
| React | 18.x | Client state for prompts and conditional UI | Already installed |
| Supabase | existing | Multi-table aggregate counts for dashboard | Already used in all pages; server component queries |
| Tailwind CSS | 3.4.x | Styling summary cards, prompt UI | Already installed, dark soil tokens in use |

### No New Packages Required

Phase 33 uses zero new npm packages. Every interaction pattern (modals, prompts, navigation, Supabase queries) exists in the codebase from phases 28–32.

```bash
# No installation needed
```

---

## Architecture Patterns

### Recommended File Structure

```
glomalin-portal/src/
├── app/(protected)/
│   ├── dashboard/
│   │   └── page.tsx          # MODIFY: add summary cards + Promise.all queries
│   └── app/
│       └── fsa-578/
│           └── page.tsx      # no change needed
├── components/
│   ├── dashboard/
│   │   └── summary-cards.tsx  # NEW: FSA/Insurance/Claims summary card trio
│   ├── fsa/
│   │   └── clu-card.tsx       # MODIFY: add prevented planting prompt + policy link
│   │   └── clu-workspace.tsx  # MODIFY: add prevented planting handler
│   └── insurance/
│       └── insurance-workspace.tsx  # MODIFY: add "Create Claim" action per policy row
└── app/api/
    └── fsa/
        └── clu-records/
            └── [id]/
                └── route.ts   # MODIFY: add `prevented_planting` to EDITABLE_FIELDS
```

### Pattern 1: CLU-to-Policy Navigation (INT-01)

**What:** When a user expands a CluCard, show a "View Policy" link (or "No policy — create one") that navigates to `/app/insurance` with a query param or hash that pre-selects/highlights the matching policy.

**Matching logic:** Query `insurance_policies` where `farm_number = clu.farm_number AND crop = clu.crop AND policy_year = clu.crop_year`. This is the most reliable join given nullable `policy_number` fields.

**Navigation approach:** Use `useRouter` from `next/navigation` inside the client component. On click: `router.push('/app/insurance?highlight=<policy_id>')`. The InsuranceWorkspace reads `searchParams` on mount and sets `selectedPolicyId`.

**When no policy exists:** Show "No policy for this CLU — Add Policy" link that navigates to `/app/insurance` and opens the create drawer (pass `?action=create&crop=<crop>&farm=<farm_number>`).

**Example:**
```typescript
// Source: Next.js 14 App Router docs — useRouter + useSearchParams
// In CluCard (expanded section):
import { useRouter } from 'next/navigation'

const router = useRouter()

// Fetch matching policy (lightweight — just farm_number + crop)
const [linkedPolicy, setLinkedPolicy] = useState<{id: string} | null>(null)

useEffect(() => {
  if (!isExpanded) return
  fetch(`/api/insurance/policies?farm_number=${record.farm_number}&crop=${encodeURIComponent(record.crop ?? '')}&year=${record.crop_year}`)
    .then(r => r.json())
    .then(d => setLinkedPolicy(d.policies?.[0] ?? null))
}, [isExpanded, record.farm_number, record.crop, record.crop_year])

// In expanded section UI:
{linkedPolicy ? (
  <button onClick={() => router.push(`/app/insurance?highlight=${linkedPolicy.id}`)}>
    View Insurance Policy
  </button>
) : (
  <button onClick={() => router.push(`/app/insurance?action=create&farm=${record.farm_number}&crop=${encodeURIComponent(record.crop ?? '')}`)}>
    No policy — Add one
  </button>
)}
```

### Pattern 2: Policy-to-Claim Navigation (INT-02)

**What:** Add a "Create Claim" button to each insurance policy row in `InsuranceWorkspace`. On click, call `POST /api/claims` with `policy_id` (which already accepts this — CLM-07 route exists). Then navigate to `/app/claims` to show the new claim in the Kanban.

**The POST /api/claims already supports prefill** from CLM-07 planning: body accepts `{ policy_id, date_of_loss, description }` and returns a new claim with crop/coverage prefilled from the policy.

**Example:**
```typescript
// Source: existing /api/claims POST route (Phase 31 + 32)
// In InsuranceWorkspace policy table row Actions cell:
async function handleCreateClaim(policy: InsurancePolicy) {
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      policy_id: policy.id,
      date_of_loss: new Date().toISOString().slice(0, 10),
      description: `Claim for ${policy.crop ?? 'unknown crop'} — ${policy.farm_name ?? ''}`,
    }),
  })
  if (res.ok) {
    router.push('/app/claims')
  }
}

// In the Actions cell (stopPropagation to avoid row click):
<button onClick={(e) => { e.stopPropagation(); handleCreateClaim(policy) }}>
  + Claim
</button>
```

### Pattern 3: Prevented Planting Trigger (INT-03)

**What:** When a user saves a CluCard with `use = 'Prevented Planting'` (or a dedicated `prevented_planting` checkbox is checked), show an inline banner inside the expanded card section offering to create a claim pre-filled with the CLU's linked policy.

**Implementation:** Add `prevented_planting` boolean to `EDITABLE_FIELDS` in `/api/fsa/clu-records/[id]/route.ts`. The `InsurancePolicy.prevented_planting` boolean already exists on the insurance table — the prompt shows when `draft.use === 'Prevented Planting'` OR when the existing `record.prevented_planting` flag transitions to true.

**Prompt style:** Inline banner inside the CluCard expanded section (not a modal) — consistent with how insurance claim alerts are surfaced as inline indicators. Single "Create Claim" button. Dismissible per session (useState in CluCard).

**Multi-policy:** Auto-select the first matching policy by `farm_number + crop`. If multiple match, show a simple select dropdown. If none match, show "No linked policy — navigate to Insurance to add one."

**Example:**
```typescript
// In CluCard expanded section, after save succeeds with prevented_planting=true:
{(draft.use === 'Prevented Planting' || record.prevented_planting) && !ppPromptDismissed && (
  <div className="mt-3 rounded border border-amber-700/50 bg-amber-950/30 px-3 py-2">
    <p className="font-mono text-xs text-amber-300 mb-2">
      Prevented Planting detected — create a claim?
    </p>
    {linkedPolicy ? (
      <div className="flex gap-2">
        <button
          onClick={handleCreatePreventedPlantingClaim}
          className="font-mono text-xs bg-soil-accent text-soil-bg rounded px-3 py-1"
        >
          Create Claim
        </button>
        <button
          onClick={() => setPpPromptDismissed(true)}
          className="font-mono text-xs text-soil-muted hover:text-soil-text"
        >
          Dismiss
        </button>
      </div>
    ) : (
      <button onClick={() => router.push('/app/insurance')}>
        Add Policy First
      </button>
    )}
  </div>
)}
```

### Pattern 4: Dashboard Summary Cards (INT-04)

**What:** Add three summary cards above the existing module grid in `dashboard/page.tsx`. Each card shows a single headline number with a label and navigates to the module on click.

**Data source:** Three Supabase queries in the existing server component, parallel with `Promise.all`. No new API routes. Dashboard is already a server component with `await createClient()`.

**Queries:**
- FSA: `count` of `clu_records` WHERE `crop_year=2026 AND reported=false` (unreported count) + total count → "X / Y reported"
- Insurance: `count` of `insurance_policies` WHERE `policy_year=2026 AND claim_alert='potential'` → "X potential alerts"
- Claims: `count` of `claims` WHERE `stage != 'closed'` → "X open claims"

**Visibility:** Show all three cards to all authenticated users regardless of module access. Cards without access show the number but clicking navigates to the module (which will deny access via RBAC if they don't have it). This is simpler than module-gating the summary cards and keeps the dashboard informative for admins who always have full access.

**Refresh:** Page-load only — no polling. Next.js server components render fresh on navigation. This is consistent with how all other pages work in this portal.

**Example:**
```typescript
// Source: Next.js 14 App Router server component pattern
// In dashboard/page.tsx — add before the module grid render:

const [
  { data: cluData },
  { data: insuranceData },
  { data: claimsData },
] = await Promise.all([
  supabase
    .from('clu_records')
    .select('id, reported', { count: 'exact' })
    .eq('crop_year', 2026),
  supabase
    .from('insurance_policies')
    .select('id', { count: 'exact' })
    .eq('policy_year', 2026)
    .eq('claim_alert', 'potential'),
  supabase
    .from('claims')
    .select('id', { count: 'exact' })
    .neq('stage', 'closed'),
])

const totalClus = cluData?.length ?? 0
const reportedClus = cluData?.filter(r => r.reported).length ?? 0
const claimAlerts = insuranceData?.length ?? 0
const openClaims = claimsData?.length ?? 0
```

**Card component (inline or extracted):**
```typescript
// Source: Existing dashboard card pattern from dashboard/page.tsx
// Summary cards sit above the MODULES grid:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
  <Link href="/app/fsa-578">
    <div className="bg-soil-surface border border-soil-border rounded-lg p-5 hover:border-soil-accent transition-colors cursor-pointer">
      <p className="text-xs font-mono text-soil-muted uppercase tracking-wider mb-1">FSA Reporting</p>
      <p className="text-2xl font-mono font-bold text-soil-text">
        {reportedClus}<span className="text-soil-muted text-base"> / {totalClus}</span>
      </p>
      <p className="text-xs font-mono text-soil-muted mt-1">CLUs reported</p>
    </div>
  </Link>
  <Link href="/app/insurance">
    <div className={`bg-soil-surface border rounded-lg p-5 transition-colors cursor-pointer ${claimAlerts > 0 ? 'border-yellow-700 hover:border-yellow-500' : 'border-soil-border hover:border-soil-accent'}`}>
      <p className="text-xs font-mono text-soil-muted uppercase tracking-wider mb-1">Insurance</p>
      <p className={`text-2xl font-mono font-bold ${claimAlerts > 0 ? 'text-yellow-400' : 'text-soil-text'}`}>
        {claimAlerts}
      </p>
      <p className="text-xs font-mono text-soil-muted mt-1">potential claim alerts</p>
    </div>
  </Link>
  <Link href="/app/claims">
    <div className="bg-soil-surface border border-soil-border rounded-lg p-5 hover:border-soil-accent transition-colors cursor-pointer">
      <p className="text-xs font-mono text-soil-muted uppercase tracking-wider mb-1">Claims</p>
      <p className="text-2xl font-mono font-bold text-soil-text">{openClaims}</p>
      <p className="text-xs font-mono text-soil-muted mt-1">open claims</p>
    </div>
  </Link>
</div>
```

### Pattern 5: Insurance Policy Filter via Query Params (supporting INT-01)

**What:** InsuranceWorkspace reads `useSearchParams()` on mount to highlight a pre-selected policy or open the create drawer.

**Implementation:** Add `useSearchParams` to `InsuranceWorkspace` (it's already a 'use client' component). Read `highlight` and `action` params on mount via `useEffect`.

```typescript
// Source: Next.js 14 App Router docs — useSearchParams
import { useSearchParams } from 'next/navigation'

// Inside InsuranceWorkspace:
const searchParams = useSearchParams()

useEffect(() => {
  const highlight = searchParams.get('highlight')
  const action = searchParams.get('action')
  const crop = searchParams.get('crop')
  const farm = searchParams.get('farm')

  if (highlight) {
    setSelectedPolicyId(highlight)
    // Scroll to policy row handled via ref or scrollIntoView
  }
  if (action === 'create') {
    setEditingPolicy(null)
    setDrawerMode('create')
    setDrawerOpen(true)
    // Pre-populate drawer fields from query params if provided
  }
}, []) // Run once on mount — searchParams is stable
```

**Note:** `useSearchParams()` in Next.js 14 requires the component to be wrapped in `<Suspense>` at the page level if it's in a client component. The existing `InsurancePage` server component wraps `InsuranceWorkspace` directly — add a `<Suspense>` wrapper in the page if needed.

### Anti-Patterns to Avoid

- **Cross-module data joins in a single complex API route:** Don't create a `/api/integration/summary` endpoint that joins all three tables. Keep each module's data queried separately with `Promise.all`. This matches existing patterns and prevents single-point failures.
- **Hard FK joins for CLU → Policy:** Don't assume `policy_number` is reliable enough to join on. Use `farm_number + crop` soft matching, which is what the legacy data supports.
- **Modal for prevented planting prompt:** Modals require focus trapping, overlay management, and z-index coordination. An inline banner in the expanded CluCard is simpler and consistent with the claim alert banner pattern in DeadlineAlertBanner.
- **Polling for dashboard cards:** Don't add `setInterval` or SWR polling to the dashboard. The server component re-runs on every navigation, which is sufficient for this use case.
- **Navigating away before claim creation completes:** The "Create Claim" flow in INT-02 and INT-03 must `await` the POST before calling `router.push()`. Don't use fire-and-forget here.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-module URL navigation | Custom history stack, custom state | `useRouter().push()` from `next/navigation` | Already works; query params carry context between modules |
| Prevented planting API update | New dedicated endpoint | Add `prevented_planting` to `EDITABLE_FIELDS` in existing PATCH route | Whitelist pattern already established, minimal change |
| Dashboard aggregate counts | New summary API route | Direct Supabase queries in existing server component | Server component already has authenticated Supabase client |
| CLU-to-Policy data join | New relational join table | Query `insurance_policies` by `farm_number + crop` client-side | Data already exists in both tables; soft match is accurate |
| Claim prefill from policy | New claim creation logic | Existing `POST /api/claims` with `policy_id` (CLM-07 already implemented) | Route exists, handles prefill, only needs UI trigger |

**Key insight:** Phase 33 is deliberately minimal — the data exists, the APIs exist, the components exist. The work is wiring them together with navigation and conditional UI, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: useSearchParams Requires Suspense Boundary
**What goes wrong:** Adding `useSearchParams()` to `InsuranceWorkspace` (a client component rendered directly by a server component) without a `<Suspense>` wrapper causes a build error or hydration mismatch in Next.js 14.
**Why it happens:** Next.js 14 requires `<Suspense>` around client components that call `useSearchParams()` to prevent blocking the server render.
**How to avoid:** Wrap `<InsuranceWorkspace>` in a `<Suspense fallback={null}>` in `InsurancePage`, or isolate the searchParams reading into a small child client component that is wrapped in Suspense.
**Warning signs:** Build error: "useSearchParams() should be wrapped in a suspense boundary"

### Pitfall 2: EDITABLE_FIELDS Whitelist Gap for prevented_planting
**What goes wrong:** The PATCH handler for `/api/fsa/clu-records/[id]/route.ts` silently ignores `prevented_planting` because it's not in `EDITABLE_FIELDS`. The UI sends the update, gets a 200 back, but the DB value doesn't change.
**Why it happens:** The whitelist pattern strips unknown keys without error. The fetch succeeds but the field is silently dropped.
**How to avoid:** Add `'prevented_planting'` and `'prevented_planting_acres'` to `EDITABLE_FIELDS` in the PATCH route as part of Plan 33-01.
**Warning signs:** Prevented planting checkbox saves without error but `record.prevented_planting` stays false on re-fetch.

### Pitfall 3: Stale Policy Data in CluCard Link Lookup
**What goes wrong:** CluCard fetches the linked policy via a client-side fetch when it expands. If the insurance_policies table has no row matching `farm_number + crop`, it correctly shows "no policy." But if the crop name casing differs (e.g., "Corn" vs "CORN" vs "corn"), the match fails silently.
**Why it happens:** String comparison in Supabase is case-sensitive by default. CLU records use title case from FSA data; insurance policies may use different case.
**How to avoid:** Use `ilike` (case-insensitive like) in the Supabase query for the crop match, or normalize both to lowercase before comparing. Add `?crop=...` to the API query using `.ilike('crop', crop)` on the server side.
**Warning signs:** CLU showing "No policy" even though a matching policy clearly exists in the Insurance module.

### Pitfall 4: Prevented Planting Prompt Re-Fires After Navigation
**What goes wrong:** User creates a claim from the prevented planting prompt, navigates to Claims, comes back to FSA. The CluCard is re-mounted and the prompt fires again because `prevented_planting` is still true on the record.
**Why it happens:** `ppPromptDismissed` is local component state — it resets on unmount/remount.
**How to avoid:** Track dismissed state by `record.id` in the parent workspace (CluWorkspace), not in CluCard. Pass `isPpPromptDismissed` as a prop and `onDismissPpPrompt(id)` callback. This persists across card expand/collapse cycles within a session.
**Warning signs:** User creates a claim, navigates back, sees the prompt again immediately.

### Pitfall 5: Dashboard Supabase Queries Fail Silently
**What goes wrong:** One of the three `Promise.all` summary queries fails (e.g., `claims` table not yet created in dev). The whole dashboard fails to render.
**Why it happens:** `Promise.all` rejects if any promise rejects. Unlike `Promise.allSettled`, a single query failure takes down all cards.
**How to avoid:** Use `Promise.allSettled` instead of `Promise.all` for the dashboard summary queries. Destructure with fallbacks — if a query settles as rejected or has an error, display "—" instead of a number.
**Warning signs:** Dashboard page throws an unhandled error or shows a 500 page when any module's table has an issue.

### Pitfall 6: Navigation Timing — Router.push Before State Flush
**What goes wrong:** In INT-02, calling `router.push('/app/claims')` immediately after a successful `POST /api/claims` sometimes navigates before the new claim appears in the Kanban (Next.js revalidation hasn't run yet).
**Why it happens:** The claims page is a server component that fetches from Supabase on render. If the push happens too fast, the fetch may catch the pre-insert snapshot.
**How to avoid:** The server component runs a fresh query on every navigation request in Next.js 14 (no static caching for authenticated routes). `router.push()` triggers a full navigation which re-runs the server component. This is fine — no `router.refresh()` call needed.
**Warning signs:** Navigating to Claims after creating a claim doesn't show the new claim. Check if caching headers are accidentally set on the claims table query.

---

## Code Examples

### Insurance Policy Lookup API Extension

```typescript
// Source: existing pattern in /api/insurance/policies/route.ts
// Add query param support for farm_number + crop filter (needed by INT-01):
// GET /api/insurance/policies?farm_number=H1234&crop=Corn&year=2026

const farmNumber = searchParams.get('farm_number')
const cropFilter = searchParams.get('crop')
const yearFilter = searchParams.get('year')

let query = supabase.from('insurance_policies').select('*')

if (yearFilter) query = query.eq('policy_year', parseInt(yearFilter, 10))
if (farmNumber) query = query.eq('farm_number', farmNumber)
if (cropFilter) query = query.ilike('crop', cropFilter)  // case-insensitive
```

### Dashboard Promise.allSettled Pattern

```typescript
// Source: v6.0 design decision documented in STATE.md and MEMORY.md
// "Cross-app fetch: Promise.allSettled, {next:{revalidate:0}}, AbortSignal.timeout(5000)"
// Adapted for server-component Supabase queries:

const results = await Promise.allSettled([
  supabase.from('clu_records').select('id, reported').eq('crop_year', 2026),
  supabase.from('insurance_policies').select('id').eq('policy_year', 2026).eq('claim_alert', 'potential'),
  supabase.from('claims').select('id').neq('stage', 'closed'),
])

const cluRows = results[0].status === 'fulfilled' ? (results[0].value.data ?? []) : []
const alertRows = results[1].status === 'fulfilled' ? (results[1].value.data ?? []) : null
const claimRows = results[2].status === 'fulfilled' ? (results[2].value.data ?? []) : null

const totalClus = cluRows.length
const reportedClus = cluRows.filter(r => r.reported).length
const claimAlerts = alertRows?.length ?? null  // null = query failed, show "—"
const openClaims = claimRows?.length ?? null
```

### Supabase Count Query (Efficient for Large Tables)

```typescript
// Source: Supabase docs — use count: 'exact' with head: true for pure counts
// More efficient than fetching all rows when only count is needed:
const { count: openClaimsCount, error } = await supabase
  .from('claims')
  .select('*', { count: 'exact', head: true })
  .neq('stage', 'closed')

// Returns count without fetching row data — preferred for dashboard summary
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side routing with `window.location.href` | `useRouter().push()` from `next/navigation` | Next.js 13+ App Router | Preserves React state, no full page reload |
| `getServerSideProps` for authenticated data | Server Components with `await createClient()` | Next.js 13+ App Router | Cleaner code, no prop drilling for auth |
| `Promise.all` for parallel queries | `Promise.allSettled` for fault-tolerant parallel queries | Established best practice | One query failure doesn't crash the whole page |
| Supabase `.select('*')` for counts | `.select('*', { count: 'exact', head: true })` | Supabase v2 | Returns only the count, not the row data |

---

## Open Questions

1. **Does `POST /api/claims` fully implement CLM-07 prefill from policy_id?**
   - What we know: The route.ts file exists and the POST handler has a comment referencing CLM-07. The route.ts was read partially and shows the POST handler stub.
   - What's unclear: Whether the CLM-07 implementation in Plan 32-02 (Claim Detail Drawer) was completed, since STATE.md shows Plan 32-01 complete but 32-02 is the next task.
   - Recommendation: Plan 33-01 should verify the `POST /api/claims` body accepts `policy_id` and returns a prefilled claim. If CLM-07 is not yet complete, Plan 33-01 should include the claim creation API as a task.

2. **Is `prevented_planting` a separate CluCard field or derived from `use = 'Prevented Planting'`?**
   - What we know: `InsurancePolicy` has `prevented_planting: boolean` and `prevented_planting_acres: number | null`. `CluRecord` has `use: string | null` (select dropdown with Non-Irrigated/Irrigated options per STATE.md Phase 28-01 decision). The `use` dropdown does NOT currently include "Prevented Planting."
   - What's unclear: Should Prevented Planting be a separate boolean field on `clu_records`, or should the `use` dropdown be extended to include it?
   - Recommendation: Add a separate `prevented_planting` boolean field approach — it is already in `InsurancePolicy`, keep the same pattern. The `use` dropdown stays for irrigation practice; `prevented_planting` is its own checkbox in the CluCard edit section. Add `'prevented_planting'` to `EDITABLE_FIELDS`.

3. **Does `clu_records` table have a `prevented_planting` column?**
   - What we know: `InsurancePolicy` has `prevented_planting: boolean`. `CluRecord` TypeScript type does NOT include `prevented_planting` in the interface (checked lib/fsa/calc.ts lines 7-37).
   - What's unclear: Whether the DB table has this column (could have been added in migration without updating the TS type), or if it needs to be added.
   - Recommendation: Plan 33-01 Wave 0 should include a DB check. If the column doesn't exist, add it via an ALTER TABLE migration script (small migration, no data risk). If it does exist, update the `CluRecord` TypeScript interface.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — read all relevant source files: `clu-card.tsx`, `clu-workspace.tsx`, `insurance-workspace.tsx`, `claims-workspace.tsx`, `claim-card.tsx`, `dashboard/page.tsx`, `modules.ts`, `lib/fsa/calc.ts`, `lib/claims/calc.ts`, `/api/fsa/clu-records/[id]/route.ts`, `/api/claims/route.ts`
- STATE.md project decisions — all architectural decisions from phases 27-32 confirmed by file inspection
- REQUIREMENTS.md — INT-01..04 requirements confirmed and matched to existing code

### Secondary (MEDIUM confidence)
- Next.js 14 App Router `useSearchParams` + Suspense requirement — well-documented behavior, confirmed by code structure observation
- Supabase `count: 'exact', head: true` pattern — standard Supabase v2 JS client pattern

### Tertiary (LOW confidence)
- Supabase case-sensitive string comparison behavior — assumed from general PostgreSQL behavior; verify with `.ilike()` as defensive measure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all libraries already in use and verified in package.json
- Architecture: HIGH — based on direct codebase reading of all relevant existing components and API routes
- Pitfalls: HIGH — based on actual code patterns observed (EDITABLE_FIELDS whitelist, existing query structure, component state patterns)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable stack — Next.js 14.x, Supabase, no fast-moving dependencies)
