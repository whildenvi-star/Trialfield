// Reconciliation engine types and helpers.
// These types model the output of the get_farm_reconciliation() Postgres RPC
// after grouping by (tract_number, clu_label) in the API route.

import type { ReconciliationStatus, ReconciliationCause } from './calc'

// ── Raw RPC row (one row per CLU × zone intersection) ────────────────────────

export interface ReconciliationRpcRow {
  clu_label:       string
  tract_number:    string
  fsa_acres:       number | null
  clu_geojson:     GeoJSONPolygon | null
  fsa_attributes:  Record<string, unknown>
  clu_record_id:   string | null
  rec_crop:        string | null
  rec_organic:     boolean | null
  rec_irrigated:   boolean | null
  rec_cover_crop:  boolean | null
  rec_reported:    boolean | null
  zone_id:         string | null
  zone_name:       string | null
  zone_geojson:    GeoJSONPolygon | null
  zone_crop:       string | null
  zone_organic:    boolean | null
  intersection_ac: number | null
}

// ── Grouped output types ──────────────────────────────────────────────────────

export interface ZoneIntersection {
  zone_id:         string
  zone_name:       string
  zone_geojson:    GeoJSONPolygon | null
  zone_crop:       string | null
  zone_organic:    boolean | null
  intersection_ac: number   // acres of overlap between this zone and the CLU
}

export interface ReconciliationRow {
  clu_label:        string
  tract_number:     string
  fsa_acres:        number
  clu_geojson:      GeoJSONPolygon | null
  fsa_attributes:   Record<string, unknown>
  clu_record_id:    string | null
  // From clu_records (user-entered)
  crop:             string | null
  organic:          boolean | null
  irrigated:        boolean | null
  cover_crop:       boolean | null
  reported:         boolean | null
  // Intersecting zones (may be empty if zone seeding not done)
  zones:            ZoneIntersection[]
  // Computed reconciliation values
  zone_acres:       number   // sum of intersection_ac across all zones
  delta:            number   // zone_acres - fsa_acres (positive = more than FSA, negative = less)
  status:           ReconciliationStatus
  cause:            ReconciliationCause
}

// ── Minimal GeoJSON types (only Polygon needed for CLU/zone geometry) ─────────

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONPolygon
  properties: Record<string, unknown>
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// ── Grouping function ─────────────────────────────────────────────────────────

export function groupRpcRows(rows: ReconciliationRpcRow[]): ReconciliationRow[] {
  const map = new Map<string, ReconciliationRow>()

  for (const row of rows) {
    const key = `${row.tract_number}::${row.clu_label}`

    if (!map.has(key)) {
      map.set(key, {
        clu_label:      row.clu_label,
        tract_number:   row.tract_number,
        fsa_acres:      Number(row.fsa_acres ?? 0),
        clu_geojson:    row.clu_geojson,
        fsa_attributes: row.fsa_attributes ?? {},
        clu_record_id:  row.clu_record_id,
        crop:           row.rec_crop,
        organic:        row.rec_organic,
        irrigated:      row.rec_irrigated,
        cover_crop:     row.rec_cover_crop,
        reported:       row.rec_reported,
        zones:          [],
        zone_acres:     0,
        delta:          0,
        status:         'ok',
        cause:          'within_tolerance',
      })
    }

    const entry = map.get(key)!

    if (row.zone_id && row.zone_name) {
      const ac = Number(row.intersection_ac ?? 0)
      entry.zones.push({
        zone_id:         row.zone_id,
        zone_name:       row.zone_name,
        zone_geojson:    row.zone_geojson,
        zone_crop:       row.zone_crop,
        zone_organic:    row.zone_organic,
        intersection_ac: ac,
      })
      entry.zone_acres += ac
    }
  }

  // Compute delta + status for each CLU after all zones are collected
  const out: ReconciliationRow[] = []
  map.forEach((entry) => {
    entry.delta  = roundAc(entry.zone_acres - entry.fsa_acres)
    entry.status = deltaStatus(entry.delta)
    entry.cause  = deltaCause(entry.delta, entry.fsa_acres, entry.zones.length)
    out.push(entry)
  })
  return out
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function deltaStatus(delta: number): ReconciliationStatus {
  const abs = Math.abs(delta)
  if (abs <= 0.1) return 'ok'
  if (abs <= 1.0) return 'flagged'
  return 'unresolved'
}

export function deltaCause(
  delta: number,
  fsaAcres: number,
  zoneCount: number
): ReconciliationCause {
  const abs = Math.abs(delta)
  if (abs <= 0.1)                        return 'within_tolerance'
  if (zoneCount === 0)                   return 'unknown'
  if (abs < 0.5 && fsaAcres < 20)       return 'unmapped_waterway'
  if (abs > 1.0 && zoneCount > 1)       return 'boundary_creep'
  return 'unknown'
}

export function roundAc(n: number): number {
  return Math.round(n * 100) / 100
}

// ── FeatureCollections for map panels ────────────────────────────────────────

export function cluFeatureCollection(
  rows: ReconciliationRow[],
  highlightClu?: string
): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => r.clu_geojson != null)
      .map((r) => ({
        type: 'Feature',
        geometry: r.clu_geojson!,
        properties: {
          clu_label:   r.clu_label,
          tract_number: r.tract_number,
          fsa_acres:   r.fsa_acres,
          status:      r.status,
          highlighted: r.clu_label === highlightClu,
        },
      })),
  }
}

export function zoneFeatureCollection(
  rows: ReconciliationRow[],
  highlightClu?: string
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []
  for (const row of rows) {
    for (const zone of row.zones) {
      if (!zone.zone_geojson) continue
      features.push({
        type: 'Feature',
        geometry: zone.zone_geojson,
        properties: {
          zone_id:      zone.zone_id,
          zone_name:    zone.zone_name,
          clu_label:    row.clu_label,
          crop:         zone.zone_crop ?? row.crop,
          organic:      zone.zone_organic ?? row.organic,
          status:       row.status,
          highlighted:  row.clu_label === highlightClu,
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}
