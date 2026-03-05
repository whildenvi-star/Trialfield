# Phase 30: Insurance Decision Tool UI - Research

**Researched:** 2026-03-05
**Domain:** Next.js 14 App Router interactive UI — slide-out drawer, CSS grid heat-map matrix, client-side slider simulator, @react-pdf/renderer PDF
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None — user gave full discretion on all UI/UX decisions. All sections below are Claude's discretion.

### Claude's Discretion

- All areas — user gave full discretion on all UI/UX decisions
- Policy editor layout, navigation, and list format
- Coverage matrix orientation, coloring, scope, and interactivity
- Payout simulator visualization, sliders, scenarios, and disclaimer
- PDF content, style, trigger, and branding
- Should follow existing glomalin-portal patterns (dark soil aesthetic, Tailwind components, no shadcn/ui)
- Reference existing codebase patterns for consistency

**Specific notes from CONTEXT.md:**
- Policy editor: slide-out drawer for create/edit — field organization at discretion
- Policy list: card grid vs compact table based on expected count (3 policies) and portal patterns
- Navigation: tabs vs policy-driven flow — Claude decides
- Delete confirmation: simple confirm vs type-to-confirm — Claude decides caution level
- Coverage matrix: row/column orientation, heat-map coloring metric, single vs all policies, click behavior
- Payout simulator: numbers-only vs numbers+chart, slider set, single vs save-and-compare, disclaimer placement
- Insurance PDF: content sections, audience/tone, visual style, trigger, branding
- Must meet <100ms recalculation for payout simulator

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INS-02 | User can create, edit, and delete insurance policies with slide-out editor | POST /api/insurance/policies (new), DELETE /api/insurance/policies/[id] (new), PATCH already exists from Phase 29. Drawer pattern from CluCard inline-expand → full-panel slide-out |
| INS-03 | User can see a coverage level comparison matrix across RP, RP-HPE, and YP at 50-85% | CSS grid (not SVG — project decision). computeInsurancePolicy() in lib/fsa/calc.ts is the calc engine. Coverage levels 50,55,60,65,70,75,80,85 × 3 plan types = 24 cells. heat-map coloring via inline CSS. plan_type is a new field on insurance_policies (not in source data) |
| INS-04 | User can simulate payout scenarios with interactive yield and price sliders | computeInsurancePolicy() already handles this — pure function, no I/O. Client-side only. HTML input[type=range] + React state. Sub-100ms guaranteed since it's a handful of arithmetic ops |
| INS-08 | User can generate an insurance summary report | @react-pdf/renderer already installed (^4.3.2). Pattern established: acreage-pdf.tsx + acreage-pdf-button.tsx loaded via dynamic({ ssr: false }). New: insurance-pdf.tsx + insurance-pdf-button.tsx following identical isolation pattern |

</phase_requirements>

---

## Summary

Phase 30 is a pure UI phase. The data foundation (insurance_policies table, insurance_pricing table, computeInsurancePolicy() engine, PATCH endpoint, APH lookup, yield sync) was all built in Phase 29. Phase 30 adds the interactive shell around that foundation: policy CRUD editor, coverage matrix, payout simulator, and PDF export.

The codebase has no shadcn/ui — all components are hand-built Tailwind with the dark soil design tokens (`soil-bg`, `soil-surface`, `soil-border`, `soil-accent`, `soil-text`, `soil-muted`, `soil-green`). The Phase 28 FSA module established all the UI patterns needed: server-rendered page with client workspace component, drawer-style expand-in-place editing (CluCard), confirm dialogs (ConfirmDialog), dynamic() for PDF isolation, and sticky action bars. Phase 30 follows these patterns exactly, scaled to the insurance domain.

The key technical decisions are: (1) The coverage matrix needs `plan_type` added to the insurance_policies table — it does not exist in the migrated source data. All 3 existing policies have empty plan_type. (2) The payout simulator uses `computeInsurancePolicy()` from `lib/fsa/calc.ts` directly — it returns indemnity, effectiveGuarantee, projectedRevenue, etc. No new calc functions needed. (3) The slide-out drawer is a fixed-position right panel (translate-x pattern) not a modal — keeps policy list visible behind it. (4) POST and DELETE routes on `/api/insurance/policies` need to be added (only GET exists currently). (5) PDF isolation pattern is identical to Phase 28: two files only touch @react-pdf/renderer, both loaded via `dynamic({ ssr: false })`.

