---
phase: 12-customer-basis-management
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/(protected)/app/marketing/basis-quotes/page.tsx
  - src/app/(protected)/app/marketing/customers/page.tsx
  - src/app/(protected)/app/marketing/layout.tsx
  - src/app/api/cert-proxy/marketing/basis-quotes/route.ts
  - src/app/api/cert-proxy/marketing/basis-quotes/[id]/route.ts
  - src/app/api/cert-proxy/marketing/customers/route.ts
  - src/app/api/cert-proxy/marketing/customers/[id]/route.ts
  - src/components/marketing/basis-quote-form.tsx
  - src/components/marketing/basis-quote-list.tsx
  - src/components/marketing/customer-form.tsx
  - src/components/marketing/customer-list.tsx
  - src/components/marketing/marketing-nav.tsx
  - ../organic-cert/src/app/api/marketing/basis-quotes/route.ts
  - ../organic-cert/src/app/api/marketing/basis-quotes/[id]/route.ts
  - ../organic-cert/src/app/api/marketing/customers/route.ts
  - ../organic-cert/src/app/api/marketing/customers/[id]/route.ts
  - ../organic-cert/src/app/api/marketing/grain-variants/route.ts
  - src/components/marketing/basis-quote-form.test.tsx
  - src/components/marketing/basis-quote-list.test.tsx
  - src/components/marketing/customer-form.test.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 12 adds Customer and Basis Quote management: two organic-cert API route groups, four cert-proxy passthrough routes in glomalin-portal, three UI components, and three test files. The auth layering (middleware getUser → proxy getSession → organic-cert Bearer validation) is architecturally sound. RBAC permission checks on organic-cert routes are consistently applied.

Three blockers were found: an unscoped PATCH on `customers/[id]` allows cross-record write of `farmId`; the Authorization header can be silently overridden in `fetchCertServiceWithAuth`; and the `grain-variants` route is entirely unauthenticated with no documented threat model justification. Five warnings cover NaN date sort instability, validation gaps on basisValue, a dead `role` prop, dead local state, and a stub test masquerading as a passing assertion. Three info items cover code hygiene.

---

## Critical Issues

### CR-01: PATCH customers/[id] passes raw request body to Prisma — farmId and other schema fields are mass-assignable

**File:** `../organic-cert/src/app/api/marketing/customers/[id]/route.ts:41`

**Issue:** The PATCH handler reads the entire request body and hands it directly to `prisma.customer.update({ where: { id }, data: body })`. The `Customer` schema includes `farmId` (a foreign key to `Farm`) and `createdAt`. A caller who constructs a request with `{ "farmId": "<another-farm-id>" }` in the body can silently reassign a customer record to a different farm, breaking the per-farm data isolation that `farmId` scoping elsewhere depends on. The auth layer only checks role (`customers.write`) — it does not verify the caller's farm owns the record being edited, and there is no existence check that includes a `farmId` constraint.

Additionally, the existence pre-check (`findUnique({ where: { id } })`) does not scope by `farmId`, so an authenticated user from farm A can verify the existence of farm B's customer by ID and then PATCH it.

**Fix:**
```typescript
// 1. Scope existence check to caller's farm
const farmId =
  process.env.DEFAULT_FARM_ID ||
  (await prisma.farm.findFirst({ select: { id: true } }))?.id
if (!farmId) throw new AppError('Farm not found', 500)

const existing = await prisma.customer.findUnique({ where: { id, farmId } })
if (!existing) throw new NotFoundError('Customer')

// 2. Allowlist the fields that can be updated
const body = await request.json()
const updated = await prisma.customer.update({
  where: { id },
  data: {
    name:          body.name          ?? undefined,
    type:          body.type          ?? undefined,
    shortCode:     body.shortCode     ?? undefined,
    contactName:   body.contactName   ?? undefined,
    phone:         body.phone         ?? undefined,
    email:         body.email         ?? undefined,
    organicCertNum: body.organicCertNum ?? undefined,
    notes:         body.notes         ?? undefined,
  },
})
```

The same pattern applies to the `GET` and `DELETE` on `customers/[id]` — scope the `findUnique` to `{ id, farmId }` so record-level existence leaks across farms are not possible. (In the current single-farm deployment the risk is low, but the pattern should be correct before the schema diverges.)

