# Phase 33: Cross-Module Integration + Dashboard - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the three existing modules (FSA, Insurance, Claims) into a coherent workflow with cross-module navigation links, a prevented planting trigger that closes the FSA-to-Claims loop, and live dashboard summary cards. No new module functionality — this is the integration and overview layer.

</domain>

<decisions>
## Implementation Decisions

### Cross-Navigation UX
- Claude's Discretion: navigation style (page jump vs slide-out panel vs other)
- Claude's Discretion: breadcrumb trail vs simple back navigation
- Claude's Discretion: whether CLU→Policy link always shows (with "Create Policy" fallback) or only when linked
- Claude's Discretion: claim creation flow from Insurance (navigate to Claims module vs inline modal)

### Prevented Planting Trigger
- Claude's Discretion: prompt presentation (modal, toast, inline banner, or other)
- Claude's Discretion: multi-policy selection vs auto-select primary policy
- Claude's Discretion: dismiss behavior and recoverability of the prompt
- Claude's Discretion: directionality (one-way FSA→Claims vs bi-directional)

### Dashboard Summary Cards
- Claude's Discretion: card density (numbers only, numbers + mini visual, numbers + breakdown)
- Claude's Discretion: click-through targets (module landing vs filtered view)
- Claude's Discretion: refresh strategy (auto-polling vs page-load only)
- Claude's Discretion: visibility rules (module-gated vs all-visible with access prompts)

### Empty & Edge States
- Claude's Discretion: missing policy handling when user navigates from CLU
- Claude's Discretion: stale/offline data display on dashboard cards
- Claude's Discretion: zero-count card visibility
- Claude's Discretion: no-access user dashboard experience

### Claude's Discretion
User gave full discretion on all implementation decisions for this phase. Claude should make choices that:
- Follow existing portal UI patterns (dark soil aesthetic, card components, module-gating)
- Prioritize simplicity and consistency over novel interactions
- Use patterns already established in phases 28, 30, and 32 (cards, modals, navigation)
- Match the cross-app fetch pattern (Promise.allSettled, AbortSignal.timeout) already documented

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude to make integration decisions consistent with the existing portal design.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-cross-module-integration-dashboard*
*Context gathered: 2026-03-06*
