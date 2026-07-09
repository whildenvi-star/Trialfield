# Phase 15: Marketing Command Center Dashboard - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 9 (5 new components + 1 page replace + 1 loading replace + 1 proxy extend + 1 type file)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(protected)/app/marketing/page.tsx` | page (RSC) | request-response + multi-fetch | `src/app/(protected)/app/enterprise-summary/page.tsx` | exact |
| `src/app/(protected)/app/marketing/loading.tsx` | loading skeleton | — | `src/app/(protected)/app/marketing/loading.tsx` (current) | self-replace |
| `src/app/api/mobile/_lib/proxy.ts` | utility / service proxy | request-response | `src/app/api/mobile/_lib/proxy.ts` (current) | self-extend |
| `src/components/marketing/position-strip.tsx` | component (server) | transform | `src/components/marketing/hedging-dashboard.tsx` → `SummaryBanner` | role-match |
| `src/components/marketing/contract-table.tsx` | component (client) | CRUD / sort | `src/components/ui/table.tsx` + `hedging-dashboard.tsx` | role-match |
| `src/components/marketing/delivery-progress-bar.tsx` | component (pure) | transform | `hedging-dashboard.tsx` → `ProgressBar` | role-match |
| `src/components/marketing/basis-exposure-panel.tsx` | component (server) | request-response | `src/app/(protected)/app/enterprise-summary/page.tsx` (panel sections) | partial |
| `src/components/marketing/recon-queue.tsx` | component (client) | event-driven / navigation | `src/app/(protected)/app/field-ops/field-ops-client.tsx` | partial |

---

## Pattern Assignments

### `src/app/(protected)/app/marketing/page.tsx` (page RSC — REPLACE)

**Analog:** `src/app/(protected)/app/enterprise-summary/page.tsx`

**Imports pattern** (enterprise-summary lines 1–8; proxy.ts lines 1–10):
```typescript
import { requireMarketingAccess, isMarketingGuardError } from '@/lib/supabase/guard'
import { redirect } from 'next/navigation'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { YearSelector } from '@/components/ui/year-selector'
import { PageHeader } from '@/components/ui/page-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Empty } from '@/components/ui/empty'
import { PositionStrip } from '@/components/marketing/position-strip'
import { ContractTable } from '@/components/marketing/contract-table'
import { BasisExposurePanel } from '@/components/marketing/basis-exposure-panel'
import { ReconQueue } from '@/components/marketing/recon-queue'
```

**searchParams + cropYear pattern** (current marketing/page.tsx lines 19–26; enterprise-summary lines 86–89):
```typescript
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const cropYear = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR
```

**Auth guard pattern** (guard.ts lines 82–113; RESEARCH.md Code Examples):
```typescript
  const guard = await requireMarketingAccess()
  if (isMarketingGuardError(guard)) redirect('/app')
  const { role, supabase } = guard
  const isOwner = role === 'owner'

  // Get session token to forward to organic-cert (see fetchCertServiceWithAuth below)
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''
```

NOTE: `requireMarketingAccess()` returns `NextResponse` on failure. In an RSC, call `redirect('/app')` instead of returning the NextResponse — the type guard `isMarketingGuardError()` distinguishes the two shapes. This is confirmed by the guard's return type (`MarketingGuardResult | NextResponse`) and the redirect pattern in enterprise-summary.

**Multi-fetch + best-effort pattern** (enterprise-summary lines 116–143; current marketing/page.tsx lines 42–68):
```typescript
  // Parallel fetch — best-effort with typed fallback
  const [contractsRes, deliveriesRes] = await Promise.all([
    fetchCertServiceWithAuth(
      `/api/marketing/grain-contracts?year=${cropYear}`,
      accessToken
    ),
    fetchCertServiceWithAuth(
      `/api/marketing/grain-deliveries?year=${cropYear}&unmatched=true`,
      accessToken
    ),
  ])

  let contracts: GrainContract[] = []
  let contractsError = false
  if (contractsRes.ok) {
    const json = await contractsRes.json() as { contracts?: GrainContract[] }
    contracts = json.contracts ?? []
  } else {
    contractsError = true
  }

  let unmatchedDeliveries: GrainDelivery[] = []
  let deliveriesError = false
  if (deliveriesRes.ok) {
    const json = await deliveriesRes.json() as { deliveries?: GrainDelivery[] }
    unmatchedDeliveries = json.deliveries ?? []
  } else {
    deliveriesError = true
  }
```

