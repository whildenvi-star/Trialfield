---
phase: 42-design-token-alignment-palette-swap
plan: 03
subsystem: ui
tags: [design-tokens, tailwind, css, canvas]

# Dependency graph
requires:
  - phase: 42-design-token-alignment-palette-swap (plan 01)
    provides: canonical tokens.ts with colors/fonts exports
  - phase: 42-design-token-alignment-palette-swap (plan 02)
    provides: glomalin-* Tailwind class migration across 37 files
provides:
  - zero hardcoded hex values in all portal component/lib files
  - bannerGradient export in tokens.ts for canvas color ramp
  - borderLight token for module/edge styling
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bannerGradient object for canvas brightness ramp sourced from tokens"
    - "borderLight token for lighter border/edge variants"

key-files:
  created: []
  modified:
    - glomalin-portal/src/lib/tokens.ts
    - glomalin-portal/src/components/farm-node-map.tsx
    - glomalin-portal/src/components/layout/ascii-noise.ts
    - glomalin-portal/src/components/fsa/farm-accordion.tsx
    - glomalin-portal/src/components/fsa/tract-accordion.tsx
    - glomalin-portal/src/lib/claims/calc.ts

key-decisions:
  - "Added borderLight (#334155) to tokens -- slate-700 used for module borders and edge strokes"
  - "Added bannerGradient object to tokens -- cyan brightness ramp for ascii-noise canvas rendering"
  - "Used hex suffix '26' for accent boxShadow opacity (15%) instead of rgba()"

patterns-established:
  - "Canvas color ramps sourced from bannerGradient in tokens.ts"

requirements-completed: [TOKEN-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 42 Plan 03: Gap Closure Summary

**Eliminated all hardcoded hex values from 5 portal files by wiring inline styles and Tailwind arbitrary values to tokens.ts exports**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T15:47:52Z
- **Completed:** 2026-03-07T15:51:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- farm-node-map.tsx: all 15+ inline hex values replaced with colors.* imports from tokens.ts
- ascii-noise.ts: 5 canvas color constants now source from new bannerGradient export in tokens.ts
- FSA accordions: 4 arbitrary Tailwind hex classes replaced with glomalin-highlight and glomalin-surface tokens
- claims calc: border-l-[#7A9E7E] replaced with border-l-glomalin-green token class
- Comprehensive grep scan confirms zero hardcoded hex values remain in portal source (excluding tokens.ts, tailwind config, and PDF files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire farm-node-map.tsx and ascii-noise.ts to tokens** - `56c7a13` (feat)
2. **Task 2: Fix FSA accordions and claims calc token references** - `4d4efdb` (feat)

## Files Created/Modified
- `glomalin-portal/src/lib/tokens.ts` - Added borderLight color, bannerGradient export, border-light Tailwind key
- `glomalin-portal/src/components/farm-node-map.tsx` - All inline hex replaced with colors.* imports
- `glomalin-portal/src/components/layout/ascii-noise.ts` - Color constants sourced from bannerGradient
- `glomalin-portal/src/components/fsa/farm-accordion.tsx` - Arbitrary hex classes replaced with glomalin-* tokens
- `glomalin-portal/src/components/fsa/tract-accordion.tsx` - Arbitrary hex classes replaced with glomalin-* tokens
- `glomalin-portal/src/lib/claims/calc.ts` - border-l arbitrary value replaced with glomalin-green

## Decisions Made
- Added `borderLight` (#334155) to tokens.ts -- slate-700 used in farm-node-map MODULE_STYLE borders and edge strokes, not covered by existing `border` (#1e293b)
- Created `bannerGradient` object (not array) in tokens.ts for the 5-level cyan brightness ramp used by ascii-noise.ts canvas rendering
- Used hex suffix `26` for accent boxShadow opacity (rgba(20,184,166,0.15) = #14b8a6 + 26 hex = ~15% opacity) to keep it token-sourced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added borderLight token to tokens.ts**
- **Found during:** Task 1 (farm-node-map.tsx migration)
- **Issue:** #334155 used in MODULE_STYLE and edge strokes had no matching token
- **Fix:** Added `borderLight: '#334155'` to colors and `'border-light'` to tailwindColors
- **Files modified:** glomalin-portal/src/lib/tokens.ts
- **Verification:** All hex references now resolve to token imports
- **Committed in:** 56c7a13 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Token addition necessary for complete hex elimination. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 42 gap closure complete -- all portal components now use the token system exclusively
- Zero hardcoded hex values confirmed across the entire glomalin-portal/src/ tree

---
*Phase: 42-design-token-alignment-palette-swap*
*Completed: 2026-03-07*
