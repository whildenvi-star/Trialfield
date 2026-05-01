// FSA Coverage Event Adapter — CNH FieldOps + GeoJSON file upload
//
// Adapter interface designed for extensibility: JD Ops Center, CNH FieldOps,
// Trimble, and Ag Leader can all implement CoverageAdapter without schema changes.
// Every source normalizes to NormalizedCoverageEvent, which maps 1:1 to
// the coverage_events table (geometry inserted via import_coverage_event RPC).
//
// CNH Linked Account limitation: API returns empty array silently when equipment
// is under a dealership-managed account. No error is thrown — callers should warn.

// ── Adapter IDs ───────────────────────────────────────────────────────────────

export const ADAPTER_FIELDOPS = 'cnhind-fieldops'
export const ADAPTER_GEOJSON  = 'geojson-upload'
export const ADAPTER_MANUAL   = 'manual'

// ── Normalized coverage event (matches coverage_events table) ─────────────────

export interface NormalizedCoverageEvent {
  zone_id?:        string | null   // resolved at import time via find_zone_for_geometry RPC
  crop_year:       number
  source_adapter:  string
  operation_type:  string          // 'planting' | 'application' | 'harvest' | 'tillage'
  op_date?:        string | null   // ISO date string
  geojson?:        string | null   // GeoJSON Polygon/MultiPolygon string
  applied_acres?:  number | null
  product?:        string | null
  rate?:           number | null
  rate_unit?:      string | null
  raw_payload:     Record<string, unknown>
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface CoverageAdapter {
  id:            string
  name:          string
  isConfigured:  () => boolean
  fetchEvents:   (cropYear: number) => Promise<NormalizedCoverageEvent[]>
}

// ── CNH FieldOps adapter ──────────────────────────────────────────────────────
// Ported from farm-budget/fieldops/client.js (CommonJS → TypeScript).
// Only runs server-side (uses Buffer, process.env).

interface FieldOpsTokenCache { accessToken: string; expiresAt: number }
const tokenCache: FieldOpsTokenCache = { accessToken: '', expiresAt: 0 }

function fieldopsConfigured(): boolean {
  return !!(
    process.env.FIELDOPS_CLIENT_ID &&
    process.env.FIELDOPS_CLIENT_SECRET &&
    process.env.FIELDOPS_SUBSCRIPTION_KEY
  )
}

async function getFieldOpsToken(): Promise<string> {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken
  }

  const tokenUrl = process.env.FIELDOPS_TOKEN_URL ?? 'https://identity.cnhind.com/oauth/token'
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        `${process.env.FIELDOPS_CLIENT_ID}:${process.env.FIELDOPS_CLIENT_SECRET}`
      ).toString('base64'),
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY ?? '',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'fields equipment yield applications telemetry',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FieldOps token failed (${res.status}): ${body}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache.accessToken = data.access_token
  tokenCache.expiresAt   = Date.now() + data.expires_in * 1000
  return tokenCache.accessToken
}