**Position computation — server-side** (RESEARCH.md Architecture Patterns / Position Strip):
```typescript
  // Server-side aggregation from the contracts array (no separate endpoint)
  const contractedBu = contracts.reduce((s, c) => s + c.contractedBushels, 0)
  const PRICED_INSTRUMENTS = new Set(['PRICED', 'FUTURES_FIXED', 'BASIS_FIXED', 'FOB', 'MIN_PRICE'])
  const pricedContracts = contracts.filter(c => PRICED_INSTRUMENTS.has(c.instrument))
  const pricedBu = pricedContracts.reduce((s, c) => s + c.contractedBushels, 0)
  const openBu = contractedBu - pricedBu
  const avgPrice = pricedBu > 0
    ? pricedContracts.reduce((s, c) => s + (c.finalCashPrice ?? 0) * c.contractedBushels, 0) / pricedBu
    : 0
  const positionData = { contractedBu, pricedBu, openBu, avgPrice, cropYear }
```

**Owner-only filtering for BasisExposurePanel** (RESEARCH.md D-07):
```typescript
  // Filtered from same contracts array — no extra fetch
  const unPricedContracts = isOwner
    ? contracts.filter(c =>
        (c.instrument === 'FUTURES_FIXED' && c.futuresPrice == null) ||
        (c.instrument === 'BASIS_FIXED' && c.basis == null)
      )
    : []
```

**Error banner pattern** (enterprise-summary lines 204–214):
```typescript
  // In JSX:
  {contractsError && (
    <div className="mb-4 px-4 py-3 bg-glomalin-warning/10 border border-glomalin-warning/30 text-glomalin-warning text-sm rounded">
      Unable to load contracts — refresh to retry.
    </div>
  )}
```

**Page JSX structure + role gates** (RESEARCH.md Server-Side Role Gate Pattern):
```typescript
  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <PageHeader
        title="Marketing Command Center"
        subtitle={`${cropYear} crop year`}
        actions={<YearSelector currentYear={cropYear} />}
      />

      {/* OWNER ONLY — not rendered in RSC for office role */}
      {isOwner && <PositionStrip data={positionData} />}

      <SectionHeader
        title="Contracts"
        actions={<a href="/app/marketing/contracts/new" className="...">New Contract</a>}
      />
      <ContractTable contracts={contracts} role={role} />

      <div className={isOwner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'grid grid-cols-1'}>
        {isOwner && <BasisExposurePanel contracts={unPricedContracts} />}
        <ReconQueue deliveries={unmatchedDeliveries} />
      </div>
    </div>
  )
```

---

### `src/app/(protected)/app/marketing/loading.tsx` (loading skeleton — REPLACE)

**Analog:** Current `src/app/(protected)/app/marketing/loading.tsx` (lines 1–53)

The existing loading.tsx shows the OLD layout (CBOT strip + old marketing positions). Replace entirely to match new layout.

**Skeleton component imports** (skeleton.tsx lines 1–34):
```typescript
import { SkeletonCard } from '@/components/ui/skeleton'
import { SkeletonRow } from '@/components/ui/skeleton'
```

**New loading shape to copy** (loading.tsx lines 1–53 as structural reference, not content):
```typescript
// NEW loading.tsx — matches new page layout
function Block({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-glomalin-border rounded animate-pulse`} />
}

