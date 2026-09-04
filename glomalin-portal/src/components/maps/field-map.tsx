'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CROP_COLORS,
  FILL_OPACITY,
  HOVER_FILL_OPACITY,
  ORGANIC_DASH_PATTERN,
  ORGANIC_BORDER_COLOR,
  ORGANIC_BORDER_WIDTH,
  STANDARD_BORDER_COLOR,
  STANDARD_BORDER_WIDTH,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  FIELD_PANEL_W,
  NO_PANEL_PADDING,
  panelPadding,
  getSatelliteStyle,
} from '@/lib/map-config'
import { canvasColors, colors, withAlpha } from '@/lib/tokens'
import { useIsCompact } from '@/lib/use-media-query'
import { CanvasRail } from '@/components/canvas/canvas-rail'
import { CanvasSearchPill } from '@/components/canvas/canvas-search-pill'
import { FieldDetailPanel, type FieldProperties } from './field-detail-panel'
import { BoundaryImport } from './boundary-import'
import { MapLegend } from './map-legend'
import { ViewSwitcher } from './view-switcher'

/** Height of the mobile bottom tab bar the sheet has to clear. */
const MOBILE_TABBAR_H = 56

import type { Map, Popup, ExpressionSpecification } from 'maplibre-gl'

export type MapView = 'enterprise' | 'fsa'

interface GeoJSONGeometry {
  type: string
  coordinates: unknown
}

interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties: FieldProperties & Record<string, unknown>
}

interface MapMeta {
  total_acres:             number
  organic_acres:           number
  precip_configured:       boolean
  precip_avg_7d:           number | null
  precip_last_fetched:     string | null
  total_registry_fields:   number | null
  fields_with_boundaries:  number
}

interface BoundaryResponse {
  type:     'FeatureCollection'
  features: GeoJSONFeature[]
  meta?:    MapMeta
}

// Module-level color expressions — static, derived from map-config constants.
const CROP_COLOR_EXPR: ExpressionSpecification = [
  'match', ['get', 'crop'],
  ...Object.entries(CROP_COLORS)
    .filter(([k]) => !k.startsWith('__'))
    .flatMap(([crop, color]) => [crop, color]),
  CROP_COLORS.__unassigned,
] as unknown as ExpressionSpecification

// FSA status view: green = all CLUs reported, orange = any unreported, dark = no FSA data
const FSA_COLOR_EXPR: ExpressionSpecification = [
  'case',
  ['==', ['get', 'fsa_reported'], true],  colors.success,
  ['==', ['get', 'fsa_reported'], false], canvasColors.accent,
  CROP_COLORS.__unknown,
] as unknown as ExpressionSpecification

const DEFAULT_PITCH   = 25
const DEFAULT_BEARING = -8

function flattenCoordinates(geometry: GeoJSONGeometry): [number, number][] {
  const result: [number, number][] = []
  function walk(coords: unknown) {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') result.push([coords[0] as number, coords[1] as number])
    else for (const c of coords) walk(c)
  }
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as unknown[][]
    if (rings.length > 0) walk(rings[0])
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as unknown[][][]
    for (const poly of polys) { if (poly.length > 0) walk(poly[0]) }
  }
  return result
}

function formatTimeAgo(isoString: string | null): string {
  if (!isoString) return 'never'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60_000)
    return diffM < 2 ? 'just now' : `${diffM}m ago`
  }
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function getColorExpr(view: MapView): ExpressionSpecification {
  return view === 'fsa' ? FSA_COLOR_EXPR : CROP_COLOR_EXPR
}

/**
 * Frame a field with the detail panel accounted for — see panelPadding() in
 * map-config for why the camera is padded instead of the container resized.
 */
function flyToField(map: Map, lng: number, lat: number, animate = true) {
  map.flyTo({
    center:    [lng, lat],
    zoom:      Math.max(map.getZoom(), 14),
    pitch:     30,
    bearing:   DEFAULT_BEARING,
    duration:  animate ? 1000 : 0,
    padding:   panelPadding(FIELD_PANEL_W),
    essential: true,
  })
}