**Primary recommendation:** Build InsuranceWorkspace as the client orchestrator (mirror of CluWorkspace), with PolicyDrawer as the slide-out editor, CoverageMatrix as a standalone client component, PayoutSimulator as a standalone client component, and InsurancePdfButton loaded via dynamic(). All components live in `src/components/insurance/`. The insurance page.tsx becomes a thin server component that fetches policies and pricing, then passes them to InsuranceWorkspace.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.2.35 (installed) | Server component page, API routes | Already installed, entire project uses it |
| React | 18 (installed) | Client components, useState/useEffect/useMemo | Already installed |
| Tailwind CSS | ^3.4.1 (installed) | All styling using soil design tokens | Already installed, all existing components use it |
| @react-pdf/renderer | ^4.3.2 (installed) | PDF generation | Already installed, used in Phase 28 acreage PDF |
| TypeScript | ^5 (installed) | Types | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/dynamic | built-in | SSR guard for @react-pdf/renderer | Required — same pattern as AcreagePdfButton |
| HTML input[type=range] | native | Payout simulator sliders | No library needed — native range inputs with React state for <100ms perf |
| CSS grid | native | Coverage matrix 24-cell layout | Project decision — not SVG, not recharts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native range inputs | rc-slider, @radix-ui/react-slider | Overkill — native inputs are sufficient for 2-3 sliders; no dependency |
| CSS grid heat-map | recharts HeatMap, @nivo/heatmap | Project decision locked to CSS grid; chart libraries not installed |
| Hand-built drawer | @radix-ui/react-dialog, headlessui | No shadcn/ui installed; hand-built Tailwind drawer is consistent with existing components |
| Hand-built select/input | shadcn/ui Form | shadcn/ui not installed; not worth adding for 3 policies |

**Installation:** No new packages needed — all libraries already installed.

```bash
# Nothing to install — all dependencies present
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(protected)/app/insurance/
│   └── page.tsx              # Server component: fetch policies + pricing, render InsuranceWorkspace
├── app/api/insurance/
│   ├── policies/
│   │   ├── route.ts          # Add POST handler (GET already exists)
│   │   └── [id]/
│   │       └── route.ts      # Add DELETE handler (GET + PATCH already exists)
│   ├── aph-lookup/           # Already exists (Phase 29)
│   └── yield-sync/           # Already exists (Phase 29)
└── components/insurance/
    ├── insurance-workspace.tsx    # Client orchestrator — owns state, handles CRUD
    ├── policy-card.tsx            # Single policy summary card (list view)
    ├── policy-drawer.tsx          # Slide-out editor (create + edit)
    ├── coverage-matrix.tsx        # 8×3 CSS grid, heat-map coloring
    ├── payout-simulator.tsx       # Slider UI + instant calc display
    ├── insurance-pdf.tsx          # PDF document (NO 'use client', loaded via dynamic)
    └── insurance-pdf-button.tsx   # PDFDownloadLink wrapper (NO 'use client', loaded via dynamic)
```

### Pattern 1: Server Page → Client Workspace (Established Pattern)

**What:** Page.tsx is a server component that fetches all data and passes it to a `'use client'` workspace component as initial props. The workspace owns all interactive state.

**When to use:** Always — this is the established portal pattern (identical to InsurancePage + would-be InsuranceWorkspace, matching FSA CluWorkspace pattern).

**Example (current insurance page.tsx → refactored pattern):**
```typescript
// src/app/(protected)/app/insurance/page.tsx
import { createClient } from '@/lib/supabase/server'
import { InsuranceWorkspace } from '@/components/insurance/insurance-workspace'

export default async function InsurancePage() {
  const supabase = await createClient()
  const [{ data: policies }, { data: pricing }] = await Promise.all([
    supabase.from('insurance_policies').select('*').eq('policy_year', 2026).order('farm_name'),
    supabase.from('insurance_pricing').select('*').eq('year', 2026),
  ])
  return (
    <InsuranceWorkspace
      initialPolicies={policies ?? []}
      initialPricing={pricing ?? []}
    />
  )
}
```

### Pattern 2: Slide-Out Drawer (Right Panel)

**What:** Fixed-position right panel, 400-480px wide, slides in from right. `translate-x-full` → `translate-x-0` with CSS transition. Backdrop overlay behind it. Keeps main list visible and scrollable.

**When to use:** Policy create and edit — avoids navigating away from the list.

