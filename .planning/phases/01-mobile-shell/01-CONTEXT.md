# Phase 1: Mobile Shell - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the portal navigable on phones with touch-friendly controls, a mobile-first navigation pattern, and graceful handling of embedded iframe modules. This phase delivers the structural shell — no new data views or features, just making what exists usable on a phone screen.

</domain>

<decisions>
## Implementation Decisions

### Navigation Pattern
- Bottom tab bar, always visible (no hide-on-scroll)
- 4 tabs: Home (dashboard) | Farm Info | Field Passes | More (overflow for remaining modules)
- "More" tab provides access to modules not in the main bar
- Tab bar should feel like a native farm app — thumb-reachable, clear icons

### Layout Approach
- Stack and simplify: collapse multi-column desktop layouts to single column on mobile
- Convert tables to card-based lists on small screens
- Trimmed data on mobile: show key fields only, not full desktop detail
- Role-based data restriction: budget/financial data hidden from crew roles on mobile; admins see everything
- Link to desktop for full module detail when data is trimmed

### Iframe Module Fallback
- Embedded Express app modules (served via iframe) show a simple "This module works best on desktop" message on mobile
- No preview or summary — just the message with guidance to use a computer
- Claude to check codebase for which modules are iframe-embedded vs native React

### Mobile Identity
- Distinct mobile feel — lighter, simpler, feels like its own farm app (not just shrunken desktop portal)
- Reference: farm app tools like Climate FieldView, Farmbrite — clean, task-oriented
- Minimal header: small logo + page title only — maximize screen space for content
- Both dark and light theme supported (matches existing theme toggle)
- Same W. Hughes Farms branding, just adapted for mobile context

### Claude's Discretion
- Exact breakpoint where mobile layout activates (375px viewport is the success criterion target)
- Icon choices for bottom tab bar
- Specific card component styling for table-to-card conversions
- How to implement role-based data trimming (component-level vs API-level filtering)
- Loading states and skeleton screens

</decisions>

<specifics>
## Specific Ideas

- User wants it to feel like a farm app (Climate FieldView, Farmbrite style) — clean, task-oriented, not a generic business dashboard
- Budget/financial data is proprietary — must be hidden from crew members on mobile, only visible to admin roles
- The team mentioned needing quick access to: farm info, acres, varieties, input rates, and field passes — these inform what tabs surface (captured for Phase 3 dashboard content)

</specifics>

<deferred>
## Deferred Ideas

- Dashboard content details (farm, acres, varieties, input rates as cards/sections) — Phase 3: Mobile Dashboard
- Field pass confirmation (manually enter or confirm completed field passes) — Phase 4: Field Data Entry
- Specific data to show on Farm Info and Field Passes tabs — Phase 3 discussion

</deferred>

---

*Phase: 01-mobile-shell*
*Context gathered: 2026-03-20*
