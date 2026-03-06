# Phase 34: Insurance & Claims UI Wiring — Research

**Researched:** 2026-03-06
**Domain:** Next.js 14 App Router UI wiring — React client state, client-side fetch, cross-module navigation
**Confidence:** HIGH

---

## Summary

Phase 34 is a pure UI wiring phase: all three backend APIs it depends on already exist and are verified working. The work is entirely in the React client layer — no new API routes, no schema changes, no new packages. The three requirements are:

- **INS-05**: APH yield auto-fetches from CLU records when a policy is opened in PolicyDrawer. The `GET /api/insurance/aph-lookup` endpoint already exists and returns `{ avgAph, count, totalRecords }`.
- **INS-06**: "Sync Yield" button on a policy row calls `POST /api/insurance/yield-sync` with `{ policyId }` and updates the policies list state in InsuranceWorkspace. The endpoint already exists and writes to Supabase.
- **CLM-07**: "File Claim" button on a policy row navigates the user to the Claims page with the policy pre-filled in a claim creation form, using the existing `POST /api/claims` route that already accepts `{ policy_id, date_of_loss, description }`.

The implementation surface is confined to two existing client components: `insurance-workspace.tsx` (for INS-06 Sync Yield button) and `policy-drawer.tsx` (for INS-05 APH auto-populate). CLM-07 adds a "File Claim" entry point in the insurance module that navigates to `/app/claims` — the key design question is whether the claim form is a modal in the insurance workspace or a navigation to the claims page. Given that the ClaimDrawer (Phase 32 Plan 02) does not yet exist (32-02 is still pending execution), CLM-07 cannot integrate deeply into that drawer. Instead, the minimal correct implementation is an inline "File Claim" modal/form within InsuranceWorkspace itself that posts to `POST /api/claims` and then navigates to the claims page.

