'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DailyRow {
  date:          string
  precip_in:     number | null
  forecast_prob: number | null
}

interface HistoryViewProps {
  rows: DailyRow[]
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded px-3 py-2 font-mono text-xs text-glomalin-text shadow-lg">
      <p className="text-glomalin-muted mb-1">{label}</p>
      <p>
        <span className="text-[#7A9E7E]">{Number(payload[0].value).toFixed(3)}</span>
        <span className="text-glomalin-muted ml-1">in</span>
      </p>
    </div>
  )
}

export default function HistoryView({ rows }: HistoryViewProps) {
  const today = new Date().toISOString().slice(0, 10)

  const historical = rows
    .filter((r) => r.date <= today)
    .slice(-30)
    .map((r) => ({
      date:  formatLabel(r.date),
      value: r.precip_in ?? 0,
    }))

  if (historical.length === 0) {
    return (
      <div className="p-6">
        <p className="text-xs font-mono text-glomalin-muted border border-glomalin-border rounded px-4 py-3">
          No historical data for this field. Use the Refresh button to pull data from Precip.ai.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-glomalin-muted mb-4">
        Daily Precipitation — Last 30 Days (inches)
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={historical} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(42,34,24,0.6)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6a5a4a' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#6a5a4a' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}"`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(200,134,10,0.08)' }} />
          <Bar dataKey="value" fill="#7A9E7E" radius={[2, 2, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