---

### CR-02: Authorization header is overridable by callers of `fetchCertServiceWithAuth`

**File:** `src/app/api/mobile/_lib/proxy.ts:83-88`

**Issue:** In `fetchCertServiceWithAuth`, the spread order is:

```typescript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${accessToken}`,
  ...options?.headers,   // ← spread comes LAST
},
```

Any caller that passes `options.headers` containing an `Authorization` key silently replaces the validated Supabase token with an arbitrary value. The current cert-proxy callers only pass `Content-Type`, so the bug is not triggered today. But the function is exported and used across the codebase; a future call site that inadvertently passes authorization headers (e.g., forwarding the incoming request headers wholesale) would bypass the auth replacement without any compile-time error.

**Fix:** Move `...options?.headers` before the auth headers, then explicitly reassert the controlled headers at the end:

```typescript
headers: {
  'Content-Type': 'application/json',
  ...options?.headers,           // caller overrides allowed for everything else
  'Authorization': `Bearer ${accessToken}`, // always wins — must be last
},
```

---

### CR-03: `grain-variants` route has no authentication — exposes crop-year and variety data unauthenticated

**File:** `../organic-cert/src/app/api/marketing/grain-variants/route.ts:1-21`

**Issue:** The route comment says "no auth required (reference data)" and there is no call to `getMarketingAuthContext`. Every other marketing route in this service requires a valid Supabase Bearer token and an `owner` or `office` role. `GrainVariant` records include crop-year, commodity symbol, and variety names that constitute operational intelligence about farm production. The organic-cert service is an internal microservice accessible only on the private network (port 3004), but the route is reachable via the glomalin-portal cert-proxy if someone crafts a request to `/api/cert-proxy/marketing/grain-variants` — and cert-proxy passes a valid token for that endpoint because the RSC pages already call it.

More concretely: the glomalin-portal `BasisQuotesPage` fetches grain-variants by forwarding the user's token, but it goes through `fetchCertServiceWithAuth`, which works only because the token is validated by the caller (the RSC auth guard). If the organic-cert endpoint is ever exposed directly (dev proxy, staging, wrong nginx config), anyone can enumerate varieties without credentials.

**Fix:** Add the standard auth guard. Grain variants are non-sensitive enough that `basis_quotes.read` permission is the right gating permission:

```typescript
export const GET = apiHandler(async (request) => {
  const ctx = await getMarketingAuthContext(request)
  if (isMarketingAuthError(ctx)) return ctx
  if (!hasMarketingPermission(ctx.role, 'basis_quotes.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // ... existing query
})
```

---

## Warnings

### WR-01: Date sort produces unstable/incorrect order when `quoteDate` and `quotedAt` are both null

**File:** `src/components/marketing/basis-quote-list.tsx:125-129`

**Issue:** The sort comparator falls back to empty string `''` when both date fields are absent:

```typescript
const aDate = a.quoteDate ?? a.quotedAt ?? ''
const bDate = b.quoteDate ?? b.quotedAt ?? ''
return new Date(bDate).getTime() - new Date(aDate).getTime()
```

`new Date('').getTime()` returns `NaN`. `NaN - NaN` is `NaN`, and `NaN - <valid>` is `NaN`. JavaScript's `Array.prototype.sort` treats a comparator returning `NaN` as `0` (implementation-defined behavior, varies across V8 versions), producing an unstable and unpredictable sort order whenever any quote lacks a date. The API schema marks `quoteDate` non-nullable on `BasisQuote`, but the component type marks it `string | null | undefined` to accommodate test fixtures, meaning this path is exercised in tests.

**Fix:**
```typescript
return [...filtered].sort((a, b) => {
  const aStr = a.quoteDate ?? a.quotedAt
  const bStr = b.quoteDate ?? b.quotedAt
  if (!aStr && !bStr) return 0
  if (!aStr) return 1   // nulls sort to the end
  if (!bStr) return -1
  return new Date(bStr).getTime() - new Date(aStr).getTime()
})
```

---

### WR-02: `basisValue` client validation accepts whitespace, sends `NaN` to the API

**File:** `src/components/marketing/basis-quote-form.tsx:73-88` and `100`

**Issue:** The validation check `if (!form.basisValue)` treats any non-empty string as present. A user entering a space character passes validation (`!' '` is `false`), but `parseFloat(' ')` returns `NaN`, which is then sent in the POST body as the JSON number literal `null` (JSON.stringify serializes NaN as null). The organic-cert `POST /api/marketing/basis-quotes` route passes `body.basisValue` directly to `prisma.basisQuote.create` with no server-side numeric validation. Prisma will attempt to insert `null` into a `Float` (non-nullable) column, producing an unhandled constraint error that surfaces as a 500 rather than a user-readable validation message.

**Fix:**
```typescript
// In handleSubmit, replace the basisValue check:
const basisNum = parseFloat(form.basisValue)
if (isNaN(basisNum)) missing.push('basis')

// When building the POST body:
basisValue: basisNum,
```

Also add server-side validation in `organic-cert/src/app/api/marketing/basis-quotes/route.ts`:
```typescript
const basisValue = Number(body.basisValue)
if (!Number.isFinite(basisValue)) {
  throw new AppError('basisValue must be a finite number', 400)
}
```

---

### WR-03: `role` prop is accepted but never used to gate UI in `BasisQuoteListClient`

**File:** `src/components/marketing/basis-quote-list.tsx:49,112`

**Issue:** `BasisQuoteListClientProps` declares `role?: 'owner' | 'office'`, the prop is destructured, and it is never referenced in the component body. The "Log Quote" button is always visible and functional for both `owner` and `office` users. This contradicts the RBAC model: while `office` has `basis_quotes.write` permission (so server-side the POST is authorized), the delete capability (`basis_quotes.delete` is owner-only) has no corresponding UI gating at all. If a delete button is added in a follow-up, the `role` prop must be wired up or the pattern becomes a maintenance trap.

This is lower severity because there is no delete button in the current UI, but the orphaned prop is an active confuser.

**Fix:** Either remove the `role` prop until it is used, or explicitly gate the "Log Quote" button by role and add a comment that delete will require it:

```typescript
// In the header row:
{(role === 'owner' || role === 'office') && (
  <button onClick={() => setLogOpen(true)} ...>Log Quote</button>
)}
```

---

### WR-04: `localCustomers` state is declared and populated but never mutated — `void setLocalCustomers` silences a real design gap

**File:** `src/components/marketing/customer-list.tsx:58,69`

**Issue:**
```typescript
const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers)
// ...
void setLocalCustomers // suppress lint warning — used for optimistic updates after save
```

`setLocalCustomers` is explicitly suppressed with `void` to defeat the linter warning that it is unused. The comment claims it is "used for optimistic updates after save" — but `handleSaved` calls `router.refresh()` for a full server re-fetch, not an optimistic update. The state is effectively dead: `localCustomers` always equals the initial `customers` prop, and `setLocalCustomers` is never called. This inflates the component state, confuses future readers, and the `void` pattern is an active lint suppression hiding a design gap.

**Fix:** Remove the unused state and read from `customers` directly, or implement the intended optimistic update:

```typescript
// Remove:
const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers)
void setLocalCustomers

