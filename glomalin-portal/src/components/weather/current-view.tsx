'use client'

interface DailyRow {
  date:          string
  precip_in:     number | null
  forecast_prob: number | null
}

interface CurrentViewProps {
  rows:       DailyRow[]
  last_7d_in:  number | null
  last_30d_in: number | null
}

function StatCard({
  label,
  value,
  pct,
  note,
}: {
  label: string
  value: string
  pct:   number
  note?: string
}) {
  return (
    <div className="rounded border border-glomalin-border bg-glomalin-surface p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-glomalin-muted mb-2">
        {label}
      </p>
      <p className="font-mono text-2xl text-glomalin-text mb-3">{value}</p>
      <div className="h-1.5 rounded overflow-hidden bg-glomalin-border/40 mb-1">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: '#7A9E7E' }}
        />
      </div>
      {note && (
        <p className="text-[10px] font-mono text-glomalin-muted mt-1">{note}</p>
      )}
    </div>
  )
}

export default function CurrentView({ rows, last_7d_in, last_30d_in }: CurrentViewProps) {
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  const last24h = (rows.find((r) => r.date === today || r.date === yesterday)?.precip_in) ?? 0
  const d7  = last_7d_in  ?? 0
  const d30 = last_30d_in ?? 0

  // Scale bars relative to 30-day total (or fallback to 4" typical season max)
  const scaleMax = Math.max(d30, 4)

  const lastFetchedRow = rows.filter((r) => r.date <= today).at(-1)
  const lastDateLabel  = lastFetchedRow ? lastFetchedRow.date : '—'

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Last 24 hours"
          value={`${last24h.toFixed(2)}"`}
          pct={(last24h / scaleMax) * 100}
          note={`as of ${lastDateLabel}`}
        />
        <StatCard
          label="Last 7 days"
          value={`${d7.toFixed(2)}"`}
          pct={(d7 / scaleMax) * 100}
        />
        <StatCard
          label="Last 30 days"
          value={`${d30.toFixed(2)}"`}
          pct={100}
          note="baseline"
        />
      </div>

      {d30 === 0 && (
        <p className="text-xs font-mono text-glomalin-muted border border-glomalin-border rounded px-4 py-3">
          No cached data for this field. Use the Refresh button to pull data from Precip.ai.
        </p>
      )}
    </div>
  )
}
