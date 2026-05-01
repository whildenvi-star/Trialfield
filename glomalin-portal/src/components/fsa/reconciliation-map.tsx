'use client'

import { useEffect, useRef } from 'react'
import type { GeoJSONFeatureCollection } from '@/lib/fsa/reconciliation'

// Status → fill color mapping (dark soil palette)
const STATUS_COLORS: Record<string, string> = {
  ok:         '#7A9E7E',   // green
  flagged:    '#ffb800',   // amber
  unresolved: '#ff3b30',   // red
}

const STATUS_ALPHA = 0.35
const HIGHLIGHT_ALPHA = 0.65

interface ReconciliationMapProps {
  /** GeoJSON to display — either CLU boundaries or zone geometry */
  geojson: GeoJSONFeatureCollection
  /** Which map panel this is ('clu' = right panel, 'zone' = left panel) */
  panel: 'clu' | 'zone'
  /** clu_label of the currently highlighted row, if any */
  highlightClu?: string | null
  /** Callback when a feature is clicked */
  onFeatureClick?: (cluLabel: string) => void
  className?: string
}

export function ReconciliationMap({
  geojson,
  panel,
  highlightClu,
  onFeatureClick,
  className = '',
}: ReconciliationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  const sourceId = `recon-${panel}`
  const fillLayer = `${sourceId}-fill`
  const lineLayer = `${sourceId}-line`

  // Stable click handler reference
  const onClickRef = useRef(onFeatureClick)
  onClickRef.current = onFeatureClick

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Lazy-import maplibre-gl so it doesn't SSR (WebGL requires browser)
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (!containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-base',
              type: 'raster',
              source: 'osm-tiles',
              paint: { 'raster-opacity': 0.4 },
            },
          ],
        },
        center: [-88.97, 42.71], // Rock County WI centroid
        zoom: 11,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      map.on('load', () => {
        // Add source with empty data initially
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        // Fill layer — colored by status
        map.addLayer({
          id: fillLayer,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'status'], 'ok'],         STATUS_COLORS.ok,
              ['==', ['get', 'status'], 'flagged'],     STATUS_COLORS.flagged,
              ['==', ['get', 'status'], 'unresolved'],  STATUS_COLORS.unresolved,
              '#64748b',  // muted default
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['get', 'highlighted'], false],
              HIGHLIGHT_ALPHA,
              STATUS_ALPHA,
            ],
          },
        })

        // Outline
        map.addLayer({
          id: lineLayer,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'highlighted'], false],
              '#ffffff',
              '#1e293b',
            ],
            'line-width': [
              'case',
              ['boolean', ['get', 'highlighted'], false],
              2,
              1,
            ],
          },
        })

        // Click handler
        map.on('click', fillLayer, (e) => {
          const feat = e.features?.[0]
          if (!feat) return
          const clu = feat.properties?.clu_label as string | undefined
          if (clu) onClickRef.current?.(clu)
        })

        map.on('mouseenter', fillLayer, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', fillLayer, () => {
          map.getCanvas().style.cursor = ''
        })

        mapRef.current = map
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update source data when geojson changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource(sourceId)
    if (!source) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(source as any).setData(geojson)

    // Fit bounds to features if we have geometry
    if (geojson.features.length > 0) {
      import('maplibre-gl').then(({ default: maplibregl }) => {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
        for (const feat of geojson.features) {
          for (const ring of feat.geometry.coordinates) {
            for (const [lng, lat] of ring) {
              if (lng < minLng) minLng = lng
              if (lat < minLat) minLat = lat
              if (lng > maxLng) maxLng = lng
              if (lat > maxLat) maxLat = lat
            }
          }
        }
        if (isFinite(minLng)) {
          map.fitBounds(
            new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]),
            { padding: 40, maxZoom: 17, duration: 600 }
          )
        }
      })
    }
  }, [geojson, sourceId])

  // Update highlighted feature without re-fitting bounds
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource(sourceId)
    if (!source) return

    // Re-set data with updated highlighted property
    const updated: GeoJSONFeatureCollection = {
      ...geojson,
      features: geojson.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          highlighted: f.properties?.clu_label === highlightClu,
        },
      })),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(source as any).setData(updated)
  }, [highlightClu, geojson, sourceId])

  const label = panel === 'clu' ? 'FSA CLU Boundaries' : 'Management Zones'

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div className="px-3 py-1.5 border-b border-glomalin-border bg-glomalin-surface">
        <span className="text-[10px] font-mono text-glomalin-muted uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
      {/* Legend */}
      <div className="absolute bottom-6 left-2 flex flex-col gap-1 pointer-events-none">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            <span className="text-[9px] font-mono text-white/70 capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
