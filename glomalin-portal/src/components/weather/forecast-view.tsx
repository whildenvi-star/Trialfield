'use client'

interface DailyRow {
  date:          string
  precip_in:     number | null
  forecast_prob: number | null
}

interface ForecastViewProps {
  rows: DailyRow[]
}

function probColor(prob: number | null): string {
  if (prob == null) return 'text-glomalin-muted'
  if (prob >= 60)   return 'text-glomalin-accent'
  if (prob >= 30)   return 'text-yellow-400'
  return 'text-glomalin-muted'
}

function probBg(prob: number | null): string {
  if (prob == null) return 'bg-glomalin-border/20'
  if (prob >= 60)   return 'bg-glomalin-accent/15'
  if (prob >= 30)   return 'bg-yellow-400/10'
  return 'bg-glomalin-border/20'
}

function dayLabel(dateStr: string): { dow: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    dow:  d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: `${d.getMonth() + 1}/${d.getDate()}`,
  }
}

export default function ForecastView({ rows }: ForecastViewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const forecast = rows.filter((r) => r.date > today).slice(0, 7)

  if (forecast.length === 0) {
    return (
      <div className="p-6">
        <p className="text-xs font-mono text-glomalin-muted border border-glomalin-border rounded px-4 py-3">
          No forecast data for this field. Use the Refresh button to pull data from Precip.ai.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-glomalin-muted mb-4">
        7-Day Forecast
      </p>
      <div className="grid grid-cols-7 gap-2">
        {forecast.map((r) => {
          const { dow, date } = dayLabel(r.date)
          const inches = r.precip_in ?? 0
          const prob   = r.forecast_prob

          return (
            <div
              key={r.date}
              className={[
                'flex flex-col items-center gap-1.5 rounded border border-glomalin-border py-3 px-1',
                probBg(prob),
              ].join(' ')}
            >
              <span className="font-mono text-[10px] text-glomalin-muted uppercase tracking-wider">
                {dow}
              </span>
              <span className="font-mono text-[10px] text-glomalin-muted">{date}</span>
              <span className="font-mono text-sm text-glomalin-text tabular-nums">
                {inches.toFixed(2)}&Prime;
              </span>
              {prob != null && (
                <span className={['font-mono text-[10px] tabular-nums', probColor(prob)].join(' ')}>
                  {Math.round(prob)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] font-mono text-glomalin-muted">
        Probability shown where available. Color: <span className="text-glomalin-muted">grey &lt;30%</span> · <span className="text-yellow-400">yellow 30–60%</span> · <span className="text-glomalin-accent">teal ≥60%</span>
      </p>
    </div>
  )
}
