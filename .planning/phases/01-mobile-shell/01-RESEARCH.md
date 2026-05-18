# Phase 1: Mobile Shell - Research

**Researched:** 2026-05-18
**Domain:** Next.js 14 App Router responsive layout, Tailwind CSS mobile-first, bottom navigation pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Navigation Pattern:** Bottom tab bar, always visible (no hide-on-scroll). 4 tabs: Home (dashboard) | Farm Info | Field Passes | More (overflow for remaining modules). "More" tab provides access to modules not in the main bar. Tab bar should feel like a native farm app — thumb-reachable, clear icons.
- **Layout Approach:** Stack and simplify — collapse multi-column desktop layouts to single column on mobile. Convert tables to card-based lists on small screens. Trimmed data on mobile: show key fields only, not full desktop detail. Role-based data restriction: budget/financial data hidden from crew roles on mobile; admins see everything. Link to desktop for full module detail when data is trimmed.
- **Iframe Module Fallback:** Embedded Express app modules (served via iframe) show a simple "This module works best on desktop" message on mobile. No preview or summary — just the message with guidance to use a computer. Claude to check codebase for which modules are iframe-embedded vs native React.
- **Mobile Identity:** Distinct mobile feel — lighter, simpler, feels like its own farm app (not just shrunken desktop portal). Reference: farm app tools like Climate FieldView, Farmbrite — clean, task-oriented. Minimal header: small logo + page title only — maximize screen space for content. Both dark and light theme supported (matches existing theme toggle). Same W. Hughes Farms branding, just adapted for mobile context.

### Claude's Discretion
- Exact breakpoint where mobile layout activates (375px viewport is the success criterion target)
- Icon choices for bottom tab bar
- Specific card component styling for table-to-card conversions
- How to implement role-based data trimming (component-level vs API-level filtering)
- Loading states and skeleton screens

### Deferred Ideas (OUT OF SCOPE)
- Dashboard content details (farm, acres, varieties, input rates as cards/sections) — Phase 3: Mobile Dashboard
- Field pass confirmation (manually enter or confirm completed field passes) — Phase 4: Field Data Entry
- Specific data to show on Farm Info and Field Passes tabs — Phase 3 discussion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Touch-friendly navigation with 44px+ tap targets that prevent mis-tapping | Bottom tab bar with `min-h-[56px]` items, SVG icons at 24px; `touch-manipulation` CSS prevents 300ms tap delay |
| UX-02 | Mobile-responsive layouts rendering correctly at 375px viewport without horizontal scroll | Tailwind `sm:` breakpoint for 640px+; all pages use `max-w-*` + `px-4`; iframe embeds conditionally replaced with fallback component at `md:` (768px) breakpoint |
</phase_requirements>

---

## Summary

The glomalin portal currently uses a desktop-first sidebar navigation (`side-nav.tsx`) that slides in over a hamburger trigger on mobile — this is a modal overlay pattern, not a mobile-native pattern. The sidebar requires `md:translate-x-0` to become visible on larger screens, and the content area uses `md:ml-[220px]` offset. On phones below 768px, users see only a small hamburger icon in the top-left; the nav is hidden behind it.

The protected layout (`(protected)/layout.tsx`) directly instantiates `SideNav` — no current mobile variant. The dashboard page and maps page use `fixed inset-0 md:left-[220px]` positioning that hardcodes the desktop sidebar offset. Any mobile layout work requires touching the protected layout, all pages that use hardcoded sidebar offsets, and the SideNav itself.

Of the 14 modules in `src/lib/modules.ts`, **6 are `type: 'embed'`** (farm-budget, grain-tickets, farm-registry, org-cert, meristem-malt, seed-inventory) and **8 are `type: 'native'`** (maps, weather, compliance, field-ops, marketing, field-history, enterprise-summary, field-timeline). The iframe fallback applies to all 6 embed modules. The `EmbedFrame` component uses `fixed` positioning referencing `var(--sidebar-w)` CSS variable, which means it must be updated for mobile.

The primary deliverable for this phase is: a new `MobileBottomNav` component, a `MobileHeader` component (minimal — logo + page title), and conditional rendering in `(protected)/layout.tsx` to serve the mobile shell vs desktop shell based on viewport.