**Example:**
```typescript
// src/components/insurance/policy-drawer.tsx
'use client'

interface PolicyDrawerProps {
  open: boolean
  policy: InsurancePolicy | null  // null = create mode
  onClose: () => void
  onSave: (policy: InsurancePolicy) => void
}

export function PolicyDrawer({ open, policy, onClose, onSave }: PolicyDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] z-50 bg-soil-surface border-l border-soil-border
          transform transition-transform duration-200 ease-out overflow-y-auto
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Content */}
      </div>
    </>
  )
}
```

### Pattern 3: CSS Grid Coverage Matrix (24 Cells)

**What:** 8 coverage levels (50–85%) × 3 plan types (RP, RP-HPE, YP) = 24 cells. CSS grid with fixed column widths. Heat-map coloring via inline style background-color derived from indemnity value. Client component since it re-renders on policy select.

**When to use:** INS-03 requirement. Coverage levels are rows, plan types are columns (plan type columns makes it easy to compare RP vs RP-HPE vs YP side-by-side at the same coverage level — the most common producer decision).

**Key insight:** The matrix calls `computeInsurancePolicy()` 24 times (8 coverage × 3 plan types) with the selected policy's data but with the coverage_level varied per cell. Plan type (RP/RP-HPE/YP) affects which price to use:
- RP: uses max(spring_price, fall_price) — already in computeInsurancePolicy()
- RP-HPE: uses fall_price only (harvest price exclusion)
- YP: uses spring_price only (yield-only, price at planting)

**Heat-map coloring logic:** Color by indemnity value normalized against the max indemnity in the matrix — higher indemnity = more visible amber/green, zero indemnity = muted background.

```typescript
// Coverage matrix calc (24 cells, all client-side, instant)
const COVERAGE_LEVELS = [50, 55, 60, 65, 70, 75, 80, 85]
const PLAN_TYPES = ['RP', 'RP-HPE', 'YP'] as const

function computeForPlanType(
  policy: InsurancePolicy,
  pricing: PricingEntry[],
  coverageLevel: number,
  planType: 'RP' | 'RP-HPE' | 'YP'
) {
  // Modify the pricing used based on plan type
  // RP: max(spring, fall) — default computeInsurancePolicy behavior
  // RP-HPE: use fall_price only (harvest price excluded from guarantee)
  // YP: use spring_price only
  const adjustedPricing = pricing.map(p => {
    if (planType === 'RP-HPE') return { ...p, fall_price: p.spring_price }  // no fall premium
    if (planType === 'YP') return { ...p, fall_price: p.spring_price }       // yield only
    return p  // RP: use both, max() in computeInsurancePolicy
  })
  return computeInsurancePolicy({ ...policy, coverage_level: coverageLevel }, adjustedPricing)
}
```

**Note:** RP-HPE and YP both use spring_price — the distinction matters more conceptually (RP-HPE has lower premium cost in practice) but the payout formula simplification is valid for decision support purposes. Flag this in code comments.

### Pattern 4: Payout Simulator (Native Range Inputs)

**What:** Two HTML `<input type="range">` sliders (yield, price) bound to React state. `onChange` recalculates via `computeInsurancePolicy()` — pure function, no I/O, guaranteed <100ms. Display results as numbers + simple visual indicator (no chart required for this use case).

**When to use:** INS-04 requirement. Single scenario (no save-and-compare) keeps complexity minimal.

