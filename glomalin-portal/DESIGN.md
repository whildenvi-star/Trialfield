# Glomalin Portal Design System

The Glomalin Portal uses a navy/cyan dark-mode design system. All color values and font definitions live in `src/lib/tokens.ts`, the single source of truth. Tailwind classes are generated from these tokens via `tailwind.config.ts`.

## Color Palette

| Token Name | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `colors.bg` | `glomalin-bg` | `#080a0f` | Page backgrounds, root containers |
| `colors.surface` | `glomalin-surface` | `#0c1015` | Cards, panels, drawers, table headers |
| `colors.border` | `glomalin-border` | `#1e293b` | Borders, dividers, table cell borders |
| `colors.accent` | `glomalin-accent` | `#14b8a6` | Buttons, links, active states, primary interactive elements |
| `colors.accentDim` | `glomalin-accent-dim` | `#0d9488` | Hover states on accent elements |
| `colors.accentLight` | `glomalin-accent-light` | `#2dd4bf` | Focus rings, emphasis highlights |
| `colors.text` | `glomalin-text` | `#cbd5e1` | Primary body text |
| `colors.muted` | `glomalin-muted` | `#64748b` | Secondary text, labels, placeholders |
| `colors.green` | `glomalin-green` | `#7A9E7E` | Success indicators, positive status, organic badges |
| `colors.highlight` | `glomalin-highlight` | `#0f172a` | Hover/active row backgrounds, subtle emphasis areas |

## Font Stack

The portal uses **JetBrains Mono** as its sole typeface, applied globally via `globals.css`. The monospace aesthetic reinforces the data-driven, agricultural-record-keeping nature of the application.

```
font-family: 'JetBrains Mono', monospace;
```

Defined in `tokens.ts` as `fonts.mono` and consumed by Tailwind as the default `font-mono` class.

## Usage Patterns

### Backgrounds

- **glomalin-bg** -- Page-level background. Applied to root layout containers and full-screen views.
- **glomalin-surface** -- Elevated surfaces: cards, panels, drawers, modal backgrounds, table headers.
- **glomalin-highlight** -- Subtle hover/active states on rows and interactive containers.

### Borders

- **glomalin-border** -- All borders and dividers. Use `border-glomalin-border` for standard borders, `divide-glomalin-border` for table/list dividers.

### Text

- **glomalin-text** -- Primary readable text. Headings, body copy, data values.
- **glomalin-muted** -- Secondary text: labels, column headers, timestamps, helper text, placeholders.

### Interactive Elements

- **glomalin-accent** -- Primary action color. Buttons, links, active tab indicators, selected states.
- **glomalin-accent-dim** -- Hover state for accent elements. Also used for subtle interactive affordances.
- **glomalin-accent-light** -- Focus rings and high-contrast emphasis. Use sparingly.

### Status

- **glomalin-green** -- Success, positive status, organic certification badges, "live" indicators.

## Canvas Components

Components that render to HTML `<canvas>` (such as `ASCIIBannerStrip`) cannot use Tailwind classes. Import the `colors` object directly from `@/lib/tokens`:

```typescript
import { colors } from '@/lib/tokens'

ctx.fillStyle = colors.bg       // '#080a0f'
ctx.fillStyle = colors.accent   // '#14b8a6'
```

This keeps canvas rendering in sync with the rest of the design system.

## Adding New Colors

1. Add the hex value to `colors` in `src/lib/tokens.ts` (camelCase key).
2. Add the Tailwind mapping to `tailwindColors` (kebab-case key pointing to the `colors` entry).
3. Use the new `glomalin-{name}` class in components, or import `colors.{name}` for canvas use.

All color definitions flow from `tokens.ts` through `tailwind.config.ts` into generated utility classes. There is no second source of truth.