export function FieldMap({
  isAdmin,
  grantedModules = null,
}: {
  isAdmin?: boolean
  grantedModules?: string[] | null
}) {
  const isCompact = useIsCompact()
  const mapContainerRef  = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<Map | null>(null)
  const popupRef         = useRef<Popup | null>(null)
  const hoveredIdRef     = useRef<string | number | null>(null)
  const viewRef          = useRef<MapView>('enterprise')
  // Loaded features, kept so ?field=<id> can resolve a field without re-querying
  // the source (querySourceFeatures only sees what is currently tiled).
  const featuresRef      = useRef<GeoJSONFeature[]>([])
  const deepLinkedRef    = useRef<string | null>(null)

  const searchParams     = useSearchParams()
  const fieldParam       = searchParams.get('field')
  const [dataVersion, setDataVersion] = useState(0)

  const [selectedField, setSelectedField]   = useState<FieldProperties | null>(null)
  const [activeCrops, setActiveCrops]       = useState<string[]>([])
  const [mapMeta, setMapMeta]               = useState<MapMeta | null>(null)
  const [showPrecip, setShowPrecip]         = useState(false)
  const [isRefreshing, setIsRefreshing]     = useState(false)
  const [mapError, setMapError]             = useState<string | null>(null)
  const [view, setView]                     = useState<MapView>('enterprise')
  const [showImportPanel, setShowImportPanel] = useState(false)

  // Sync view ref so the async map init closure can read the current view.
  useEffect(() => { viewRef.current = view }, [view])

  // Switch fill colors when view changes (after map is initialized).
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('fields-fill')) return
    const expr = getColorExpr(view)
    map.setPaintProperty('fields-fill', 'fill-color', expr)
    map.setPaintProperty('fields-hover', 'fill-color', expr)
  }, [view])

  // Crossfade the precip-fill layer whenever showPrecip changes — the
  // renderer animates fill-opacity per the transition set at addLayer.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('precip-fill')) return
    map.setPaintProperty('precip-fill', 'fill-opacity', showPrecip ? 1 : 0)
  }, [showPrecip])

  const refreshBoundaries = useCallback(async () => {
    try {
      const res = await fetch('/api/maps/boundaries')
      if (!res.ok) return
      const fc: BoundaryResponse = await res.json()
      const source = mapRef.current?.getSource('fields') as { setData?: (d: unknown) => void } | undefined
      source?.setData?.(fc)
      featuresRef.current = fc.features
      if (fc.meta) setMapMeta(fc.meta)
      setDataVersion((v) => v + 1)
    } catch {/* non-blocking */}
  }, [])

  const handlePrecipRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/weather/precip/refresh', { method: 'POST' })
      if (res.ok) await refreshBoundaries()
    } catch {/* non-blocking */} finally {
      setIsRefreshing(false)
    }
  }, [refreshBoundaries])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let mapInstance: Map | null = null
    // initMap is async, so an unmount can land *before* mapInstance is assigned.
    // Without this flag the cleanup had nothing to remove and the next mount
    // built a second MapLibre instance on the same container — two canvases,
    // two tile pipelines, two sets of handlers. React's development double-mount
    // reproduced it every time.
    let cancelled = false

    async function initMap() {
      try {
        const maplibregl = await import('maplibre-gl')
        // @ts-expect-error — CSS module import
        await import('maplibre-gl/dist/maplibre-gl.css')

        if (cancelled || !mapContainerRef.current) return

        mapInstance = new maplibregl.Map({
          container:          mapContainerRef.current,
          // getSatelliteStyle, not getSatelliteStyleUrl: without a MapTiler key
          // the URL variant falls back to MapLibre demotiles — a blank political
          // basemap — so the field map rendered as an empty green void anywhere
          // the key is unset, while the two FSA maps (already on this helper)
          // showed real ESRI imagery. Same fallback everywhere now.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style:              getSatelliteStyle() as any,
          center:             DEFAULT_MAP_CENTER,
          zoom:               DEFAULT_MAP_ZOOM,
          pitch:              DEFAULT_PITCH,
          bearing:            DEFAULT_BEARING,
          attributionControl: { compact: true },
        })
        // Unmounted while the style was loading — drop it rather than leaking.
        if (cancelled) { mapInstance.remove(); mapInstance = null; return }
        mapRef.current = mapInstance

        mapInstance.on('load', async () => {
          let fc: BoundaryResponse = { type: 'FeatureCollection', features: [] }
          try {
            const res = await fetch('/api/maps/boundaries')
            if (res.ok) fc = await res.json()
          } catch {/* graceful degradation */}

          if (!mapInstance) return
          if (fc.meta) setMapMeta(fc.meta)
          featuresRef.current = fc.features

          // Auto-zoom to all fields, preserving tilt
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
          for (const feature of fc.features) {
            for (const [lng, lat] of flattenCoordinates(feature.geometry)) {
              if (lng < minLng) minLng = lng
              if (lng > maxLng) maxLng = lng
              if (lat < minLat) minLat = lat
              if (lat > maxLat) maxLat = lat
            }
          }
          if (isFinite(minLng)) {
            mapInstance.fitBounds(
              [[minLng, minLat], [maxLng, maxLat]],
              { padding: 40, animate: false, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING }
            )
          }

          const cropSet = new Set<string>()
          for (const f of fc.features) {
            const crop = f.properties?.crop
            if (crop && typeof crop === 'string') cropSet.add(crop)
          }
          setActiveCrops(Array.from(cropSet).sort())

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mapInstance.addSource('fields', { type: 'geojson', data: fc as any, promoteId: 'registry_field_id' })

          // Use current view from ref (may have changed before map finished loading)
          const colorExpr = getColorExpr(viewRef.current)

          // Layer 1: crop/fsa fill
          mapInstance.addLayer({
            id: 'fields-fill', type: 'fill', source: 'fields',
            paint: { 'fill-color': colorExpr, 'fill-opacity': FILL_OPACITY },
          })

          // Layer 2: precip overlay (hidden by default via fill-opacity: 0,
          // not visibility, so the GL renderer can crossfade the toggle —
          // the 300ms fade keeps the eye anchored instead of popping layers)
          mapInstance.addLayer({
            id: 'precip-fill', type: 'fill', source: 'fields',
            paint: {
              'fill-opacity': 0,
              'fill-opacity-transition': { duration: 300 },
              'fill-color': [
                'step',
                ['coalesce', ['get', 'last_7d_in'], -1],
                'rgba(0,0,0,0)',
                0.01, 'rgba(180,210,255,0.30)',
                0.5,  'rgba(100,165,240,0.48)',
                1.5,  'rgba(50,120,220,0.60)',
                3.0,  'rgba(20,80,200,0.72)',
              ] as unknown as ExpressionSpecification,
            },
          })

          // Layer 3: standard border
          mapInstance.addLayer({
            id: 'fields-border', type: 'line', source: 'fields',
            paint: { 'line-color': STANDARD_BORDER_COLOR, 'line-width': STANDARD_BORDER_WIDTH },
          })

          // Layer 4: organic dashed border
          mapInstance.addLayer({
            id: 'fields-organic-border', type: 'line', source: 'fields',
            filter: ['==', ['get', 'organic'], true],
            paint: {
              'line-color': ORGANIC_BORDER_COLOR,
              'line-width': ORGANIC_BORDER_WIDTH,
              'line-dasharray': ORGANIC_DASH_PATTERN as unknown as number[],
            },
          })

          // Layer 5: hover highlight
          mapInstance.addLayer({
            id: 'fields-hover', type: 'fill', source: 'fields',
            paint: {
              'fill-color': colorExpr,
              'fill-opacity': [
                'case', ['boolean', ['feature-state', 'hover'], false],
                HOVER_FILL_OPACITY, 0,
              ],
            },
          })

          // Hover interactions
          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'field-map-popup' })
          popupRef.current = popup

          mapInstance.on('mousemove', 'fields-fill', (e) => {
            if (!mapInstance || !e.features?.length) return
            mapInstance.getCanvas().style.cursor = 'pointer'
            const feature   = e.features[0]
            const featureId = feature.id
            if (hoveredIdRef.current !== null && hoveredIdRef.current !== featureId) {
              mapInstance.setFeatureState({ source: 'fields', id: hoveredIdRef.current }, { hover: false })
            }
            hoveredIdRef.current = featureId ?? null
            if (featureId != null) {
              mapInstance.setFeatureState({ source: 'fields', id: featureId }, { hover: true })
            }
            const name = feature.properties?.name ?? 'Unknown field'
            popup.setLngLat(e.lngLat).setHTML(`<span>${name}</span>`).addTo(mapInstance)
          })

          mapInstance.on('mouseleave', 'fields-fill', () => {
            if (!mapInstance) return
            mapInstance.getCanvas().style.cursor = ''
            if (hoveredIdRef.current !== null) {
              mapInstance.setFeatureState({ source: 'fields', id: hoveredIdRef.current }, { hover: false })
              hoveredIdRef.current = null
            }
            popup.remove()
          })

          // Click → fly to field centroid, open detail panel
          mapInstance.on('click', 'fields-fill', (e) => {
            if (!mapInstance || !e.features?.length) return
            const props = e.features[0].properties as FieldProperties

            const lng = (props.centroid_lng ?? e.lngLat.lng) as number
            const lat = (props.centroid_lat ?? e.lngLat.lat) as number
            flyToField(mapInstance, lng, lat)

            setSelectedField({
              ...props,
              fsa_reported: props.fsa_reported ?? null,
              last_7d_in:   props.last_7d_in  ?? null,
              last_30d_in:  props.last_30d_in ?? null,
            })
          })

          // Signals the deep-link effect that features are available.
          setDataVersion((v) => v + 1)
        })

        mapInstance.on('error', (e) => {
          console.error('[FieldMap] MapLibre error:', e.error)
          setMapError('Map failed to load. Check your network connection.')
        })

      } catch (err) {
        console.error('[FieldMap] Failed to initialize map:', err)
        setMapError('Failed to load map library.')
      }
    }

    initMap()
    return () => {
      cancelled = true
      // Prefer the ref: if init finished, that is the live instance. The local
      // is the fallback for a teardown that lands mid-init.
      const live = mapRef.current ?? mapInstance
      live?.remove()
      mapRef.current = null
    }
  }, [])

  // ?field=<registry_field_id> — opens a field directly from the command palette
  // or any shared link. Every object needs a URL; a jump that can't be linked to
  // is a jump only the palette can make.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !fieldParam) return
    if (deepLinkedRef.current === fieldParam) return
    if (featuresRef.current.length === 0) return

    const match = featuresRef.current.find(
      (f) => f.properties?.registry_field_id === fieldParam
    )
    if (!match) return

    deepLinkedRef.current = fieldParam
    const props = match.properties
    if (props.centroid_lng != null && props.centroid_lat != null) {
      flyToField(map, Number(props.centroid_lng), Number(props.centroid_lat))
    }
    setSelectedField({
      ...props,
      fsa_reported: props.fsa_reported ?? null,
      last_7d_in:   props.last_7d_in  ?? null,
      last_30d_in:  props.last_30d_in ?? null,
    })
  }, [fieldParam, dataVersion])

  const precipAvg     = mapMeta?.precip_avg_7d
  const precipUpdated = mapMeta?.precip_last_fetched

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-glomalin-canvas-bg">
          <div className="rounded border border-glomalin-canvas-border bg-glomalin-canvas-surface px-8 py-10 text-center max-w-md">
            <p className="text-glomalin-canvas-accent font-mono text-sm font-semibold mb-2">Map Error</p>
            <p className="text-glomalin-canvas-muted font-mono text-sm">{mapError}</p>
          </div>
        </div>
      )}

      {/* ── Canvas chrome ──────────────────────────────────────────────────
          Corner slots over a full-bleed map, rather than a bar across the top.
          The rail is desktop-only: on a phone the bottom tab bar already
          carries module reach, and 48px of rail would just be another edge. */}

      <CanvasRail
        grantedModules={grantedModules}
        layersContent={
          <div className="px-4 space-y-3">
            {mapMeta?.precip_configured ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrecip((v) => !v)}
                  aria-pressed={showPrecip}
                  className={[
                    'flex-1 px-2.5 py-1.5 rounded border text-[10px] font-mono uppercase tracking-widest transition-colors',
                    showPrecip
                      ? 'border-[#7BAFD4] text-[#7BAFD4] bg-[#7BAFD4]/10'
                      : 'border-glomalin-canvas-border text-glomalin-canvas-muted hover:border-glomalin-canvas-muted hover:text-glomalin-canvas-text',
                  ].join(' ')}
                >
                  ☁ Precipitation
                </button>
                <button
                  onClick={handlePrecipRefresh}
                  disabled={isRefreshing}
                  title="Refresh precipitation data"
                  aria-label="Refresh precipitation data"
                  className="w-8 h-8 flex items-center justify-center rounded border border-glomalin-canvas-border text-glomalin-canvas-muted hover:text-glomalin-canvas-text disabled:opacity-40 transition-colors text-xs"
                >
                  {isRefreshing ? '…' : '↻'}
                </button>
              </div>
            ) : (
              <p className="text-glomalin-canvas-muted font-mono text-xs">
                Precipitation layer not configured.
              </p>
            )}

            {precipAvg != null && (
              <p className="font-mono text-[11px] text-glomalin-canvas-muted">
                7d avg <span className="text-[#7BAFD4]">{precipAvg.toFixed(2)}&Prime;</span>
                {' · '}updated {formatTimeAgo(precipUpdated ?? null)}
              </p>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowImportPanel((v) => !v)}
                className={[
                  'w-full px-2.5 py-1.5 rounded border text-[10px] font-mono uppercase tracking-widest transition-colors',
                  showImportPanel
                    ? 'border-glomalin-canvas-accent text-glomalin-canvas-accent bg-glomalin-canvas-accent/10'
                    : 'border-glomalin-canvas-border text-glomalin-canvas-muted hover:border-glomalin-canvas-muted hover:text-glomalin-canvas-text',
                ].join(' ')}
              >
                ⬆ Import boundaries
              </button>
            )}
          </div>
        }
      />

      {/* Top-left: search pill — clears the rail on desktop */}
      <div className="absolute top-3 left-3 md:left-[60px] z-20">
        <CanvasSearchPill />
      </div>

      {/* Top-right: farm stats, read-only */}
      {mapMeta && (
        <div
          className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-3 h-10 px-4 rounded-full font-mono text-xs border border-glomalin-canvas-border shadow-lg"
          style={{ backgroundColor: withAlpha(canvasColors.bg, 0.85), backdropFilter: 'blur(8px)' }}
        >
          <span className="text-glomalin-canvas-muted uppercase tracking-widest text-[10px]">Farm</span>
          <span className="text-glomalin-canvas-text tabular-nums">{mapMeta.total_acres.toLocaleString()} ac</span>
          <span className="text-glomalin-canvas-border">·</span>
          <span className="text-[#7A9E7E] tabular-nums">{mapMeta.organic_acres.toLocaleString()} organic</span>
          {showPrecip && precipAvg != null && (
            <>
              <span className="text-glomalin-canvas-border">·</span>
              <span className="text-[#7BAFD4] tabular-nums">{precipAvg.toFixed(2)}&Prime;</span>
            </>
          )}
        </div>
      )}

      {/* Boundary import panel — admin only, slides in from right */}
      {isAdmin && showImportPanel && (
        <div
          className="absolute top-0 right-0 bottom-0 z-40 w-[400px] max-w-[92vw] overflow-y-auto"
          style={{ backgroundColor: withAlpha(canvasColors.bg, 0.96), borderLeft: `1px solid ${canvasColors.border}`, backdropFilter: 'blur(6px)' }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono text-sm text-glomalin-canvas-accent uppercase tracking-wider">
                Import Boundaries
              </h2>
              <button
                onClick={() => setShowImportPanel(false)}
                className="text-glomalin-canvas-muted hover:text-glomalin-canvas-text font-mono text-sm transition-colors px-1"
              >
                ✕
              </button>
            </div>

            {mapMeta && mapMeta.total_registry_fields != null && (
              <div className="mb-5 p-3 border border-glomalin-canvas-border rounded bg-[#0a0805]">
                <p className="font-mono text-[10px] text-glomalin-canvas-muted uppercase tracking-wider mb-1">
                  Boundary Coverage
                </p>
                <p className="font-mono text-sm text-glomalin-canvas-text">
                  {mapMeta.fields_with_boundaries}{' '}
                  <span className="text-glomalin-canvas-muted">of</span>{' '}
                  {mapMeta.total_registry_fields} registry fields
                </p>
              </div>
            )}

            <p className="font-mono text-xs text-glomalin-canvas-muted mb-5 leading-relaxed">
              Upload a .zip shapefile export from SMS. Feature names are matched
              to field names and aliases in the Farm Registry via{' '}
              <span className="text-glomalin-canvas-text">registry_field_id</span>.
              Import replaces all existing boundaries.
            </p>

            <BoundaryImport onSuccess={refreshBoundaries} />
          </div>
        </div>
      )}

      {/* Legend — hidden in FSA view (crop colors don't apply) */}
      {view === 'enterprise' && (
        <MapLegend crops={activeCrops} showPrecip={showPrecip} />
      )}

      {/* View switcher */}
      <ViewSwitcher view={view} onChange={setView} />

      {/* Field detail — right-docked panel on desktop, bottom sheet on mobile */}
      <FieldDetailPanel
        field={selectedField}
        variant={isCompact ? 'sheet' : 'panel'}
        sheetBottomOffset={MOBILE_TABBAR_H}
        onClose={() => {
          setSelectedField(null)
          // Ease the camera padding back out as the panel leaves — the map
          // recenters itself instead of jumping when the panel disappears
          mapRef.current?.easeTo({
            padding: NO_PANEL_PADDING,
            duration: 500,
          })
        }}
      />

      <style>{`
        .maplibregl-popup .maplibregl-popup-content,
        .field-map-popup .maplibregl-popup-content {
          background: ${canvasColors.surface};
          border: 1px solid ${canvasColors.border};
          border-radius: 4px;
          padding: 6px 10px;
          font-family: ui-monospace, monospace;
          font-size: 12px;
          color: ${canvasColors.text};
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        }
        .maplibregl-popup .maplibregl-popup-tip,
        .field-map-popup .maplibregl-popup-tip {
          border-top-color: ${canvasColors.border};
        }
      `}</style>
    </div>
  )
}
