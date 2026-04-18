'use client'

import { useEffect, useRef, useState } from 'react'
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
import { MapLegend } from './map-legend'

// MapLibre GL JS types only — the actual library is loaded dynamically inside
// useEffect to avoid SSR issues (MapLibre requires the browser `window` global).
import type { Map, Popup, ExpressionSpecification } from 'maplibre-gl'

interface GeoJSONGeometry {
  type: string
  coordinates: unknown
}

interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties: FieldProperties & Record<string, unknown>
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

/**
 * Flatten all polygon/multipolygon coordinates into [lng, lat] pairs.
 * Used to compute the bounding box for fitBounds().
 */
function flattenCoordinates(geometry: GeoJSONGeometry): [number, number][] {
  const result: [number, number][] = []

  function walk(coords: unknown) {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') {
      result.push([coords[0] as number, coords[1] as number])
    } else {
      for (const c of coords) walk(c)
    }
  }

  if (geometry.type === 'Polygon') {
    // Only outer ring (index 0) is enough for bbox
    const rings = geometry.coordinates as unknown[][]
    if (rings.length > 0) walk(rings[0])
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as unknown[][][]
    for (const poly of polys) {
      if (poly.length > 0) walk(poly[0])
    }
  }

  return result
}

/**
 * FieldMap — interactive satellite map with all 56 farm fields.
 *
 * Key behaviors:
 * - MapLibre GL JS loaded dynamically (no SSR — requires window)
 * - Fetches /api/maps/boundaries on load (GeoJSON FeatureCollection with crop+organic+acres)
 * - Auto-zooms to fit all field polygons using fitBounds() — NOT a hardcoded center
 * - Fields color-coded by crop (CROP_COLORS), organic fields get dashed border overlay
 * - Hover: brightens fill + shows field name tooltip
 * - Click: opens FieldDetailPanel with field data
 * - MapLegend always visible at bottom-left
 * - NO layer switcher, NO basemap toggle — satellite only (per CONTEXT.md locked decision)
 */