**Primary recommendation:** Wire all three features against existing APIs with client-side fetch. No new packages needed. APH auto-populate belongs in `policy-drawer.tsx` `useEffect`. Sync Yield button belongs in the policy table row actions column. File Claim belongs as an inline mini-form (modal) in InsuranceWorkspace, triggered by a button in the policy table row.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INS-05 | User can see APH yield auto-populated from CLU records | `GET /api/insurance/aph-lookup?crop=X&farmName=Y` returns `{avgAph, count, totalRecords}`. PolicyDrawer already opens with a `policy` prop. Add `useEffect` on drawer open to fetch and display. |
| INS-06 | User can sync actual yield from grain-tickets for post-harvest comparison | `POST /api/insurance/yield-sync` with `{policyId}` exists, returns `{matched, score, match, policy}` or `{matched: false}`. InsuranceWorkspace manages `policies` state — update the matching policy on success. Add "Sync Yield" button to each policy row in the table. |
| CLM-07 | User can create a claim pre-filled from an insurance policy | `POST /api/claims` with `{policy_id, date_of_loss, description}` exists and carries over crop/coverage/guarantee. Add "File Claim" button to policy row. Trigger a modal to capture `date_of_loss` and optional `description`, then POST and navigate to `/app/claims`. |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` + `useEffect` | React 18 | APH fetch on drawer open, loading state | Native React, no dep needed |
| `fetch` (native) | Browser built-in | Call existing API endpoints | All existing patterns use native fetch |
| Next.js `useRouter` | next 14.2.35 | Navigate to `/app/claims` after claim creation | App Router navigation hook |
| Tailwind CSS | ^3.4.1 | Match soil palette styling (already all components) | Project standard |

### No New Packages Required

All packages needed for Phase 34 are already in `package.json`:
- `react-dropzone@^15.0.0` — already installed (used in Phase 32)
- `@dnd-kit/*` — already installed (used in Phase 32)
- `@supabase/supabase-js` + `@supabase/ssr` — already installed

**Installation:** None required.

---

## Architecture Patterns

### Existing Component Structure (extends, does not restructure)

```
glomalin-portal/src/
├── components/insurance/
│   ├── insurance-workspace.tsx   ← ADD: Sync Yield button + File Claim button + modal state
│   └── policy-drawer.tsx         ← ADD: APH auto-fetch useEffect + display section
├── app/api/insurance/
│   ├── aph-lookup/route.ts       ← EXISTS: GET ?crop=&farmName= → {avgAph,count,totalRecords}
│   └── yield-sync/route.ts       ← EXISTS: POST {policyId} → {matched,score,match,policy}
└── app/api/claims/route.ts       ← EXISTS: POST {policy_id,date_of_loss,description} → {claim}
```

### Pattern 1: APH Auto-Populate in PolicyDrawer (INS-05)

**What:** When PolicyDrawer opens with a policy, auto-fetch APH from CLU records. Display result as a read-only info row in the "Acres & Yields" section.

**When to use:** `useEffect` triggered by `[open, policy]` — matches the existing sync pattern in PolicyDrawer for populating form state.

**Key implementation detail:** The drawer already has a `useEffect` that fires on `[open, policy, isEdit]` to populate form state. Add a second `useEffect` for APH fetch on the same trigger, with `open && policy` guard.

**APH display:** Show below or adjacent to the "Guarantee (bu/ac)" field as a read-only hint — "Computed APH from CLU: 187.3 bu/ac (avg of 4 records)". The user can choose to use it or not — it is informational, not auto-filled into the guarantee field (which is an editable user input).

**Three possible states from the API response:**
- `totalRecords === 0`: "No matching CLU records found for this farm/crop"
- `totalRecords > 0 && count === 0`: "CLU records found but no APH values entered"
- `count > 0`: Show `avgAph` value with record count context

**Example:**
```typescript
// Source: existing aph-lookup/route.ts response shape
const [aphData, setAphData] = useState<{
  avgAph: number
  count: number
  totalRecords: number
} | null>(null)
const [aphLoading, setAphLoading] = useState(false)

useEffect(() => {
  if (!open || !policy?.crop) {
    setAphData(null)
    return
  }
  setAphLoading(true)
  const params = new URLSearchParams({ crop: policy.crop })
  if (policy.farm_name) params.set('farmName', policy.farm_name)
  fetch(`/api/insurance/aph-lookup?${params}`)
    .then((r) => r.json())
    .then((data) => setAphData(data))
    .catch(() => setAphData(null))
    .finally(() => setAphLoading(false))
}, [open, policy?.crop, policy?.farm_name])
```

### Pattern 2: Sync Yield Button in Insurance Table (INS-06)

**What:** Add a "Sync Yield" button to each policy row's actions column (alongside the existing Edit and Delete buttons).

**Flow:** Button click → `POST /api/insurance/yield-sync` → if matched, update that policy in `policies` state in InsuranceWorkspace → show inline feedback.

**State management:** InsuranceWorkspace already manages `policies` state. Add per-row `syncingId` state (string | null) to track which row is syncing. This avoids a full-list loading state.

**Response handling:**
- `matched: true` → update policy in list: `setPolicies(prev => prev.map(p => p.id === id ? updatedPolicy : p))`
- `matched: false` → show inline message "No grain ticket match found (score: {score})" in a toast or inline feedback area
- HTTP 200 with `error` field (grain tickets offline) → show "Grain ticket service unavailable" message

**Implementation surface:** `handleSyncYield(policyId: string)` in InsuranceWorkspace, passed as prop or called via direct button `onClick`.

**Example:**
```typescript
// Source: yield-sync/route.ts response shape
async function handleSyncYield(policyId: string) {
  setSyncingId(policyId)
  try {
    const res = await fetch('/api/insurance/yield-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId }),
    })
    const data = await res.json()
    if (data.matched && data.policy) {
      setPolicies((prev) =>
        prev.map((p) => (p.id === policyId ? data.policy : p))
      )
    } else {
      // Show feedback: data.error or "No match found"
    }
  } catch {
    // Network error
  } finally {
    setSyncingId(null)
  }
}
```

### Pattern 3: File Claim Button and Modal (CLM-07)

**What:** Add a "File Claim" button to each policy row's actions. Clicking it opens a modal/inline form to capture `date_of_loss` (required) and `description` (optional), then POSTs to `POST /api/claims` and navigates to `/app/claims`.

**Critical context — Phase 32 Plan 02 not yet executed:** The `ClaimDrawer` component does not yet exist (32-02 is pending). Phase 34 should NOT depend on ClaimDrawer. The "File Claim" flow is: fill mini-form → POST → navigate to `/app/claims` page (where the newly created claim will appear on the Kanban board). This is the cleanest implementation that doesn't create a cross-phase dependency.

**Modal design:** A simple inline overlay modal (not the full ClaimDrawer) — just two fields: `date_of_loss` (date input, required) and `description` (textarea, optional). Submit button creates the claim and navigates. This is intentionally minimal — the claim detail can be managed from the Claims page.

**Navigation:** Use `useRouter` from `next/navigation` (App Router). After successful POST, call `router.push('/app/claims')`.

**Policy context shown:** Display the policy context at the top of the modal — farm name, crop, coverage type, so user knows which policy they're filing from.

**Example:**
```typescript
// Source: POST /api/claims route.ts — expects { policy_id, date_of_loss, description }
const [filingPolicy, setFilingPolicy] = useState<InsurancePolicy | null>(null)
const router = useRouter()

async function handleFileClaim(dateOfLoss: string, description: string) {
  if (!filingPolicy) return
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      policy_id: filingPolicy.id,
      date_of_loss: dateOfLoss,
      description: description || null,
    }),
  })
  if (res.ok) {
    setFilingPolicy(null)
    router.push('/app/claims')
  }
}
```

### Anti-Patterns to Avoid

- **Fetching APH on every render:** Use `[open, policy?.crop, policy?.farm_name]` dependencies precisely — do not fetch if the drawer is closed.
- **Passing APH data through the drawer form submit:** APH is read-only display data, not a form field. Never include `avgAph` in the form state or the POST body to `PATCH /api/insurance/policies/[id]`.
- **Using Server Actions for the File Claim form:** All existing patterns in this project use `fetch()` directly. Server Actions are not used for any form submissions — consistent with the signed URL upload pattern and policy CRUD.
- **Triggering router.push before await res.json():** Navigate after confirming `res.ok` — not before, or on a fire-and-forget.
- **Blocking Sync Yield entire table during one policy sync:** Use per-row `syncingId` state, not a global boolean.
- **Importing useRouter from wrong package:** Must use `from 'next/navigation'` (App Router), not `from 'next/router'` (Pages Router).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| APH fuzzy matching | Custom similarity score in UI | Existing `normName()` + substring matching already in `aph-lookup/route.ts` | Logic already correct and tested; don't duplicate |
| Grain ticket matching | Manual farm/crop comparison in client | `POST /api/insurance/yield-sync` server-side | Server has access to grain-tickets port 3000; client cannot call cross-origin port directly |
| Policy pre-fill for claims | Re-derive coverage level from policy | `POST /api/claims` already reads policy from DB and carries over all fields | The API does the join server-side; the client only needs `policy_id` |

**Key insight:** All three features are "button → POST → update state" — the hard work (matching, computation, data derivation) is already done in the API layer. Phase 34 is purely connecting UI events to existing endpoints.

---

## Common Pitfalls

### Pitfall 1: APH Display Confusion — "CLUs found but no APH"

**What goes wrong:** When `totalRecords > 0` but `count === 0`, the API returns `avgAph: 0`. If the UI just checks `avgAph > 0`, it will show "No matching records" instead of the more accurate "CLU records found but no APH values entered."

**Why it happens:** All 444 CLU records currently have `aph=0` (known data state from Phase 29-01 decision). This is the expected state — APH values need manual entry.

**How to avoid:** Check `totalRecords` and `count` separately:
```typescript
if (aphData.count > 0) {
  // Show: "Computed APH: {avgAph} bu/ac (avg of {count} records)"
} else if (aphData.totalRecords > 0) {
  // Show: "CLU records found but no APH values entered yet"
} else {
  // Show: "No matching CLU records found for this farm/crop"
}
```

**Warning signs:** APH section always shows "No matching records" even for crops with CLU records.

### Pitfall 2: Sync Yield Grain Tickets Offline

**What goes wrong:** `POST /api/insurance/yield-sync` returns HTTP 200 (not 5xx) when grain-tickets is offline — returns `{ error: 'Grain ticket service unavailable...', matched: false, policy: null }`.

**Why it happens:** Intentional design from Phase 29-02 decision: "yield-sync returns HTTP 200 not 502 when grain-tickets offline — offline is expected during dev."

**How to avoid:** Check for `data.error` in the response body when `!data.matched`. Don't assume a 200 response means success.

**Warning signs:** Sync Yield button appears to succeed (no UI error) but actual yield doesn't update.

### Pitfall 3: Next.js 15+ Dynamic Route Params Pattern

**What goes wrong:** If any new route handlers are added, using `params.id` synchronously (Next.js 14 style) instead of `await params` (Next.js 15 breaking change).

**Why it happens:** The existing codebase uses `{ params }: { params: Promise<{ id: string }> }` + `await params` (established in Phase 29-02 decision). Phase 34 adds no new routes, but the planner should note this if any new routes are needed.

**How to avoid:** Phase 34 adds no new API routes — this pitfall only applies if that scope changes.

### Pitfall 4: File Claim Without date_of_loss Validation

**What goes wrong:** `POST /api/claims` returns 400 if `date_of_loss` is missing or not a string. The client form must require this field.

**Why it happens:** The API validates strictly — `if (typeof date_of_loss !== 'string' || !date_of_loss)` returns 400.

**How to avoid:** `date` input with `required` attribute. Disable submit button until the field is non-empty. Show an inline error for 400 responses.

### Pitfall 5: InsuranceWorkspace Policy State Mismatch After Sync

**What goes wrong:** After Sync Yield succeeds, the returned `data.policy` from the API has `actual_synced_from_grain: true` and a recomputed `claim_alert`. If the UI only updates `actual` in the existing policy object instead of replacing the entire row with the server-returned object, these derived fields get out of sync.

**Why it happens:** The PATCH in `yield-sync/route.ts` returns the full updated policy via `.select().single()`. Always replace the full policy row.

**How to avoid:** `setPolicies(prev => prev.map(p => p.id === policyId ? data.policy : p))` — full replacement, not merge.

---

## Code Examples

### APH Info Display in PolicyDrawer

```typescript
// Source: pattern from aph-lookup/route.ts response + InsurancePolicy type
{/* After the "Actual (bu/ac)" field, before the "Other" section */}
{open && policy && (
  <div className="mb-3 rounded border border-soil-border bg-soil-bg px-3 py-2 text-xs font-mono">
    <p className="text-soil-accent font-semibold mb-1">APH from CLU Records</p>
    {aphLoading ? (
      <p className="text-soil-muted">Loading...</p>
    ) : aphData ? (
      aphData.count > 0 ? (
        <p className="text-soil-text">
          {aphData.avgAph} bu/ac
          <span className="text-soil-muted ml-1">(avg of {aphData.count} records)</span>
        </p>
      ) : aphData.totalRecords > 0 ? (
        <p className="text-soil-muted">CLU records found — no APH values entered yet</p>
      ) : (
        <p className="text-soil-muted">No matching CLU records found</p>
      )
    ) : null}
  </div>
)}
```

### Sync Yield Button in Policy Table Row

```typescript
// Source: InsuranceWorkspace table row — extends existing Edit | Delete actions
<div className="flex items-center justify-center gap-2">
  <button
    onClick={() => openEditDrawer(policy)}
    className="text-xs text-soil-muted hover:text-soil-accent transition-colors font-mono"
  >
    Edit
  </button>
  <span className="text-soil-border">|</span>
  <button
    onClick={() => handleSyncYield(policy.id)}
    disabled={syncingId === policy.id}
    className="text-xs text-soil-muted hover:text-soil-green transition-colors font-mono disabled:opacity-50"
  >
    {syncingId === policy.id ? 'Syncing...' : 'Sync Yield'}
  </button>
  <span className="text-soil-border">|</span>
  <button
    onClick={() => setFilingPolicy(policy)}
    className="text-xs text-soil-muted hover:text-soil-accent transition-colors font-mono"
  >
    File Claim
  </button>
  <span className="text-soil-border">|</span>
  <button
    onClick={() => handleDelete(policy.id)}
    className="text-xs text-soil-muted hover:text-red-400 transition-colors font-mono"
  >
    Delete
  </button>