// Replace sorted with:
const sorted = [...customers].sort((a, b) => { ... })
```

---

### WR-05: `getSession()` used in cert-proxy routes without prior `getUser()` call

**File:** `src/app/api/cert-proxy/marketing/basis-quotes/route.ts:7,22`, `src/app/api/cert-proxy/marketing/basis-quotes/[id]/route.ts:7`, `src/app/api/cert-proxy/marketing/customers/route.ts:7,22`, `src/app/api/cert-proxy/marketing/customers/[id]/route.ts:7,23`

**Issue:** All five cert-proxy route handlers authenticate by calling `supabase.auth.getSession()` and checking `session?.access_token`. Supabase's own documentation explicitly warns that `getSession()` reads the session from the local cookie store without re-verifying the JWT against the auth server, and should not be used as the sole identity check in server-side code. The correct pattern (as implemented in `marketing-guard-rsc.ts`) is `getUser()` first, then `getSession()` only to obtain the token for forwarding.

In the current deployment this is partially mitigated by the middleware running `getUser()` on every non-public request before the route handler executes, meaning a revoked token would be caught at middleware. However, the route handlers themselves do not encode this dependency — if `PUBLIC_PREFIXES` is updated to include `/api/cert-proxy` in a maintenance change, the mitigation disappears silently.

**Fix:** Replace the `getSession()`-only pattern with the validated pattern from `marketing-guard-rsc.ts`:

```typescript
// In each cert-proxy route handler:
const supabase = await createClient()
const { data: { user }, error: userError } = await supabase.auth.getUser()
if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const { data: { session } } = await supabase.auth.getSession()
if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

