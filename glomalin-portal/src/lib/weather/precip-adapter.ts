export interface PrecipPoint {
  registry_field_id: string
  lat:               number
  lng:               number
  date:              string        // YYYY-MM-DD
  precip_in:         number
  forecast_prob:     number | null // 0–100 for future dates, null for historical
}

export interface FetchPrecipOptions {
  startDate?:    string  // YYYY-MM-DD, defaults to 30 days ago
  endDate?:      string  // YYYY-MM-DD, defaults to today + forecastDays
  days?:         number  // shorthand: fetch this many days back from today
  forecastDays?: number  // how many days forward to include (default 0)
}

export interface PrecipAdapter {
  isConfigured: () => boolean
  fetchPrecip:  (
    fields:  { id: string; lat: number; lng: number }[],
    options?: FetchPrecipOptions
  ) => Promise<PrecipPoint[]>
}

// ── Precip.ai adapter ─────────────────────────────────────────────────────────
// Env vars:
//   PRECIP_APP_API_KEY   — required (Bearer token from app.precip.ai)
//   PRECIP_APP_BASE_URL  — optional override (default: https://api.precip.ai)
//
// Endpoint: GET /api/v1/daily
//   ?latitude=<lat1>,<lat2>,...
//   &longitude=<lng1>,<lng2>,...
//   &start=YYYY-MM-DD
//   &end=YYYY-MM-DD
//   &format=geojson
//
// Response: GeoJSON FeatureCollection — one Feature per input point, in order.
//   features[i].properties.days[j].startTime  — ISO timestamp (date = slice 0..10)
//   features[i].properties.days[j].precip      — total precip in MILLIMETERS
//   features[i].properties.days[j].precip_probability — 0–100 | null

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface PrecipDay {
  startTime:         string
  precip:            number
  precip_probability: number | null
}

interface PrecipFeature {
  geometry:   { coordinates: [number, number] }
  properties: { days: PrecipDay[] }
}

export const PrecipAppAdapter: PrecipAdapter = {
  isConfigured: () => !!process.env.PRECIP_APP_API_KEY,

  async fetchPrecip(fields, options = {}): Promise<PrecipPoint[]> {
    if (fields.length === 0) return []

    const BASE = (process.env.PRECIP_APP_BASE_URL ?? 'https://api.precip.ai').replace(/\/$/, '')
    const key  = process.env.PRECIP_APP_API_KEY ?? ''

    const today = new Date()
    const start = options.startDate
      ?? toISO(new Date(today.getTime() - (options.days ?? 30) * 86_400_000))
    const end = options.endDate
      ?? toISO(new Date(today.getTime() + (options.forecastDays ?? 0) * 86_400_000))

    const lats = fields.map(f => f.lat).join(',')
    const lngs = fields.map(f => f.lng).join(',')

    const url = `${BASE}/api/v1/daily?latitude=${lats}&longitude=${lngs}&start=${start}&end=${end}&format=geojson`

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept':        'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return []

    const data = await res.json() as { type: string; features: PrecipFeature[] }
    if (!Array.isArray(data?.features)) return []

    const results: PrecipPoint[] = []

    for (let i = 0; i < data.features.length; i++) {
      const field = fields[i]
      if (!field) continue
      const days = data.features[i].properties.days ?? []
      for (const day of days) {
        const date = day.startTime?.slice(0, 10)
        if (!date || day.precip == null) continue
        results.push({
          registry_field_id: field.id,
          lat:               field.lat,
          lng:               field.lng,
          date,
          precip_in:         Number((day.precip / 25.4).toFixed(3)), // mm → inches
          forecast_prob:     day.precip_probability != null ? Number(day.precip_probability) : null,
        })
      }
    }

    return results
  },
}
