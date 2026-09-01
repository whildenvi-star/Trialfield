// Crop glyphs for the marketing surfaces. Monoline SVG, currentColor, sized by
// the caller — shapes chosen to stay readable at 14–16px so a per-crop row can
// be identified without reading its label.
//
// Commodity names arrive from the marketing DB ("Corn", "Soybeans", "Wheat")
// and tracking-tier rows carry a " — Specialty/Organic" suffix, so matching is
// substring + CBOT symbol, never equality.

export type CropGlyph = 'corn' | 'soybeans' | 'wheat' | 'barley' | 'rye' | 'generic'

/** Per-crop accent. Distinct hues so two bars in the same card never read alike. */
export const CROP_COLORS: Record<CropGlyph, string> = {
  corn:     '#facc15',
  soybeans: '#34d399',
  wheat:    '#fb923c',
  barley:   '#a78bfa',
  rye:      '#60a5fa',
  generic:  '#94a3b8',
}

export function cropGlyphFor(commodityName: string, symbol?: string | null): CropGlyph {
  const n = commodityName.toLowerCase()
  if (n.includes('corn')) return 'corn'
  if (n.includes('soy') || n.includes('bean')) return 'soybeans'
  if (n.includes('wheat')) return 'wheat'
  if (n.includes('barley')) return 'barley'
  if (n.includes('rye')) return 'rye'
  if (symbol === 'C') return 'corn'
  if (symbol === 'S') return 'soybeans'
  if (symbol === 'W') return 'wheat'
  return 'generic'
}

export function cropColorFor(commodityName: string, symbol?: string | null): string {
  return CROP_COLORS[cropGlyphFor(commodityName, symbol)]
}

interface CropIconProps {
  /** Commodity name as it comes off a rollup row. */
  commodity: string
  /** CBOT symbol, used only when the name is unrecognized. */
  symbol?: string | null
  size?: number
  className?: string
  /** Override the glyph color; defaults to currentColor from the parent. */
  color?: string
}

export function CropIcon({ commodity, symbol, size = 16, className, color }: CropIconProps) {
  const glyph = cropGlyphFor(commodity, symbol)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={glyph}
      focusable="false"
    >
      {GLYPHS[glyph]}
    </svg>
  )
}

// ── Glyph paths ─────────────────────────────────────────────────────────────

const Corn = (
  <>
    {/* ear */}
    <path d="M12 2.4c2.6 0 4.3 3.4 4.3 8.3 0 5.4-2 10.9-4.3 10.9s-4.3-5.5-4.3-10.9C7.7 5.8 9.4 2.4 12 2.4Z" />
    {/* kernel rows */}
    <path d="M12 3v18" />
    <path d="M8.3 8h7.4M7.8 12.4h8.4M8.5 16.8h7" />
    {/* husk leaves */}
    <path d="M8 13.4c-2.7.8-4.4 2.9-4.8 5.7 2.8.2 4.9-1.1 6-3.4" />
    <path d="M16 13.4c2.7.8 4.4 2.9 4.8 5.7-2.8.2-4.9-1.1-6-3.4" />
  </>
)

const Soybeans = (
  <g transform="rotate(-38 12 12)">
    {/* pod */}
    <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" />
    {/* beans */}
    <circle cx="7.6" cy="12" r="1.45" />
    <circle cx="12" cy="12" r="1.45" />
    <circle cx="16.4" cy="12" r="1.45" />
  </g>
)

/** Stem + three opposed grain pairs. Barley reuses it and adds awns. */
const wheatHead = (
  <>
    <path d="M12 22V5" />
    <path d="M12 7.6c0-2.2 1.4-3.9 3.4-4.2.3 2.2-1.2 4-3.4 4.2Z" />
    <path d="M12 7.6c0-2.2-1.4-3.9-3.4-4.2-.3 2.2 1.2 4 3.4 4.2Z" />
    <path d="M12 12.1c0-2.2 1.4-3.9 3.4-4.2.3 2.2-1.2 4-3.4 4.2Z" />
    <path d="M12 12.1c0-2.2-1.4-3.9-3.4-4.2-.3 2.2 1.2 4 3.4 4.2Z" />
    <path d="M12 16.6c0-2.2 1.4-3.9 3.4-4.2.3 2.2-1.2 4-3.4 4.2Z" />
    <path d="M12 16.6c0-2.2-1.4-3.9-3.4-4.2-.3 2.2 1.2 4 3.4 4.2Z" />
  </>
)

const Wheat = wheatHead

const Barley = (
  <>
    {wheatHead}
    {/* awns — what separates barley from wheat at a glance */}
    <path d="M12 5V2.2M14.9 4.6 16.4 2M9.1 4.6 7.6 2" />
  </>
)

const Rye = (
  <>
    <path d="M12 22V6.5" />
    <path d="M12 12c-2.7 0-5.1-2-5.5-5.1 3.1.1 5.5 2.2 5.5 5.1Z" />
    <path d="M12 15.4c2.7 0 5.1-2 5.5-5.1-3.1.1-5.5 2.2-5.5 5.1Z" />
    <path d="M12 6.5c0-1.8 1-3.2 2.6-3.6.2 1.8-.9 3.3-2.6 3.6Z" />
  </>
)

const Generic = (
  <>
    <ellipse cx="12" cy="13.5" rx="5" ry="6.5" />
    <path d="M12 20V8.5M12 8.5c0-2.6 1.8-4.5 4.5-5-.2 2.7-2 4.6-4.5 5Z" />
  </>
)

const GLYPHS: Record<CropGlyph, React.ReactNode> = {
  corn: Corn,
  soybeans: Soybeans,
  wheat: Wheat,
  barley: Barley,
  rye: Rye,
  generic: Generic,
}