**Slider set:** yield + price (not coverage level — coverage level is the matrix's domain; mixing coverage into the simulator creates UI confusion).

**Disclaimer placement:** Inline banner directly above results section — not footer, not tooltip. Farm operators scan top-to-bottom; disclaimer before numbers is more likely to be read.

**Example:**
```typescript
'use client'

const [simYield, setSimYield] = useState(policy.guarantee)
const [simPrice, setSimPrice] = useState(springPrice)

const result = useMemo(() => {
  // Override the pricing with the simulator price
  const adjustedPricing = pricing.map(p =>
    p.crop.toLowerCase() === policy.crop?.toLowerCase()
      ? { ...p, fall_price: simPrice, spring_price: simPrice }
      : p
  )
  return computeInsurancePolicy({ ...policy, actual: simYield }, adjustedPricing)
}, [policy, pricing, simYield, simPrice])
```

### Pattern 5: PDF Isolation (Established Pattern)

**What:** Two files only import from @react-pdf/renderer. Both are loaded via `dynamic({ ssr: false })` from the workspace component. No 'use client' directive on the PDF files themselves. Named export pattern requires `.then(m => ({ default: m.NamedExport }))` in dynamic() call.

**When to use:** INS-08 requirement. Identical pattern to Phase 28 acreage PDF.

**PDF content decision:** Print-friendly light background (same as acreage PDF — `#f5f5f5` headers, white background). Audience: farmer-reference level (not agent-formal). Content sections:
1. Header with farm name and generation date
2. Policy summary table (farm, crop, coverage %, guarantee, actual, alert status)
3. Coverage matrix snapshot (24 cells as a simple table — react-pdf can't do CSS grid, use flexDirection rows)
4. Disclaimer footer

**PDF download trigger:** Download-button only (no preview). PDFDownloadLink renders immediately, generates on click. Consistent with Phase 28 pattern.

```typescript
// src/components/insurance/insurance-pdf-button.tsx
// NO 'use client' — loaded via dynamic({ ssr: false })
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InsurancePdfDocument } from './insurance-pdf'

export function InsurancePdfButton({ policies, pricing }: Props) {
  return (
    <PDFDownloadLink
      document={<InsurancePdfDocument policies={policies} pricing={pricing} />}
      fileName="insurance-summary-2026.pdf"
    >
      {({ loading }) => (
        <button
          className="bg-soil-accent text-soil-bg px-4 py-2 rounded font-mono text-sm font-bold hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          type="button"
        >
          {loading ? 'Generating...' : 'Export PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
```

### Pattern 6: Policy CRUD API (New Routes Needed)

**What:** POST /api/insurance/policies and DELETE /api/insurance/policies/[id] do not exist. Only GET (list) and PATCH + GET (single) exist from Phase 29. Must add them.

**POST body fields:**
```typescript
interface PolicyCreate {
  farm_name: string | null
  farm_number: string | null
  crop: string | null
  policy_year: number          // default 2026
  planted_acres: number        // required
  guarantee: number            // default 0
  actual: number               // default 0
  coverage_level: number       // default 75
  unit_type: string | null
  premium_per_acre: number | null
  agent_name: string | null
  plan_type: string | null     // 'RP' | 'RP-HPE' | 'YP' | null
  notes: string | null
  prevented_planting: boolean  // default false
  prevented_planting_acres: number | null
}
```

**Note:** `plan_type` is NOT currently a column on `insurance_policies`. It needs to be added via ALTER TABLE (same pattern as Phase 29's migrate-29.ts). The matrix requires it.

**DELETE:** Simple delete by ID with auth check. No soft-delete (no audit requirements at this phase).

### Pattern 7: InsuranceWorkspace Navigation Structure

**What:** Three-section layout within the insurance page — not separate routes, not tabs, but policy-driven flow. The selected policy drives the matrix and simulator. This matches how farmers actually use it: pick a policy, then explore options for it.

**Recommended structure:**
```
[Stat cards row]           — same as current page.tsx
[Disclaimer banner]        — decision-support notice
[Policy list + Add button] — compact table (3 policies, table more info-dense than cards)
[Coverage Matrix]          — for selected policy (hide if none selected)
[Payout Simulator]         — for selected policy (hide if none selected)
[Export PDF button]        — top-right of page header, always visible
```

**Policy list format:** Compact table (not card grid). 3 policies fit in a table row each. Table shows: Farm, Crop, Plan Type, Coverage %, Guarantee, Actual, Alert badge, Edit/Delete actions. Card grid would waste vertical space and hide key data fields.

**Selected policy interaction:** Clicking a policy row selects it (highlighted row) and expands matrix/simulator below. Edit button opens PolicyDrawer. Delete button triggers ConfirmDialog (same z-[60] pattern from Phase 28).

### Anti-Patterns to Avoid

- **Importing @react-pdf/renderer outside the two PDF files:** Causes "Component is not a constructor" SSR crash. The acreage PDF code documents this — copy the pattern exactly.
- **Making API calls in the payout simulator:** computeInsurancePolicy() is a pure function in lib/fsa/calc.ts. Call it directly. No fetch() on slider change.
- **Using shadcn/ui or any uninstalled library:** Not in package.json. All components hand-built with Tailwind.
- **Using `Array.from()` alternatives on Set/Map in TypeScript:** The tsconfig targets ES3 — spread syntax on Set/Map may not work. Use `Array.from()` for iteration (documented in lib/insurance/calc.ts header comment).
- **Mutating pricing array in computeForPlanType:** Create new array with `.map()` — the function is pure and pricing is shared state.
- **Forgetting plan_type column migration:** plan_type does not exist on insurance_policies yet. The drawer and matrix both depend on it. Must add via ALTER TABLE before UI builds.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF | @react-pdf/renderer (already installed) | SSR crashes, browser print unreliable, @react-pdf already patterns established |
| Coverage calculations | Manual formula duplication | computeInsurancePolicy() in lib/fsa/calc.ts | Already correct, tested, plan type adaptation is thin wrapper |
| Drawer animation | CSS animation library | Tailwind translate-x + transition-transform | Sufficient for this use case, no dependency |
| Delete confirmation | Custom confirm component | ConfirmDialog from components/fsa/ | Already exists, copy or move to shared location |

**Key insight:** The calculation engine is complete. Phase 30 is wrapper/display work, not business logic work.

---

## Common Pitfalls

### Pitfall 1: plan_type Column Missing
**What goes wrong:** Coverage matrix and policy drawer reference plan_type but the column doesn't exist on insurance_policies. Runtime error or silent null everywhere.
**Why it happens:** plan_type wasn't in the fsa-acres source data (all 3 policies have it missing). Phase 27 migration didn't add it. Phase 29 didn't add it (not needed for those features).
**How to avoid:** Add plan_type TEXT column via ALTER TABLE in a migrate-30.ts script (same pattern as migrate-29.ts). Run before building UI. Default existing rows to NULL (not a specific plan type — user can set it via the editor).
**Warning signs:** TypeScript type for InsurancePolicy lacks plan_type field.

### Pitfall 2: @react-pdf/renderer SSR Crash
**What goes wrong:** "Component is not a constructor" error crashes the Next.js dev server or build.
**Why it happens:** @react-pdf/renderer uses browser-only APIs. Next.js App Router runs components on the server by default.
**How to avoid:** Follow the established two-file pattern exactly: insurance-pdf.tsx (document) + insurance-pdf-button.tsx (download link). No 'use client' on either. Load via `dynamic({ ssr: false })` in insurance-workspace.tsx. Named export requires `.then(m => ({ default: m.NamedExport }))`.
**Warning signs:** Any import of @react-pdf/renderer outside these two files.

### Pitfall 3: RP-HPE vs YP Formula Simplification
**What goes wrong:** RP-HPE and YP produce identical payout numbers in the matrix, confusing users.
**Why it happens:** computeInsurancePolicy() uses max(spring, fall) and doesn't know plan type. Both RP-HPE and YP use spring_price when fall_price is excluded, producing the same number if spring_price equals spring_price.
**How to avoid:** The distinction is real but subtle: RP-HPE guarantees the harvest price won't exceed the spring price (lower premium cost in practice, similar payout in a loss scenario). Add a comment in the matrix explaining the simplification. The disclaimer "results are illustrative only" covers this. For decision support purposes, the formula is sufficient.
**Warning signs:** User asks "why are RP-HPE and YP the same?" — have the comment ready.

### Pitfall 4: Payout Simulator Slider Range
**What goes wrong:** Yield slider range set incorrectly — min/max don't match realistic farm yields.
**Why it happens:** Default HTML range inputs use 0-100 which is wrong for yield (bu/ac can be 0-300 depending on crop).
**How to avoid:** Set slider min/max dynamically based on policy.guarantee. Recommended: min=0, max=policy.guarantee * 1.5, step=1. Price slider: min=0, max=springPrice * 2, step=0.05.
**Warning signs:** Slider can't reach meaningful values for the selected policy.

### Pitfall 5: InsuranceWorkspace Hydration Mismatch
**What goes wrong:** Server-rendered HTML doesn't match client render, causing React hydration errors.
**Why it happens:** Server page.tsx fetches policies; InsuranceWorkspace initializes local state from props. If state initialization differs from server render, hydration fails.
**How to avoid:** InsuranceWorkspace is `'use client'` — it won't be server-rendered. Only page.tsx renders on server. Pass data as props only. No localStorage or window access during render.
**Warning signs:** "Hydration failed because the initial UI does not match" console error.

### Pitfall 6: Next.js 15 Dynamic Route Params
**What goes wrong:** DELETE /api/insurance/policies/[id] uses `params.id` directly instead of awaiting params.
**Why it happens:** Next.js 15+ made dynamic route params a Promise (breaking change from Next.js 14 sync params).
**How to avoid:** Follow Phase 29-02 pattern: `const { id } = await params` — not `params.id`. Already documented in STATE.md decisions.
**Warning signs:** TypeScript error on `params.id` in route handlers.

---

## Code Examples

### POST /api/insurance/policies

```typescript
// src/app/api/insurance/policies/route.ts — add POST handler
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  if (typeof body.planted_acres !== 'number' || body.planted_acres <= 0) {
    return NextResponse.json({ error: 'planted_acres is required and must be positive' }, { status: 400 })
  }

  const insertData = {
    farm_name: typeof body.farm_name === 'string' ? body.farm_name : null,
    farm_number: typeof body.farm_number === 'string' ? body.farm_number : null,
    crop: typeof body.crop === 'string' ? body.crop : null,
    policy_year: typeof body.policy_year === 'number' ? body.policy_year : 2026,
    planted_acres: body.planted_acres as number,
    guarantee: typeof body.guarantee === 'number' ? body.guarantee : 0,
    actual: typeof body.actual === 'number' ? body.actual : 0,
    coverage_level: typeof body.coverage_level === 'number' ? body.coverage_level : 75,
    plan_type: typeof body.plan_type === 'string' ? body.plan_type : null,
    unit_type: typeof body.unit_type === 'string' ? body.unit_type : null,
    premium_per_acre: typeof body.premium_per_acre === 'number' ? body.premium_per_acre : null,
    agent_name: typeof body.agent_name === 'string' ? body.agent_name : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    prevented_planting: typeof body.prevented_planting === 'boolean' ? body.prevented_planting : false,
    prevented_planting_acres: typeof body.prevented_planting_acres === 'number' ? body.prevented_planting_acres : null,
    claim_alert: 'none',  // computed fresh on first PATCH
    actual_synced_from_grain: false,
    legacy_id: `ins_manual_${Date.now()}`,  // synthetic legacy_id for new records
  }

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policy }, { status: 201 })
}
```

### DELETE /api/insurance/policies/[id]

```typescript
// src/app/api/insurance/policies/[id]/route.ts — add DELETE handler
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('insurance_policies')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
```

### migrate-30.ts (plan_type column)

```typescript
// glomalin-portal/scripts/migrate-30.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrate() {
  // Add plan_type column to insurance_policies
  // TEXT — 'RP' | 'RP-HPE' | 'YP' | NULL
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_type TEXT;`
  })
  if (error) { console.error('Migration failed:', error); process.exit(1) }
  console.log('migrate-30: plan_type column added')
}

