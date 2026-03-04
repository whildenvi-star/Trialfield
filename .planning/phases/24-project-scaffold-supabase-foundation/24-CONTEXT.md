# Phase 24: Project Scaffold + Supabase Foundation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Greenfield Next.js 14 App Router project in glomalin-portal/ with Tailwind configured for the dark soil palette, Supabase schema deployed (profiles, module_access, RLS, auto-profile trigger), and both browser and server Supabase clients wired for SSR. No auth flows, no UI pages beyond confirming the dev server runs.

</domain>

<decisions>
## Implementation Decisions

### Module Identity
- Display label: "Macro Rollup" (not "Farm Overview" or "Dashboard")
- Function-based sublabels: "Whole-farm P&L", "Field & Acre Registry", "NOP Compliance", "Seed & Input Tracking", "FSA Reporting"
- URL routes use module IDs directly: /app/macro-rollup, /app/farm-registry, /app/org-cert, /app/inputs-seeds, /app/fsa-reporting
- Portal is an auth gateway that links out to existing standalone apps (ports 3000-3005) — NOT absorbing module functionality into portal pages
- lib/modules.js defines: id, label, sublabel, route for all 5 modules

### Visual Palette & Typography
- Font: JetBrains Mono everywhere (headings, body, labels — full monospace aesthetic)
- Load via Google Fonts
- Dark soil palette confirmed: bg #080604, surface #0e0c0b, border #2a2218, accent #C8860A, text #e8d8c0, muted #6a5a4a, green #7A9E7E
- Corners: subtle rounding (4-6px border radius) — softened but not rounded
- Branding: text wordmark "GLOMALIN" in JetBrains Mono, no icon/logo image

### Dev Environment
- Hosted Supabase project (cloud) — not local Supabase CLI/Docker
- Schema managed via schema.sql file, applied in Supabase dashboard
- Include seed.sql with test admin user and sample module access grants for immediate testing
- .env.local.example documents all required Supabase env vars
- Package manager: npm (consistent with existing farm-budget, grain-tickets modules)

### Claude's Discretion
- Tailwind config structure and custom theme extension approach
- Next.js App Router directory organization (route groups, layouts)
- Supabase client initialization patterns (createBrowserClient vs createServerClient)
- Exact spacing scale and typography sizing
- RLS policy specifics

</decisions>

<specifics>
## Specific Ideas

- All-mono aesthetic — the portal should feel like a farm operations terminal, not a consumer app
- "GLOMALIN" wordmark treatment in header — clean text, no imagery
- Module cards will eventually link to standalone apps on their respective ports

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-project-scaffold-supabase-foundation*
*Context gathered: 2026-03-04*