export function FieldMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const hoveredIdRef = useRef<string | number | null>(null)

  const [selectedField, setSelectedField] = useState<FieldProperties | null>(null)
  const [activeCrops, setActiveCrops] = useState<string[]>([])
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return
    // Guard: only initialize once
    if (mapRef.current) return

    let mapInstance: Map | null = null

    async function initMap() {
      try {
        // Dynamic import avoids SSR — MapLibre requires `window`
        const maplibregl = await import('maplibre-gl')
        // @ts-expect-error — CSS module import (handled by Next.js/webpack at runtime)
        await import('maplibre-gl/dist/maplibre-gl.css')

        if (!mapContainerRef.current) return

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style: getSatelliteStyleUrl(),
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          // Attribution is required for satellite tile providers
          attributionControl: { compact: true },
        })

        mapRef.current = mapInstance

        mapInstance.on('load', async () => {
          // Fetch field boundaries (enriched with crop + organic + reportingAcres server-side)
          let featureCollection: FeatureCollection = { type: 'FeatureCollection', features: [] }
          try {
            const res = await fetch('/api/maps/boundaries')
            if (res.ok) {
              featureCollection = await res.json()
            }
          } catch {
            // Graceful degradation: map renders, fields just won't appear
          }

          if (!mapInstance) return

          // ----------------------------------------------------------------
          // Auto-zoom: fitBounds to all field polygons (per CONTEXT.md)
          // ----------------------------------------------------------------
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
          for (const feature of featureCollection.features) {
            const coords = flattenCoordinates(feature.geometry)
            for (const [lng, lat] of coords) {
              if (lng < minLng) minLng = lng
              if (lng > maxLng) maxLng = lng
              if (lat < minLat) minLat = lat
              if (lat > maxLat) maxLat = lat
            }
          }
          if (isFinite(minLng)) {
            mapInstance.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
              padding: 40,
              animate: false,
            })
          }

          // Collect unique crop names present on the map for legend
          const cropSet = new Set<string>()
          for (const f of featureCollection.features) {
            const crop = f.properties?.crop
            if (crop && typeof crop === 'string') cropSet.add(crop)
          }
          setActiveCrops(Array.from(cropSet).sort())

          // ----------------------------------------------------------------
          // Layer setup
          // ----------------------------------------------------------------
          mapInstance.addSource('fields', {
            type: 'geojson',
            // Cast to any to satisfy strict GeoJSON typing — our FeatureCollection is valid GeoJSON
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: featureCollection as any,
            // Promote id so feature-state works for hover
            promoteId: 'registry_field_id',
          })

          // Build match expression for fill color from CROP_COLORS.
          // Cast to ExpressionSpecification — dynamically built from CROP_COLORS at runtime.
          const colorExpression = [
            'match',
            ['get', 'crop'],
            ...Object.entries(CROP_COLORS)
              .filter(([k]) => !k.startsWith('__'))
              .flatMap(([crop, color]) => [crop, color]),
            CROP_COLORS.__unassigned, // fallback for null / unknown crop
          ] as unknown as ExpressionSpecification

          // Layer 1: crop fill
          mapInstance.addLayer({
            id: 'fields-fill',
            type: 'fill',
            source: 'fields',
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': FILL_OPACITY,
            },
          })

          // Layer 2: standard border (all fields)
          mapInstance.addLayer({
            id: 'fields-border',
            type: 'line',
            source: 'fields',
            paint: {
              'line-color': STANDARD_BORDER_COLOR,
              'line-width': STANDARD_BORDER_WIDTH,
            },
          })

          // Layer 3: organic dashed border overlay (organic fields only)
          mapInstance.addLayer({
            id: 'fields-organic-border',
            type: 'line',
            source: 'fields',
            filter: ['==', ['get', 'organic'], true],
            paint: {
              'line-color': ORGANIC_BORDER_COLOR,
              'line-width': ORGANIC_BORDER_WIDTH,
              'line-dasharray': ORGANIC_DASH_PATTERN as unknown as number[],
            },
          })

          // Layer 4: hover highlight (feature-state based)
          mapInstance.addLayer({
            id: 'fields-hover',
            type: 'fill',
            source: 'fields',
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                HOVER_FILL_OPACITY,
                0,
              ],
            },
          })

          // ----------------------------------------------------------------
          // Hover interaction
          // ----------------------------------------------------------------
          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'field-map-popup',
          })
          popupRef.current = popup

          mapInstance.on('mousemove', 'fields-fill', (e) => {
            if (!mapInstance || !e.features || e.features.length === 0) return

            mapInstance.getCanvas().style.cursor = 'pointer'

            const feature = e.features[0]
            const featureId = feature.id

            // Clear previous hover state
            if (hoveredIdRef.current !== null && hoveredIdRef.current !== featureId) {
              mapInstance.setFeatureState(
                { source: 'fields', id: hoveredIdRef.current },
                { hover: false }
              )
            }

            hoveredIdRef.current = featureId ?? null

            if (featureId !== undefined && featureId !== null) {
              mapInstance.setFeatureState(
                { source: 'fields', id: featureId },
                { hover: true }
              )
            }

            // Tooltip: field name only
            const name = feature.properties?.name ?? 'Unknown field'
            popup
              .setLngLat(e.lngLat)
              .setHTML(`<span>${name}</span>`)
              .addTo(mapInstance)
          })

          mapInstance.on('mouseleave', 'fields-fill', () => {
            if (!mapInstance) return
            mapInstance.getCanvas().style.cursor = ''

            if (hoveredIdRef.current !== null) {
              mapInstance.setFeatureState(
                { source: 'fields', id: hoveredIdRef.current },
                { hover: false }
              )
              hoveredIdRef.current = null
            }

            popup.remove()
          })

          // ----------------------------------------------------------------
          // Click interaction — open detail panel
          // ----------------------------------------------------------------
          mapInstance.on('click', 'fields-fill', (e) => {
            if (!e.features || e.features.length === 0) return
            const props = e.features[0].properties as FieldProperties
            setSelectedField(props)
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

    return () => {
      mapInstance?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* MapLibre map container */}
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

      {/* Legend — always visible, bottom-left, positioned inside the map container */}
      <MapLegend crops={activeCrops} />

      {/* Detail panel — slide in from right when a field is selected */}
      <FieldDetailPanel
        field={selectedField}
        onClose={() => setSelectedField(null)}
      />

      {/* MapLibre popup tooltip styles */}
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
