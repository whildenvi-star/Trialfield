---
phase: 54-iframe-embed-navigation-design-tokens
plan: 01
subsystem: ui
tags: [css, design-tokens, color-tokens, platform-tokens, express, nextjs, dark-mode, light-mode]

# Dependency graph
requires: []
provides:
  - Canonical color token block in all 7 platform-tokens.css files (dark + light)
  - Single source of truth for --bg, --primary, --text, --border, --card, --amber, --danger, --success (+ 8 more)
  - platform-tokens.css loads BEFORE style.css in all 6 Express app index.html files
affects:
  - 54-02 (iframe embed navigation — next plan, relies on unified tokens)
  - All future Express app styling work

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "platform-tokens.css is the single source of truth for all platform color tokens — no per-app overrides"
    - "CSS load order: platform-tokens.css always before style.css in <head>"
    - "style.css retains only app-specific non-color tokens (--blue, --orange, --glow, --font-mono, etc.)"
    - "glomalin-portal/globals.css retains RGB triplets for Tailwind opacity modifiers; hex aliases live in platform-tokens.css"

key-files:
  created: []
  modified:
    - farm-budget/public/platform-tokens.css
    - grain-tickets/public/platform-tokens.css
    - seed-inventory/public/platform-tokens.css
    - meristem-malt/public/platform-tokens.css
    - farm-registry/public/platform-tokens.css
    - fsa-acres/public/platform-tokens.css
    - glomalin-portal/public/platform-tokens.css
    - farm-budget/public/style.css
    - grain-tickets/public/style.css
    - seed-inventory/public/style.css
    - meristem-malt/public/style.css
    - farm-registry/public/style.css
    - fsa-acres/public/style.css
    - glomalin-portal/src/app/globals.css
    - farm-budget/public/index.html
    - grain-tickets/public/index.html
    - seed-inventory/public/index.html
    - meristem-malt/public/index.html
    - farm-registry/public/index.html
    - fsa-acres/public/index.html

key-decisions:
  - "CSS load order fixed in all 6 Express index.html files — platform-tokens.css was loading after style.css (Rule 3 auto-fix)"
  - "glomalin-portal/globals.css hex aliases removed; RGB triplet --c-* vars kept for Tailwind opacity support"
  - "App-specific non-color tokens (--blue, --purple, --glow, --font-mono, etc.) kept in style.css — not part of canonical set"
  - "grain-tickets light mode --amber override kept in style.css as #7a5000 (matches platform-tokens.css value anyway)"

patterns-established:
  - "Token hierarchy: platform-tokens.css (colors) > style.css (app-specific non-color overrides)"
  - "Light mode via .light and body.light classes — platform-tokens.css handles the canonical color flip"

requirements-completed:
  - UXN-07
  - UXN-09

# Metrics
duration: 18min
completed: 2026-03-26
---

# Phase 54 Plan 01: Canonical Color Tokens Summary

**Extracted 16 color tokens (--bg through --amber, dark + light) into identical platform-tokens.css blocks across all 7 apps, eliminating per-app color duplication**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-26T00:12:35Z
- **Completed:** 2026-03-26T00:30:00Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Added canonical :root color token block (16 tokens) to all 7 platform-tokens.css files — identical byte-for-byte values
- Added .light / :root.light day-mode color overrides to all 7 platform-tokens.css files
- Removed duplicate color definitions from 6 Express app style.css files and glomalin-portal globals.css
- Fixed CSS load order in all 6 Express app index.html files (platform-tokens.css now loads first)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add canonical color token block to all platform-tokens.css files** - `ec3ec1e` (feat)
2. **Task 2: Remove duplicate color definitions from style.css; fix CSS load order** - `1f288ba` (feat)

**Plan metadata:** (this summary commit)

## Files Created/Modified
- `*/public/platform-tokens.css` (7 files) — Added :root color block + .light overrides before @import
- `*/public/style.css` (6 files) — Removed canonical color tokens from :root and body.light/light blocks
- `glomalin-portal/src/app/globals.css` — Removed hex alias block; kept --c-* RGB triplets for Tailwind
- `*/public/index.html` (6 files) — Swapped link order: platform-tokens.css now before style.css

## Decisions Made
- CSS load order was reversed in all apps (style.css loaded before platform-tokens.css) — auto-fixed as Rule 3 (blocking issue: color tokens in platform-tokens.css would have been overridden by style.css duplicates)
- glomalin-portal globals.css keeps RGB triplet --c-* vars (--c-bg, --c-primary, etc.) for Tailwind opacity modifier support (bg-color/50); hex --bg aliases moved to platform-tokens.css
- App-specific tokens kept in style.css: --blue, --orange, --purple, --profit-pos, --glow, --font-mono, --transition-fast, etc. — these are not platform-wide tokens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed reversed CSS load order in all 6 index.html files**
- **Found during:** Task 2 (Remove duplicate color definitions)
- **Issue:** All 6 Express apps loaded style.css BEFORE platform-tokens.css. With color tokens in platform-tokens.css and duplicates removed from style.css, the tokens would have been defined before the body rule referencing them — correct. However, if any style.css rule redefined a color token it would win. More critically, the task specified fixing load order explicitly as part of correct behavior.
- **Fix:** Swapped `<link>` order in all 6 index.html files so platform-tokens.css loads first
- **Files modified:** farm-budget, grain-tickets, seed-inventory, meristem-malt, farm-registry, fsa-acres index.html
- **Verification:** grep confirms platform-tokens.css line number < style.css line number in all files
- **Committed in:** 1f288ba (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking load order)
**Impact on plan:** Essential correctness fix — load order ensures color tokens are available when style.css rules run. No scope creep.

## Issues Encountered
None — all files had consistent structure making edits straightforward.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Color token unification complete — all apps render identical colors from one source
- Platform-tokens.css is the definitive reference for any future color changes
- Ready for Phase 54-02 (iframe embed navigation)

---
*Phase: 54-iframe-embed-navigation-design-tokens*
*Completed: 2026-03-26*
