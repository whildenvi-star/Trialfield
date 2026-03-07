# Phase 42: Design Token Alignment & Palette Swap - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the old soil palette with a unified navy/cyan design system defined in a canonical token file (`src/lib/tokens.ts`). All portal components import from this file — no hardcoded hex strings. Tailwind config references tokens. DESIGN.md documents the system. No new UI features — this is a design infrastructure phase.

</domain>

<decisions>
## Implementation Decisions

### Color palette
- Keep the current navy/cyan shades already in tailwind.config.ts (bg #080a0f, surface #0c1015, accent #14b8a6, etc.)
- Semantic colors use muted/earthy tones — success=#7A9E7E (already in config), danger/warning/info follow the same understated approach
- No soil palette remnants anywhere — complete removal, no exceptions

### Token file location
- Place at `src/lib/tokens.ts` (not src/styles/) — alongside other lib utilities for consistency with existing project structure

### Tailwind namespace
- Rename `soil-*` to `glomalin-*` — project-branded namespace (glomalin-bg, glomalin-accent, glomalin-text, etc.)

### DESIGN.md
- General color/font/spacing rules — no specific component recipes needed
- Patterns emerge from the codebase itself

### Claude's Discretion
- Whether to keep gold (#C8860A) as a secondary accent or drop it — decide based on whether it adds value alongside cyan
- Surface depth layering — determine the right number of depth levels (3 or 4+) based on existing portal component needs
- Token scope — whether to include spacing/radius/shadows beyond colors+fonts, based on what varies across components
- Token naming convention — semantic names vs palette+semantic layers, whatever works best with Tailwind + component imports
- Whether tokens.ts should be dual-consumer (Tailwind config + direct React imports) or Tailwind-only
- Clean break vs gradual migration strategy — decide based on how many components use soil-* classes
- ASCIIBannerStrip: direct token imports vs Tailwind classes — decide based on how the banner currently renders
- DESIGN.md audience scope, visual examples inclusion, and file location (portal-specific vs project root)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-design-token-alignment-palette-swap*
*Context gathered: 2026-03-07*
