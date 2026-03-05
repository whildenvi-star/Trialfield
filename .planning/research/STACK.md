# Stack Research

**Domain:** v6.0 FSA Acres, Insurance & Claims — card-based field workflow, heat map coverage comparison, payout scenario simulator, Kanban claims pipeline, document upload, deadline tracking
**Researched:** 2026-03-04
**Confidence:** HIGH for all additions (verified against npm registry, official docs, and multiple community sources)

---

## Context: What Already Exists (Do NOT Re-research)

All additions are inside `glomalin-portal/` (Next.js 14.2.35 + Supabase). Nothing is installed yet beyond the scaffold packages below.

| Already Present | Version | Do Not Re-add |
|-----------------|---------|---------------|
| `next` | 14.2.35 | App Router, Server Components, Route Handlers |
| `@supabase/supabase-js` | ^2.98.0 | Auth, DB queries, RLS, Storage API |
| `@supabase/ssr` | ^0.9.0 | SSR cookie handling for auth |
| `@xyflow/react` | ^12.10.1 | Node map on landing page — do not add again |
| `react` / `react-dom` | ^18 | Already installed |
| `tailwindcss` | ^3.4.1 | Dark soil palette already configured |
| `typescript` | ^5 | Already configured |

**What EXISTS in other modules (do NOT add to portal):**
- `@react-pdf/renderer` 4.3.2 — already in `organic-cert/`, patterns are available to copy, but this IS needed in `glomalin-portal/` for the FSA-578 PDF export (new install required there)
- `Chart.js` — in `grain-tickets/` vanilla JS app only, not available in portal
- `shadcn/ui` / Radix UI — NOT yet installed in `glomalin-portal/` (only in `organic-cert/`); needs fresh install

---

## Recommended Stack — New Additions Only

### Core UI Components (Install First — Everything Depends On This)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `shadcn/ui` (CLI) | latest | Component library via CLI scaffolding | shadcn generates owned source code — no runtime dependency. Already proven in organic-cert. Radix primitives + Tailwind = perfect fit for dark soil aesthetic. Provides Card, Dialog, Badge, Checkbox, Select, Popover out of the box. |
| `@radix-ui/react-slider` | ^1.2.x | Range slider for payout scenario simulator | Ships inside shadcn/ui as `Slider` component. Accessible, keyboard-navigable, Tailwind-styled. Used for coverage level (65–85%) and price sliders in the insurance decision tool. No separate install needed after shadcn init. |

### Charting & Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `recharts` | ^3.4.1 | Line charts (historical performance), bar charts (premium vs indemnity), area charts (yield trends) | 13.8M weekly downloads — dominant React charting library. SVG-based, fully composable, simple `"use client"` wrapper pattern for Next.js 14 App Router. Fits dark soil Tailwind palette via `stroke`/`fill` props. Lighter than Nivo for straightforward chart types. |
| `@nivo/heatmap` | ^0.99.0 | Coverage level comparison matrix (rows = crops, columns = coverage %, cells = dollar guarantee or premium cost) | Nivo's heatmap is the only React-native library that renders a true color-scaled matrix without D3 configuration overhead. The `@nivo/heatmap` package is standalone — no need to install all of Nivo. Canvas rendering option available for performance. Requires `"use client"`. |

### Drag-and-Drop (Kanban Claims Pipeline)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@dnd-kit/core` | ^6.3.1 | DndContext, DragOverlay, collision detection for the claims Kanban | Most actively maintained React DnD library in 2025. Lightweight, accessible (keyboard DnD), touch-enabled for tablet use. Works in Next.js 14 App Router with `"use client"`. No React 18 concurrent mode conflicts. |
| `@dnd-kit/sortable` | ^10.0.0 | SortableContext, useSortable hook — card ordering within a Kanban column | Ships separately, handles the within-column sort and cross-column move patterns. Multi-container Kanban is the documented primary use case. |
| `@dnd-kit/utilities` | ^3.2.2 | CSS.Transform helper for drag-in-progress visual transforms | Small utility package bundled with dnd-kit. Required for smooth drag animation. |

### Animation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `framer-motion` | ^12.x | Card entrance animations, Kanban column transitions, sidebar slide-in, toast animations | The standard React animation library in 2025 (12.34.5+ on npm). Works in Next.js 14 with `"use client"` directive on animated components. Use `template.tsx` for page transitions (not AnimatePresence, which has App Router incompatibility). Scope to micro-interactions: card mount/unmount, drag overlay, modal open/close. |

### Document Upload (Claims Evidence)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-dropzone` | ^14.2.3 | Drag-and-drop file upload zone for claims documents (PDFs, photos, adjuster reports) | 14.2.3 is current. Pairs directly with Supabase Storage `.upload()` API — the standard pattern for Next.js 14 + Supabase document management. Minimal setup, accessible, handles multiple file types and size validation. No Uppy/Tus needed for document uploads of this scale. |