async function fieldopsGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token   = await getFieldOpsToken()
  const baseUrl = process.env.FIELDOPS_API_BASE ?? 'https://ag.api.cnhind.com'
  const url     = new URL(path, baseUrl)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY ?? '',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`FieldOps API ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

function normalizeFieldopsApp(
  app: Record<string, unknown>,
  cropYear: number
): NormalizedCoverageEvent {
  // FieldOps application shape:
  // { id, fieldId, date, product, rate, rateUnit, appliedAcres, geometry }
  const geom = app['geometry'] as Record<string, unknown> | null | undefined
  return {
    crop_year:      cropYear,
    source_adapter: ADAPTER_FIELDOPS,
    operation_type: 'application',
    op_date:        (app['date'] as string | null) ?? null,
    geojson:        geom ? JSON.stringify(geom) : null,
    applied_acres:  parseNum(app['appliedAcres']),
    product:        parseStr(app['product']),
    rate:           parseNum(app['rate']),
    rate_unit:      parseStr(app['rateUnit']),
    raw_payload:    app,
  }
}

export const FieldOpsAdapter: CoverageAdapter = {
  id:           ADAPTER_FIELDOPS,
  name:         'CNH FieldOps',
  isConfigured: fieldopsConfigured,

  async fetchEvents(cropYear: number): Promise<NormalizedCoverageEvent[]> {
    if (!fieldopsConfigured()) {
      throw new Error(
        'CNH FieldOps credentials not configured. Set FIELDOPS_CLIENT_ID, ' +
        'FIELDOPS_CLIENT_SECRET, and FIELDOPS_SUBSCRIPTION_KEY in .env.local.'
      )
    }

    // Pull applications + yield in parallel (planting coverage from applications endpoint)
    // NOTE: returns empty array silently for dealership-linked accounts — check the count.
    const [apps, yieldData] = await Promise.allSettled([
      fieldopsGet<Record<string, unknown>[]>('/v1/applications', { year: String(cropYear) }),
      fieldopsGet<Record<string, unknown>[]>('/v1/yield', { year: String(cropYear) }),
    ])

    const events: NormalizedCoverageEvent[] = []

    if (apps.status === 'fulfilled') {
      for (const a of apps.value ?? []) {
        events.push(normalizeFieldopsApp(a, cropYear))
      }
    }

    if (yieldData.status === 'fulfilled') {
      for (const y of yieldData.value ?? []) {
        // Yield records include as-harvested geometry — treat as 'harvest' operation
        const geom = y['geometry'] as Record<string, unknown> | null | undefined
        events.push({
          crop_year:      cropYear,
          source_adapter: ADAPTER_FIELDOPS,
          operation_type: 'harvest',
          op_date:        (y['date'] as string | null) ?? null,
          geojson:        geom ? JSON.stringify(geom) : null,
          applied_acres:  parseNum(y['harvestedAcres'] ?? y['acres']),
          product:        parseStr(y['crop']),
          raw_payload:    y,
        })
      }
    }

    return events
  },
}

// ── GeoJSON file upload adapter ───────────────────────────────────────────────
// Normalizes any GeoJSON FeatureCollection export from FieldView, JD Ops Center,
// Trimble Ag Software, Ag Leader, etc.
//
// Feature properties are matched against common field name conventions across platforms.

export interface GeoJSONFeatureCollection {
  type:     string
  features: Array<{
    geometry:   unknown
    properties: Record<string, unknown>
  }>
}

export function normalizeGeoJsonCollection(
  collection: GeoJSONFeatureCollection,
  cropYear:   number,
  defaultOperationType = 'application'
): NormalizedCoverageEvent[] {
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('Input must be a GeoJSON FeatureCollection')
  }

  return collection.features.map((feature) => {
    const p      = feature.properties ?? {}
    const geomStr = feature.geometry ? JSON.stringify(feature.geometry) : null

    return {
      crop_year:      cropYear,
      source_adapter: ADAPTER_GEOJSON,
      operation_type: parseStr(p['operation_type'] ?? p['OperationType'] ?? p['OpType']) ?? defaultOperationType,
      op_date:        parseStr(p['op_date'] ?? p['date'] ?? p['Date'] ?? p['OpDate']) ?? null,
      geojson:        geomStr,
      applied_acres:  parseNum(p['applied_acres'] ?? p['AppliedAcres'] ?? p['FieldAc'] ?? p['Acres']),
      product:        parseStr(p['product'] ?? p['Product'] ?? p['ProductName'] ?? p['Crop']),
      rate:           parseNum(p['rate'] ?? p['Rate'] ?? p['AppRate']),
      rate_unit:      parseStr(p['rate_unit'] ?? p['RateUnit'] ?? p['Unit']),
      raw_payload:    p,
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function parseStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}
