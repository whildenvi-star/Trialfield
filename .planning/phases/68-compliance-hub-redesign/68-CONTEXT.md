# Phase 68: Compliance Hub Redesign — Design Decisions

## What the user asked for
Replace the three separate FSA 578, Insurance, and Claims nav entries with a single unified "Compliance" module. Full redesign — not a minimal wrapper.

## Scope decisions

### Single nav entry
- Remove `fsa-578`, `insurance`, `claims` from MODULES array in `src/lib/modules.ts`
- Add single `compliance` entry pointing to `/app/compliance`
- Label: "Compliance", sublabel: "FSA · Insurance · Claims"

### Route structure
- `/app/compliance` — Overview/dashboard tab (default)
- Internal tabs within the page (not separate routes):
  - **Overview** — dashboard header with stats + risk flags + upcoming deadlines
  - **Acreage** — current FSA 578 functionality
  - **Insurance** — current Insurance functionality
  - **Claims** — current Claims kanban
  - **Calendar** — new compliance deadline timeline

### Shared component library
Build `/components/compliance/ui/` with reusable pieces:
- `StatCard` — metric display (label, value, sub-label, color variant)
- `ComplianceBadge` — status badges (unreported, reported, alert, pending, overdue, ok)
- `SectionTable` — shared table shell (header, rows, empty state)
- `ActionButton` — primary/secondary/danger button variants
- `Drawer` — slide-in panel for create/edit forms (replaces the per-module drawers)

### Compliance dashboard (Overview tab)
Stats row:
- Unreported CLUs (count, link → Acreage tab filtered)
- Active Policies (count, link → Insurance tab)
- Open Claims (count, link → Claims tab)
- Overdue Deadlines (count, red if > 0)

Risk flags panel: list of actionable items with severity (warning/info/ok)
- "X CLU records not yet reported"
- "X claims with overdue deadlines"
- "X policies with potential claim alerts"
- "X policies with no linked CLU records"

Upcoming deadlines (next 30 days): chronological list of claim deadlines

### Unified farm/crop filter
- Persistent filter bar below the tab nav: Farm dropdown + Crop dropdown
- State lives in the compliance shell (URL params: `?farm=&crop=`)
- Each tab reads these params and pre-filters its data
- Clearing filter shows all records

### Cross-tab navigation
- "File Claim" from Insurance → navigates to Claims tab (not separate page)
- "View Insurance" from Acreage → navigates to Insurance tab with `?highlight=policyId`
- "File PP Claim" from Acreage → navigates to Claims tab with pre-filled form
- All navigation stays within `/app/compliance` — no inter-page jumps

### Compliance calendar (Calendar tab)
Timeline of critical dates (next 90 days):
- FSA reporting deadlines (if set on CLU records)
- Notice of Loss deadlines (date_of_loss + 15 days for each claim)
- Stage-based claim deadlines
- Color coded: green (7+ days), amber (1–7 days), red (overdue)
- Simple list view, not a calendar widget (no external dependencies)

## Technical constraints
- No external UI library — pure Tailwind + glomalin design tokens
- No new npm packages
- Keep existing workspace component logic — refactor shell only
- Existing API routes stay unchanged
- Supabase tables stay unchanged
- Existing `/app/fsa-578`, `/app/insurance`, `/app/claims` routes should redirect to `/app/compliance` (301 or router.push)

## Design system
- `glomalin-bg` (#080604), `glomalin-surface` (#0e0c0b), `glomalin-border` (#2a2218)
- `glomalin-text` (#e8d8c0), `glomalin-muted` (#6a5a4a), `glomalin-accent` (#C8860A)
- `green-400` for ok/reported, `amber-400` for warnings, `red-400` for overdue/critical

## What NOT to change
- Existing Supabase tables (clu_records, insurance_policies, insurance_pricing, claims, claim_timeline)
- Existing API routes under `/api/fsa/`, `/api/insurance/`, `/api/claims/`
- Calculation libraries (`/lib/fsa/calc.ts`, `/lib/insurance/calc.ts`, `/lib/claims/calc.ts`)
- Core workspace logic in existing `*-workspace.tsx` components — extract and reuse