### PDF Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@react-pdf/renderer` | ^4.3.2 | FSA-578 print-ready form layout export | Already proven in `organic-cert/` for multi-section government form PDFs. The FSA-578 is a structured form with field/crop/acre tables — same pattern as NOP inspection reports. Install fresh in `glomalin-portal/` alongside the existing install in `organic-cert/`. |

### Date Utilities

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `date-fns` | ^4.1.0 | Deadline calculations (days until sign-up deadline, APH submission window), date formatting throughout | Already installed in `organic-cert/` at 4.1.0. Pure functions, tree-shakable, no global state. Essential for claims deadline alerts: `differenceInDays(deadline, today)`, `isAfter()`, `format()`. Install fresh in `glomalin-portal/`. |

---

## Installation

```bash
cd /Users/glomalinguild/Desktop/my-project-one/glomalin-portal

# 1. shadcn/ui init (run interactively — choose "dark" theme, confirm tailwind.config.ts paths)
npx shadcn@latest init

# 2. shadcn components used across v6.0 features
npx shadcn@latest add card badge checkbox select dialog popover slider tooltip separator

# 3. Charting
npm install recharts @nivo/heatmap

# 4. Drag-and-drop (Kanban claims board)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 5. Animation
npm install framer-motion

# 6. Document upload
npm install react-dropzone

# 7. PDF export (FSA-578)
npm install @react-pdf/renderer

# 8. Date utilities
npm install date-fns
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `recharts` | `nivo` (full package) | Use Nivo if you need >5 chart types with shared theming and server-side rendering. Recharts is simpler for the 3-4 chart types needed here (line, bar, area). |
| `recharts` | `chart.js` (existing in grain-tickets) | Chart.js is vanilla JS in grain-tickets — not React-compatible in portal. Do not attempt to bridge it. |
| `recharts` | `victory` | Victory has better React Native support but 13M fewer weekly downloads. Overkill for this use case. |
| `@nivo/heatmap` | `recharts` for heat map | Recharts has no native heatmap/matrix chart type. D3 custom rendering is the only alternative and adds 400+ lines of custom code. Nivo's heatmap is the correct tool. |
| `@nivo/heatmap` | `visx` (Airbnb D3 primitives) | visx requires building the entire chart from scratch with D3 primitives. Correct for custom data viz teams, wrong for a 4-person farm office app with one developer. |
| `@dnd-kit/core` | `react-beautiful-dnd` | react-beautiful-dnd was deprecated in 2022, archived on GitHub August 2025, and now shows npm install warnings. Do not use it. |
| `@dnd-kit/core` | `pragmatic-drag-and-drop` (Atlassian) | Headless and framework-agnostic — excellent for complex use cases. dnd-kit has better React-specific ergonomics and stronger Kanban examples for this use case. |
| `framer-motion` | CSS Transitions only | CSS transitions are sufficient for hover states and simple fades. Framer Motion is only worth adding if you need layout animations (card moves between columns) and spring physics on drag overlay. It is worth it here specifically for the Kanban board and card grid. |
| `react-dropzone` | Uppy + Tus | Uppy/Tus is correct for large file resumable uploads (videos, 100MB+ files). Claims documents are PDFs and photos under 10MB — react-dropzone + Supabase Storage direct upload is simpler and sufficient. |
| `@react-pdf/renderer` | Puppeteer HTML-to-PDF | Puppeteer spawns a headless browser in a Route Handler — adds 200MB+ to server process. @react-pdf/renderer renders synchronously in <2s for a structured form like FSA-578. |
| `date-fns` | `dayjs` | dayjs is slightly smaller but date-fns is already in the ecosystem (organic-cert). Consistency across the monorepo matters more than 5KB bundle savings. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Officially deprecated, GitHub repo archived August 2025, npm shows deprecation warning on install. Dead code. | `@dnd-kit/core` + `@dnd-kit/sortable` |
| `Chart.js` (from grain-tickets) | It is a vanilla JS library imported in grain-tickets' Express SPA. No React component API. Cannot be used in glomalin-portal's Next.js 14 App Router. | `recharts` for standard charts, `@nivo/heatmap` for matrix |
| `@xyflow/react` for the coverage matrix | React Flow is for node graphs, not data matrices. Misusing it for a heat map would require fighting the library. | `@nivo/heatmap` |
| AnimatePresence for page transitions | Known incompatibility with Next.js 14 App Router due to how App Router renders pages. Use `template.tsx` pattern instead for page-level transitions. | `motion.div` inside `template.tsx` |
| `d3` (raw) | Raw D3 directly manipulates the DOM via `useEffect` + `useRef` — at odds with React's virtual DOM. Only appropriate if you need a truly custom viz that no React-wrapped library covers. The heatmap does not require it. | `@nivo/heatmap` |
| `react-query` / `swr` for claims data | These are client-side caching libraries. Supabase's real-time subscriptions and Next.js Server Actions handle data fetching patterns in this portal. Adding a separate data-fetching layer creates two competing patterns. | Supabase client in Server Components + Server Actions |
| Full `@nivo/core` or `nivo` meta-package | Installing all of Nivo adds ~800KB to the bundle for chart types you will never use. Install only `@nivo/heatmap`. | `npm install @nivo/heatmap` (standalone) |

---

## Stack Patterns by Feature

**FSA Card Grid (bulk CLU assignment, templates):**
- shadcn `Card` + Tailwind `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4` for responsive CLU cards
- shadcn `Checkbox` on each card for bulk selection state (React `useState` with Set)
- shadcn `Select` for template application dropdown
- Framer Motion `AnimatePresence` + `layout` prop for card entrance/exit during filter changes
- NO dnd-kit needed here — cards are not reorderable, only selectable and assignable

**Insurance Heat Map (coverage level comparison matrix):**
- `@nivo/heatmap` with custom `"use client"` wrapper component
- Rows = crop types, Columns = coverage levels (65%, 70%, 75%, 80%, 85%)
- Cell values = dollar guarantee or net premium cost (user toggle)
- Color scale: green (favorable) to red (expensive/low coverage) using Nivo's sequential color scheme
- Tooltip: hover shows exact values for that crop × coverage combination

**Payout Scenario Simulator (RP/RP-HPE/YP sliders):**
- shadcn `Slider` (Radix UI primitive) for yield shortfall %, spring price, fall price inputs
- `recharts` `AreaChart` for the real-time payout curve as slider values change
- All calculations in pure TypeScript — no library needed for MPCI/ARC/PLC math
- React `useMemo` to debounce recalculation on slider movement

**Claims Kanban Board:**
- `@dnd-kit/core` `DndContext` + `@dnd-kit/sortable` `SortableContext` for the board
- Wrap DndContext in a `"use client"` component; fetch claim data via Server Action, pass as prop
- `DragOverlay` for the card-follows-cursor visual while dragging
- Column IDs map directly to Supabase `claims.status` enum: `filed | under_review | adjuster_assigned | approved | paid | denied`
- On `onDragEnd`: optimistic UI update → Supabase `.update({ status: newColumn })` → revert on error
- Framer Motion `layout` on claim cards for smooth column-change animation

**Document Upload (Claims Evidence):**
- `react-dropzone` `useDropzone()` hook for drop zone UI
- On drop: `supabase.storage.from('claim-documents').upload(path, file)`
- File path pattern: `claims/{claimId}/{timestamp}-{filename}`
- Store file metadata (name, size, type, storage path, uploaded_by) in `claim_documents` Supabase table
- RLS: users can only read documents for claims they have access to

**Deadline Tracking (FSA sign-up, APH submission, claim filing windows):**
- `date-fns` `differenceInDays(deadline, today)` → derive urgency badge color
- Urgency levels: >30 days = gray, 8–30 days = amber, ≤7 days = red pulsing badge
- Deadline data stored in Supabase `insurance_deadlines` table with `crop_year`, `deadline_type`, `due_date`, `notes`
- shadcn `Badge` with Tailwind color variants for the urgency display

---

## Version Compatibility

| Package | Version | Compatibility Notes |
|---------|---------|---------------------|
| `recharts` | ^3.4.1 | Requires `"use client"` directive in Next.js 14. `ResponsiveContainer` requires a parent element with explicit height. Server Components can pass data to Recharts chart wrappers — only the chart component itself must be client-side. |
| `@nivo/heatmap` | ^0.99.0 | Requires `"use client"`. Known issue: Next.js 13+ throws `createContext` error without `"use client"` — wrapping in a client boundary component resolves this. Canvas version (`ResponsiveHeatMapCanvas`) performs better for matrices over 10×10. |
| `@dnd-kit/core` | ^6.3.1 | Works in Next.js 14 App Router. Known hydration mismatch on SSR: use `dynamic(() => import('./KanbanBoard'), { ssr: false })` or wrap DndContext with a `mounted` state check to avoid mismatches. |
| `@dnd-kit/sortable` | ^10.0.0 | Requires `@dnd-kit/core` peer dependency. Install both together. |
| `framer-motion` | ^12.x | Works with Next.js 14. Do NOT use `AnimatePresence` for route transitions in App Router (known issue). Use `motion` components inside `template.tsx` or individual client component files instead. |
| `react-dropzone` | ^14.2.3 | Requires `"use client"`. No known Next.js 14 incompatibilities. |
| `@react-pdf/renderer` | ^4.3.2 | Run server-side only in Route Handlers (never in client components). React 18 compatible. Set `Content-Type: application/pdf` and `Content-Disposition: attachment` response headers in the Route Handler. |
| `date-fns` | ^4.1.0 | Full ESM support. Tree-shakable. Import only functions used: `import { differenceInDays, format, isAfter } from 'date-fns'`. No global state. |
| `shadcn/ui` | latest CLI | Generates components into `src/components/ui/`. Run `npx shadcn@latest init` before adding individual components. Components are owned source — update them with `npx shadcn@latest add [component]` not npm. |

---

## Supabase Schema Additions Required

The following new tables are needed in Supabase (not in the v5.0 schema):

```sql
-- FSA CLU records (replaces fsa-acres Express JSON)
create table clu_records (
  id uuid primary key default gen_random_uuid(),
  farm_number text not null,
  tract_number text,
  clu_number text not null,
  crop text,
  intended_use text,
  fsa_acres numeric(8,2),
  reported_acres numeric(8,2),
  practice text,
  crop_year int not null default 2026,
  status text default 'pending',  -- pending | complete | flagged
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FSA planting templates (bulk assignment)
create table fsa_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crop text not null,
  intended_use text,
  practice text,
  coverage_level numeric(4,1),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Insurance policies (replaces fsa-acres insurance.js JSON)
create table insurance_policies (
  id uuid primary key default gen_random_uuid(),
  policy_number text,
  line_number text,
  farm_name text,
  farm_number text,
  crop text not null,
  policy_year int not null,
  unit_type text,
  coverage_level numeric(4,1),
  plan_type text,  -- RP | RP-HPE | YP
  planted_acres numeric(8,2),
  guarantee numeric(8,2),
  actual_yield numeric(8,2),
  premium_per_acre numeric(8,2),
  agent_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insurance deadlines
create table insurance_deadlines (
  id uuid primary key default gen_random_uuid(),
  deadline_type text not null,  -- signup | aph_submission | claim_filing
  crop_year int not null,
  due_date date not null,
  crop text,
  notes text,
  created_at timestamptz default now()
);

-- Claims lifecycle
create table claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id),
  claim_number text,
  status text not null default 'filed',
  -- filed | under_review | adjuster_assigned | approved | paid | denied
  loss_type text,
  loss_date date,
  reported_date date,
  adjuster_name text,
  adjuster_phone text,
  estimated_loss numeric(10,2),
  approved_amount numeric(10,2),
  paid_date date,
  filing_deadline date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Claim documents (files in Supabase Storage)
create table claim_documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  file_name text not null,
  file_size int,
  file_type text,
  storage_path text not null,  -- path in supabase storage bucket
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

RLS policies follow the same pattern as `module_access` from v5.0: check that the requesting user's profile has access to the `fsa-reporting` module grant.

---

## Sources

- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/package.json` — Confirmed exact existing dependencies. HIGH confidence.
- WebSearch: recharts 3.4.1 confirmed latest, `"use client"` pattern for Next.js 14 App Router confirmed. MEDIUM confidence (npm, multiple community sources).
- WebSearch: @nivo/heatmap 0.99.0 confirmed latest, `createContext` SSR error pattern and `"use client"` fix confirmed via GitHub issues. HIGH confidence.
- WebSearch: @dnd-kit/core 6.3.1 and @dnd-kit/sortable 10.0.0 confirmed latest versions, Kanban multi-container pattern with Next.js App Router confirmed. HIGH confidence (official docs + community).
- WebSearch: react-beautiful-dnd confirmed officially deprecated (GitHub archived August 2025). HIGH confidence.
- WebSearch: framer-motion 12.x confirmed latest (12.34.5), `"use client"` pattern confirmed, AnimatePresence page transition incompatibility with App Router confirmed. HIGH confidence.
- WebSearch: react-dropzone 14.2.3 confirmed latest, Supabase Storage integration pattern confirmed via official Supabase docs. HIGH confidence.
- WebSearch: @react-pdf/renderer v4.x in organic-cert confirmed, same library appropriate for FSA-578 PDF. HIGH confidence (existing codebase evidence).
- WebSearch: date-fns v4.1.0 confirmed current, ESM-first, Next.js compatible. HIGH confidence.
- `https://supabase.com/ui/docs/nextjs/dropzone` — Official Supabase Next.js dropzone pattern confirmed. HIGH confidence.
- `https://nivo.rocks/heatmap/` — Nivo heatmap API and Canvas variant confirmed. HIGH confidence.
- `https://docs.dndkit.com/introduction/installation` — dnd-kit official installation docs confirm package list. HIGH confidence.

---

*Stack research for: v6.0 FSA Acres, Insurance & Claims — glomalin-portal Next.js 14 + Supabase additions only*
*Researched: 2026-03-04*
