# Handoff — Day/Night Theme + Text Sizing + Formatting Agent

**Session:** 2026-03-14

---

## What Was Completed

### Phases 1-5 (fully implemented)

1. **Full Platform Audit** — `AUDIT.md` documents all 9 apps, their CSS systems, 220+ sub-14px font declarations, and color token inventory

2. **Design Token Foundation** — `platform-tokens.css` provides:
   - 5-level text scale system (XS/S/M/L/XL) via `--text-scale` CSS property
   - 8 semantic size tokens (`--size-xs` through `--size-3xl`)
   - 3 font family tokens (heading: Outfit, body: DM Sans, code: JetBrains Mono)
   - Google Fonts imports for Outfit and DM Sans

3. **Global Theme Switch** — `settings-panel.js` provides instant day/night switching that layers on top of the existing `body.light` class system. No breaking changes to existing theme code.

4. **Settings Tab on Every Page** — Auto-injecting slide-out drawer with:
   - Day/Night toggle with sun/moon icons
   - 5-step text size control with live preview
   - Formatting Agent ON/OFF switch
   - Readability score badge
   - Violation list
   - Reset to defaults button
   - All controls persist to localStorage

5. **Formatting Agent** — `formatting-agent.js` monitors:
   - Contrast ratio (WCAG AA 4.5:1 minimum)
   - Font size (10px minimum)
   - Text overflow
   - Runs on idle callback, never blocks main thread
   - Auto-corrects tight line-height

### Apps Integrated
- farm-budget (port 3001)
- fsa-acres (port 3002)
- meristem-malt (port 3003)
- farm-registry (port 3005)
- seed-inventory (port 3006)
- grain-tickets (port 3007)
- glomalin-portal (port 3010)

---

## What Was Deferred and Why

| Item | Why Deferred |
|------|--------------|
| **Phase 6: Font-size remediation** | 220+ hardcoded font-size values need visual verification before replacing with tokens. Data tables depend on tight sizing for density — changing blindly risks breaking layouts. Best done interactively in a UAT session. |
| **Phase 7: Stress test** | Depends on Phase 6. Cannot generate readability report without browser testing. |
| **organic-cert** | Uses shadcn/ui + Tailwind v4 with different theme architecture. Needs its own integration approach. |
| **field-app** | React Native — no CSS. Needs native theme provider. |
| **admin.html / report.html** | Standalone pages with own color schemes. Low priority. |

---

## How to Run the Formatting Agent Manually

In any browser console on a platform page:

```javascript
// Trigger a manual scan
FormattingAgent.scan();

// Get current score
FormattingAgent.getScore();  // Returns 0-100

// Get violation list
FormattingAgent.getViolations();  // Returns array of strings

// Enable/disable
FormattingAgent.enable();
FormattingAgent.disable();
```

The agent also logs violations to the console automatically in grouped format.

---

## How to Extend the Token System

### Adding a new size token
1. Add the `calc()` expression to `platform-tokens.css` `:root` block
2. Copy updated file to all app `public/` directories
3. Reference as `var(--size-newname)` in CSS

### Adding a new color token
1. Add to each app's `style.css` `:root` and `body.light` blocks
2. For glomalin-portal, also add to `src/lib/tokens.ts` and `tailwind.config.ts`
3. Reference as `var(--token-name)` in CSS

### Migrating a component to the text scale
Replace hardcoded font-size:
```css
/* Before */
.my-label { font-size: 0.75rem; }

/* After */
.my-label { font-size: var(--size-xs); }
```

The element will then respond to the user's text scale preference automatically.

### Adding the settings panel to a new app
1. Copy `platform-tokens.css`, `settings-panel.js`, `formatting-agent.js` to the app's `public/` dir
2. Add `<link rel="stylesheet" href="platform-tokens.css">` after `style.css` in `<head>`
3. Add `<script src="settings-panel.js"></script>` and `<script src="formatting-agent.js"></script>` before `</body>`
4. If the app uses a different localStorage theme key, add `<script>window.__SP_THEME_KEY = 'your-key';</script>` before `settings-panel.js`

---

## Next Recommended Session Priorities

1. **Phase 6: Interactive remediation** — Open each app in the browser, check Formatting Agent score, replace worst-offending hardcoded font-sizes with `var(--size-*)` tokens. Start with farm-budget (biggest CSS, 27K lines).

2. **Visual QA at XL size** — Navigate every page with text scale set to XL and fix any overflow or layout collapse.

3. **organic-cert integration** — Create a similar settings panel as a React component for the shadcn/ui-based app.

4. **Shared file management** — Consider a build script or symlinks to keep `platform-tokens.css`, `settings-panel.js`, and `formatting-agent.js` in sync across apps instead of manual copies.

---

## Files Created/Modified

### New Files
| File | Copies |
|------|--------|
| `AUDIT.md` | root |
| `TOKENS.md` | root |
| `OVERNIGHT_LOG.md` | root |
| `HANDOFF.md` | root |
| `platform-tokens.css` | 7 copies (each app's public/) |
| `settings-panel.js` | 7 copies (each app's public/) |
| `formatting-agent.js` | 7 copies (each app's public/) |

### Modified Files
| File | Change |
|------|--------|
| `farm-budget/public/index.html` | Added CSS link + 2 script tags |
| `fsa-acres/public/index.html` | Added CSS link + 2 script tags |
| `grain-tickets/public/index.html` | Added CSS link + 2 script tags |
| `meristem-malt/public/index.html` | Added CSS link + 2 script tags |
| `farm-registry/public/index.html` | Added CSS link + 2 script tags |
| `seed-inventory/public/index.html` | Added CSS link + theme key override + 2 script tags |
| `glomalin-portal/src/app/layout.tsx` | Added Script imports, CSS link, text-scale init |
| `glomalin-portal/src/app/globals.css` | Added text scale vars, theme colors, font imports |