export default function MarketingLoading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      {/* PageHeader skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Block w="w-64" h="h-7" />
          <Block w="w-32" h="h-3" />
        </div>
        <Block w="w-24" h="h-8" />
      </div>

      {/* Position strip skeleton (owner-only — render optimistically) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Contracts table skeleton */}
      <Block w="w-28" h="h-3" />
      <div className="border border-glomalin-border rounded">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} cols={8} />
        ))}
      </div>

      {/* Lower panels skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[3, 3].map((rows, pi) => (
          <div key={pi} className="bg-glomalin-surface border border-glomalin-border rounded-lg p-4 space-y-3">
            <Block w="w-32" h="h-4" />
            {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### `src/app/api/mobile/_lib/proxy.ts` (utility — EXTEND)

**Analog:** `src/app/api/mobile/_lib/proxy.ts` (current, lines 52–67)

The existing `fetchCertService` function (lines 52–67) is the direct base. Add `fetchCertServiceWithAuth` immediately after it, following the same structural pattern as the other fetchers.

**Base pattern to extend from** (proxy.ts lines 52–67):
```typescript
/** Fetch from organic-cert service (Next.js, port 3004). */
export async function fetchCertService(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const { cert } = getBase()
  return fetch(`${cert}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  } as RequestInit)
}
```

**New function to add** (immediately after the above):
```typescript
/**
 * Fetch from organic-cert service with Supabase Bearer token forwarded.
 * Required by organic-cert marketing routes that call getMarketingAuthContext(),
 * which validates Authorization: Bearer <token>.
 * Call supabase.auth.getSession() in the RSC after requireMarketingAccess() succeeds
 * to get the accessToken to pass here.
 */
export async function fetchCertServiceWithAuth(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<Response> {
  const { cert } = getBase()
  return fetch(`${cert}${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options?.headers,
    },
  } as RequestInit)
}
```

---

### `src/components/marketing/position-strip.tsx` (component, server, transform)

**Analog:** `src/components/marketing/hedging-dashboard.tsx` → `SummaryBanner` function (lines 48–88)

The `SummaryBanner` in hedging-dashboard is the direct prior-art for a KpiStrip + StatCard composition. `PositionStrip` is a server component (no `'use client'`) that receives already-computed position data from the RSC.

**Imports pattern** (hedging-dashboard lines 3–8):
```typescript
import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { formatBu, formatUsdCents, formatPct } from '@/lib/fmt'
```

**Props shape + component body** (hedging-dashboard SummaryBanner lines 48–88 as reference):
```typescript
// PositionStrip — server component, no 'use client' directive
// Props computed by page.tsx RSC before passing down

interface PositionData {
  contractedBu: number
  pricedBu:     number
  openBu:       number
  avgPrice:     number   // dollars (not cents) — use formatUsdCents
  cropYear:     number
}

interface PositionStripProps {
  data: PositionData
}

export function PositionStrip({ data }: PositionStripProps) {
  const { contractedBu, pricedBu, openBu, avgPrice, cropYear } = data
  const pricedPct = contractedBu > 0 ? pricedBu / contractedBu : 0

  return (
    <KpiStrip cols={4}>
      <StatCard
        label="CONTRACTED"
        value={formatBu(contractedBu)}
        sublabel={`${cropYear} crop year`}
      />
      <StatCard
        label="PRICED"
        value={formatBu(pricedBu)}
        sublabel={`${formatPct(pricedPct)} of contracted`}
      />
      <StatCard
        label="OPEN / UNPRICED"
        value={formatBu(openBu)}
        sublabel="exposure"
        variant="warning"
      />
      <StatCard
        label="EST. AVG PRICE"
        value={avgPrice > 0 ? formatUsdCents(avgPrice) : '—'}
        sublabel="blended cash"
      />
    </KpiStrip>
  )
}
```

**KpiStrip cols API** (kpi-strip.tsx lines 10–16):
```typescript
// cols=4 resolves to: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
// Mobile: 1-col → tablet: 2-col → desktop: 4-col
// No override needed — the KpiStrip already handles responsive breakpoints.
```

**StatCard variant API** (stat-card.tsx lines 5–12):
```typescript
// variant options: 'default' | 'success' | 'warning' | 'danger'
// 'warning' → text-glomalin-warning (amber #ffb800)
// 'default' → text-glomalin-bright
// sublabel renders in text-glomalin-muted below the value
```

---

### `src/components/marketing/contract-table.tsx` (component, client, CRUD/sort)

**Analog:** `src/components/ui/table.tsx` (lines 1–160) + `hedging-dashboard.tsx` `CommodityCard` (lines 150–338)

This is the most complex new component. It is `'use client'` because it uses `useSortState`. It receives pre-fetched contracts from the RSC and a `role` prop for financial field gating.

**Imports pattern** (table.tsx lines 1–5; badge.tsx lines 1–2; money.tsx lines 1–3):
```typescript
'use client'

