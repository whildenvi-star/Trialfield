# Phase 30: Insurance Decision Tool UI - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the interactive UI for insurance policy management within the glomalin-portal insurance module. Users can create/edit/delete policies via a slide-out editor, compare coverage options in a side-by-side matrix, simulate payout scenarios with interactive sliders, and generate a downloadable insurance summary PDF. All data foundations and calculation engines exist from Phase 29 — this phase is pure UI/UX.

</domain>

<decisions>
## Implementation Decisions

### Policy Editor Experience
- Slide-out drawer for create/edit — Claude decides field organization (grouped sections vs single scroll)
- Policy list display — Claude decides format (card grid vs compact table) based on expected policy count and portal patterns
- Navigation structure — Claude decides whether policies/matrix/simulator are tabbed sections or policy-driven flow
- Delete confirmation — Claude decides caution level (simple confirm vs type-to-confirm)

### Coverage Matrix Presentation
- Row/column orientation — Claude decides whether plans (RP/RP-HPE/YP) or coverage levels (50-85%) are columns
- Heat-map coloring metric — Claude decides whether to color by premium cost, value ratio, or another useful signal
- Matrix scope — Claude decides single-policy vs all-policies view
- Cell interactivity — Claude decides click behavior (select coverage, show detail popover, or view-only)

### Payout Simulator Interaction
- Result presentation — Claude decides numbers-only vs numbers+chart visualization
- Slider set — Claude decides yield+price vs yield+price+coverage level sliders
- Scenario comparison — Claude decides single scenario vs save-and-compare capability
- Disclaimer placement — Claude decides banner vs footer vs other appropriate placement
- Must meet <100ms recalculation requirement from success criteria

### Insurance PDF Report
- Content sections — Claude decides what to include (policy table, coverage matrix snapshot, payout scenarios, etc.)
- Audience/tone — Claude decides farmer-reference vs shareable-with-agent level of formality
- Visual style — Claude decides print-friendly light vs portal-branded dark aesthetic
- Generation trigger — Claude decides download-button vs preview-then-download flow
- Header/branding — Claude decides farm name header vs data-only

### Claude's Discretion
- All areas above — user gave full discretion on all UI/UX decisions
- Policy editor layout, navigation, and list format
- Coverage matrix orientation, coloring, scope, and interactivity
- Payout simulator visualization, sliders, scenarios, and disclaimer
- PDF content, style, trigger, and branding
- Should follow existing glomalin-portal patterns (dark soil aesthetic, shadcn/ui components)
- Reference existing codebase patterns for consistency

</decisions>

<specifics>
## Specific Ideas

- Only 3 insurance policies currently exist — UI should work well for small counts but scale if more are added
- Insurance plan types limited to RP, RP-HPE, YP (SCO/ECO deferred to v7+)
- Coverage levels: 50%, 55%, 60%, 65%, 70%, 75%, 80%, 85%
- This is "decision support" not a premium calculator — keep practical for farm operators
- PDF generation uses @react-pdf/renderer (existing in codebase)
- Coverage matrix uses CSS grid (not SVG) per v6.0 design decisions
- Payout simulator is client-side calculation (not API calls) for <100ms response

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-insurance-decision-tool-ui*
*Context gathered: 2026-03-05*