migrate()
```

**Alternative if exec_sql RPC not available:** Use Supabase dashboard SQL editor to run `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_type TEXT;`

### Coverage Matrix (CSS Grid, 24 cells)

```typescript
'use client'
// src/components/insurance/coverage-matrix.tsx
import { computeInsurancePolicy } from '@/lib/fsa/calc'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'

const COVERAGE_LEVELS = [50, 55, 60, 65, 70, 75, 80, 85]
const PLAN_TYPES = ['RP', 'RP-HPE', 'YP'] as const
type PlanType = typeof PLAN_TYPES[number]

function computeCell(
  policy: InsurancePolicy,
  pricing: PricingEntry[],
  coverage: number,
  planType: PlanType
) {
  // RP: max(spring, fall) — default behavior
  // RP-HPE and YP: use spring_price as the guarantee price (simplification for decision support)
  const adjustedPricing = planType === 'RP'
    ? pricing
    : pricing.map(p => ({ ...p, fall_price: p.spring_price }))

  return computeInsurancePolicy({ ...policy, coverage_level: coverage }, adjustedPricing)
}

export function CoverageMatrix({ policy, pricing }: { policy: InsurancePolicy; pricing: PricingEntry[] }) {
  // Compute all 24 cells
  const cells = COVERAGE_LEVELS.map(coverage =>
    PLAN_TYPES.map(plan => ({
      coverage,
      plan,
      result: computeCell(policy, pricing, coverage, plan),
    }))
  )

  // Find max indemnity for heat-map normalization
  const maxIndemnity = Math.max(...cells.flat().map(c => c.result.indemnity), 1)

  return (
    <div className="overflow-x-auto">
      {/* grid: 1 label col + 3 plan type cols */}
      <div className="grid grid-cols-4 gap-px bg-soil-border rounded overflow-hidden min-w-[480px]">
        {/* Header row */}
        <div className="bg-soil-surface px-3 py-2 text-xs text-soil-muted font-mono">Coverage</div>
        {PLAN_TYPES.map(plan => (
          <div key={plan} className="bg-soil-surface px-3 py-2 text-xs text-soil-accent font-mono font-semibold text-center">
            {plan}
          </div>
        ))}

        {/* Data rows */}
        {cells.map(row => row.map((cell, colIdx) => {
          const isFirstCol = colIdx === 0
          const intensity = cell.result.indemnity / maxIndemnity  // 0-1
          const bg = cell.result.indemnity > 0
            ? `rgba(200, 134, 10, ${0.1 + intensity * 0.5})`  // soil-accent amber
            : undefined

          return (
            <div key={`${cell.coverage}-${cell.plan}`}
              className={`px-3 py-2 text-xs font-mono ${isFirstCol ? 'bg-soil-surface text-soil-muted' : 'text-soil-text text-center'}`}
              style={!isFirstCol && bg ? { backgroundColor: bg } : undefined}
            >
              {isFirstCol
                ? `${cell.coverage}%`
                : cell.result.indemnity > 0
                  ? `$${cell.result.indemnity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : '—'
              }
            </div>
          )
        }))}
      </div>
    </div>
  )
}
```

**Note on grid iteration:** `cells.map(row => row.map(...))` returns nested arrays. React renders flat arrays fine. The grid-cols-4 layout handles positioning automatically.

### Payout Simulator

```typescript
'use client'
// src/components/insurance/payout-simulator.tsx
import { useState, useMemo } from 'react'
import { computeInsurancePolicy } from '@/lib/fsa/calc'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'

export function PayoutSimulator({ policy, pricing }: { policy: InsurancePolicy; pricing: PricingEntry[] }) {
  const basePricing = pricing.find(p => p.crop.toLowerCase() === (policy.crop ?? '').toLowerCase())
  const defaultYield = policy.actual > 0 ? policy.actual : policy.guarantee
  const defaultPrice = basePricing ? Math.max(basePricing.spring_price, basePricing.fall_price) : 5.00

  const [simYield, setSimYield] = useState(defaultYield)
  const [simPrice, setSimPrice] = useState(defaultPrice)

  const result = useMemo(() => {
    const adjustedPricing = pricing.map(p =>
      p.crop.toLowerCase() === (policy.crop ?? '').toLowerCase()
        ? { ...p, spring_price: simPrice, fall_price: simPrice }
        : p
    )
    return computeInsurancePolicy({ ...policy, actual: simYield }, adjustedPricing)
  }, [policy, pricing, simYield, simPrice])

  const yieldMax = Math.ceil(policy.guarantee * 1.5)
  const priceMax = Math.ceil(defaultPrice * 2 * 20) / 20  // round to nearest $0.05

  return (
    <div className="space-y-4">
      {/* Disclaimer — above results */}
      <p className="text-xs text-soil-muted italic">
        Results are illustrative only. Verify all figures with your insurance agent.
      </p>

      {/* Yield slider */}
      <div>
        <label className="text-xs text-soil-muted font-mono block mb-1">
          Simulated Yield: {simYield.toFixed(1)} bu/ac
        </label>
        <input
          type="range"
          min={0} max={yieldMax} step={1}
          value={simYield}
          onChange={e => setSimYield(Number(e.target.value))}
          className="w-full accent-soil-accent"
        />
      </div>

      {/* Price slider */}
      <div>
        <label className="text-xs text-soil-muted font-mono block mb-1">
          Price: ${simPrice.toFixed(2)}/bu
        </label>
        <input
          type="range"
          min={0} max={priceMax} step={0.05}
          value={simPrice}
          onChange={e => setSimPrice(Number(e.target.value))}
          className="w-full accent-soil-accent"
        />
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-soil-surface border border-soil-border rounded px-4 py-3">
          <p className="text-xs text-soil-muted font-mono">Effective Guarantee</p>
          <p className="text-lg font-mono font-bold text-soil-text">
            {result.effectiveGuarantee.toFixed(1)} bu/ac
          </p>
        </div>
        <div className={`bg-soil-surface border rounded px-4 py-3 ${result.indemnity > 0 ? 'border-yellow-700' : 'border-soil-border'}`}>
          <p className="text-xs text-soil-muted font-mono">Est. Indemnity</p>
          <p className={`text-lg font-mono font-bold ${result.indemnity > 0 ? 'text-yellow-400' : 'text-soil-muted'}`}>
            {result.indemnity > 0
              ? `$${result.indemnity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : '$0'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 sync route params | Next.js 15+ async params (Promise) | Next.js 15 | Must `await params` in all dynamic route handlers — already documented in STATE.md |
| PDF via browser print | @react-pdf/renderer | Project decision v5 | Consistent PDF output, no browser dependencies |
| shadcn/ui components | Hand-built Tailwind components | Project decision v5 | Simpler dependency footprint, consistent soil aesthetic |

**Deprecated/outdated:**
- Sync params in dynamic routes: `params.id` → `(await params).id` — enforced in Phase 29 route handlers

---

## Open Questions

1. **exec_sql RPC availability for plan_type migration**
   - What we know: Phase 29 used a separate migrate-29.ts script with direct SQL (ALTER TABLE)
   - What's unclear: Whether Supabase project has exec_sql RPC enabled or if raw SQL must be run via dashboard
   - Recommendation: Write migrate-30.ts with the same pattern as migrate-29.ts; document fallback SQL for dashboard execution

2. **insurance_pricing data for 2026**
   - What we know: insurance_pricing table exists (Phase 27), validation route queries it for year=2026
   - What's unclear: Whether pricing rows actually exist in Supabase for 2026 (all CLU APH is 0; pricing may also be unpopulated)
   - Recommendation: Coverage matrix and payout simulator must handle zero pricing gracefully — show "—" cells when spring_price and fall_price are both 0

3. **plan_type for existing 3 policies**
   - What we know: All 3 migrated policies have no plan_type in source data
   - What's unclear: Whether the farm operator knows the plan type off the top of their head
   - Recommendation: plan_type field in editor defaults to null with a hint "RP is most common". Matrix shows a note when plan_type is null: "Select a plan type via Edit to see accurate matrix"

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not present in .planning/config.json (no nyquist_validation key). No validation architecture section required.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `/glomalin-portal/src/lib/fsa/calc.ts` — computeInsurancePolicy() signature, InsurancePolicy type, PricingEntry type, coverage_level semantics
- Codebase: `/glomalin-portal/src/lib/insurance/calc.ts` — computeClaimAlert(), computeAphFromClus(), findBestGrainMatch() — confirms calc engine is complete
- Codebase: `/glomalin-portal/src/app/(protected)/app/insurance/page.tsx` — InsurancePolicy interface, current UI baseline to refactor
- Codebase: `/glomalin-portal/src/components/fsa/acreage-pdf.tsx` + `acreage-pdf-button.tsx` — PDF isolation pattern to replicate
- Codebase: `/glomalin-portal/src/components/fsa/clu-workspace.tsx` — client orchestrator pattern to replicate
- Codebase: `/glomalin-portal/src/components/fsa/confirm-dialog.tsx` — delete confirmation pattern
- Codebase: `/glomalin-portal/src/app/api/insurance/policies/route.ts` — GET only; POST missing
- Codebase: `/glomalin-portal/src/app/api/insurance/policies/[id]/route.ts` — GET + PATCH; DELETE missing
- Codebase: `/glomalin-portal/package.json` — confirms no shadcn/ui, no slider library, @react-pdf/renderer ^4.3.2 installed
- Codebase: `/glomalin-portal/tailwind.config.ts` — soil design tokens confirmed
- Codebase: `/fsa-acres/data/data.json` — confirms 3 insurance policies, no plan_type field in source data
- `.planning/STATE.md` — Next.js 15 async params decision, CSS grid decision, PDF isolation pattern

### Secondary (MEDIUM confidence)

- `.planning/phases/29-insurance-tables-calculation-engine/29-RESEARCH.md` — Phase 29 findings (all CLU APH = 0, 3 policies in DB, ins_482 corrupt data)

### Tertiary (LOW confidence)

- RP/RP-HPE/YP formula distinction for the matrix: The simplification (RP-HPE = spring_price only) is a reasonable approximation for decision support but not verified against USDA RMA actuarial tables. The disclaimer on all outputs covers this.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed, versions confirmed from package.json
- Architecture: HIGH — all patterns directly sourced from existing codebase (CluWorkspace, AcreagePdf, ConfirmDialog)
- Pitfalls: HIGH — plan_type missing confirmed from source data inspection, SSR crash pattern established in Phase 28, async params in STATE.md
- Formulas: MEDIUM — computeInsurancePolicy() verified, plan type adaptation is a reasonable simplification with disclaimer

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack, no fast-moving dependencies)
