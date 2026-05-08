# Platform Design Tokens — Token Map

**Date:** 2026-03-14
**Source of Truth:** `platform-tokens.css` (copied to each app's `public/` dir)

---

## Text Scale System

### Scale Levels

| Level | `--text-scale` | Body Text | Small Text | Heading |
|-------|----------------|-----------|------------|---------|
| XS    | 0.85           | 11.9px    | 9.3px      | 18.7px  |
| S     | 0.93           | 13.0px    | 10.2px     | 20.4px  |
| **M** | **1.0**        | **14.0px**| **10.9px** | **22.0px**|
| L     | 1.15           | 16.1px    | 12.6px     | 25.3px  |
| XL    | 1.3            | 18.2px    | 14.2px     | 28.6px  |

### Size Tokens

| Token | Formula | At M (14px base) | Usage |
|-------|---------|-------------------|-------|
| `--size-xs` | base * 0.78 * scale | 10.9px | Badges, footnotes, timestamps |
| `--size-sm` | base * 0.88 * scale | 12.3px | Labels, secondary text |
| `--size-base` | base * 1.0 * scale | 14.0px | Body text, table cells |
| `--size-md` | base * 1.14 * scale | 16.0px | Section headers, emphasis |
| `--size-lg` | base * 1.29 * scale | 18.1px | Page titles, card headers |
| `--size-xl` | base * 1.57 * scale | 22.0px | Hero text, dashboard values |
| `--size-2xl` | base * 2.0 * scale | 28.0px | Large headlines |
| `--size-3xl` | base * 2.57 * scale | 36.0px | Landing page hero |

### CSS Variables

```css
:root {
  --text-scale: 1;        /* Set by settings-panel.js */
  --base-size: 14px;      /* Platform base */
}
```

### localStorage Keys

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `mru-theme` | `light` / `dark` | `dark` | Theme preference (most apps) |
| `si-theme` | `light` / `dark` | `dark` | Theme preference (seed-inventory) |
| `mru-text-scale` | `0.85` / `0.93` / `1` / `1.15` / `1.3` | `1` | Text scale multiplier |
| `mru-fmt-agent` | `on` / `off` | `on` | Formatting agent toggle |

---

## Font Families

| Token | Stack | Usage |
|-------|-------|-------|
| `--font-heading` | Outfit, system-ui sans | Section/page headings |
| `--font-body` | DM Sans, system-ui sans | Body text, descriptions |
| `--font-code` | JetBrains Mono, monospace | Data tables, code, terminal |

**Note:** All apps currently use JetBrains Mono for everything. The font tokens provide a path to differentiate heading/body/code fonts. Outfit and DM Sans are loaded via Google Fonts import in `platform-tokens.css`.

---

## Color Tokens (existing, not modified)

Theme colors remain in each app's `style.css` (or `globals.css` for Next.js apps). The token variable names are consistent across all Express apps:

### Dark Theme (`:root`)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#080a0f` | Page background |
| `--bg-raised` | `#0e1118` | Elevated surfaces |
| `--card` | `#0c1015` | Card/panel background |
| `--primary` | `#14b8a6` | Primary accent (teal) |
| `--primary-dim` | `#0d9488` | Darker accent |
| `--primary-light` | `#2dd4bf` | Lighter accent |
| `--text` | `#cbd5e1` | Primary text |
| `--text-light` | `#64748b` | Muted text |
| `--text-bright` | `#e2e8f0` | Emphasis text |
| `--border` | `#1e293b` | Standard borders |
| `--border-light` | `#334155` | Subtle borders |
| `--highlight` | `#0f172a` | Hover background |
| `--danger` | `#ff3b30` | Error/destructive |
| `--success` | `#7A9E7E` | Success state |
| `--amber` | `#ffb800` | Warning/gold |

### Light Theme (`body.light`)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f8fafc` | Page background |
| `--bg-raised` | `#ffffff` | Elevated surfaces |
| `--card` | `#f1f5f9` | Card/panel background |
| `--primary` | `#0d9488` | Primary accent (darker teal) |
| `--text` | `#1e293b` | Primary text |
| `--text-bright` | `#0f172a` | Emphasis text |
| `--border` | `#cbd5e1` | Standard borders |
| `--highlight` | `#f0fdfa` | Hover background |
| `--danger` | `#c62828` | Error/destructive |

---

## Readability Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-tight` | 1.3 | Compact displays |
| `--line-height-base` | 1.6 | Body text default |
| `--line-height-loose` | 1.8 | Descriptive/readable text |
| `--max-line-length` | 80ch | Max content width guideline |

---

## Files

| File | Location | Description |
|------|----------|-------------|
| `platform-tokens.css` | Each app's `public/` | CSS custom properties + settings panel styles |
| `settings-panel.js` | Each app's `public/` | Settings drawer UI component |
| `formatting-agent.js` | Each app's `public/` | Client-side readability monitor |

### App Integration

**Express apps:** `<link>` in `<head>`, `<script>` before `</body>`
**glomalin-portal:** CSS imported in `globals.css`, JS via `next/script` in `layout.tsx`

---

## How to Extend

### Adding a new color token
1. Add the CSS variable to each app's `:root` and `body.light` blocks in `style.css`
2. For glomalin-portal, also add to `tokens.ts` and `tailwind.config.ts`

### Adding a new size token
1. Add the calc expression to `platform-tokens.css` `:root` block
2. Copy the updated file to all app `public/` directories

### Adding a new component that needs theming
1. Use existing `var(--token)` references — never hardcode colors
2. Use `var(--size-*)` tokens — never hardcode `font-size` in px
3. Test in both day/night themes and at XL text size