import { useState } from 'react'  // only if local state needed beyond useSortState
import {
  Table, TableHead, TableBody, TableRow,
  TableHeader, TableCell, SortableHeader,
  useSortState,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Money } from '@/components/ui/money'
import { Empty } from '@/components/ui/empty'
import { DeliveryProgressBar } from './delivery-progress-bar'
import { formatBu, formatBasis } from '@/lib/fmt'
```

**useSortState hook usage** (table.tsx lines 124–149):
```typescript
// Initialize with default sort key matching delivery_start ascending (D-03 default)
const { sortKey, sortDir, onSort, sortRows } = useSortState('deliveryStart')

// Sort the contracts array before rendering
const sorted = sortRows(contracts, (c) => {
  switch (sortKey) {
    case 'customer':      return c.customer?.name ?? ''
    case 'variant':       return c.variant?.name ?? ''
    case 'instrument':    return c.instrument
    case 'contractedBu':  return c.contractedBushels
    case 'deliveryStart': return c.deliveryStart ?? ''
    case 'futuresPrice':  return c.futuresPrice ?? 0
    case 'basis':         return c.basis ?? 0
    case 'cashPrice':     return c.finalCashPrice ?? 0
    default:              return ''
  }
})
```

**SortableHeader vs TableHeader** (table.tsx lines 49–120):
```typescript
// Sortable column header (active column gets text-glomalin-accent, ↑↓↕ indicator)
<SortableHeader sortKey="customer" currentKey={sortKey} direction={sortDir} onSort={onSort}>
  CUSTOMER
</SortableHeader>

// Non-sortable column (delivery progress bar, actions)
<TableHeader>DELIVERY</TableHeader>
<TableHeader className="w-[7%]">{/* actions */}</TableHeader>
```

**Role-gated price cell** (RESEARCH.md Code Examples; CONTEXT.md D-06):
```typescript
// futuresPrice, basis, finalCashPrice: absent from response for office role (not null — absent)
// Check key presence, not null-check

// FUTURES column cell:
<TableCell className="text-right">
  {'futuresPrice' in contract && contract.futuresPrice != null
    ? <Money value={contract.futuresPrice} cents />
    : <span className="text-glomalin-muted">—</span>
  }
</TableCell>

// BASIS column cell:
<TableCell className="text-right">
  {'basis' in contract && contract.basis != null
    ? <span className="font-mono tabular-nums text-glomalin-text">{formatBasis(contract.basis)}</span>
    : <span className="text-glomalin-muted">—</span>
  }
</TableCell>
```

**Instrument badge map** (UI-SPEC.md Section Contract Table):
```typescript
const INSTRUMENT_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  PRICED:        { label: 'PRICED', variant: 'accent' },
  SPOT:          { label: 'SPOT',   variant: 'default' },
  FOB:           { label: 'FOB',    variant: 'default' },
  PRICED_LATER:  { label: 'PTF',    variant: 'warning' },
  BASIS_FIXED:   { label: 'BASIS',  variant: 'info' },
  FUTURES_FIXED: { label: 'HTA',    variant: 'info' },
  MIN_PRICE:     { label: 'MIN',    variant: 'success' },
  ACCUMULATOR:   { label: 'ACCUM',  variant: 'warning' },
}

// In table cell:
<TableCell>
  <Badge variant={INSTRUMENT_BADGE[contract.instrument]?.variant ?? 'default'}>
    {INSTRUMENT_BADGE[contract.instrument]?.label ?? contract.instrument}
  </Badge>
</TableCell>
```

**Empty state inside table** (empty.tsx lines 14–39):
```typescript
// When contracts.length === 0:
<TableBody>
  <TableRow hover={false}>
    <TableCell colSpan={9}>
      <Empty
        title={`No contracts for ${cropYear}`}
        description="Contracts added in Phase 13 will appear here. Use 'New Contract' to get started."
      />
    </TableCell>
  </TableRow>
