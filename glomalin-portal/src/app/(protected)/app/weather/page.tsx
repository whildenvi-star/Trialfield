import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import WeatherShell from '@/components/weather/weather-shell'
import { type FieldSummary } from '@/components/weather/field-list'

export const metadata = { title: 'Precipitation — Glomalin Portal' }

async function getSummary(): Promise<FieldSummary[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data } = await supabase
    .from('precip_summary')
    .select('registry_field_id, last_7d_in, last_30d_in, last_fetched')

  if (!data) return []

  // Enrich with field names from field_boundaries
  const { data: boundaries } = await supabase
    .from('field_boundaries')
    .select('registry_field_id, name')

  const nameMap: Record<string, string> = {}
  for (const b of boundaries ?? []) {
    nameMap[b.registry_field_id] = b.name
  }

  return data.map((row) => ({
    registry_field_id: row.registry_field_id,
    last_7d_in:        row.last_7d_in  ? Number(row.last_7d_in)  : null,
    last_30d_in:       row.last_30d_in ? Number(row.last_30d_in) : null,
    last_fetched:      row.last_fetched ?? null,
    name:              nameMap[row.registry_field_id] ?? undefined,
  }))
}

export default async function WeatherPage() {
  const summary = await getSummary()

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-glomalin-border shrink-0">
        <h1 className="font-mono text-sm text-glomalin-text tracking-wide">
          Precipitation
        </h1>
        <p className="font-mono text-[10px] text-glomalin-muted mt-0.5">
          Per-field rain data via Precip.ai · {summary.length} field{summary.length !== 1 ? 's' : ''} cached
        </p>
      </div>
      <WeatherShell initialSummary={summary} />
    </div>
  )
}
