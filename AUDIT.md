# Platform Audit — Day/Night Theme + Text Sizing

**Date:** 2026-03-14
**Scope:** All 9 applications in the farm operations platform

---

## Platform Overview

| App | Tech | Port | Pages | CSS File | Theme System |
|-----|------|------|-------|----------|--------------|
| farm-budget | Express + Vanilla JS | 3001 | 1 SPA (20 modules) | style.css (27K lines) | CSS vars + body.light |
| fsa-acres | Express + Vanilla JS | 3002 | 1 SPA (9 tabs) | style.css (1.1K lines) | CSS vars + body.light |
| meristem-malt | Express + Vanilla JS | 3003 | 1 SPA | style.css (677 lines) | CSS vars + body.light |
| farm-registry | Express + Vanilla JS | 3005 | 2 HTML pages | style.css (754 lines) | CSS vars + body.light |
| grain-tickets | Express + Vanilla JS | 3007 | 2 HTML pages (6 tabs) | style.css + glomalin.css | CSS vars + body.light |
| seed-inventory | Express + Vanilla JS | 3006 | 1 SPA (11 tabs) | style.css (691 lines) | CSS vars + body.light |
| glomalin-portal | Next.js 14 + Tailwind | 3010 | 11 pages, 31+ components | globals.css + tokens.ts | CSS vars + .light class |
| organic-cert | Next.js 16 + Tailwind | 3004 | 19 pages, 25+ components | globals.css + shadcn | CSS vars + .light variant |
| field-app | React Native / Expo | mobile | 15 screens | N/A (inline styles) | Colors.ts constants |

---

## Current Theme System

### What Works Well
- **Consistent CSS variable naming** across all 6 Express apps (identical `:root` + `body.light` pattern)
- **localStorage persistence** (`mru-theme` key, `si-theme` for seed-inventory)
- **Synchronous theme init** prevents flash on page load
- **Meta theme-color** updates for browser chrome
- **Dark palette is cohesive**: `#080a0f` bg, `#14b8a6` teal accent, `#cbd5e1` text

### What Needs Work
- **No text size control** — no scaling mechanism exists anywhere
- **No shared CSS file** — each app duplicates ~35 CSS variables
- **glomalin-portal uses separate token system** (`tokens.ts` + Tailwind namespace)
- **organic-cert uses shadcn/ui theme** (different variable naming convention)
- **field-app has no theme switching** — hardcoded Colors.ts

---

## Color Audit

### CSS Variables (shared across Express apps)

**Dark (`:root`):**
- Background: `#080a0f`, Raised: `#0e1118`, Card: `#0c1015`
- Primary: `#14b8a6` (teal), Dim: `#0d9488`, Light: `#2dd4bf`
- Text: `#cbd5e1`, Muted: `#64748b`, Bright: `#e2e8f0`
- Border: `#1e293b`, Border-light: `#334155`
- Semantic: danger `#ff3b30`, success `#7A9E7E`, blue `#4a9eff`, amber `#ffb800`, orange `#ff6e40`, purple `#b388ff`

**Light (`body.light`):**
- Background: `#f8fafc`, Raised: `#ffffff`, Card: `#f1f5f9`
- Primary: `#0d9488`, Text: `#1e293b`, Bright: `#0f172a`
- Border: `#cbd5e1`, Border-light: `#e2e8f0`

### Hardcoded Colors (need tokenization)
- Header bg: `#060810` (dark), `#fafafa` (light) — all Express apps
- Scrollbar: `#334155` thumb, `#080a0f` track
- Print: `white` bg, `#1a1a1a` text, `#ddd` borders
- Glomalin widget: `#00ff88` dot, `rgba(74, 246, 38, 0.35)` glow
- Organic-cert PDF: `#2d5a27` primary (print-only, keep separate)
- Selection: `#14b8a6` bg dark, `#1565c0` bg light

---

## Typography Audit

### Font Stacks
- **Mono (primary):** JetBrains Mono → SF Mono → Cascadia Code → Fira Code → Consolas → monospace
- **Sans (secondary):** -apple-system → BlinkMacSystemFont → Segoe UI → Roboto → Helvetica Neue → Arial → sans-serif
- **Requested fonts:** Outfit (headings), DM Sans (body), Berkeley Mono (code/data) — NOT currently loaded

### Base Size
- All apps: `14px` on `html` or `body`

### Font Sizes Below 14px (Accessibility Flags)

| Size | px Equiv | Occurrences | Severity |
|------|----------|-------------|----------|
| 0.50rem | 8.0px | 2+ | CRITICAL |
| 0.55rem | 8.8px | 8+ | CRITICAL |
| 0.60rem | 9.6px | 10+ | CRITICAL |
| 0.62rem | 9.9px | 5+ | CRITICAL |
| 0.65rem | 10.4px | 15+ | HIGH |
| 0.68rem | 10.9px | 20+ | HIGH |
| 0.70rem | 11.2px | 40+ | MEDIUM |
| 0.72rem | 11.5px | 30+ | MEDIUM |
| 0.75rem | 12.0px | 50+ | MEDIUM |
| 0.78rem | 12.5px | 40+ | LOW |

**Total sub-14px declarations: ~220+**

### No Responsive Typography
- No `clamp()` or `calc()` usage for fluid sizing
- No accessibility font controls
- No text zoom preferences
- Mobile inputs forced to 16px (only scaling mechanism)

---

## Scope Decision

### In-Scope for This Work
The 6 Express + vanilla JS apps share identical CSS variable patterns and can be upgraded together:
1. farm-budget
2. fsa-acres
3. meristem-malt
4. farm-registry
5. grain-tickets
6. seed-inventory

Plus the portal:
7. glomalin-portal (Tailwind + CSS vars)

### Deferred
- **organic-cert** — separate shadcn/ui theme system, managed independently
- **field-app** — React Native, requires completely different approach (no CSS)

---

## Architecture Proposal

### Token System
A single `platform-tokens.css` file defining:
1. **Color tokens** — already exist as CSS vars, unify naming
2. **Text size scale** — 5 levels (XS/S/M/L/XL) as multiplier on `--base-size`
3. **Font stacks** — 3 families (heading, body, mono)

### Text Size Implementation
```
--text-scale: 1;           /* M = default */
--base-size: 14px;
--size-xs:  calc(var(--base-size) * 0.85 * var(--text-scale));  /* 11.9px at M */
--size-sm:  calc(var(--base-size) * 1.0  * var(--text-scale));  /* 14px at M */
--size-md:  calc(var(--base-size) * 1.14 * var(--text-scale));  /* 16px at M */
--size-lg:  calc(var(--base-size) * 1.29 * var(--text-scale));  /* 18px at M */
--size-xl:  calc(var(--base-size) * 1.57 * var(--text-scale));  /* 22px at M */
--size-2xl: calc(var(--base-size) * 2.0  * var(--text-scale));  /* 28px at M */

Multipliers:
  XS: --text-scale: 0.85
  S:  --text-scale: 0.93
  M:  --text-scale: 1.0    (default)
  L:  --text-scale: 1.15
  XL: --text-scale: 1.3
```

### Settings Panel
- Shared vanilla JS component (all Express apps load same script)
- Fixed tab on right edge, slides out on click
- Day/Night toggle + 5-step text size control
- localStorage keys: `mru-theme`, `mru-text-scale`

### Formatting Agent
- Standalone JS module loaded on each page
- MutationObserver + ResizeObserver
- Contrast checking, min-size enforcement, overflow detection
- Readability score badge in settings panel
