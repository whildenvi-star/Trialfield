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
  borderLight: '#334155',
  accent:      '#14b8a6',
  accentDim:   '#0d9488',
  accentLight: '#2dd4bf',
  text:        '#cbd5e1',
  muted:       '#64748b',
  highlight:   '#0f172a',
  // Semantic status (dark-mode values — for canvas/inline styles)
  success:     '#7A9E7E',
  danger:      '#ff3b30',
  warning:     '#ffb800',
  info:        '#38bdf8',
  // Legacy alias
  green:       '#7A9E7E',
} as const

// ── Banner gradient (cyan brightness ramp for canvas rendering) ─────
// Used by ascii-noise.ts charColor() — ordered brightest to faintest
export const bannerGradient = {
  white:     '#ffffff',    // peak highlights (>0.85)
  brightest: '#22d3ee',    // cyan-300 (0.65-0.85)
  mid:       '#0e7490',    // cyan-700 (0.35-0.65)
  dim:       '#164e63',    // cyan-900 (0.15-0.35)
  faint:     '#0c2a3a',    // (<0.15)
} as const

// ── Colors (kebab-case keys — for Tailwind class generation) ───────
// Uses CSS custom properties with RGB triplets so Tailwind opacity
// modifiers work (e.g. bg-glomalin-accent/30). The --c-* variables
// are defined in globals.css :root / .light blocks.
export const tailwindColors: Record<string, string> = {
  // Surfaces
  bg:               'rgb(var(--c-bg) / <alpha-value>)',
  surface:          'rgb(var(--c-card) / <alpha-value>)',
  elevated:         'rgb(var(--c-elevated) / <alpha-value>)',
  highlight:        'rgb(var(--c-highlight) / <alpha-value>)',

  // Borders
  border:           'rgb(var(--c-border) / <alpha-value>)',
  'border-light':   'rgb(var(--c-border-light) / <alpha-value>)',
  'border-strong':  'rgb(var(--c-border-strong) / <alpha-value>)',

  // Accent
  accent:           'rgb(var(--c-primary) / <alpha-value>)',
  'accent-dim':     'rgb(var(--c-primary-dim) / <alpha-value>)',
  'accent-light':   'rgb(var(--c-primary-light) / <alpha-value>)',

  // Text
  text:             'rgb(var(--c-text) / <alpha-value>)',
  muted:            'rgb(var(--c-text-light) / <alpha-value>)',
  bright:           'rgb(var(--c-text-bright) / <alpha-value>)',

  // Semantic status
  success:          'rgb(var(--c-success) / <alpha-value>)',
  danger:           'rgb(var(--c-danger) / <alpha-value>)',
  warning:          'rgb(var(--c-warning) / <alpha-value>)',
  info:             'rgb(var(--c-info) / <alpha-value>)',

  // Focus ring
  ring:             'rgb(var(--c-ring) / <alpha-value>)',

  // Confidence tiers (reuse semantic colors for consistent meaning)
  // CONFIDENT = verified/locked data (success green)
  // INFERRED  = calculated from other data (accent teal)
  // MANUAL    = hand-entered, less reliable (warning amber)
  // UNVERIFIED = unknown provenance (muted gray)
  'tier-confident':   'rgb(var(--c-success) / <alpha-value>)',
  'tier-inferred':    'rgb(var(--c-primary) / <alpha-value>)',
  'tier-manual':      'rgb(var(--c-warning) / <alpha-value>)',
  'tier-unverified':  'rgb(var(--c-text-light) / <alpha-value>)',

  // Legacy alias — keep so existing `text-glomalin-green` still works
  green:            'rgb(var(--c-success) / <alpha-value>)',
}

// ── Fonts ──────────────────────────────────────────────────────────
export const fonts = {
  mono: ['JetBrains Mono', 'monospace'] as const,
}