</div>
```

### File Claim Modal (inline in InsuranceWorkspace)

```typescript
// Source: POST /api/claims route signature — { policy_id, date_of_loss, description }
// Rendered as sibling to PolicyDrawer at bottom of InsuranceWorkspace return
{filingPolicy && (
  <>
    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setFilingPolicy(null)} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-soil-surface border border-soil-border rounded-lg p-6 font-mono">
        <h2 className="text-soil-accent font-semibold text-base mb-1">File a Claim</h2>
        <p className="text-xs text-soil-muted mb-4">
          {filingPolicy.farm_name ?? '(no farm)'} — {filingPolicy.crop ?? 'no crop'} — {filingPolicy.plan_type ?? '—'}
        </p>
        {/* date_of_loss input (required) */}
        {/* description textarea (optional) */}
        {/* Submit + Cancel buttons */}
      </div>
    </div>
  </>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| APH entered manually in PolicyDrawer | APH auto-fetched from CLU records on drawer open | Phase 34 (this phase) | Eliminates manual lookup and copy-paste |
| Actual yield entered manually | "Sync Yield" button pulls from grain-tickets automatically | Phase 34 (this phase) | Post-harvest actual yield one-click update |
| Claim creation only from Claims page | "File Claim" button on any policy row | Phase 34 (this phase) | Closes the insurance → claims navigation loop |

**Backend APIs were built in advance (Phases 29 + 31) but not wired into the UI — Phase 34 closes that gap.**

---

## Open Questions

1. **Where exactly should APH display in PolicyDrawer?**
   - What we know: The "Acres & Yields" section has planted_acres, guarantee, actual, premium_per_acre. APH is related to guarantee (APH × coverage_level = effective guarantee).
   - What's unclear: Whether APH should appear before guarantee (as a reference to help fill it in) or after actual (as a comparative data point).
   - Recommendation: Place APH as a read-only info box between the "Actual (bu/ac)" field and the "Other" section — it's additional context, not a primary input field.

2. **What feedback should Sync Yield show when grain-tickets is offline?**
   - What we know: The API returns `{ error: 'Grain ticket service unavailable...', matched: false }` with HTTP 200.
   - What's unclear: Whether to show a toast, inline message, or nothing.
   - Recommendation: Show an inline message in the sync feedback area within the policy row (similar to a console warning in styled text). Do not use a blocking alert.

3. **Does Phase 32 Plan 02 need to complete before Phase 34 can ship?**
   - What we know: Phase 32 Plan 02 (ClaimDrawer, TimelineFeed, DocumentUpload) has NOT been executed — no summary exists and the files don't exist. CLM-07 (File Claim button) only needs to create a claim and navigate to the claims page — it does NOT need ClaimDrawer to exist.
   - What's unclear: Whether the planner wants Phase 34 to wait for 32-02, or whether the "navigate to claims page" approach is sufficient for CLM-07.
   - Recommendation: Treat Phase 34 as independent of Phase 32 Plan 02. The "File Claim" button navigates to `/app/claims` after creation — the user finds the new claim in the Kanban board. CLM-07's success criterion says "be taken to claim creation pre-filled with policy data" which is satisfied by the server-side pre-fill in `POST /api/claims` + navigation.

---

## Sources

### Primary (HIGH confidence)

Codebase investigation — all findings are from direct code inspection:

- `/glomalin-portal/src/app/api/insurance/aph-lookup/route.ts` — APH endpoint response shape `{avgAph, count, totalRecords, farmName, crop}`
- `/glomalin-portal/src/app/api/insurance/yield-sync/route.ts` — Sync Yield endpoint, HTTP 200 on offline, `{matched, score, match, policy}` response
- `/glomalin-portal/src/app/api/claims/route.ts` — POST /api/claims, requires `{policy_id, date_of_loss}`, carries over `{crop, plan_type, coverage_level, guarantee}`
- `/glomalin-portal/src/components/insurance/policy-drawer.tsx` — Existing PolicyDrawer `useEffect` pattern and form structure
- `/glomalin-portal/src/components/insurance/insurance-workspace.tsx` — Existing policy list state, CRUD handlers, `handleCreate`/`handleUpdate`/`handleDelete` patterns
- `/glomalin-portal/src/lib/fsa/calc.ts` — `InsurancePolicy` type definition including `actual_synced_from_grain`, `claim_alert`, `aph_computed`, `aph_clu_count`
- `/glomalin-portal/src/lib/insurance/calc.ts` — `computeAphFromClus` return shape `{avgAph, count, totalRecords}`, `normName`, `findBestGrainMatch`
- `.planning/STATE.md` — Accumulated decisions including Phase 29-02 decisions about yield-sync HTTP 200 offline behavior and PATCH policy pattern

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` — Phase 34 success criteria, dependency chain (Phases 30 + 31)
- `.planning/phases/32-claims-lifecycle-ui/32-01-SUMMARY.md` — Confirmed Phase 32 Plan 01 complete; Plan 02 NOT yet executed (no ClaimDrawer exists)
- `.planning/REQUIREMENTS.md` — INS-05, INS-06, CLM-07 requirement text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns from existing codebase
- Architecture: HIGH — all three APIs inspected directly; response shapes verified from source
- Pitfalls: HIGH — derived from STATE.md accumulated decisions and direct code inspection of API response behavior

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable — no external dependencies; codebase-internal research)