**Primary recommendation:** Use a CSS-only media query breakpoint at `max-width: 767px` (below Tailwind `md:`) to switch between desktop shell (SideNav) and mobile shell (MobileBottomNav + MobileHeader). All changes are additive — the desktop layout is untouched.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.35 | App Router, SSR, routing | Already deployed |
| React | 18 | Component model | Already in use |
| TailwindCSS | 3.4.1 | Responsive utilities | Already configured with glomalin tokens |
| TypeScript | 5 | Type safety | Project standard |

### Supporting (already in project — no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `usePathname` (next/navigation) | — | Active tab detection in BottomNav | Bottom nav needs active state |
| localStorage | — | Theme/banner preferences | Already used for theme persistence |
| CSS Custom Properties (`--sidebar-w`, `--portal-header-h`) | — | Layout offset coordination | EmbedFrame and fixed-position pages depend on these |

### No new dependencies required

All required capabilities are already present. The project has TailwindCSS, Next.js App Router, and the `glomalin-*` color system. Do not add new UI libraries.

**Installation:** None required.

---

## Architecture Patterns

### Current Layout Architecture (what exists)

```
(protected)/layout.tsx
  └── SideNav (desktop: fixed left sidebar at 220px; mobile: hidden, hamburger toggled)
  └── <div className="md:ml-[220px]">   ← content offset
        └── <main> children             ← page content
```

Pages with hardcoded sidebar assumptions:
- `dashboard/page.tsx`: `fixed inset-0 md:left-[220px]` (FieldMap full viewport)
- `app/maps/page.tsx`: `fixed top-0 bottom-0 right-0 left-[220px]` (hardcoded, not responsive)
- `embed-frame.tsx`: `fixed right-0 bottom-0` with `left: var(--sidebar-w, 220px)` and `top: var(--embed-breadcrumb-h, 36px)`

### Target Layout Architecture (after this phase)

```
(protected)/layout.tsx
  ├── [on md+] SideNav (unchanged — 220px sidebar)
  │   └── <div className="md:ml-[220px]"> children
  │
  └── [on <md] MobileHeader (sticky top, minimal — logo + page title)
      └── <div className="pb-[56px]">     ← padding for bottom nav height
            └── children
      └── MobileBottomNav (fixed bottom, 4 tabs + More)
```

### Pattern 1: Responsive Layout Switch via Tailwind `md:` breakpoint

**What:** The protected layout renders both shells; CSS hides the appropriate one per viewport. This avoids JS-based media query hooks (which cause SSR hydration mismatches).

**When to use:** Server component layouts. CSS-only toggle is SSR-safe.

**Example:**
```tsx
// src/app/(protected)/layout.tsx
return (
  <div className="bg-glomalin-bg">
    {/* Desktop sidebar — hidden on mobile */}
    <div className="hidden md:block">
      <SideNav user={...} grantedModules={...} />
    </div>
    
    {/* Mobile header — visible on mobile only */}
    <div className="md:hidden">
      <MobileHeader />
    </div>

    {/* Content area — offset on desktop, padded on mobile */}
    <div className="md:ml-[220px] pb-[56px] md:pb-0">
      <Suspense fallback={null}><DeniedToast /></Suspense>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>

    {/* Mobile bottom nav — visible on mobile only */}
    <div className="md:hidden">
      <MobileBottomNav user={...} grantedModules={...} />
    </div>
  </div>
)
```

### Pattern 2: MobileBottomNav Component Structure

**What:** Fixed-position 4-tab bar at bottom of screen. Always visible (no hide-on-scroll per locked decision). "More" opens a slide-up sheet with remaining modules.

**When to use:** Mobile viewport only (`md:hidden` wrapper in layout).

**Example:**
```tsx
// src/components/layout/mobile-bottom-nav.tsx
'use client'

const MAIN_TABS = [
  { label: 'Home',        href: '/dashboard',          icon: HomeIcon },
  { label: 'Farm Info',   href: '/app/field-history',  icon: FieldIcon },
  { label: 'Field Passes',href: '/app/field-ops',      icon: CheckIcon },
  { label: 'More',        action: 'more',              icon: GridIcon },
]

// Each tab item: min-h-[56px], flex-1, touch-manipulation
// Icon: 24px SVG
// Label: text-[10px] font-mono
```

