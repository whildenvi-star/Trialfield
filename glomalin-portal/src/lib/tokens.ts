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
  bg:          '#06080d',
  surface:     '#111620',
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
  // Agricultural semantic
  field:       '#589054',
  earth:       '#b28a4a',
  // Legacy alias
  green:       '#7A9E7E',
} as const

// ── Canvas chrome (the map's own palette) ──────────────────────────
// The dark, earthy surface the map wears — previously hardcoded as bare hex
// across seven map components, which is why it had drifted from `colors` above.
//
// Deliberately theme-INDEPENDENT: this chrome floats over satellite imagery,
// which is dark in both themes, so it must not flip with `.light` the way the
// --c-* variables do. Hence literal hex here rather than CSS custom properties.
// Tailwind still computes opacity modifiers from hex, so bg-glomalin-canvas-
// surface/90 works as expected.
export const canvasColors = {
  bg:       '#080604',   // beneath the map — full-bleed page ground
  surface:  '#0e0c0b',   // floating panels, bars, sheets
  elevated: '#1a1510',   // raised rows inside a panel
  border:   '#2a2218',   // hairlines on canvas chrome
  muted:    '#6a5a4a',   // secondary label text
  text:     '#e8d8c0',   // primary text on canvas chrome
  accent:   '#C8860A',   // amber — selection, active state, wheat
} as const

/**
 * hex → `rgba(...)`, for the inline styles and MapLibre popup CSS that need a
 * translucent canvas surface. Keeps those from re-hardcoding the same hex.
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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

  // Agricultural semantic
  field:            'rgb(var(--c-field) / <alpha-value>)',
  earth:            'rgb(var(--c-earth) / <alpha-value>)',

  // Canvas chrome — literal hex on purpose; see canvasColors above.
  'canvas-bg':       canvasColors.bg,
  'canvas-surface':  canvasColors.surface,
  'canvas-elevated': canvasColors.elevated,
  'canvas-border':   canvasColors.border,
  'canvas-muted':    canvasColors.muted,
  'canvas-text':     canvasColors.text,
  'canvas-accent':   canvasColors.accent,

  // Legacy alias — keep so existing `text-glomalin-green` still works
  green:            'rgb(var(--c-success) / <alpha-value>)',
}

// ── Fonts ──────────────────────────────────────────────────────────
export const fonts = {
  mono: ['JetBrains Mono', 'monospace'] as const,
}
