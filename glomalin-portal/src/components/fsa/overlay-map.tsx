'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Map as MaplibreMap } from 'maplibre-gl'
import { getSatelliteStyle, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/map-config'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { SplitPanel, type SplitProposal } from '@/components/fsa/split-panel'

// ── Types ────────────────────────────────────────────────────────────────────

interface ZoneSummaryItem {
  zone_id?: string
  zone_name?: string
  zone_crop?: string
  zone_irrigated?: boolean
  zone_organic?: boolean
  intersection_ac?: number
  geojson: string
}

interface CoverageSummaryItem {
  event_id?: string
  op_date?: string
  product?: string
  source_adapter?: string
  applied_acres?: number
  intersection_ac?: number
  geojson: string
}

interface TripleItem {
  zone_id?: string
  zone_name?: string
  zone_crop?: string
  zone_irrigated?: boolean
  zone_organic?: boolean
  event_id?: string
  op_date?: string
  product?: string
  intersection_ac?: number
  geojson: string
}

interface OverlaySummary {
  clu_fsa_acres: number | null
  clu_crop: string | null
  clu_irrigated: boolean | null
  clu_organic: boolean | null
  total_zone_ac: number
  total_coverage_ac: number
  zones: ZoneSummaryItem[]
  coverage: CoverageSummaryItem[]
  triples: TripleItem[]
}

interface OverlayResponse {
  type: 'FeatureCollection'
  features: unknown[]
  summary: OverlaySummary
}

interface CluListItem {
  id: string
  farm_number: string
  tract_number: string
  clu: string
  sub_label?: string | null
  field_name: string | null
  farm_name: string | null
  fsa_acres: number | null
  crop: string | null
  reported: boolean
  superseded: boolean
  is_split_candidate?: boolean
}

type DrawMode = 'idle' | 'drawing' | 'preview'

const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextSubLabel(existing: string[]): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  for (const l of letters) {
    if (!existing.includes(l)) return l
  }
  return 'a'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface OverlayMapProps {
  cropYear?: number
}

export function OverlayMap({ cropYear = CURRENT_CROP_YEAR }: OverlayMapProps) {
  const mapContainerRef  = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<MaplibreMap | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef          = useRef<any>(null)

  const [loading, setLoading]                       = useState(true)
  const [mapError, setMapError]                     = useState<string | null>(null)
  const [cluList, setCluList]                       = useState<CluListItem[]>([])
  const [selectedId, setSelectedId]                 = useState<string | null>(null)
  const [overlayData, setOverlayData]               = useState<OverlayResponse | null>(null)
  const [overlayLoading, setOverlayLoading]         = useState(false)
  const [drawMode, setDrawMode]                     = useState<DrawMode>('idle')
  const [splitProposals, setSplitProposals]         = useState<SplitProposal[]>([])
  const [splitPanelOpen, setSplitPanelOpen]         = useState(false)
  const [expandedFarms, setExpandedFarms]           = useState<Set<string>>(new Set())

  // Fetch CLU list on mount
  useEffect(() => {
    fetch(`/api/fsa/clu-records?year=${cropYear}`)
      .then((r) => r.json())
      .then((d) => {
        const records: CluListItem[] = (d.records ?? []).filter(
          // Show only whole (unsplit) CLUs and sub-CLU children — exclude superseded parents
          (r: CluListItem) => !r.superseded
        )
        setCluList(records)
      })
      .catch(() => setCluList([]))
  }, [cropYear])

  // Fetch overlay data when a CLU is selected
  const fetchOverlay = useCallback(async (id: string) => {
    setOverlayLoading(true)
    setOverlayData(null)
    try {
      const res = await fetch(`/api/fsa/clu-records/${id}/overlay`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data: OverlayResponse = await res.json()
      setOverlayData(data)

      // Update map sources
      const map = mapRef.current
      if (!map) return

      const allFeatures = data.features as Array<{
        type: string
        geometry: unknown
        properties: { layer_type: string }
      }>

      const cluFC    = { type: 'FeatureCollection', features: allFeatures.filter((f) => f.properties.layer_type === 'clu') }
      const zoneFC   = { type: 'FeatureCollection', features: allFeatures.filter((f) => f.properties.layer_type === 'zone') }
      const covFC    = { type: 'FeatureCollection', features: allFeatures.filter((f) => f.properties.layer_type === 'coverage') }
      const tripleFC = { type: 'FeatureCollection', features: allFeatures.filter((f) => f.properties.layer_type === 'intersection_triple') }

      const setSource = (name: string, fc: unknown) => {
        const src = map.getSource(name) as { setData: (d: unknown) => void } | undefined
        src?.setData(fc)
      }

      setSource('overlay-clu', cluFC)
      setSource('overlay-zones', zoneFC)
      setSource('overlay-coverage', covFC)
      setSource('overlay-triples', tripleFC)

      // Auto-zoom to CLU boundary
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
      const walk = (v: unknown): void => {
        if (!Array.isArray(v)) return
        if (typeof v[0] === 'number') {
          const [lng, lat] = v as number[]
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        } else {
          for (const c of v) walk(c)
        }
      }
      for (const f of cluFC.features) {
        walk((f as { geometry: { coordinates: unknown } }).geometry.coordinates)
      }
      if (isFinite(minLng)) {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 600 })
      }
    } catch {
      setOverlayData(null)
    } finally {
      setOverlayLoading(false)
    }
  }, [])

  const handleSelectClu = useCallback((id: string) => {
    setSelectedId(id)
    setOverlayData(null)
    setDrawMode('idle')
    fetchOverlay(id)
  }, [fetchOverlay])

  // "Split by zones" — create proposals from zone intersection features
  function proposeZoneSplits() {
    if (!overlayData || !selectedId) return
    const zones = overlayData.summary.zones
    if (zones.length === 0) return

    const proposals: SplitProposal[] = zones.map((z, i) => ({
      sub_label:    String.fromCharCode(97 + i),   // 'a', 'b', 'c', ...
      geojson:      z.geojson,
      acres:        z.intersection_ac ?? 0,
      crop:         z.zone_crop && z.zone_crop !== '(none)' ? z.zone_crop : '',
      irrigated:    z.zone_irrigated ?? false,
      organic:      z.zone_organic ?? false,
      use:          '',
      source_label: `Zone: ${z.zone_name ?? z.zone_id ?? '?'}`,
    }))

    setSplitProposals(proposals)
    setSplitPanelOpen(true)
  }

  // "Split by coverage" — create proposals from coverage event intersection features
  function proposeCoverageSplits() {
    if (!overlayData || !selectedId) return
    const events = overlayData.summary.coverage
    if (events.length === 0) return

    const selectedClu = cluList.find((c) => c.id === selectedId)
    const baseCrop    = selectedClu?.crop ?? ''

    const proposals: SplitProposal[] = events.map((ev, i) => ({
      sub_label:    String.fromCharCode(97 + i),
      geojson:      ev.geojson,
      acres:        ev.intersection_ac ?? 0,
      crop:         baseCrop,
      irrigated:    false,
      organic:      false,
      use:          '',
      source_label: `Coverage ${ev.op_date ?? '—'} · ${ev.product ?? ev.source_adapter ?? '?'}`,
    }))

    setSplitProposals(proposals)
    setSplitPanelOpen(true)
  }

  // Enter draw/snip mode using @mapbox/mapbox-gl-draw (MapLibre-compatible)
  async function enterDrawMode() {
    if (!mapRef.current || !selectedId) return
    setDrawMode('drawing')

    try {
      // Dynamic import — only loads in browser
      const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
      // @ts-expect-error — no type declarations for the CSS sub-path
      await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css')

      const map = mapRef.current
      if (!map) return

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        styles: [
          {
            id: 'gl-draw-polygon-fill',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.25 },
          },
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            paint: { 'line-color': '#fbbf24', 'line-dasharray': [0.2, 2], 'line-width': 2 },
          },
          {
            id: 'gl-draw-point-active',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint']],
            paint: { 'circle-radius': 5, 'circle-color': '#fbbf24' },
          },
        ],
      })

      // @ts-expect-error — IControl compatibility
      map.addControl(draw)
      draw.changeMode('draw_polygon')
      drawRef.current = draw

      map.on('draw.create', handleDrawCreate)
    } catch {
      // Fallback if @mapbox/mapbox-gl-draw is incompatible with this MapLibre version:
      // show a message guiding the user to use zone/coverage splits instead
      setDrawMode('idle')
      alert(
        'Draw tool unavailable in this browser. Use "Split by zones" or "Split by coverage" instead, ' +
        'or contact support to enable the polygon draw tool.'
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleDrawCreate(e: { features: any[] }) {
    const map = mapRef.current
    if (!map || !selectedId) return

    const drawn = e.features?.[0]
    if (!drawn) return

    // Remove draw control
    if (drawRef.current) {
      try { map.removeControl(drawRef.current) } catch { /* ignore */ }
      drawRef.current = null
      map.off('draw.create', handleDrawCreate)
    }
    setDrawMode('preview')

    try {
      const res = await fetch(`/api/fsa/clu-records/${selectedId}/split-preview`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawn_geojson: JSON.stringify(drawn.geometry) }),
      })

      if (!res.ok) throw new Error(`Preview failed: ${res.status}`)

      const data = await res.json() as {
        snip:      { geojson: { type: string; coordinates: unknown }; acres: number }
        remainder: { geojson: { type: string; coordinates: unknown }; acres: number }
      }

      const selectedClu = cluList.find((c) => c.id === selectedId)
      const usedLabels: string[] = []
      const labelA = nextSubLabel(usedLabels)
      usedLabels.push(labelA)
      const labelB = nextSubLabel(usedLabels)

      const proposals: SplitProposal[] = [
        {
          sub_label:    labelA,
          geojson:      JSON.stringify(data.snip.geojson),
          acres:        data.snip.acres,
          crop:         '',
          irrigated:    false,
          organic:      false,
          use:          '',
          source_label: 'Drawn (snip)',
        },
        {
          sub_label:    labelB,
          geojson:      JSON.stringify(data.remainder.geojson),
          acres:        data.remainder.acres,
          crop:         selectedClu?.crop ?? '',
          irrigated:    false,
          organic:      false,
          use:          '',
          source_label: 'Remainder',
        },
      ]

      setSplitProposals(proposals)
      setSplitPanelOpen(true)
    } catch {
      // silently reset
    } finally {
      setDrawMode('idle')
    }
  }

  function handleSplitComplete(parentId: string) {
    // Remove the split parent from the CLU list, refresh
    setCluList((prev) => prev.filter((c) => c.id !== parentId))
    setSelectedId(null)
    setOverlayData(null)
    // Refresh the full list to pick up new sub-records
    fetch(`/api/fsa/clu-records?year=${cropYear}`)
      .then((r) => r.json())
      .then((d) => setCluList((d.records ?? []).filter((r: CluListItem) => !r.superseded)))
      .catch(() => {/* non-blocking */})
  }

  // Build farm tree from cluList
  const farmGroups = (() => {
    const map = new Map<string, CluListItem[]>()
    for (const c of cluList) {
      if (!map.has(c.farm_number)) map.set(c.farm_number, [])
      map.get(c.farm_number)!.push(c)
    }
    return map
  })()

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let mapInstance: MaplibreMap | null = null

    async function initMap() {
      try {
        const maplibregl = await import('maplibre-gl')
        // @ts-expect-error — CSS handled by Next.js at runtime
        await import('maplibre-gl/dist/maplibre-gl.css')
        if (!mapContainerRef.current) return

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: getSatelliteStyle() as any,
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          attributionControl: { compact: true },
        })
        mapRef.current = mapInstance

        mapInstance.on('load', () => {
          if (!mapInstance) return
          setLoading(false)

          // ── CLU boundary (dashed amber outline) ──────────────────────────
          mapInstance.addSource('overlay-clu', { type: 'geojson', data: EMPTY_FC as never })
          mapInstance.addLayer({
            id: 'overlay-clu-fill',
            type: 'fill',
            source: 'overlay-clu',
            paint: { 'fill-color': '#f97316', 'fill-opacity': 0.08 },
          })
          mapInstance.addLayer({
            id: 'overlay-clu-stroke',
            type: 'line',
            source: 'overlay-clu',
            paint: {
              'line-color': '#f97316',
              'line-width': 2.5,
              'line-dasharray': [5, 3],
            },
          })

          // ── Zone polygons clipped to CLU ──────────────────────────────────
          mapInstance.addSource('overlay-zones', { type: 'geojson', data: EMPTY_FC as never })
          mapInstance.addLayer({
            id: 'overlay-zones-fill',
            type: 'fill',
            source: 'overlay-zones',
            paint: {
              'fill-color': [
                'case',
                ['all', ['==', ['get', 'zone_organic'], true], ['==', ['get', 'zone_irrigated'], true]], '#22c55e',
                ['all', ['==', ['get', 'zone_organic'], true]], '#0ea5e9',
                ['all', ['==', ['get', 'zone_irrigated'], true]], '#14b8a6',
                '#a3a320',
              ] as never,
              'fill-opacity': 0.35,
            },
          })
          mapInstance.addLayer({
            id: 'overlay-zones-stroke',
            type: 'line',
            source: 'overlay-zones',
            paint: { 'line-color': 'rgba(255,255,255,0.6)', 'line-width': 1.5 },
          })

          // ── Coverage event polygons clipped to CLU ────────────────────────
          mapInstance.addSource('overlay-coverage', { type: 'geojson', data: EMPTY_FC as never })
          mapInstance.addLayer({
            id: 'overlay-coverage-fill',
            type: 'fill',
            source: 'overlay-coverage',
            paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.25 },
          })
          mapInstance.addLayer({
            id: 'overlay-coverage-stroke',
            type: 'line',
            source: 'overlay-coverage',
            paint: {
              'line-color': '#a855f7',
              'line-width': 1.5,
              'line-dasharray': [3, 2],
            },
          })

          // ── Triple intersections: CLU ∩ zone ∩ coverage ───────────────────
          mapInstance.addSource('overlay-triples', { type: 'geojson', data: EMPTY_FC as never })
          mapInstance.addLayer({
            id: 'overlay-triples-fill',
            type: 'fill',
            source: 'overlay-triples',
            paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.55 },
          })
          mapInstance.addLayer({
            id: 'overlay-triples-stroke',
            type: 'line',
            source: 'overlay-triples',
            paint: { 'line-color': '#fbbf24', 'line-width': 2 },
          })
        })

        mapInstance.on('error', () => {
          setMapError('Map failed to load.')
          setLoading(false)
        })
      } catch {
        setMapError('Failed to load map library.')
        setLoading(false)
      }
    }

    initMap()
    return () => {
      mapInstance?.remove()
      mapRef.current = null
    }
  }, [])

  const selectedClu = cluList.find((c) => c.id === selectedId) ?? null

  return (
    <div className="relative flex h-full min-h-[500px] border border-glomalin-border rounded overflow-hidden">

      {/* ── Left sidebar: CLU list ─────────────────────────────────────── */}
      <div className="w-60 shrink-0 bg-glomalin-surface border-r border-glomalin-border flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-glomalin-border shrink-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-muted">
            Overlay — {cropYear}
          </p>
          <p className="text-[9px] font-mono text-glomalin-muted/60 mt-0.5">
            Select a CLU to see Venn layers
          </p>
        </div>

        {/* Layer legend */}
        <div className="px-3 py-2 border-b border-glomalin-border shrink-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0 border-t-2 border-dashed border-orange-500 shrink-0" />
            <span className="text-[9px] font-mono text-glomalin-muted">FSA CLU</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded-sm bg-green-500/60 shrink-0" />
            <span className="text-[9px] font-mono text-glomalin-muted">Zone (org+irr / dryland)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded-sm bg-purple-500/60 shrink-0" />
            <span className="text-[9px] font-mono text-glomalin-muted">Planting pass</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded-sm bg-amber-400/80 shrink-0" />
            <span className="text-[9px] font-mono text-glomalin-muted">All 3 agree (triple)</span>
          </div>
        </div>

        {/* CLU farm tree */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {Array.from(farmGroups.entries()).map(([farmNumber, clus]) => {
            const isExpanded = expandedFarms.has(farmNumber)
            return (
              <div key={farmNumber} className="border-b border-glomalin-border">
                <button
                  onClick={() => setExpandedFarms((prev) => {
                    const next = new Set(prev)
                    if (next.has(farmNumber)) next.delete(farmNumber)
                    else next.add(farmNumber)
                    return next
                  })}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-glomalin-bg transition-colors"
                >
                  <span className={`text-[9px] font-mono text-glomalin-muted shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span className="font-mono text-xs text-glomalin-text">Farm {farmNumber}</span>
                  <span className="font-mono text-[9px] text-glomalin-muted ml-auto">
                    {clus.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className="bg-glomalin-bg/30">
                    {clus.map((c) => {
                      const isSelected = c.id === selectedId
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectClu(c.id)}
                          className={`w-full text-left flex items-center gap-1.5 px-4 py-1.5 border-t border-glomalin-border/40 transition-colors ${
                            isSelected ? 'bg-glomalin-accent/15' : 'hover:bg-glomalin-bg'
                          }`}
                        >
                          {/* Split-candidate badge */}
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            c.is_split_candidate ? 'bg-amber-400' : c.reported ? 'bg-green-500' : c.crop ? 'bg-yellow-500' : 'bg-orange-500'
                          }`} />
                          <span className="font-mono text-[10px] text-glomalin-muted shrink-0">
                            {c.clu}{c.sub_label ? c.sub_label : ''}
                          </span>
                          <span className="font-mono text-[10px] text-glomalin-text truncate flex-1">
                            {c.field_name ?? `T${c.tract_number}`}
                          </span>
                          <span className="font-mono text-[9px] text-glomalin-muted shrink-0 tabular-nums">
                            {c.fsa_acres?.toFixed(1)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Map container ────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-w-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg/80">
            <p className="font-mono text-sm text-glomalin-muted">Loading map…</p>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg">
            <p className="font-mono text-sm text-red-400">{mapError}</p>
          </div>
        )}

        {/* Draw mode banner */}
        {drawMode === 'drawing' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-glomalin-bg border border-amber-600/50 rounded px-4 py-2 shadow-lg">
            <p className="text-xs font-mono text-amber-400 text-center">
              Draw a polygon to snip out a sub-CLU — click to add points, double-click to finish
            </p>
            <button
              onClick={() => {
                if (drawRef.current && mapRef.current) {
                  try { mapRef.current.removeControl(drawRef.current) } catch { /* ignore */ }
                  drawRef.current = null
                }
                setDrawMode('idle')
              }}
              className="block mx-auto mt-1 text-[10px] font-mono text-glomalin-muted hover:text-glomalin-text"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel: overlay breakdown + split actions ──────────────── */}
      {selectedClu && (
        <div className="w-72 shrink-0 bg-glomalin-surface border-l border-glomalin-border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-glomalin-border shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-glomalin-muted">
              CLU {selectedClu.clu}{selectedClu.sub_label ?? ''} — Farm {selectedClu.farm_number}
            </p>
            <p className="text-xs font-mono text-glomalin-text mt-0.5 truncate">
              {selectedClu.field_name ?? `Tract ${selectedClu.tract_number}`}
            </p>
            <p className="text-[10px] font-mono text-glomalin-muted mt-0.5">
              {selectedClu.fsa_acres?.toFixed(2) ?? '—'} ac FSA
              {selectedClu.crop && ` · ${selectedClu.crop}`}
            </p>
          </div>

          {overlayLoading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs font-mono text-glomalin-muted animate-pulse">Loading overlay…</p>
            </div>
          )}

          {overlayData && !overlayLoading && (
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Zone intersections */}
              {overlayData.summary.zones.length > 0 && (
                <div className="border-b border-glomalin-border">
                  <p className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-glomalin-muted bg-glomalin-bg/40">
                    Zone layers
                  </p>
                  {overlayData.summary.zones.map((z, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-t border-glomalin-border/40">
                      <span className={`w-2 h-2 rounded-sm mt-0.5 shrink-0 ${
                        z.zone_organic && z.zone_irrigated ? 'bg-green-500' :
                        z.zone_organic ? 'bg-sky-500' :
                        z.zone_irrigated ? 'bg-teal-500' : 'bg-yellow-700'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-glomalin-text truncate">{z.zone_name ?? '—'}</p>
                        <p className="text-[9px] font-mono text-glomalin-muted">
                          {z.zone_crop && z.zone_crop !== '(none)' ? z.zone_crop : '(no crop)'}
                          {z.zone_irrigated ? ' · Irr' : ''}
                          {z.zone_organic ? ' · Org' : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-glomalin-muted shrink-0 tabular-nums">
                        {(z.intersection_ac ?? 0).toFixed(2)} ac
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Coverage event intersections */}
              {overlayData.summary.coverage.length > 0 ? (
                <div className="border-b border-glomalin-border">
                  <p className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-glomalin-muted bg-glomalin-bg/40">
                    Planting passes
                  </p>
                  {overlayData.summary.coverage.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-t border-glomalin-border/40">
                      <span className="w-2 h-2 rounded-sm mt-0.5 shrink-0 bg-purple-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-glomalin-text truncate">
                          {ev.product ?? ev.source_adapter ?? '—'}
                        </p>
                        <p className="text-[9px] font-mono text-glomalin-muted">{ev.op_date ?? '—'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-glomalin-muted shrink-0 tabular-nums">
                        {(ev.intersection_ac ?? 0).toFixed(2)} ac
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-b border-glomalin-border px-3 py-2.5">
                  <p className="text-[9px] font-mono text-amber-400">
                    ⚠ No planting pass data for this CLU
                  </p>
                  <p className="text-[9px] font-mono text-glomalin-muted/60 mt-0.5">
                    Use Draw Snip to mark the boundary manually
                  </p>
                </div>
              )}

              {/* Triple intersections */}
              {overlayData.summary.triples.length > 0 && (
                <div className="border-b border-glomalin-border">
                  <p className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-glomalin-muted bg-glomalin-bg/40">
                    All 3 agree (zone + pass + CLU)
                  </p>
                  {overlayData.summary.triples.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 border-t border-glomalin-border/40">
                      <span className="w-2 h-2 rounded-sm mt-0.5 shrink-0 bg-amber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-glomalin-text truncate">
                          {t.zone_name ?? '—'} · {t.op_date ?? '—'}
                        </p>
                        <p className="text-[9px] font-mono text-glomalin-muted">
                          {t.zone_crop && t.zone_crop !== '(none)' ? t.zone_crop : ''}
                          {t.zone_irrigated ? ' · Irr' : ''}
                          {t.zone_organic ? ' · Org' : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 shrink-0 tabular-nums">
                        {(t.intersection_ac ?? 0).toFixed(2)} ac
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Split action buttons ──────────────────────────────────────── */}
          {overlayData && !overlayLoading && (
            <div className="px-3 py-3 border-t border-glomalin-border space-y-2 shrink-0">
              <p className="text-[9px] font-mono text-glomalin-muted uppercase tracking-widest mb-1">
                Split this CLU
              </p>

              <button
                onClick={proposeZoneSplits}
                disabled={overlayData.summary.zones.length < 2}
                className="w-full py-2 rounded border border-glomalin-border text-xs font-mono text-glomalin-text hover:bg-glomalin-bg hover:border-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 px-3"
                title={overlayData.summary.zones.length < 2 ? 'Need 2+ zone intersections to split by zones' : undefined}
              >
                <span className="w-2 h-2 rounded-sm bg-green-500 shrink-0" />
                Split by zone boundaries
                {overlayData.summary.zones.length >= 2 && (
                  <span className="ml-auto text-[9px] text-green-400">
                    {overlayData.summary.zones.length} zones
                  </span>
                )}
              </button>

              <button
                onClick={proposeCoverageSplits}
                disabled={overlayData.summary.coverage.length < 2}
                className="w-full py-2 rounded border border-glomalin-border text-xs font-mono text-glomalin-text hover:bg-glomalin-bg hover:border-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 px-3"
                title={overlayData.summary.coverage.length < 2 ? 'Need 2+ coverage events to split by coverage' : 'No planting passes loaded — sync FieldView first'}
              >
                <span className="w-2 h-2 rounded-sm bg-purple-500 shrink-0" />
                Split by coverage passes
                {overlayData.summary.coverage.length >= 2 && (
                  <span className="ml-auto text-[9px] text-purple-400">
                    {overlayData.summary.coverage.length} passes
                  </span>
                )}
              </button>

              <button
                onClick={enterDrawMode}
                disabled={drawMode !== 'idle'}
                className="w-full py-2 rounded border border-glomalin-border text-xs font-mono text-glomalin-text hover:bg-glomalin-bg hover:border-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2 px-3"
              >
                <span className="text-amber-400 shrink-0">✎</span>
                {drawMode === 'drawing' ? 'Drawing…' : drawMode === 'preview' ? 'Previewing…' : 'Draw snip (custom boundary)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* SplitPanel drawer */}
      {selectedClu && (
        <SplitPanel
          open={splitPanelOpen}
          onClose={() => setSplitPanelOpen(false)}
          parentId={selectedClu.id}
          parentFsaAcres={selectedClu.fsa_acres ?? 0}
          parentLabel={`CLU ${selectedClu.clu} — Farm ${selectedClu.farm_number}${selectedClu.farm_name ? ` · ${selectedClu.farm_name}` : ''}`}
          initialProposals={splitProposals}
          onSplitComplete={handleSplitComplete}
        />
      )}

      {/* MapLibre popup styles */}
      <style>{`
        .maplibregl-popup-content {
          background: #0e0c0b;
          border: 1px solid #2a2218;
          border-radius: 4px;
          padding: 7px 11px;
          font-family: ui-monospace, monospace;
          font-size: 11px;
          color: #e8d8c0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.7);
          line-height: 1.6;
        }
        .maplibregl-popup-tip { border-top-color: #2a2218; }
      `}</style>
    </div>
  )
}
