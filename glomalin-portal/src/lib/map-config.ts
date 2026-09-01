// map-config.ts
// Edit crop colors here to tune the field map palette without code changes.
// Crop names must match canonical names from the crop registry (Phase 50).
//
// MapLibre GL JS (maplibre-gl) is the open-source fork of Mapbox GL JS —
// identical API surface, no proprietary token required.

// ---------------------------------------------------------------------------
// Crop color palette
// ---------------------------------------------------------------------------
export const CROP_COLORS: Record<string, string> = {
  // Grain crops
  'Yellow Corn': '#F5C518',           // corn = golden yellow
  'Soybeans': '#6B8E23',              // soybeans = olive green
  'Soft Red Winter Wheat': '#D4A017', // winter wheat = amber
  'Hard Red Winter Wheat': '#C8860A', // HRW wheat = darker amber (matches portal accent)
  'Hybrid Rye': '#7B5EA7',            // rye = purple
  'Oats': '#C8A97E',                  // oats = tan
  'Barley': '#A89060',                // barley = warm tan

  // Specialty / organic
  'Natto Beans': '#8BAF5A',           // natto = lighter green
  'Seed Beans': '#4A7C59',            // seed beans = forest green

  // Fallback for any crop not listed above
  '__unassigned': '#4A4035',          // no crop set = muted dark (dark soil neutral)
  '__unknown': '#3A3028',             // crop set but not in palette = darker muted
}

// ---------------------------------------------------------------------------
// Polygon fill & border styles
// ---------------------------------------------------------------------------

/** Opacity for the polygon fill (0–1). Borders are always full opacity. */
export const FILL_OPACITY = 0.30

/** Opacity on hover — lighter to signal clickability */
export const HOVER_FILL_OPACITY = 0.65

/** Selected field fill opacity — brightest state */
export const SELECTED_FILL_OPACITY = 0.90

// ---------------------------------------------------------------------------
// Organic certification overlay
// ---------------------------------------------------------------------------

/** Dashed line pattern for organic fields overlay (MapLibre line-dasharray).
 *  [dash length, gap length] in pixels at zoom ~14 */
export const ORGANIC_DASH_PATTERN = [3, 2] as const

/** Organic border color — white-ish to contrast with any crop fill */
export const ORGANIC_BORDER_COLOR = '#E8D8C0'
export const ORGANIC_BORDER_WIDTH = 2.5

// ---------------------------------------------------------------------------
// Standard polygon border (non-organic fields)
// ---------------------------------------------------------------------------
export const STANDARD_BORDER_COLOR = 'rgba(255,255,255,0.6)'
export const STANDARD_BORDER_WIDTH = 2

// ---------------------------------------------------------------------------
// Default map view
// ---------------------------------------------------------------------------

/** Default map center used as a loading fallback only.
 *  At runtime, fitBounds() on all field polygons is the canonical initial view.
 *  [lng, lat] — MapLibre uses [lng, lat] order. */
export const DEFAULT_MAP_CENTER: [number, number] = [-92.5, 41.9]

/** Default zoom used when no field boundaries are loaded yet. */
export const DEFAULT_MAP_ZOOM = 13

// ---------------------------------------------------------------------------
// Canvas panel geometry
// ---------------------------------------------------------------------------
// Detail panels are overlays, not reflows: the map container keeps its size and
// the *camera* gets padded instead. That is what stops the map re-laying-out on
// every selection, and it is why these widths have to be shared — the panel CSS
// width and the camera padding are the same number in two places, and they
// silently disagree the moment one of them is edited alone.

/** Field detail panel on the main map (`w-96`). */
export const FIELD_PANEL_W = 384

/** CLU panel on the FSA reporting map. */
export const CLU_PANEL_W = 320

/** Below this width a panel covers most of the screen, so padding is pointless. */
export const PANEL_PAD_MIN_VIEWPORT = 768

/** Camera padding for a right-docked panel, or zero on narrow screens. */
export function panelPadding(panelWidth: number) {
  const right =
    typeof window !== 'undefined' && window.innerWidth > PANEL_PAD_MIN_VIEWPORT
      ? panelWidth
      : 0
  return { top: 0, bottom: 0, left: 0, right }
}

/** Camera padding reset — used when a panel closes so the map recenters. */
export const NO_PANEL_PADDING = { top: 0, bottom: 0, left: 0, right: 0 }

// ---------------------------------------------------------------------------
// Satellite tile style URL
// ---------------------------------------------------------------------------

/**
 * Returns the MapLibre GL style URL for satellite imagery.
 *
 * Priority order:
 * 1. MapTiler Cloud satellite (free tier, requires NEXT_PUBLIC_MAPTILER_KEY).
 *    Register a free key at https://cloud.maptiler.com/account/keys/
 *    The key is a public API key — safe to expose in client-side code.
 * 2. MapLibre demo tiles fallback (no key required, lower quality, for dev/preview).
 *
 * No Mapbox token is required. No hybrid or street style is provided in this phase.
 */
export function getSatelliteStyleUrl(): string {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (maptilerKey) {
    return `https://api.maptiler.com/maps/satellite/style.json?key=${maptilerKey}`
  }
  return 'https://demotiles.maplibre.org/style.json'
}

/**
 * Returns a MapLibre satellite style — either a MapTiler style URL (if key set)
 * or an inline ESRI World Imagery raster style (free, no API key required).
 * MapLibre Map constructor accepts both string URLs and inline style objects.
 */
export function getSatelliteStyle(): string | object {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (maptilerKey) {
    return `https://api.maptiler.com/maps/satellite/style.json?key=${maptilerKey}`
  }
  return {
    version: 8,
    sources: {
      'esri-sat': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'sat', type: 'raster', source: 'esri-sat' }],
  }
}
