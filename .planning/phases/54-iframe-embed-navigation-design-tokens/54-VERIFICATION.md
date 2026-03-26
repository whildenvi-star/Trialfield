---
phase: 54-iframe-embed-navigation-design-tokens
verified: 2026-03-25T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
re_verification: false
gaps:
  - truth: "All 8 apps use identical color token values so switching between portal and any embedded app shows no color jarring"
    status: partial
    reason: "farm-budget/public/style.css retains a full body.light { } block with canonical color tokens set to different values (--bg: #ffffff, --primary: #1a6b10 green, etc.) that override platform-tokens.css light mode values. In light mode farm-budget renders a distinct green-themed UI while every other app renders teal, causing visible color jarring on theme toggle."
    artifacts:
      - path: "farm-budget/public/style.css"
        issue: "Lines ~2791-2817: body.light { } block redefines --bg, --bg-raised, --card, --card-alt, --primary, --primary-dim, --primary-light, --text, --text-light, --text-bright, --border, --border-light, --highlight, --danger, --success with values that differ from platform-tokens.css canonical set (e.g. --primary: #1a6b10 vs #0d9488, --bg: #ffffff vs #f8fafc)"
    missing:
      - "Remove the canonical color token properties (--bg, --bg-raised, --card, --card-alt, --primary, --primary-dim, --primary-light, --text, --text-light, --text-bright, --border, --border-light, --highlight, --danger, --success) from farm-budget/public/style.css body.light { } block — leave only non-canonical tokens (--blue, --purple, --teal, --orange, --profit-pos, --profit-neg, --shadow-hover, --glow, --glow-amber)"
human_verification:
  - test: "Navigate to any Express embed in portal, toggle day/night"
    expected: "All embedded apps and portal chrome switch color theme simultaneously with identical colors — no app shows a different background shade or primary accent color"
    why_human: "Specificity cascade between body.light and .light/:root.light requires visual confirmation that the canonical tokens win"
  - test: "Load farm-budget in light mode standalone, then load any other Express app in light mode — compare background and primary accent colors"
    expected: "Background and primary accent must be indistinguishable between apps"
    why_human: "The body.light color conflict in farm-budget is a programmatic finding but visual severity needs human confirmation"
---

# Phase 54: iframe Embed Navigation & Design Tokens — Verification Report

**Phase Goal:** Embedded Express apps integrate cleanly into the portal (no duplicate headers, clear navigation context) and every app uses identical color tokens so there is no visual jarring when switching between them
**Verified:** 2026-03-25
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When an Express app loads inside a portal iframe, its own header bar is hidden | VERIFIED | All 6 Express apps have `html.in-iframe .header { display: none !important; }` CSS rules + inline iframe detection scripts in index.html adding `html.in-iframe` class |
| 2 | A breadcrumb bar shows "Dashboard > Module Name" path and "Back to Dashboard" is always visible | VERIFIED | `embed-breadcrumb.tsx` exists, is substantive (54 lines), imported and rendered in `[module]/page.tsx` for embed-type modules only |
| 3 | All 8 apps use identical color token values — switching shows no color jarring | PARTIAL — DARK OK, LIGHT FAILED | Dark mode: all 7 platform-tokens.css files have identical `--bg: #080a0f` blocks. Light mode: farm-budget/public/style.css retains `body.light { --bg: #ffffff; --primary: #1a6b10 }` which overrides platform-tokens.css canonical values |
| 4 | Toggling day/night in the portal cascades consistently to all embedded apps | VERIFIED | `embed-frame.tsx` sends postMessage on load + storage/theme-change events; `organic-cert/src/app/layout.tsx` has message listener guarded by `window !== window.top` |