### Pattern 3: "More" Overflow Sheet

**What:** Tapping "More" opens a slide-up panel listing all remaining accessible modules. Not a route change — a sheet overlay using `useState`.

**When to use:** Any module not in the 4 primary tabs.

**Implementation approach:** `useState(false)` for open state. `fixed inset-x-0 bottom-0 z-50` panel with `translate-y` transition. Backdrop div closes on tap. List items are `<Link>` elements that close the sheet on navigation.

### Pattern 4: Iframe Module Mobile Fallback

**What:** When a module is `type: 'embed'`, the page detects mobile and renders a fallback message instead of `<EmbedFrame>`.

**Implementation options (two valid approaches):**

Option A — CSS-only (recommended for simplicity):
```tsx
// In [module]/page.tsx for embed type
<>
  {/* Mobile fallback */}
  <div className="md:hidden flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
    <p className="text-glomalin-text font-mono text-sm mb-2">{mod.label}</p>
    <p className="text-glomalin-muted font-mono text-xs">
      This module works best on desktop.
    </p>
    <p className="text-glomalin-muted font-mono text-xs mt-1">
      Open portal.whughesfarms.com on a computer for full access.
    </p>
  </div>
  {/* Desktop iframe */}
  <div className="hidden md:block">
    <EmbedBreadcrumb ... />
    <EmbedFrame ... />
  </div>
</>
```

Option B — server-side detection via User-Agent (not recommended — unreliable, stale UA strings, complicates SSR).

Use Option A. CSS toggle is the correct approach here.

### Pattern 5: Table-to-Card Conversion (for enterprise-summary, compliance, field-history)

**What:** Tables that scroll horizontally on desktop become stacked cards on mobile showing only key fields.

**Example (enterprise-summary has a 10-column table):**
```tsx
{/* Mobile card view */}
<div className="md:hidden space-y-2">
  {entRows.map((row) => (
    <div key={row.fieldName} className="bg-glomalin-surface border border-glomalin-border rounded p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-glomalin-text">{row.fieldName}</span>
        <span className="text-xs text-glomalin-muted">{row.acres.toFixed(1)} ac</span>
      </div>
      <div className="flex gap-4 text-xs text-glomalin-muted">
        <span>Cost: {fmt(row.totalCostPerAcre)}/ac</span>
        {row.revenuePerAcre != null && <span>Rev: {fmt(row.revenuePerAcre)}/ac</span>}
      </div>
    </div>
  ))}
</div>
{/* Desktop table */}
<div className="hidden md:block overflow-x-auto rounded border border-glomalin-border">
  {/* existing <table> ... */}
</div>
```

### Pattern 6: Fixed-Position Pages (maps, dashboard) on Mobile

**What:** `maps/page.tsx` hardcodes `left-[220px]` (no responsive fallback). `dashboard/page.tsx` uses `md:left-[220px]` correctly. Maps needs a fix.

**Fix for maps page:**
```tsx
// Before: className="fixed top-0 bottom-0 right-0 left-[220px]"
// After:
<div className="fixed top-0 bottom-0 right-0 left-0 md:left-[220px]">
```

**EmbedFrame CSS variable:** The `--sidebar-w` CSS variable is set in `side-nav.tsx`'s useEffect to `220px`. On mobile, this variable should be `0px`. The `MobileBottomNav` component should set `--sidebar-w` to `0px` in a matching useEffect. However, since `EmbedFrame` is wrapped in the `md:hidden`/`hidden md:block` pattern (Pattern 4), it will only render on desktop where `--sidebar-w` is already `220px`. No additional fix needed for EmbedFrame itself.

### Anti-Patterns to Avoid

