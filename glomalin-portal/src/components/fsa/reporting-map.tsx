'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Map, Popup } from 'maplibre-gl'
import { getSatelliteStyle, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/map-config'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { ReportingCluPanel } from './reporting-clu-panel'
import type { CluMapProperties, ReportingStatus, CluAnomalyResult } from './reporting-clu-panel'

// Status fill colors — visible against satellite imagery
const STATUS_COLORS: Record<ReportingStatus, string> = {
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
}

interface FarmSummary {
  farm_number: string
  farm_name: string | null
  total: number
  green: number
  yellow: number
  orange: number
  bounds: [number, number, number, number]
}

interface FieldBoundaryFeature {
  type: 'Feature'
  geometry: Record<string, unknown>
  properties: { registry_field_id: string; name: string }
}

interface MapResponse {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: Record<string, unknown>
    properties: CluMapProperties
  }>
  farms: FarmSummary[]
  fieldBoundaries?: {
    type: 'FeatureCollection'
    features: FieldBoundaryFeature[]
  }
}

function deriveStatus(props: Partial<CluMapProperties>): ReportingStatus {
  if (props.reported) return 'green'
  if (props.crop) return 'yellow'
  return 'orange'
}

export function ReportingMap({ farmFilter }: { farmFilter?: string }) {
  const router = useRouter()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const popupRef = useRef<Popup | null>(null)
  const featuresRef = useRef<MapResponse['features']>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [farms, setFarms] = useState<FarmSummary[]>([])
  const [selectedClu, setSelectedClu] = useState<CluMapProperties | null>(null)
  const [activeFarm, setActiveFarm] = useState<string | null>(farmFilter ?? null)
  const [bulkReporting, setBulkReporting] = useState<string | null>(null)
  const [showCluLayer, setShowCluLayer] = useState(true)
  const [showFarmBounds, setShowFarmBounds] = useState(true)
  const [anomalies, setAnomalies] = useState<CluAnomalyResult[]>([])
  const anomaliesRef = useRef<CluAnomalyResult[]>([])
  const [splitSectionOpen, setSplitSectionOpen] = useState(true)

  // Rebuild the GeoJSON source data from current featuresRef
  const refreshMapSource = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('clus') as { setData: (d: unknown) => void } | undefined
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: featuresRef.current,
    })
  }, [])

  // Called by panel after save — patch the in-memory feature + refresh farm counts
  const handleRecordUpdated = useCallback(
    (updated: Partial<CluMapProperties> & { id: string }) => {
      // Update the feature in featuresRef
      featuresRef.current = featuresRef.current.map((f) => {
        if (f.properties.id !== updated.id) return f
        const newProps = { ...f.properties, ...updated }
        newProps.status = deriveStatus(newProps)
        return { ...f, properties: newProps }
      })

      // Update paint expressions so the color changes immediately
      refreshMapSource()

      // Update farms state counts
      setFarms((prev) =>
        prev.map((farm) => {
          const farmFeatures = featuresRef.current.filter(
            (f) => f.properties.farm_number === farm.farm_number
          )
          return {
            ...farm,
            green:  farmFeatures.filter((f) => f.properties.status === 'green').length,
            yellow: farmFeatures.filter((f) => f.properties.status === 'yellow').length,
            orange: farmFeatures.filter((f) => f.properties.status === 'orange').length,
          }
        })
      )

      // Sync selectedClu state if this is the open panel
      setSelectedClu((prev) => {
        if (!prev || prev.id !== updated.id) return prev
        const newProps = { ...prev, ...updated }
        newProps.status = deriveStatus(newProps)
        return newProps
      })
    },
    [refreshMapSource]
  )

  // Bulk report all "entered" (yellow) CLUs for a farm
  const handleReportEntered = useCallback(
    async (farmNumber: string) => {
      const yellowIds = featuresRef.current
        .filter((f) => f.properties.farm_number === farmNumber && f.properties.status === 'yellow')
        .map((f) => f.properties.id)
      if (yellowIds.length === 0) return

      setBulkReporting(farmNumber)
      try {
        const res = await fetch('/api/fsa/clu-records/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: yellowIds, action: 'mark-reported' }),
        })
        if (res.ok) {
          for (const id of yellowIds) {
            handleRecordUpdated({ id, reported: true })
          }
        }
      } finally {
        setBulkReporting(null)
      }
    },
    [handleRecordUpdated]
  )

  // Fly to a farm's bounding box
  const flyToFarm = useCallback((farm: FarmSummary) => {
    const map = mapRef.current
    if (!map) return
    const [minLng, minLat, maxLng, maxLat] = farm.bounds
    if (!isFinite(minLng) || minLng === maxLng) return
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 700 })
    setActiveFarm(farm.farm_number)
  }, [])

  // Farm chip: update URL param + fly to farm
  const handleFarmChipClick = useCallback((farmNumber: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'acreage')
    params.set('farm', farmNumber)
    router.replace(`/app/compliance?${params.toString()}`)
    const farm = farms.find((f) => f.farm_number === farmNumber)
    if (farm) flyToFarm(farm)
  }, [farms, flyToFarm, router])

  // Navigate to next unreported CLU in current farm (or all farms)
  const handleNavigateNext = useCallback(() => {
    if (!selectedClu) return
    const candidates = featuresRef.current
      .filter((f) => !f.properties.reported && (!activeFarm || f.properties.farm_number === activeFarm))
      .sort((a, b) => {
        const fa = a.properties, fb = b.properties
        if (fa.farm_number !== fb.farm_number) return String(fa.farm_number).localeCompare(String(fb.farm_number))
        if (fa.tract_number !== fb.tract_number) return String(fa.tract_number).localeCompare(String(fb.tract_number))
        return String(fa.clu).localeCompare(String(fb.clu))
      })
    if (candidates.length === 0) return
    const idx = candidates.findIndex((f) => f.properties.id === selectedClu.id)
    const next = candidates[(idx === -1 ? 0 : idx + 1) % candidates.length]
    // Compute centroid by averaging all coordinate pairs
    let lngSum = 0, latSum = 0, count = 0
    const walk = (v: unknown): void => {
      if (!Array.isArray(v)) return
      if (typeof v[0] === 'number') { lngSum += v[0] as number; latSum += v[1] as number; count++; return }
      for (const c of v) walk(c)
    }
    walk(next.geometry.coordinates)
    if (count === 0) return
    mapRef.current?.easeTo({ center: [lngSum / count, latSum / count], zoom: 16, duration: 600 })
    mapRef.current?.setFilter('clu-selected', ['==', ['get', 'id'], next.properties.id])
    setSelectedClu(next.properties)
  }, [selectedClu, activeFarm])

  // Fly to an anomaly CLU and open its panel
  const handleFlyToAnomaly = useCallback((a: CluAnomalyResult) => {
    const feature = featuresRef.current.find((f) => f.properties.id === a.clu_record_id)
    if (!feature) return
    let lngSum = 0, latSum = 0, count = 0
    const walk = (v: unknown): void => {
      if (!Array.isArray(v)) return
      if (typeof v[0] === 'number') { lngSum += v[0] as number; latSum += v[1] as number; count++; return }
      for (const c of v) walk(c)
    }
    walk(feature.geometry.coordinates)
    if (!count) return
    mapRef.current?.easeTo({ center: [lngSum / count, latSum / count], zoom: 16, duration: 600 })
    mapRef.current?.setFilter('clu-selected', ['==', ['get', 'id'], a.clu_record_id])
    setSelectedClu(feature.properties)
  }, [])

  // "All" chip: clear farm filter
  const handleFarmClear = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'acreage')
    params.delete('farm')
    router.replace(`/app/compliance?${params.toString()}`)
    setActiveFarm(null)
  }, [router])

  // Apply/clear farm filter on map layers when activeFarm changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('clu-fill')) return
    if (activeFarm) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = ['==', ['get', 'farm_number'], activeFarm] as any
      map.setFilter('clu-fill', f)
      map.setFilter('clu-stroke', f)
      map.setFilter('clu-hover', f)
    } else {
      map.setFilter('clu-fill', null)
      map.setFilter('clu-stroke', null)
      map.setFilter('clu-hover', null)
    }
  }, [activeFarm])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let mapInstance: Map | null = null

    async function initMap() {
      try {
        const maplibregl = await import('maplibre-gl')
        // @ts-expect-error — CSS module import handled by Next.js at runtime
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

        mapInstance.on('load', async () => {
          let data: MapResponse = { type: 'FeatureCollection', features: [], farms: [] }

          try {
            const res = await fetch(`/api/fsa/reporting-map?year=${CURRENT_CROP_YEAR}`)
            if (res.ok) {
              data = await res.json()
            }
          } catch {
            // Graceful degradation
          }

          if (!mapInstance) return

          featuresRef.current = data.features
          setFarms(data.farms)
          setLoading(false)

          // Fetch CLU split candidates (non-blocking)
          try {
            const ar = await fetch(`/api/fsa/clu-anomalies?year=${CURRENT_CROP_YEAR}`)
            if (ar.ok) {
              const { anomalies: raw } = await ar.json()
              anomaliesRef.current = raw ?? []
              setAnomalies(raw ?? [])
            }
          } catch { /* non-blocking */ }

          // Auto-zoom to all CLU bounds
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
          const walkCoords = (v: unknown): void => {
            if (!Array.isArray(v)) return
            if (typeof v[0] === 'number') {
              const [lng, lat] = v as number[]
              if (lng < minLng) minLng = lng
              if (lng > maxLng) maxLng = lng
              if (lat < minLat) minLat = lat
              if (lat > maxLat) maxLat = lat
            } else {
              for (const c of v) walkCoords(c)
            }
          }
          for (const f of data.features) {
            walkCoords(f.geometry.coordinates)
          }
          if (isFinite(minLng)) {
            mapInstance.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
              padding: 40,
              animate: false,
            })
          }

          // Source + layers
          mapInstance.addSource('clus', {
            type: 'geojson',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            promoteId: 'id',
          })

          // Fill — status-based color, translucent over satellite
          mapInstance.addLayer({
            id: 'clu-fill',
            type: 'fill',
            source: 'clus',
            paint: {
              'fill-color': [
                'match', ['get', 'status'],
                'green',  STATUS_COLORS.green,
                'yellow', STATUS_COLORS.yellow,
                STATUS_COLORS.orange,
              ],
              'fill-opacity': 0.30,
            },
          })

          // Standard stroke — white for satellite visibility
          mapInstance.addLayer({
            id: 'clu-stroke',
            type: 'line',
            source: 'clus',
            paint: {
              'line-color': 'rgba(255,255,255,0.6)',
              'line-width': 2,
            },
          })

          // Selected CLU highlight
          mapInstance.addLayer({
            id: 'clu-selected',
            type: 'line',
            source: 'clus',
            filter: ['==', ['get', 'id'], ''],
            paint: {
              'line-color': '#C8860A',
              'line-width': 3,
            },
          })

          // Anomaly dashed outline — on top of all other CLU layers
          const anomalyIds = anomaliesRef.current.map((a) => a.clu_record_id)
          mapInstance.addLayer({
            id: 'clu-anomaly-stroke',
            type: 'line',
            source: 'clus',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filter: (anomalyIds.length > 0
              ? ['in', ['get', 'id'], ['literal', anomalyIds]]
              : ['==', ['get', 'id'], '']) as any,
            paint: {
              'line-color': '#ef4444',
              'line-dasharray': [4, 3],
              'line-width': 2.5,
            },
          })

          // Hover fill brightening via feature-state
          mapInstance.addLayer({
            id: 'clu-hover',
            type: 'fill',
            source: 'clus',
            paint: {
              'fill-color': [
                'match', ['get', 'status'],
                'green',  STATUS_COLORS.green,
                'yellow', STATUS_COLORS.yellow,
                STATUS_COLORS.orange,
              ],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.65,
                0,
              ],
            },
          })

          // SMS farm boundary layer — blue outline only, no fill
          if (data.fieldBoundaries && data.fieldBoundaries.features.length > 0) {
            mapInstance.addSource('farm-bounds', {
              type: 'geojson',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: data.fieldBoundaries as any,
            })

            mapInstance.addLayer({
              id: 'farm-bounds-fill',
              type: 'fill',
              source: 'farm-bounds',
              paint: {
                'fill-color': '#60a5fa',
                'fill-opacity': 0.08,
              },
            })

            mapInstance.addLayer({
              id: 'farm-bounds-stroke',
              type: 'line',
              source: 'farm-bounds',
              paint: {
                'line-color': '#60a5fa',
                'line-width': 2.5,
                'line-dasharray': [4, 2],
              },
            })
          }

          // Popup for hover
          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'clu-map-popup',
          })
          popupRef.current = popup

          let hoveredId: string | number | null = null

          mapInstance.on('mousemove', 'clu-fill', (e) => {
            if (!mapInstance || !e.features?.length) return
            mapInstance.getCanvas().style.cursor = 'pointer'

            const f = e.features[0]
            const fid = f.id

            if (hoveredId !== null && hoveredId !== fid) {
              mapInstance.setFeatureState({ source: 'clus', id: hoveredId }, { hover: false })
            }
            hoveredId = fid ?? null
            if (fid != null) {
              mapInstance.setFeatureState({ source: 'clus', id: fid }, { hover: true })
            }

            const p = f.properties as CluMapProperties
            const cropLine = p.crop ? `<br/><span style="color:#C8860A">${p.crop}</span>` : '<br/><span style="color:#6a5a4a">No crop</span>'
            popup
              .setLngLat(e.lngLat)
              .setHTML(
                `<span style="color:#e8d8c0;font-weight:600">${p.field_name ?? `F${p.farm_number} T${p.tract_number} C${p.clu}`}</span>${cropLine}<br/><span style="color:#6a5a4a">${p.fsa_acres} ac</span>`
              )
              .addTo(mapInstance)
          })

          mapInstance.on('mouseleave', 'clu-fill', () => {
            if (!mapInstance) return
            mapInstance.getCanvas().style.cursor = ''
            if (hoveredId !== null) {
              mapInstance.setFeatureState({ source: 'clus', id: hoveredId }, { hover: false })
              hoveredId = null
            }
            popup.remove()
          })

          mapInstance.on('click', 'clu-fill', (e) => {
            if (!e.features?.length) return
            const props = e.features[0].properties as CluMapProperties
            // Highlight selected CLU outline
            mapInstance?.setFilter('clu-selected', ['==', ['get', 'id'], props.id])
            setSelectedClu(props)
          })
        })

        mapInstance.on('error', (e) => {
          console.error('[ReportingMap]', e.error)
          setError('Map failed to load.')
          setLoading(false)
        })

      } catch (err) {
        console.error('[ReportingMap] init failed:', err)
        setError('Failed to load map library.')
        setLoading(false)
      }
    }

    initMap()
    return () => {
      mapInstance?.remove()
      mapRef.current = null
    }
  }, [])

  // Toggle CLU layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = showCluLayer ? 'visible' : 'none'
    for (const id of ['clu-fill', 'clu-stroke', 'clu-selected', 'clu-hover', 'clu-anomaly-stroke']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [showCluLayer])

  // Update anomaly dashed layer filter when anomalies state changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('clu-anomaly-stroke')) return
    const ids = anomalies.map((a) => a.clu_record_id)
    map.setFilter(
      'clu-anomaly-stroke',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ids.length > 0 ? ['in', ['get', 'id'], ['literal', ids]] : ['==', ['get', 'id'], '']) as any
    )
  }, [anomalies])

  // Toggle SMS farm boundary layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = showFarmBounds ? 'visible' : 'none'
    for (const id of ['farm-bounds-fill', 'farm-bounds-stroke']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [showFarmBounds])

  const totalCLUs = farms.reduce((s, f) => s + f.total, 0)
  const totalGreen = farms.reduce((s, f) => s + f.green, 0)

  return (
    <div className="relative flex h-[calc(100vh-240px)] min-h-[500px] border border-glomalin-border rounded overflow-hidden">
      {/* Farm list sidebar */}
      <div className="w-52 shrink-0 bg-glomalin-surface border-r border-glomalin-border flex flex-col overflow-hidden">
        {/* Overall progress header */}
        <div className="px-3 py-2.5 border-b border-glomalin-border">
          <p className="font-mono text-xs text-glomalin-muted">Overall Progress</p>
          <p className="font-mono text-sm text-glomalin-text mt-0.5">
            {totalGreen}/{totalCLUs} reported
          </p>
          {/* Segmented progress bar */}
          <div className="flex h-1.5 rounded overflow-hidden bg-glomalin-border mt-1.5">
            {totalCLUs > 0 && (
              <>
                <div
                  style={{ width: `${(farms.reduce((s, f) => s + f.green, 0) / totalCLUs) * 100}%` }}
                  className="bg-green-500"
                />
                <div
                  style={{ width: `${(farms.reduce((s, f) => s + f.yellow, 0) / totalCLUs) * 100}%` }}
                  className="bg-yellow-500"
                />
              </>
            )}
          </div>
        </div>

        {/* Farm picker chips */}
        {farms.length > 1 && (
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-glomalin-border">
            <button
              onClick={handleFarmClear}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                !activeFarm
                  ? 'border-glomalin-accent text-glomalin-accent'
                  : 'border-glomalin-border text-glomalin-muted hover:text-glomalin-text'
              }`}
            >
              All
            </button>
            {farms.map((f) => (
              <button
                key={f.farm_number}
                onClick={() => handleFarmChipClick(f.farm_number)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  activeFarm === f.farm_number
                    ? 'border-glomalin-accent text-glomalin-accent'
                    : 'border-glomalin-border text-glomalin-muted hover:text-glomalin-text'
                }`}
              >
                {f.farm_number}
              </button>
            ))}
          </div>
        )}

        {/* Legend chips */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-glomalin-border flex-wrap">
          {(['orange', 'yellow', 'green'] as ReportingStatus[]).map((s) => {
            const labels = { orange: 'Undecl', yellow: 'Entered', green: 'Rpted' }
            const colors = { orange: 'bg-orange-500', yellow: 'bg-yellow-500', green: 'bg-green-500' }
            return (
              <span key={s} className="flex items-center gap-1 text-[10px] font-mono text-glomalin-muted">
                <span className={`w-2 h-2 rounded-sm ${colors[s]}`} />
                {labels[s]}
              </span>
            )
          })}
        </div>

        {/* Layer toggles */}
        <div className="px-3 py-2 border-b border-glomalin-border space-y-1.5">
          <p className="text-[10px] font-mono text-glomalin-muted uppercase tracking-wide">Layers</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCluLayer}
              onChange={(e) => setShowCluLayer(e.target.checked)}
              className="accent-glomalin-accent w-3 h-3"
            />
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-glomalin-text">
              <span className="w-3 h-2 rounded-sm bg-orange-500 opacity-80" />
              CLU Boundaries
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFarmBounds}
              onChange={(e) => setShowFarmBounds(e.target.checked)}
              className="accent-[#60a5fa] w-3 h-3"
            />
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-glomalin-text">
              <span className="w-3 h-0.5 bg-blue-400" />
              Farm Boundaries
            </span>
          </label>
        </div>

        {/* Farm list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <p className="text-xs font-mono text-glomalin-muted px-3 py-4">Loading…</p>
          )}
          {farms.map((farm) => {
            const isActive = activeFarm === farm.farm_number
            return (
              <div
                key={farm.farm_number}
                className={`px-3 py-2.5 border-b border-glomalin-border cursor-pointer transition-colors ${isActive ? 'bg-glomalin-accent/10' : 'hover:bg-glomalin-bg'}`}
                onClick={() => flyToFarm(farm)}
              >
                <p className="font-mono text-xs text-glomalin-text truncate">
                  Farm {farm.farm_number}
                </p>
                {farm.farm_name && (
                  <p className="font-mono text-[10px] text-glomalin-muted truncate">{farm.farm_name}</p>
                )}
                {/* Segmented bar */}
                <div className="flex h-1 rounded overflow-hidden bg-glomalin-border mt-1.5 mb-1">
                  {farm.total > 0 && (
                    <>
                      <div style={{ width: `${(farm.green / farm.total) * 100}%` }} className="bg-green-500" />
                      <div style={{ width: `${(farm.yellow / farm.total) * 100}%` }} className="bg-yellow-500" />
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] text-glomalin-muted">
                    {farm.green}/{farm.total} rptd
                  </p>
                  {farm.yellow > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReportEntered(farm.farm_number) }}
                      disabled={bulkReporting === farm.farm_number}
                      className="text-[10px] font-mono text-green-400 hover:text-green-300 disabled:opacity-40 underline underline-offset-2"
                    >
                      {bulkReporting === farm.farm_number ? '…' : `Report ${farm.yellow}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Split Candidates section */}
        {anomalies.length > 0 && (
          <div className="border-t border-glomalin-border shrink-0">
            <button
              onClick={() => setSplitSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-glomalin-bg transition-colors"
            >
              <span className="text-[10px] font-mono uppercase tracking-wide text-glomalin-muted">
                Split Candidates
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">
                {anomalies.length}
              </span>
            </button>
            {splitSectionOpen && (
              <div className="max-h-40 overflow-y-auto border-t border-glomalin-border/50">
                {anomalies.map((a) => (
                  <button
                    key={a.clu_record_id}
                    onClick={() => handleFlyToAnomaly(a)}
                    className="w-full text-left px-3 py-1.5 border-b border-glomalin-border/40 hover:bg-glomalin-bg transition-colors"
                  >
                    <p className="text-[10px] font-mono text-glomalin-muted">
                      F{a.farm_number}/T{a.tract_number}/CLU {a.clu_label}
                    </p>
                    <p className="text-[10px] font-mono text-red-400 truncate">
                      {a.zone_crops.join(' + ')} · {a.fsa_acres} ac
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="relative flex-1">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg/80">
            <p className="font-mono text-sm text-glomalin-muted">Loading map…</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg">
            <div className="rounded border border-glomalin-border bg-glomalin-surface px-8 py-8 text-center max-w-sm">
              <p className="text-glomalin-accent font-mono text-sm font-semibold mb-1">Map Error</p>
              <p className="text-glomalin-muted font-mono text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Detail panel */}
        {selectedClu && (
          <ReportingCluPanel
            clu={selectedClu}
            onClose={() => {
              setSelectedClu(null)
              mapRef.current?.setFilter('clu-selected', ['==', ['get', 'id'], ''])
            }}
            onRecordUpdated={handleRecordUpdated}
            onNavigateNext={handleNavigateNext}
            anomalyData={anomalies.find((a) => a.clu_record_id === selectedClu.id)}
          />
        )}
      </div>

      {/* MapLibre popup styles */}
      <style>{`
        .clu-map-popup .maplibregl-popup-content {
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
        .clu-map-popup .maplibregl-popup-tip {
          border-top-color: #2a2218;
        }
      `}</style>
    </div>
  )
}
