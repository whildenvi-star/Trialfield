'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Map as MaplibreMap, Popup } from 'maplibre-gl'
import { getSatelliteStyle, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/map-config'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { ReportingCluPanel } from './reporting-clu-panel'
import type { CluMapProperties, ReportingStatus, CluAnomalyResult } from './reporting-clu-panel'
import { MapBatchEditBar, type BatchEditFields } from './map-batch-edit-bar'

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

interface PlantingPass {
  op_date: string | null
  product: string | null
  applied_acres: number | null
  source_adapter: string
}

type GeoJSONFeature = {
  type: 'Feature'
  geometry: Record<string, unknown>
  properties: CluMapProperties
}

interface MapResponse {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  farms: FarmSummary[]
  fieldBoundaries?: {
    type: 'FeatureCollection'
    features: FieldBoundaryFeature[]
  }
  smsBoundaryNames?: Record<string, string>
  plantingPasses?: Record<string, PlantingPass[]>
}

type FarmTreeNode = {
  farm: FarmSummary | undefined
  tracts: Map<string, GeoJSONFeature[]>
}

function deriveStatus(props: Partial<CluMapProperties>): ReportingStatus {
  if (props.reported) return 'green'
  if (props.crop) return 'yellow'
  return 'orange'
}

export function ReportingMap({ farmFilter, className }: { farmFilter?: string; className?: string }) {
  const router = useRouter()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
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
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [anomalies, setAnomalies] = useState<CluAnomalyResult[]>([])
  const anomaliesRef = useRef<CluAnomalyResult[]>([])
  const [splitSectionOpen, setSplitSectionOpen] = useState(true)
  // Tree sidebar state
  const [cluList, setCluList] = useState<GeoJSONFeature[]>([])
  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(new Set())
  const [expandedTracts, setExpandedTracts] = useState<Set<string>>(new Set())
  const [smsBoundaryNames, setSmsBoundaryNames] = useState<Record<string, string>>({})
  const [plantingPasses, setPlantingPasses] = useState<Record<string, PlantingPass[]>>({})
  // Batch edit: CLUs checked in the sidebar for multi-apply
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  // Sync with app-level dark/light theme — watches the 'light' class on <html>
  useEffect(() => {
    const update = () => setIsLightTheme(document.documentElement.classList.contains('light'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const nightMode = !isLightTheme

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
      // Compute patched array once — drives both map source and sidebar tree
      const next = featuresRef.current.map((f) => {
        if (f.properties.id !== updated.id) return f
        const newProps = { ...f.properties, ...updated }
        newProps.status = deriveStatus(newProps)
        return { ...f, properties: newProps }
      })
      featuresRef.current = next
      setCluList(next)
      refreshMapSource()

      // Update farms state counts from next (already patched)
      setFarms((prev) =>
        prev.map((farm) => {
          const farmFeatures = next.filter(
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

  // Select a CLU from the sidebar — fly to it + open detail panel
  const handleSelectClu = useCallback((props: CluMapProperties) => {
    const feat = featuresRef.current.find((f) => f.properties.id === props.id)
    if (feat) {
      let lngSum = 0, latSum = 0, count = 0
      const walk = (v: unknown): void => {
        if (!Array.isArray(v)) return
        if (typeof v[0] === 'number') { lngSum += v[0] as number; latSum += v[1] as number; count++; return }
        for (const c of v) walk(c)
      }
      walk(feat.geometry.coordinates)
      if (count > 0) {
        mapRef.current?.easeTo({ center: [lngSum / count, latSum / count], zoom: 16, duration: 600 })
      }
    }
    mapRef.current?.setFilter('clu-selected', ['==', ['get', 'id'], props.id])
    setSelectedClu(props)
  }, [])

  // Batch selection: toggle one CLU checkbox
  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Batch selection: set many CLUs at once (tract/farm select-all)
  const toggleCheckedMany = useCallback((ids: string[], on: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const clearChecked = useCallback(() => {
    setCheckedIds(new Set())
    setBatchError(null)
  }, [])

  // Apply batch edit to all checked CLUs, then patch in-memory state from the
  // server response (picks up organic auto-sync + recomputes status/counts)
  const handleBatchApply = useCallback(
    async (fields: BatchEditFields) => {
      const ids = Array.from(checkedIds)
      if (ids.length === 0) return
      setBatchBusy(true)
      setBatchError(null)
      try {
        const res = await fetch('/api/fsa/clu-records/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action: 'batch-edit', fields }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setBatchError(json.error ?? 'Batch update failed')
          return
        }
        for (const rec of json.records ?? []) {
          handleRecordUpdated({
            id: rec.id,
            crop: rec.crop ?? null,
            grain_plant_date: rec.grain_plant_date ?? null,
            organic: rec.organic,
            irrigated: rec.irrigated ?? false,
            intended_use: rec.intended_use ?? null,
          })
        }
      } catch {
        setBatchError('Network error — please try again')
      } finally {
        setBatchBusy(false)
      }
    },
    [checkedIds, handleRecordUpdated]
  )

  const toggleFarm = useCallback((farmNumber: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev)
      if (next.has(farmNumber)) next.delete(farmNumber)
      else next.add(farmNumber)
      return next
    })
  }, [])

  const toggleTract = useCallback((tractKey: string) => {
    setExpandedTracts((prev) => {
      const next = new Set(prev)
      if (next.has(tractKey)) next.delete(tractKey)
      else next.add(tractKey)
      return next
    })
  }, [])

  const farmTree = useMemo(() => {
    const tree = new Map<string, FarmTreeNode>()
    for (const feat of cluList) {
      const p = feat.properties
      if (!tree.has(p.farm_number)) {
        tree.set(p.farm_number, {
          farm: farms.find((f) => f.farm_number === p.farm_number),
          tracts: new Map(),
        })
      }
      const node = tree.get(p.farm_number)!
      if (!node.tracts.has(p.tract_number)) node.tracts.set(p.tract_number, [])
      node.tracts.get(p.tract_number)!.push(feat)
    }
    return tree
  }, [cluList, farms])

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

    let mapInstance: MaplibreMap | null = null

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
          setCluList(data.features)
          setSmsBoundaryNames(data.smsBoundaryNames ?? {})
          setPlantingPasses(data.plantingPasses ?? {})
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

          // Batch-checked CLUs highlight — sky blue, distinct from gold single-select
          mapInstance.addLayer({
            id: 'clu-checked',
            type: 'line',
            source: 'clus',
            filter: ['==', ['get', 'id'], ''],
            paint: {
              'line-color': '#38bdf8',
              'line-width': 3,
            },
          })

          // Anomaly dashed outline — on top of all other CLU layers
          const anomalyIds = anomaliesRef.current.map((a) => a.clu_record_id)
          mapInstance.addLayer({
            id: 'clu-anomaly-stroke',
            type: 'line',
            source: 'clus',
            filter: (anomalyIds.length > 0
              ? ['in', ['get', 'id'], ['literal', anomalyIds]]
              : ['==', ['get', 'id'], '']) as never,
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
            handleSelectClu(props)
          })

          // Sync overlay opacity to whatever theme is active at load time
          if (!document.documentElement.classList.contains('light')) {
            mapInstance.setPaintProperty('clu-fill',   'fill-opacity', 0.50)
            mapInstance.setPaintProperty('clu-stroke', 'line-color',   'rgba(255,255,255,0.80)')
            mapInstance.setPaintProperty('clu-stroke', 'line-width',   2.5)
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle CLU layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = showCluLayer ? 'visible' : 'none'
    for (const id of ['clu-fill', 'clu-stroke', 'clu-selected', 'clu-checked', 'clu-hover', 'clu-anomaly-stroke']) {
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

  // Update batch-checked highlight filter when checkbox selection changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('clu-checked')) return
    const ids = Array.from(checkedIds)
    map.setFilter(
      'clu-checked',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ids.length > 0 ? ['in', ['get', 'id'], ['literal', ids]] : ['==', ['get', 'id'], '']) as any
    )
  }, [checkedIds])

  // Toggle SMS farm boundary layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const vis = showFarmBounds ? 'visible' : 'none'
    for (const id of ['farm-bounds-fill', 'farm-bounds-stroke']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
    }
  }, [showFarmBounds])

  // Night mode: boost CLU overlay opacity so fills stay legible on the darkened satellite
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('clu-fill')) return
    map.setPaintProperty('clu-fill', 'fill-opacity', nightMode ? 0.50 : 0.30)
    map.setPaintProperty('clu-stroke', 'line-color',
      nightMode ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.60)'
    )
    map.setPaintProperty('clu-stroke', 'line-width', nightMode ? 2.5 : 2)
  }, [nightMode])

  const totalCLUs = farms.reduce((s, f) => s + f.total, 0)
  const totalGreen = farms.reduce((s, f) => s + f.green, 0)

  return (
    <div className={className ?? 'relative flex h-[calc(100vh-240px)] min-h-[500px] border border-glomalin-border rounded overflow-hidden'}>
      {/* Farm list sidebar */}
      <div className="w-64 shrink-0 bg-glomalin-surface border-r border-glomalin-border flex flex-col overflow-hidden">
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

        {/* Active farm filter indicator */}
        {activeFarm && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-glomalin-border bg-glomalin-accent/5">
            <span className="text-[10px] font-mono text-glomalin-accent flex-1 truncate">Farm {activeFarm}</span>
            <button
              onClick={handleFarmClear}
              className="text-[10px] font-mono text-glomalin-muted hover:text-glomalin-text transition-colors shrink-0"
            >
              Show all
            </button>
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

        {/* Farm tree */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <p className="text-xs font-mono text-glomalin-muted px-3 py-4">Loading…</p>
          )}
          {Array.from(farmTree.entries()).map(([farmNumber, { farm, tracts }]) => {
            const isExpanded = expandedFarms.has(farmNumber)
            const farmIds = Array.from(tracts.values()).flat().map((f) => f.properties.id)
            const farmAllChecked = farmIds.length > 0 && farmIds.every((id) => checkedIds.has(id))
            const farmSomeChecked = farmIds.some((id) => checkedIds.has(id))
            return (
              <div key={farmNumber} className="border-b border-glomalin-border">
                {/* Farm header */}
                <div
                  className={`flex items-start gap-1.5 px-3 py-2 cursor-pointer transition-colors ${
                    activeFarm === farmNumber ? 'bg-glomalin-accent/10' : 'hover:bg-glomalin-bg'
                  }`}
                  onClick={() => {
                    toggleFarm(farmNumber)
                    if (farm) flyToFarm(farm)
                  }}
                >
                  <input
                    type="checkbox"
                    checked={farmAllChecked}
                    ref={(el) => { if (el) el.indeterminate = !farmAllChecked && farmSomeChecked }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleCheckedMany(farmIds, !farmAllChecked)}
                    className="accent-sky-400 w-3 h-3 mt-0.5 shrink-0 cursor-pointer"
                    aria-label={`Select all CLUs in farm ${farmNumber}`}
                  />
                  <span className={`text-[9px] font-mono text-glomalin-muted mt-0.5 shrink-0 inline-block transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-glomalin-text">Farm {farmNumber}</p>
                    {farm?.farm_name && (
                      <p className="font-mono text-[10px] text-glomalin-muted truncate">{farm.farm_name}</p>
                    )}
                    {farm && farm.total > 0 && (
                      <div className="flex h-0.5 rounded overflow-hidden bg-glomalin-border mt-1">
                        <div style={{ width: `${(farm.green / farm.total) * 100}%` }} className="bg-green-500" />
                        <div style={{ width: `${(farm.yellow / farm.total) * 100}%` }} className="bg-yellow-500" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {farm && farm.orange > 0 && <span className="text-[9px] font-mono text-orange-400">{farm.orange}○</span>}
                      {farm && farm.yellow > 0 && <span className="text-[9px] font-mono text-yellow-400">{farm.yellow}◑</span>}
                      {farm && farm.green > 0 && <span className="text-[9px] font-mono text-green-400">{farm.green}●</span>}
                      {farm && farm.yellow > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReportEntered(farmNumber) }}
                          disabled={bulkReporting === farmNumber}
                          className="text-[9px] font-mono text-green-400 hover:text-green-300 disabled:opacity-40 underline underline-offset-1 ml-auto"
                        >
                          {bulkReporting === farmNumber ? '…' : `Rpt ${farm.yellow}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tracts (expanded) */}
                {isExpanded && (
                  <div className="bg-glomalin-bg/30">
                    {Array.from(tracts.entries()).map(([tractNumber, tractFeatures]) => {
                      const tractKey = `${farmNumber}|${tractNumber}`
                      const isTractExpanded = expandedTracts.has(tractKey)
                      const tractIds = tractFeatures.map((f) => f.properties.id)
                      const tractAllChecked = tractIds.length > 0 && tractIds.every((id) => checkedIds.has(id))
                      const tractSomeChecked = tractIds.some((id) => checkedIds.has(id))
                      return (
                        <div key={tractKey} className="border-t border-glomalin-border/40">
                          {/* Tract header */}
                          <div
                            className="flex items-center gap-1.5 px-4 py-1.5 cursor-pointer hover:bg-glomalin-bg transition-colors"
                            onClick={() => toggleTract(tractKey)}
                          >
                            <input
                              type="checkbox"
                              checked={tractAllChecked}
                              ref={(el) => { if (el) el.indeterminate = !tractAllChecked && tractSomeChecked }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleCheckedMany(tractIds, !tractAllChecked)}
                              className="accent-sky-400 w-3 h-3 shrink-0 cursor-pointer"
                              aria-label={`Select all CLUs in tract ${tractNumber}`}
                            />
                            <span className={`text-[8px] font-mono text-glomalin-muted shrink-0 inline-block transition-transform duration-150 ${isTractExpanded ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                            <span className="font-mono text-[11px] text-glomalin-muted">Tract {tractNumber}</span>
                            <span className="font-mono text-[9px] text-glomalin-muted/50 ml-auto shrink-0">
                              {tractFeatures.length}
                            </span>
                          </div>

                          {/* CLU rows */}
                          {isTractExpanded && tractFeatures.map((feat) => {
                            const p = feat.properties
                            const smsName = p.registry_field_id
                              ? (smsBoundaryNames[p.registry_field_id] ?? p.field_name)
                              : p.field_name
                            const passes = p.registry_field_id
                              ? (plantingPasses[p.registry_field_id] ?? [])
                              : []
                            const isSelected = selectedClu?.id === p.id
                            const isChecked = checkedIds.has(p.id)
                            return (
                              <div key={p.id} className="border-t border-glomalin-border/30">
                                <div
                                  className={`flex items-center gap-1.5 px-5 py-1.5 transition-colors ${
                                    isSelected ? 'bg-glomalin-accent/15' : isChecked ? 'bg-sky-500/10' : 'hover:bg-glomalin-bg'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleChecked(p.id)}
                                    className="accent-sky-400 w-3 h-3 shrink-0 cursor-pointer"
                                    aria-label={`Select CLU ${p.clu}`}
                                  />
                                  <button
                                    onClick={() => handleSelectClu(p)}
                                    className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: STATUS_COLORS[p.status] }}
                                    />
                                    <span className="font-mono text-[10px] text-glomalin-muted shrink-0">
                                      {p.clu}
                                    </span>
                                    <span className="font-mono text-[10px] text-glomalin-text truncate flex-1">
                                      {smsName ?? '—'}
                                    </span>
                                    <span className="font-mono text-[9px] text-glomalin-muted shrink-0">
                                      {p.fsa_acres}
                                    </span>
                                  </button>
                                </div>
                                {p.crop && (
                                  <div className="px-8 pb-0.5">
                                    <span className="font-mono text-[9px] text-glomalin-muted truncate block">
                                      {p.crop}{p.grain_plant_date ? ` · ${p.grain_plant_date}` : ''}
                                    </span>
                                  </div>
                                )}
                                {passes.map((pass, i) => (
                                  <div key={i} className="flex items-center gap-1 px-8 pb-0.5">
                                    <span className="font-mono text-[8px] text-blue-400/60 shrink-0">↳FV</span>
                                    <span className="font-mono text-[9px] text-blue-400/80 truncate">
                                      {pass.product ?? '—'}{pass.op_date ? ` · ${pass.op_date.slice(5)}` : ''}{pass.applied_acres ? ` · ${pass.applied_acres}ac` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
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
        <div
          ref={mapContainerRef}
          className="w-full h-full transition-[filter] duration-700"
          style={nightMode ? { filter: 'brightness(0.48) saturate(0.60) contrast(1.20)' } : undefined}
        />

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

        {/* Batch edit bar — shown when CLUs are checked in the sidebar */}
        {checkedIds.size > 0 && !loading && (
          <div className="absolute bottom-3 left-3 z-10 space-y-1.5">
            {batchError && (
              <p className="font-mono text-[10px] text-red-400 bg-glomalin-surface/95 rounded px-2 py-1 border border-red-800 w-72">
                {batchError}
              </p>
            )}
            <MapBatchEditBar
              selectedCount={checkedIds.size}
              busy={batchBusy}
              onApply={handleBatchApply}
              onClear={clearChecked}
            />
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