- **JS-based viewport detection at render time:** Using `window.innerWidth` in server components causes hydration mismatches. Use Tailwind responsive classes instead.
- **`useMediaQuery` hook for layout switching:** Causes layout shift after hydration (SSR renders desktop, then switches to mobile). CSS-only responsive classes don't have this problem.
- **Hiding sidebar with `display:none` in JS:** The SideNav already handles mobile via `md:translate-x-0`. Wrapping it in `hidden md:block` is cleaner and avoids double rendering of nav state.
- **Putting bottom nav inside the scrolling content area:** It must be `fixed` or `sticky` at the bottom of the viewport, outside `<main>`. The `pb-[56px]` on the content wrapper prevents content being hidden behind it.
- **48px touch targets (iOS minimum is 44px, aim for 48-56px):** Use `min-h-[56px]` for bottom tab items to comfortably exceed the 44px requirement from UX-01.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive class switching | Custom media query hooks | Tailwind `md:hidden` / `hidden md:block` | SSR-safe, no hydration mismatch, already configured |
| Slide-up sheet animation | CSS keyframes from scratch | `translate-y-full` → `translate-y-0` via `transition-transform duration-200` — already used by SideNav | Consistent with existing animation pattern |
| Icon set | Custom SVG library | Inline SVG (consistent with existing codebase pattern — see SideNav hamburger, NavItem indicators) | No new dependency, matches project conventions |
| Mobile breakpoint | Custom breakpoint | Use `md:` (768px) — already the breakpoint SideNav uses for `md:translate-x-0` and `md:ml-[220px]` | Consistency with existing responsive logic |

**Key insight:** The existing codebase already uses Tailwind `md:` for the only responsive behavior it has (sidebar slide-in). Building the mobile shell using the same breakpoint keeps the system coherent.

---

## Common Pitfalls

### Pitfall 1: The maps page hardcodes `left-[220px]` without responsive fallback

**What goes wrong:** On a 375px phone, `left-[220px]` makes the map start 220px in from the left, leaving only 155px of visible map width.
**Why it happens:** The maps page was written assuming the sidebar is always present.
**How to avoid:** Change to `left-0 md:left-[220px]` in `maps/page.tsx`.
**Warning signs:** Map appears cropped on the left on small screens.

### Pitfall 2: Bottom nav padding is insufficient — content hidden behind nav bar

**What goes wrong:** The last item in a scrollable list is hidden behind the 56px bottom nav bar.
**Why it happens:** Fixed-position elements don't push document flow.
**How to avoid:** Add `pb-[56px] md:pb-0` to the content wrapper div in the protected layout.

### Pitfall 3: Hydration mismatch from JS viewport detection

**What goes wrong:** Server renders desktop layout, client switches to mobile — React throws hydration error or shows flash of wrong layout.
**Why it happens:** `window.innerWidth` is undefined on server.
**How to avoid:** Use CSS-only `md:hidden` / `hidden md:block` responsive classes. Never use `useMediaQuery` for structural layout switching.

### Pitfall 4: More sheet blocks interaction with content behind it

**What goes wrong:** The "More" sheet overlay doesn't capture taps on the backdrop, so users can't dismiss it by tapping outside.
**Why it happens:** Missing click-outside handler or backdrop element.
**How to avoid:** Add a full-screen backdrop `<div className="fixed inset-0 z-40 bg-black/50" onClick={close} />` rendered when the sheet is open, below the sheet's `z-50`.

### Pitfall 5: `--portal-header-h` CSS variable not updated for mobile

**What goes wrong:** `top-bar.tsx` sets `--portal-header-h` based on the banner height. On mobile, the `MobileHeader` height is different (~56px, no banner). If pages reference this variable for positioning, they'll be off.
**Why it happens:** Two headers now exist (TopBar was the old design; SideNav is the current design). Checking: `side-nav.tsx` sets `--portal-header-h` to `0px`. So the portal currently uses `0px` for this value. The `MobileHeader` should keep setting it to `0px` (or not set it at all) to avoid affecting pages that reference it.
**How to avoid:** `MobileHeader` sets `--portal-header-h: 0px` via CSS or does not touch it. The `pb-[56px]` bottom padding on the content wrapper handles clearance for the bottom nav.

### Pitfall 6: EmbedFrame CSS variable `--sidebar-w` on mobile

**What goes wrong:** `EmbedFrame` uses `left: var(--sidebar-w, 220px)` in its fixed positioning. On mobile, if an embed module somehow renders (should not with Pattern 4), the frame would start at 220px from the left.
**Why it happens:** CSS variable fallback is `220px`.
**How to avoid:** The `hidden md:block` wrapper on EmbedFrame (Pattern 4) means it never renders on mobile. Belt-and-suspenders: `MobileBottomNav` can set `--sidebar-w: 0px` in its mount effect. SideNav already sets it to `220px` on mount, so the two components never conflict (one renders, not both).

