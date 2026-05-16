export interface PrecipPoint {
  registry_field_id: string
  lat:               number
  lng:               number
  date:              string        // YYYY-MM-DD
  precip_in:         number
  forecast_prob:     number | null // 0–100 for future dates, null for historical
}

export interface FetchPrecipOptions {
  startDate?:   string  // YYYY-MM-DD, defaults to 30 days ago
  endDate?:     string  // YYYY-MM-DD, defaults to today + 7 days (includes forecast)
  days?:        number  // shorthand: fetch this many days back from today
  forecastDays?: number // how many days forward to include (default 0)
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
// Endpoint (to verify once API docs arrive):
//   GET /v1/daily?lat={lat}&lng={lng}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
//   Headers: { Authorization: Bearer <key> }
//   Response: [{ date: "YYYY-MM-DD", precip_in: 0.43, probability?: 80 }, ...]
//
// NOTE: Endpoint path, query param names, and response field names are best-guess
// from public docs. Update after confirming with actual API response.

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const PrecipAppAdapter: PrecipAdapter = {
  isConfigured: () => !!process.env.PRECIP_APP_API_KEY,

  async fetchPrecip(fields, options = {}): Promise<PrecipPoint[]> {
    const BASE = (process.env.PRECIP_APP_BASE_URL ?? 'https://api.precip.ai').replace(/\/$/, '')
    const key  = process.env.PRECIP_APP_API_KEY ?? ''

    const today = new Date()
    const start = options.startDate
      ?? toISO(new Date(today.getTime() - (options.days ?? 30) * 86_400_000))
    const end = options.endDate
      ?? toISO(new Date(today.getTime() + (options.forecastDays ?? 0) * 86_400_000))

    const results: PrecipPoint[] = []

    await Promise.allSettled(
      fields.map(async (field) => {
        const url = `${BASE}/v1/daily?lat=${field.lat}&lng=${field.lng}&start_date=${start}&end_date=${end}`
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Accept':        'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) return
        const data = await res.json() as { date: string; precip_in: number; probability?: number }[]
        if (!Array.isArray(data)) return
        for (const row of data) {
          if (row.date && row.precip_in != null) {
            results.push({
              registry_field_id: field.id,
              lat:               field.lat,
              lng:               field.lng,
              date:              row.date,
              precip_in:         Number(row.precip_in),
              forecast_prob:     row.probability != null ? Number(row.probability) : null,
            })
          }
        }
      })
    )

    return results
  },
}
