'use client'

import { useState, useEffect, useCallback } from 'react'
import FieldList, { type FieldSummary } from './field-list'
import CurrentView from './current-view'
import HistoryView from './history-view'
import ForecastView from './forecast-view'

type Tab = 'current' | 'history' | 'forecast'

interface DailyRow {
  date:          string
  precip_in:     number | null
  forecast_prob: number | null
}

interface WeatherShellProps {
  initialSummary: FieldSummary[]
}

export default function WeatherShell({ initialSummary }: WeatherShellProps) {
  const sorted = [...initialSummary].sort(
    (a, b) => (b.last_7d_in ?? 0) - (a.last_7d_in ?? 0)
  )

  const [summary, setSummary]           = useState<FieldSummary[]>(sorted)
  const [selectedId, setSelectedId]     = useState<string | null>(sorted[0]?.registry_field_id ?? null)
  const [activeTab, setActiveTab]       = useState<Tab>('current')
  const [fieldRows, setFieldRows]       = useState<DailyRow[]>([])
  const [loadingRows, setLoadingRows]   = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  const [refreshMsg, setRefreshMsg]     = useState<string | null>(null)

  const maxLast7d = Math.max(...summary.map((f) => f.last_7d_in ?? 0), 0.01)

  const selectedSummary = summary.find((f) => f.registry_field_id === selectedId)

  // Load daily rows whenever selected field changes
  useEffect(() => {
    if (!selectedId) return
    setLoadingRows(true)
    fetch(`/api/weather/precip/field/${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((d: { rows?: DailyRow[] }) => setFieldRows(d.rows ?? []))
      .catch(() => setFieldRows([]))
      .finally(() => setLoadingRows(false))
  }, [selectedId])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res  = await fetch('/api/weather/precip/refresh', { method: 'POST' })
      const data = await res.json() as { refreshed?: number; fields_updated?: number; error?: string }
      if (data.error) {
        setRefreshMsg(`Error: ${data.error}`)
      } else {
        setRefreshMsg(`Refreshed ${data.refreshed ?? 0} rows across ${data.fields_updated ?? 0} fields`)
        // Re-fetch summary
        const summaryRes  = await fetch('/api/weather/precip')
        const summaryData = await summaryRes.json() as { fields?: FieldSummary[] }
        if (summaryData.fields) {
          setSummary([...summaryData.fields].sort((a, b) => (b.last_7d_in ?? 0) - (a.last_7d_in ?? 0)))
        }
        // Re-fetch rows for selected field
        if (selectedId) {
          const rowsRes  = await fetch(`/api/weather/precip/field/${encodeURIComponent(selectedId)}`)
          const rowsData = await rowsRes.json() as { rows?: DailyRow[] }
          setFieldRows(rowsData.rows ?? [])
        }
      }
    } catch {
      setRefreshMsg('Refresh failed — check network or API key')
    } finally {
      setRefreshing(false)
    }
  }, [selectedId])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'current',  label: 'Current' },
    { id: 'history',  label: 'History' },
    { id: 'forecast', label: 'Forecast' },
  ]

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[500px] overflow-hidden">
      {/* Left: field list */}
      <div className="w-64 shrink-0 border-r border-glomalin-border overflow-hidden flex flex-col">
        <FieldList
          fields={summary}
          selectedId={selectedId}
          onSelect={setSelectedId}
          maxLast7d={maxLast7d}
        />
      </div>

      {/* Right: tabs + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar + refresh */}
        <div className="flex items-center justify-between border-b border-glomalin-border px-4 shrink-0">
          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'relative px-4 py-3 font-mono text-xs transition-colors duration-100',
                  activeTab === tab.id
                    ? 'text-glomalin-accent'
                    : 'text-glomalin-muted hover:text-glomalin-text',
                ].join(' ')}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-glomalin-accent rounded-t"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {refreshMsg && (
              <span className={[
                'font-mono text-[10px]',
                refreshMsg.startsWith('Error') ? 'text-red-400' : 'text-glomalin-muted',
              ].join(' ')}>
                {refreshMsg}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="font-mono text-xs text-glomalin-muted hover:text-glomalin-accent border border-glomalin-border hover:border-glomalin-accent rounded px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Field name header */}
        {selectedSummary && (
          <div className="px-6 py-3 border-b border-glomalin-border/40 shrink-0">
            <p className="font-mono text-sm text-glomalin-text">
              {selectedSummary.name ?? selectedSummary.registry_field_id}
            </p>
            {selectedSummary.last_fetched && (
              <p className="font-mono text-[10px] text-glomalin-muted">
                last fetched {new Date(selectedSummary.last_fetched).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedId ? (
            <p className="p-6 text-xs font-mono text-glomalin-muted">
              Select a field from the list to view precipitation data.
            </p>
          ) : loadingRows ? (
            <p className="p-6 text-xs font-mono text-glomalin-muted animate-pulse">
              Loading field data…
            </p>
          ) : (
            <>
              {activeTab === 'current' && (
                <CurrentView
                  rows={fieldRows}
                  last_7d_in={selectedSummary?.last_7d_in ?? null}
                  last_30d_in={selectedSummary?.last_30d_in ?? null}
                />
              )}
              {activeTab === 'history' && (
                <HistoryView rows={fieldRows} />
              )}
              {activeTab === 'forecast' && (
                <ForecastView rows={fieldRows} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