### Pitfall 7: enterprise-summary table is 10 columns wide — unscrollable on 375px

**What goes wrong:** The table in `enterprise-summary/page.tsx` has 10 columns. On a 375px phone, the `overflow-x-auto` container allows horizontal scroll but the UX is poor, and the success criterion says "no horizontal scrolling."
**Why it happens:** Table was designed for desktop.
**How to avoid:** Implement Pattern 5 (table-to-card) for this page specifically. Show only Field, Crop, Total Cost/ac on mobile. Link to desktop note per locked decision.

---

## Iframe vs Native Module Inventory

This is the "Claude to check codebase" item from the locked decisions. Source: `src/lib/modules.ts`.

**Embed modules (need fallback on mobile — 6 total):**
| Module ID | Label | Embed Key |
|-----------|-------|-----------|
| `farm-budget` | Enterprise Planner | FARM_BUDGET |
| `grain-tickets` | Grain Tickets | GRAIN_TICKETS |
| `farm-registry` | Farm Registry | FARM_REGISTRY |
| `org-cert` | Organic Cert | ORG_CERT |
| `meristem-malt` | Meristem Malt | MERISTEM_MALT |
| `seed-inventory` | Input Receiving | SEED_INVENTORY |

All 6 are served from `src/app/(protected)/app/[module]/page.tsx` (the dynamic embed router). The fallback is applied once in that file, not 6 separate places.

**Native modules (need mobile layout — 8 total):**
| Module ID | Label | Current Mobile Issues |
|-----------|-------|-----------------------|
| `maps` | Field Map | `left-[220px]` hardcoded — fix to `left-0 md:left-[220px]` |
| `weather` | Precipitation | Uses `p-4 md:p-6 max-w-*` — likely adequate, verify |
| `compliance` | Compliance | Uses tab UI — verify tab targets are 44px+ |
| `field-ops` | Field Ops TC Log | Unknown — needs check |
| `marketing` | Grain Marketing | Unknown — needs check |
| `field-history` | Field History | Already uses card pattern (`Link` cards) — likely adequate |
| `enterprise-summary` | Enterprise Summary | 10-col table — needs card conversion (Pattern 5) |
| `field-timeline` | Field Timeline | Unknown — needs check |

**Dashboard (special case):**
- `dashboard/page.tsx` renders `FieldMap` at `fixed inset-0 md:left-[220px]` — the `md:left-[220px]` is already responsive. The mobile bottom nav pushes no padding problem since it's fixed-position full-bleed. The bottom `pb-[56px]` pattern does not apply to fixed-position full-bleed pages. Instead, the FieldMap should know about the bottom nav height. Approach: the FieldMap can use `bottom: 56px` on mobile via a CSS variable `--mobile-nav-h: 56px` set by MobileBottomNav, or simply accept that the bottom of the map is behind the nav bar (acceptable for a map where the nav overlaps).

---

## Code Examples

Verified patterns from codebase:

### Existing responsive class pattern (from SideNav)
```tsx
// Source: src/components/layout/side-nav.tsx
// Mobile: -translate-x-full (hidden)
// Desktop (md+): translate-x-0 (visible)
className={[
  'fixed left-0 inset-y-0 z-50 w-[220px] flex flex-col',
  mobileOpen ? 'translate-x-0' : '-translate-x-full',
  'md:translate-x-0',  // ← always visible on md+
].join(' ')}
```

### CSS variable set on mount (existing pattern)
```tsx
// Source: src/components/layout/side-nav.tsx
useEffect(() => {
  document.documentElement.style.setProperty('--sidebar-w', '220px')
  document.documentElement.style.setProperty('--portal-header-h', '0px')
}, [])
```

### EmbedFrame CSS variable dependency
```tsx
// Source: src/components/embed-frame.tsx
<div className="fixed right-0 bottom-0"
  style={{ top: 'var(--embed-breadcrumb-h, 36px)', left: 'var(--sidebar-w, 220px)' }}>
```

### Touch target minimum — Tailwind
```tsx
// Pattern: min-h-[56px] items-center flex — exceeds 44px UX-01 requirement
<button className="flex flex-col items-center justify-center flex-1 min-h-[56px] touch-manipulation">
```