</TableBody>
```

**Full table wrapper** (table.tsx lines 8–14 — overflow-x-auto built in):
```typescript
// Table component already wraps with overflow-x-auto — no additional wrapper needed
<Table>
  <TableHead>
    <TableRow hover={false}>
      {/* SortableHeader columns */}
    </TableRow>
  </TableHead>
  <TableBody>
    {sorted.map((contract) => (
      <TableRow key={contract.id}>
        {/* TableCell columns */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### `src/components/marketing/delivery-progress-bar.tsx` (component, pure, transform)

**Analog:** `src/components/marketing/hedging-dashboard.tsx` → `ProgressBar` function (lines 92–108)

The `ProgressBar` in hedging-dashboard is the closest existing analog. The new `DeliveryProgressBar` differs: uses Tailwind class-based fill color (not inline style from `colors` token), includes a text label below, and uses different color thresholds.

**Existing ProgressBar pattern to adapt from** (hedging-dashboard lines 92–108):
```typescript
// OLD (uses inline style + colors token + single threshold):
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const barColor = clamped >= 80 ? colors.accent : clamped >= 50 ? colors.info : colors.warning
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-glomalin-bg overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${clamped}%`, background: barColor }} />
      </div>
      <span className="font-mono text-xs text-glomalin-text w-10 text-right">{fmtPct(clamped)}</span>
    </div>
  )
}
```

**New DeliveryProgressBar** (no 'use client' — pure, no hooks):
```typescript
// NEW — uses Tailwind class fill, shows applied/contracted fraction below bar
// Thresholds from UI-SPEC.md: 0-79% info, 80-99% success, 100% warning
import { formatBu } from '@/lib/fmt'

interface DeliveryProgressBarProps {
  applied:    number
  contracted: number
}

