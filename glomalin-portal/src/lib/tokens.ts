/**
 * Canonical design tokens for the Glomalin Portal.
 *
 * Single source of truth for all colors and fonts.
 * Consumed by:
 *   - tailwind.config.ts  (via `tailwindColors` / `fonts`)
 *   - Canvas components    (via `colors` for direct hex values)
 */

// ── Colors (camelCase — for direct JS/TS imports) ──────────────────
export const colors = {
  bg:          '#080a0f',
  surface:     '#0c1015',
  border:      '#1e293b',
  accent:      '#14b8a6',
  accentDim:   '#0d9488',
  accentLight: '#2dd4bf',
  text:        '#cbd5e1',
  muted:       '#64748b',
  green:       '#7A9E7E',
  highlight:   '#0f172a',
} as const

// ── Colors (kebab-case keys — for Tailwind class generation) ───────
// Produces classes like `bg-glomalin-accent-dim`, `text-glomalin-accent-light`
export const tailwindColors: Record<string, string> = {
  bg:             colors.bg,
  surface:        colors.surface,
  border:         colors.border,
  accent:         colors.accent,
  'accent-dim':   colors.accentDim,
  'accent-light': colors.accentLight,
  text:           colors.text,
  muted:          colors.muted,
  green:          colors.green,
  highlight:      colors.highlight,
}

// ── Fonts ──────────────────────────────────────────────────────────
export const fonts = {
  mono: ['JetBrains Mono', 'monospace'] as const,
}