---

## Info

### IN-01: Test for P2002 "Duplicate" error mapping is a non-asserting stub

**File:** `src/components/marketing/customer-form.test.tsx:50-53`

**Issue:**
```typescript
it('maps Duplicate error response to A customer with this name already exists', async () => {
  // Component should render the API error message from a Duplicate response
  expect(true).toBeDefined()
})
```

This test always passes regardless of component behavior. It covers the critical user-facing error mapping where `msg.includes('Duplicate')` triggers the human-readable duplicate message in `customer-form.tsx:119`. If that branch is broken or removed, the suite stays green. The test is labeled a "stub" in its comment history but was not removed before shipping.

**Fix:** Implement the test with a mocked `fetch`:
```typescript
it('maps Duplicate error response to human-readable message', async () => {
  vi.stubGlobal('fetch', async () => ({
    ok: false,
    json: async () => ({ error: 'Duplicate entry on farmId, name' }),
  }))
  render(<CustomerForm customer={null} onSuccess={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Acme' } })
  fireEvent.change(screen.getByRole('combobox', { name: /type/i }), { target: { value: 'ELEVATOR' } })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await screen.findByText(/customer with this name already exists/i)
})
```

---

### IN-02: Test fixtures in `basis-quote-list.test.tsx` use undocumented confidence values (`HIGH`, `MEDIUM`) not in the component's display maps

**File:** `src/components/marketing/basis-quote-list.test.tsx:31,40`

**Issue:** The test fixtures set `confidence: 'HIGH'` and `confidence: 'MEDIUM'`, but `CONFIDENCE_LABELS` and `CONFIDENCE_CLS` in `basis-quote-list.tsx` only define `CONFIDENT`, `INFERRED`, `MANUAL`, and `UNVERIFIED`. The component handles unknowns gracefully (`?? tier` for label, `?? CONFIDENCE_CLS['UNVERIFIED']` for style), but the test fixture values do not exercise any of the real display paths. The test "renders basis value negative in danger color" does pass because `basis: -18` is correctly displayed, but the confidence cell for `HIGH` silently renders with the `UNVERIFIED` style, making the tests less meaningful as a regression check.

**Fix:** Update test fixtures to use canonical values (`CONFIDENT`, `INFERRED`, etc.) that match the production enum.

---

### IN-03: Stub nav items render as `<Link>` elements with `pointer-events-none` but remain keyboard-focusable via `Tab` in some browsers

**File:** `src/components/marketing/marketing-nav.tsx:34-36`

**Issue:**
```tsx
item.stub && 'opacity-50 pointer-events-none cursor-not-allowed',
```
`tabIndex={-1}` is only set for stub items (`item.stub ? -1 : undefined`), which is correct. However, `aria-disabled={true}` is set without also preventing the default link navigation — some screen readers will still activate an `aria-disabled` link when the user presses Enter. The `pointer-events-none` class only blocks mouse events; keyboard activation bypasses it. For stub nav items, this means keyboard users who navigate to a stub link and press Enter will be routed to `/app/marketing/contracts` (which presumably 404s or renders an empty shell).

**Fix:** Render stub items as `<span>` or add an `onClick` that calls `e.preventDefault()`:
```tsx
{item.stub ? (
  <span
    key={item.href}
    className={cn('px-3 py-2 rounded text-sm font-mono opacity-50 cursor-not-allowed text-glomalin-muted')}
    aria-disabled="true"
    role="link"
  >
    {item.label}
  </span>
) : (
  <Link ... >{item.label}</Link>
)}
```

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