### glomalin design tokens available
```tsx
// All these work in Tailwind classes:
// bg-glomalin-bg, bg-glomalin-surface, border-glomalin-border
// text-glomalin-text, text-glomalin-muted, text-glomalin-accent
// font-mono (JetBrains Mono)
// Source: src/lib/tokens.ts + tailwind.config.ts
```

### Role check pattern (existing — for role-based data trimming)
```tsx
// Source: src/app/(protected)/layout.tsx
const role = profile?.role ?? 'viewer'
// Pass role as prop to components; component conditionally renders financial data
// Pattern: {role === 'admin' && <FinancialRow ... />}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hamburger menu (current) | Bottom tab bar (this phase) | Phase 1 | Mobile nav becomes thumb-reachable and always visible |
| Tables on all viewports | Tables on desktop, cards on mobile | Phase 1 | enterprise-summary, compliance become usable on 375px |
| IFrame full-height (current) | Desktop iframe + mobile fallback message | Phase 1 | Embed modules no longer break on mobile |
| Hardcoded `left-[220px]` in maps | `left-0 md:left-[220px]` | Phase 1 | Maps page fills full width on mobile |

---

## Open Questions

1. **Does `compliance/page.tsx` have any layout issues on mobile?**
   - What we know: It renders `ComplianceShell` (a client component in `src/components/compliance/`). We have not inspected that component.
   - What's unclear: Whether ComplianceShell has any hardcoded widths, multi-column grids, or tabs with small touch targets.
   - Recommendation: Plan should include a task to audit all 8 native module pages and identify which need card conversion vs are already single-column.

2. **Which 2 modules should be "Farm Info" and "Field Passes" tabs?**
   - What we know: The CONTEXT.md names these tab labels. Field Passes maps to `field-ops` (Field Ops TC Log). Farm Info likely maps to `field-history` or `maps`.
   - What's unclear: Exact module routes for the 2nd and 3rd tabs.
   - Recommendation: Plan should treat this as Claude's discretion: Farm Info = `/app/field-history`, Field Passes = `/app/field-ops`. These are the modules most relevant to daily farm team use (per CONTEXT.md specifics section).

3. **Does the `observations` module need mobile treatment?**
   - What we know: `src/app/(protected)/app/observations/` exists (from Phase 4 work) and is `type: 'native'`.
   - What's unclear: It's not in `MODULES` array in `modules.ts` — it may be a standalone route not listed in the nav. It also may already be mobile-first (it was built as a field-entry tool in Phase 4).
   - Recommendation: Do not include observations in the bottom nav; it's accessed through a different flow. Confirm it renders correctly at 375px as a low-priority check.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/components/layout/side-nav.tsx`, `src/components/layout/top-bar.tsx`, `src/components/embed-frame.tsx`
- Direct codebase inspection — `src/lib/modules.ts` (authoritative module/embed type list)
- Direct codebase inspection — `src/app/(protected)/layout.tsx` (current layout structure)
- Direct codebase inspection — `src/app/(protected)/app/maps/page.tsx`, `dashboard/page.tsx` (hardcoded sidebar offsets)
- Direct codebase inspection — `src/app/(protected)/app/enterprise-summary/page.tsx` (10-column table confirmed)
- Direct codebase inspection — `src/app/(protected)/app/[module]/page.tsx` (single embed router handles all 6 embed modules)
- Direct codebase inspection — `tailwind.config.ts`, `src/lib/tokens.ts` (design tokens, breakpoints)

### Secondary (MEDIUM confidence)
- WCAG 2.5.5 target size: 44x44px minimum — confirmed by Apple HIG and Android Material Design specs
- CSS `touch-action: manipulation` prevents 300ms tap delay on mobile browsers — well-established browser behavior

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection or stable specifications

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly inspected package.json; no new dependencies needed
- Architecture patterns: HIGH — directly inspected current layout code; proposed patterns follow existing conventions
- Iframe vs native inventory: HIGH — directly read modules.ts; all 14 modules catalogued
- Common pitfalls: HIGH — identified from direct code inspection (hardcoded offsets, missing responsive class)
- Touch target recommendations: HIGH — WCAG 2.5.5 + Apple HIG are stable published specs

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (codebase is stable, no fast-moving deps)