**Score:** 3/4 truths verified (Truth 3 is partial — dark mode works, light mode has farm-budget override gap)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/src/components/embed-breadcrumb.tsx` | Breadcrumb bar with "Back to Dashboard" | VERIFIED | 54 lines, fixed-position, "Dashboard > module" left, "Back to Dashboard" right, both Link to /dashboard |
| `glomalin-portal/src/components/embed-frame.tsx` | postMessage theme sync + breadcrumb-aware top offset | VERIFIED | `iframeRef`, `sendThemeToIframe()`, `useEffect` with storage + theme-change listeners, `top: calc(56px + 36px)` |
| `glomalin-portal/src/app/(protected)/app/[module]/page.tsx` | Renders EmbedBreadcrumb for embed-type modules | VERIFIED | EmbedBreadcrumb imported, rendered above EmbedFrame, gated on `mod.type === 'embed'` |
| `organic-cert/src/app/layout.tsx` | postMessage listener for theme sync | VERIFIED | Inline script contains `glomalin-theme` message handler guarded by `window !== window.top` |
| `farm-budget/public/platform-tokens.css` | Canonical color tokens | VERIFIED | `--bg: #080a0f` dark, `--bg: #f8fafc` light — identical to all other apps |
| `grain-tickets/public/platform-tokens.css` | Canonical color tokens | VERIFIED | `--bg: #080a0f` / `--bg: #f8fafc` — matches canonical |
| `seed-inventory/public/platform-tokens.css` | Canonical color tokens | VERIFIED | Matches canonical |
| `meristem-malt/public/platform-tokens.css` | Canonical color tokens | VERIFIED | Matches canonical |
| `farm-registry/public/platform-tokens.css` | Canonical color tokens | VERIFIED | Matches canonical |
| `fsa-acres/public/platform-tokens.css` | Canonical color tokens | VERIFIED | Matches canonical |
| `glomalin-portal/public/platform-tokens.css` | Canonical color tokens | VERIFIED | Matches canonical; loaded via `<link>` in glomalin-portal/src/app/layout.tsx |
| `farm-budget/public/style.css` | No canonical color tokens in :root | PARTIAL | `:root` block cleaned; BUT `body.light { }` at line 2791 still redefines --bg, --primary, --text, --border, --card, --highlight, --danger, --success with different values |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `[module]/page.tsx` | `embed-breadcrumb.tsx` | `import { EmbedBreadcrumb }` + JSX render | WIRED | Line 5: `import { EmbedBreadcrumb }` Line 49: `<EmbedBreadcrumb moduleLabel={mod.label} moduleSublabel={mod.sublabel} />` |
| `embed-breadcrumb.tsx` | `/dashboard` | `Link href="/dashboard"` | WIRED | Two `<Link href="/dashboard">` elements: one for "Dashboard" text, one for "Back to Dashboard" |
| `embed-frame.tsx` | `organic-cert iframe` | `postMessage({ type: 'glomalin-theme', theme }, '*')` | WIRED | `sendThemeToIframe()` calls `iframeRef.current?.contentWindow?.postMessage(...)` on load and on storage/theme-change events |
| `organic-cert/src/app/layout.tsx` | `document.documentElement.classList` | `addEventListener('message', ...)` toggles `.light` | WIRED | Inline script: `window.addEventListener('message', function(e){ if(e.data&&e.data.type==='glomalin-theme'){...} })` guarded by `window!==window.top` |
| `platform-tokens.css` | `style.css` (all apps) | CSS cascade — `platform-tokens.css` before `style.css` in `<head>` | WIRED for all apps | Load order confirmed: platform-tokens.css on line before style.css in all 6 Express index.html files |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UXN-04 | 54-02, 54-04 | Embedded Express apps hide their header bar when inside portal iframe | SATISFIED | `html.in-iframe .header-* { display: none !important; }` present in all 6 app style.css files; inline scripts add `html.in-iframe` class to `<html>` element |
| UXN-05 | 54-02 | Portal shows breadcrumb bar above iframe embeds showing current navigation path | SATISFIED | `EmbedBreadcrumb` renders "Dashboard > {moduleLabel}" via fixed-position bar anchored at `top: var(--portal-header-h)` |
| UXN-06 | 54-02 | "Back to Dashboard" escape hatch always visible when inside an embed | SATISFIED | Right side of EmbedBreadcrumb always shows `<Link href="/dashboard">Back to Dashboard</Link>` with left-arrow SVG |
| UXN-07 | 54-01 | All 8 apps use identical color tokens from shared platform-tokens.css | PARTIAL | Dark mode: all 7 platform-tokens.css identical. Light mode: farm-budget/public/style.css `body.light` block overrides canonical tokens with different values — UXN-07 not fully satisfied |
| UXN-08 | 54-03 | Day/night toggle produces consistent results across portal and all embedded apps | SATISFIED | Portal pushes theme via postMessage on storage + custom event; organic-cert receives and applies; same-origin apps receive via localStorage (existing mechanism) + postMessage (redundant, harmless) |
| UXN-09 | 54-01, 54-04 | Switching between portal and any embedded app shows zero visual color jarring | PARTIAL | Dark mode: consistent. Light mode: farm-budget renders different background (#ffffff vs #f8fafc) and different primary accent (#1a6b10 green vs #0d9488 teal) due to residual body.light block |

**Orphaned requirements:** None — all 6 requirement IDs from plans match REQUIREMENTS.md Phase 54 assignments.

---

## Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `farm-budget/public/style.css` | 2791-2817 | `body.light { --bg: #ffffff; --primary: #1a6b10; ... }` redefines 14 canonical color tokens with divergent values | Blocker | Light mode: farm-budget renders green primary accent and pure-white background instead of canonical teal and #f8fafc — visible color jarring on day mode toggle |

---

## Human Verification Required

### 1. Light Mode Color Consistency

**Test:** In portal, navigate to any Express embed (grain-tickets, seed-inventory, etc.), enable light mode via settings panel, then navigate to farm-budget embed. Compare background and primary accent color.
**Expected:** All apps show identical light background (#f8fafc) and identical teal accent (#0d9488)
**Why human:** CSS specificity cascade (`body.light` vs `.light`) requires visual confirmation that the correct token wins — the body.light block in farm-budget currently sets `--bg: #ffffff` and `--primary: #1a6b10` which would produce visible differences

### 2. Theme Cascade Speed

**Test:** Load portal with any Express embed visible. Toggle day/night via settings panel rapidly.
**Expected:** Portal chrome and embedded app switch simultaneously with no lag or flash
**Why human:** Timing of postMessage / storage events vs render cycle is not verifiable via static analysis

---

## Gaps Summary

One gap blocks full goal achievement: **farm-budget light mode color tokens are not unified.**

Plan 54-01 Task 2 correctly cleaned the `:root` block in farm-budget/public/style.css. However, the `body.light { }` block at line 2791 — which predates the platform-tokens system — was not removed. This block contains 14 canonical color token overrides with values that differ significantly from the platform canonical set:

- `--bg: #ffffff` vs canonical `#f8fafc`
- `--primary: #1a6b10` (green) vs canonical `#0d9488` (teal)
- `--success: #2e7d32` vs canonical `#0d9488`
- `--text: #1a1a1a` vs canonical `#1e293b`

Since style.css loads after platform-tokens.css, and `body.light` has higher specificity than `.light`, farm-budget's own values win in light mode. Every other Express app and the portal itself use the canonical teal-based light theme. Switching to farm-budget in day mode will show a green-accented, different-background app — exactly the visual jarring the phase aimed to eliminate.

**Fix:** In `farm-budget/public/style.css`, remove the 14 canonical color token properties from the `body.light { }` block, keeping only: `--blue`, `--purple`, `--teal`, `--orange`, `--profit-pos`, `--profit-neg`, `--shadow-hover`, `--glow`, `--glow-amber` (these are app-specific non-canonical tokens).

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
