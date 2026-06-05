'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  getSatelliteStyleUrl,
} from '@/lib/map-config'
import { FieldDetailPanel, type FieldProperties } from './field-detail-panel'
import { BoundaryImport } from './boundary-import'
import { MapLegend } from './map-legend'
import { ViewSwitcher } from './view-switcher'

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
  ['==', ['get', 'fsa_reported'], true],  '#7A9E7E',
  ['==', ['get', 'fsa_reported'], false], '#C8860A',
  '#3a3028',
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

export function FieldMap({ isAdmin }: { isAdmin?: boolean }) {
  const mapContainerRef  = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<Map | null>(null)
  const popupRef         = useRef<Popup | null>(null)
  const hoveredIdRef     = useRef<string | number | null>(null)
  const viewRef          = useRef<MapView>('enterprise')

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

  // Toggle the precip-fill layer visibility whenever showPrecip changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('precip-fill')) return
    map.setLayoutProperty('precip-fill', 'visibility', showPrecip ? 'visible' : 'none')
  }, [showPrecip])

  const refreshBoundaries = useCallback(async () => {
    try {
      const res = await fetch('/api/maps/boundaries')
      if (!res.ok) return
      const fc: BoundaryResponse = await res.json()
      const source = mapRef.current?.getSource('fields') as { setData?: (d: unknown) => void } | undefined
      source?.setData?.(fc)
      if (fc.meta) setMapMeta(fc.meta)
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

    async function initMap() {
      try {
        const maplibregl = await import('maplibre-gl')
        // @ts-expect-error — CSS module import
        await import('maplibre-gl/dist/maplibre-gl.css')

        if (!mapContainerRef.current) return

        mapInstance = new maplibregl.Map({
          container:          mapContainerRef.current,
          style:              getSatelliteStyleUrl(),
          center:             DEFAULT_MAP_CENTER,
          zoom:               DEFAULT_MAP_ZOOM,
          pitch:              DEFAULT_PITCH,
          bearing:            DEFAULT_BEARING,
          attributionControl: { compact: true },
        })
        mapRef.current = mapInstance

        mapInstance.on('load', async () => {
          let fc: BoundaryResponse = { type: 'FeatureCollection', features: [] }
          try {
            const res = await fetch('/api/maps/boundaries')
            if (res.ok) fc = await res.json()
          } catch {/* graceful degradation */}

          if (!mapInstance) return
          if (fc.meta) setMapMeta(fc.meta)

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

          // Layer 2: precip overlay (hidden by default)
          mapInstance.addLayer({
            id: 'precip-fill', type: 'fill', source: 'fields',
            layout: { visibility: 'none' },
            paint: {
              'fill-color': [
                'step',
                ['coalesce', ['get', 'last_7d_in'], -1],
                'rgba(0,0,0,0)',
                0.01, 'rgba(180,210,255,0.30)',
                0.5,  'rgba(100,165,240,0.48)',
                1.5,  'rgba(50,120,220,0.60)',
                3.0,  'rgba(20,80,200,0.72)',
              ] as unknown as ExpressionSpecification,
              'fill-opacity': 1,
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
            mapInstance.flyTo({
              center:   [lng, lat],
              zoom:     Math.max(mapInstance.getZoom(), 14),
              pitch:    30,
              bearing:  DEFAULT_BEARING,
              duration: 1000,
              essential: true,
            })

            setSelectedField({
              ...props,
              fsa_reported: props.fsa_reported ?? null,
              last_7d_in:   props.last_7d_in  ?? null,
              last_30d_in:  props.last_30d_in ?? null,
            })
          })
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
    return () => { mapInstance?.remove(); mapRef.current = null }
  }, [])

  const precipAvg     = mapMeta?.precip_avg_7d
  const precipUpdated = mapMeta?.precip_last_fetched

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Error state */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080604]">
          <div className="rounded border border-[#2a2218] bg-[#0e0c0b] px-8 py-10 text-center max-w-md">
            <p className="text-[#C8860A] font-mono text-sm font-semibold mb-2">Map Error</p>
            <p className="text-[#6a5a4a] font-mono text-sm">{mapError}</p>
          </div>
        </div>
      )}

      {/* Summary bar — always visible for admins, conditionally for others once mapMeta loads */}
      {(mapMeta || isAdmin) && (
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center gap-5 px-4 h-10 font-mono text-xs"
          style={{ backgroundColor: 'rgba(8, 6, 4, 0.82)', backdropFilter: 'blur(4px)', borderBottom: '1px solid #2a2218' }}
        >
          {mapMeta && (
            <>
              <span className="text-[#6a5a4a] uppercase tracking-widest text-[10px]">Farm</span>
              <span className="text-[#e8d8c0]">{mapMeta.total_acres.toLocaleString()} ac</span>
              <span className="text-[#2a2218]">·</span>
              <span className="text-[#7A9E7E]">{mapMeta.organic_acres.toLocaleString()} organic</span>

              {mapMeta.precip_configured && precipAvg != null && (
                <>
                  <span className="text-[#2a2218]">·</span>
                  <span className="text-[#6a5a4a] uppercase tracking-widest text-[10px]">Precip (7d avg)</span>
                  <span className="text-[#7BAFD4]">{precipAvg.toFixed(2)}&Prime;</span>
                  <span className="text-[#2a2218]">·</span>
                  <span className="text-[#6a5a4a]">Updated {formatTimeAgo(precipUpdated ?? null)}</span>
                </>
              )}
            </>
          )}

          <div className="flex-1" />

          {mapMeta?.precip_configured && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrecip((v) => !v)}
                className={[
                  'px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-colors',
                  showPrecip
                    ? 'border-[#7BAFD4] text-[#7BAFD4] bg-[#7BAFD4]/10'
                    : 'border-[#2a2218] text-[#6a5a4a] hover:border-[#6a5a4a] hover:text-[#e8d8c0]',
                ].join(' ')}
              >
                ☁ Precip
              </button>
              <button
                onClick={handlePrecipRefresh}
                disabled={isRefreshing}
                title="Refresh precipitation data"
                className="text-[#6a5a4a] hover:text-[#e8d8c0] disabled:opacity-40 transition-colors text-xs px-1"
              >
                {isRefreshing ? '…' : '↻'}
              </button>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowImportPanel((v) => !v)}
              className={[
                'px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-widest transition-colors',
                showImportPanel
                  ? 'border-[#C8860A] text-[#C8860A] bg-[#C8860A]/10'
                  : 'border-[#2a2218] text-[#6a5a4a] hover:border-[#6a5a4a] hover:text-[#e8d8c0]',
              ].join(' ')}
            >
              ⬆ Boundaries
            </button>
          )}
        </div>
      )}

      {/* Boundary import panel — admin only, slides in from right */}
      {isAdmin && showImportPanel && (
        <div
          className="absolute top-10 right-0 bottom-0 z-30 w-[400px] overflow-y-auto"
          style={{ backgroundColor: 'rgba(8, 6, 4, 0.96)', borderLeft: '1px solid #2a2218', backdropFilter: 'blur(6px)' }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-mono text-sm text-[#C8860A] uppercase tracking-wider">
                Import Boundaries
              </h2>
              <button
                onClick={() => setShowImportPanel(false)}
                className="text-[#6a5a4a] hover:text-[#e8d8c0] font-mono text-sm transition-colors px-1"
              >
                ✕
              </button>
            </div>

            {mapMeta && mapMeta.total_registry_fields != null && (
              <div className="mb-5 p-3 border border-[#2a2218] rounded bg-[#0a0805]">
                <p className="font-mono text-[10px] text-[#6a5a4a] uppercase tracking-wider mb-1">
                  Boundary Coverage
                </p>
                <p className="font-mono text-sm text-[#e8d8c0]">
                  {mapMeta.fields_with_boundaries}{' '}
                  <span className="text-[#6a5a4a]">of</span>{' '}
                  {mapMeta.total_registry_fields} registry fields
                </p>
              </div>
            )}

            <p className="font-mono text-xs text-[#6a5a4a] mb-5 leading-relaxed">
              Upload a .zip shapefile export from SMS. Feature names are matched
              to field names and aliases in the Farm Registry via{' '}
              <span className="text-[#e8d8c0]">registry_field_id</span>.
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

      {/* Field detail panel */}
      <FieldDetailPanel
        field={selectedField}
        onClose={() => setSelectedField(null)}
      />

      <style>{`
        .maplibregl-popup .maplibregl-popup-content,
        .field-map-popup .maplibregl-popup-content {
          background: #0e0c0b;
          border: 1px solid #2a2218;
          border-radius: 4px;
          padding: 6px 10px;
          font-family: ui-monospace, monospace;
          font-size: 12px;
          color: #e8d8c0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        }
        .maplibregl-popup .maplibregl-popup-tip,
        .field-map-popup .maplibregl-popup-tip {
          border-top-color: #2a2218;
        }
      `}</style>
    </div>
  )
}
