# Phase 40: ASCIIBannerStrip Component - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone animated ASCII mycelial network canvas component for glomalin-portal. Renders procedural mycelium art using ASCII characters at ~50fps with retina support, pure noise functions, and no external dependencies. Shell integration (Phase 41), design tokens (Phase 42), and additional scenes (Phase 43) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Mycelium visual style
- Organic & sparse — few branching tendrils with lots of dark negative space, like actual mycelium under a microscope
- 8-12 mycelium nodes (bright connection points) visible at once across the strip
- Tendrils follow mostly straight paths with slight noise displacement (jitter) — cleaner, more digital feel
- Occasional forks — some tendrils split into 2-3 smaller branches that fade out for natural feel

### Animation behavior
- Slow creeping growth — tendrils slowly extend and retract like time-lapse fungal growth, meditative and alive
- Moderate speed: 8-12 second growth/retraction cycle — visible movement that doesn't demand attention
- Nodes have a lifecycle — they bloom, persist, then fade while new ones appear elsewhere; the network shifts over time
- Tab resume: jump to current clock time (feels like it was running in the background), not pause/resume

### Color & contrast
- Cyan with white highlights — main network in cyan tones, brightest nodes flash momentary white peaks
- High contrast — dim tendrils barely visible, nodes glow bright, creating depth and drawing the eye to focal points
- Bottom gradient fades to page background color (not transparent) — guarantees seamless join, needs to know the bg color

### Claude's Discretion
- Background color choice (match page bg vs pure black vs slightly lighter)
- File structure (single file vs directory with separate noise utils)

### Component API surface
- Minimal props: height, className, and paused — the component owns its visual identity
- Export both the React component AND noise/mycelium utility functions (noise2D, fbm, generateMycelium) so Phase 43 scenes can reuse the math
- No forwardRef — canvas is fully internal, consumers just render `<ASCIIBannerStrip />` and it works

</decisions>

<specifics>
## Specific Ideas

- ASCII brightness ramp from requirements: " .·:;░▒▓█" — dim chars for tendrils, bright chars for nodes
- White highlights on brightest nodes add sparkle against cyan base
- The sparse aesthetic should evoke looking at real mycelium under a microscope — lots of negative space with living tendrils creeping between bright fruiting-body nodes
- Jittery straight connections (not smooth curves) give a slightly digital/glitchy feel that suits the ASCII medium

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-asciibannerstrip-component*
*Context gathered: 2026-03-07*