export function DeliveryProgressBar({ applied, contracted }: DeliveryProgressBarProps) {
  const pct = contracted > 0 ? Math.min(100, Math.round((applied / contracted) * 100)) : 0
  const fillColor =
    pct >= 100 ? 'bg-glomalin-warning'
    : pct >= 80 ? 'bg-glomalin-success'
    : 'bg-glomalin-info'

  return (
    <div>
      <div className="w-full h-1.5 rounded-full bg-glomalin-border/50">
        <div className={`h-full rounded-full ${fillColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-glomalin-muted mt-0.5 block">
        {formatBu(applied)} / {formatBu(contracted)}
      </span>
    </div>
  )
}
```

Key differences from old ProgressBar: Tailwind fill class not inline style; `h-1.5` (6px) not `h-2` (8px); fraction label below not pct label right; threshold at 100 (fully delivered = warning) not 80.

---

### `src/components/marketing/basis-exposure-panel.tsx` (component, server, request-response)

**Analog:** `src/components/ui/card.tsx` (lines 1–44) + `src/components/ui/empty.tsx` (lines 14–39)

No exact existing panel component in the codebase — closest pattern is the Card-wrapped list structure used inline in enterprise-summary. BasisExposurePanel is a server component (no 'use client') — it receives already-filtered contracts from page.tsx RSC.

**Card component API** (card.tsx lines 1–44):
```typescript
// All named exports from card.tsx:
// Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'
```

**Card panel structure** (card.tsx lines 15–36 for inner components):
```typescript
// CardHeader renders: flex flex-col gap-1 p-4 pb-0
// CardTitle renders:  text-base font-semibold font-heading text-glomalin-bright
// CardDescription renders: text-xs text-glomalin-muted
// CardContent renders: p-4

<Card>
  <CardHeader>
    <CardTitle>Basis Exposure</CardTitle>
    <CardDescription>
      {contracts.length} contract{contracts.length !== 1 ? 's' : ''} with open pricing leg
    </CardDescription>
  </CardHeader>
  <CardContent>
    {contracts.length === 0 ? (
      <Empty
        title="No open pricing legs"
        description="All HTA and basis-fixed contracts have been priced."
      />
    ) : (
      <div className="divide-y divide-glomalin-border/40">
        {contracts.map((contract) => (
          <div key={contract.id} className="flex items-center justify-between py-2 gap-4">
            {/* left cluster: Badge + customer short_code + variant name */}
            {/* right cluster: formatBu(contracted_bu) + delivery_end date */}
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

**Left/right cluster typography** (UI-SPEC.md Basis Exposure Panel):
```typescript
// Left cluster:
<div className="flex items-center gap-2 min-w-0">
  <Badge variant={contract.instrument === 'FUTURES_FIXED' ? 'info' : 'info'}>
    {contract.instrument === 'FUTURES_FIXED' ? 'HTA' : 'BASIS'}
  </Badge>
  <span className="font-sans text-sm text-glomalin-text">{contract.customer?.shortCode}</span>
  <span className="font-sans text-sm text-glomalin-muted">{contract.variant?.name}</span>
</div>

// Right cluster:
<div className="flex items-center gap-3 shrink-0 text-right">
  <span className="font-mono text-sm text-glomalin-text">{formatBu(contract.contractedBushels)} bu</span>
  <span className="font-mono text-xs text-glomalin-muted">
    del. {new Date(contract.deliveryEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
  </span>
</div>
```

---

### `src/components/marketing/recon-queue.tsx` (component, client, event-driven/navigation)

**Analog:** `src/app/(protected)/app/field-ops/field-ops-client.tsx` (lines 1–5 for useRouter pattern) + `card.tsx` panel structure

ReconQueue is `'use client'` because each "Apply" button calls `router.push()`. It receives `deliveries` from the RSC.

**useRouter import pattern** (field-ops-client.tsx lines 1–4):
```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { formatBu } from '@/lib/fmt'
```

**router.push navigation pattern** (field-ops-client.tsx as structural reference):
```typescript
// Inside the component:
const router = useRouter()

// In the Apply button onClick:
onClick={() => router.push(`/app/marketing/deliveries/${delivery.id}/apply`)}
```

**Full panel structure** (UI-SPEC.md Reconciliation Queue):
```typescript
export function ReconQueue({ deliveries }: { deliveries: GrainDelivery[] }) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Queue</CardTitle>
        <CardDescription>
          {deliveries.length} unmatched deliver{deliveries.length !== 1 ? 'ies' : 'y'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deliveries.length === 0 ? (
          <Empty
            title="Queue is clear"
            description="All deliveries have been applied to contracts."
          />
        ) : (
          <div className="divide-y divide-glomalin-border/40">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex flex-wrap items-center justify-between py-2 gap-2">
                {/* left cluster */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-sans text-sm font-bold text-glomalin-text">
                    {new Date(delivery.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="font-sans text-sm text-glomalin-muted">
                    {delivery.customer?.shortCode} · {delivery.variant?.name}
                  </span>
                  <span className="font-mono text-xs text-glomalin-warning">
                    {formatBu(delivery.unappliedBushels)} unmatched
                  </span>
                </div>
                {/* Apply button */}
                <button
                  className="px-3 py-1.5 min-h-[44px] rounded border border-glomalin-border
                             text-xs font-mono text-glomalin-muted ml-auto
                             hover:border-glomalin-accent hover:text-glomalin-accent
                             transition-colors"
                  onClick={() => router.push(`/app/marketing/deliveries/${delivery.id}/apply`)}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Shared Patterns

### Authentication Guard (requireMarketingAccess)
**Source:** `src/lib/supabase/guard.ts` lines 82–113
**Apply to:** `page.tsx` RSC
```typescript
// Returns MarketingGuardResult | NextResponse
// In an RSC: use isMarketingGuardError() + redirect(), not return
const guard = await requireMarketingAccess()
if (isMarketingGuardError(guard)) redirect('/app')
const { role, supabase } = guard
// role is typed as 'owner' | 'office' — use directly for isOwner flag
```

### Cross-Service Token Forwarding
**Source:** `src/app/api/mobile/_lib/proxy.ts` lines 52–67 (extended by this phase)
**Apply to:** All `fetchCertServiceWithAuth()` calls in `page.tsx`
```typescript
// Pattern: extract session after guard succeeds, pass to every fetch
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session?.access_token ?? ''
// Then: fetchCertServiceWithAuth('/api/marketing/...', accessToken)
```

### Error Banner (service offline / fetch failure)
**Source:** `src/app/(protected)/app/enterprise-summary/page.tsx` lines 204–214
**Apply to:** `page.tsx` RSC, one banner per failing data section
```typescript
<div className="mb-4 px-4 py-3 bg-glomalin-warning/10 border border-glomalin-warning/30 text-glomalin-warning text-sm rounded">
  Unable to load {section} — refresh to retry.
</div>
```

### Formatting Functions
**Source:** `src/lib/fmt.ts` lines 1–41
**Apply to:** All new marketing components
```typescript
formatBu(n)         // "182,400" — no "bu" suffix (add " bu" in JSX if needed)
formatUsdCents(n)   // "$4.82" — use for avg price display
formatPct(n)        // "63.0%" — pass fraction (0.63), not percentage (63)
formatBasis(n)      // "+12¢" or "-8¢" — for basis column in contract table
```
Note: `formatBu` returns the number only (e.g. "182,400") — append " bu" in JSX where the unit is needed. Compare hedging-dashboard line 139: `{formatBu(mix[type])} bu`.

### Card Panel Structure
**Source:** `src/components/ui/card.tsx` lines 1–44
**Apply to:** `basis-exposure-panel.tsx`, `recon-queue.tsx`
```typescript
// All four named exports used by panels: Card, CardHeader, CardTitle, CardDescription, CardContent
// CardDescription is the subtitle line (e.g. "3 contracts with open pricing leg")
// CardContent padding: p-4 (built-in — do not add extra wrapper div with p-4 inside)
```

### Empty State
**Source:** `src/components/ui/empty.tsx` lines 14–39
**Apply to:** All three data sections (ContractTable, BasisExposurePanel, ReconQueue)
```typescript
// Empty renders: flex-col items-center justify-center gap-3 px-6 py-12 text-center
// No icon prop needed for these sections (icon is optional)
// action prop not used in Phase 15 (navigation to Phase 13/14 routes handled elsewhere)
```

### Server-Side Role Gate (JSX conditional)
**Source:** CONTEXT.md D-05, D-07; guard.ts MarketingRole type
**Apply to:** `page.tsx` RSC for PositionStrip and BasisExposurePanel
```typescript
// Pattern: boolean flag derived from role string, used in JSX
const isOwner = role === 'owner'
// Then in JSX: {isOwner && <PositionStrip ... />}
// NOT: className="hidden" — financial sections must not be in the DOM for office role
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have sufficient analogs in the codebase |

The `GrainContract` / `GrainDelivery` TypeScript types referenced in the new components do not exist yet — they will be defined inline in each component or in a new `src/lib/marketing/types.ts`. The old `src/lib/marketing/types.ts` (SaleInstrument model) is deleted; the new types should be defined from the Prisma schema fields that organic-cert returns in its JSON responses.

---

## Files to Delete (no pattern needed — removal only)

Per CONTEXT.md Claude's Discretion and RESEARCH.md:

| File | Reason |
|------|--------|
| `src/components/marketing/marketing-workspace.tsx` | Tab-bar pattern retired (D-01) |
| `src/components/marketing/hedging-dashboard.tsx` | Old KpiStrip/ProgressBar composition replaced by new components |
| `src/components/marketing/commodity-table.tsx` | Old Supabase table (sale_instruments) — not used by new page |
| `src/components/marketing/instrument-form.tsx` | Old Supabase table (sale_instruments) — not used by new page |
| `src/components/marketing/variant-setup-panel.tsx` | Old Supabase table (crop_variants) — not used by new page |
| `src/components/marketing/crop-types-panel.tsx` | Old Supabase table — not used by new page |
| `src/components/marketing/what-if-panel.tsx` | Deferred to Phase 16 |
| `src/lib/marketing/queries.ts` | References sale_instruments, crop_variants, commodity_pricing Supabase tables |
| `src/lib/marketing/types.ts` | SaleInstrument / CbotPrice / YieldSummary / BudgetField types — replaced by GrainContract types |

**Before deleting portal `/api/marketing/` routes** (commodities, variants, instruments, contracts, commodity-pricing): grep entire portal for callers. Current marketing page.tsx imports `computeCommodityPositions` from `lib/marketing/queries.ts` (Supabase direct, not API routes) — the API routes may be legacy and uncalled. Grep first, then delete. See RESEARCH.md Pitfall 3.

---

## Metadata

**Analog search scope:** `src/app/(protected)/`, `src/components/marketing/`, `src/components/ui/`, `src/app/api/mobile/_lib/`, `src/lib/`
**Files read:** 17
**Pattern extraction date:** 2026-06-25
