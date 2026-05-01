'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { ReconciliationTable } from './reconciliation-table'
import {
  cluFeatureCollection,
  zoneFeatureCollection,
  type ReconciliationRow,
} from '@/lib/fsa/reconciliation'
import type { CluRecord } from '@/lib/fsa/calc'

// Lazy-load map and PDF button — both are browser-only
const ReconciliationMap = dynamic(
  () => import('./reconciliation-map').then((m) => m.ReconciliationMap),
  { ssr: false, loading: () => <div className="flex-1 bg-glomalin-surface animate-pulse" /> }
)

const Form578Button = dynamic(
  () => import('./form-578-button').then((m) => m.Form578Button),
  { ssr: false, loading: () => <span className="text-xs font-mono text-glomalin-muted">Loading PDF...</span> }
)

// ── Summary bar ───────────────────────────────────────────────────────────────

interface Summary { total: number; ok: number; flagged: number; unresolved: number }

function SummaryBar({ s }: { s: Summary }) {
  const pct = (n: number) => s.total > 0 ? Math.round((n / s.total) * 100) : 0

  return (
    <div className="flex items-center gap-4 text-xs font-mono text-glomalin-muted">
      <span className="text-glomalin-text font-medium">{s.total} CLUs</span>
      <span className="text-glomalin-green">{s.ok} ok ({pct(s.ok)}%)</span>
      <span className="text-yellow-400">{s.flagged} flagged</span>
      <span className="text-red-400">{s.unresolved} unresolved</span>
      {s.unresolved === 0 && s.total > 0 && (
        <span className="text-glomalin-green ml-2">✓ Ready to export</span>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface ReconciliationViewProps {
  cropYear?: number
}

export function ReconciliationView({ cropYear = CURRENT_CROP_YEAR }: ReconciliationViewProps) {
  const [farms, setFarms]               = useState<string[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null)
  const [rows, setRows]                 = useState<ReconciliationRow[]>([])
  const [cluRecords, setCluRecords]     = useState<CluRecord[]>([])
  const [summary, setSummary]           = useState<Summary | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [highlightClu, setHighlightClu] = useState<string | null>(null)
  const [refreshKey, setRefreshKey]     = useState(0)

  // Fetch farm list on mount
  useEffect(() => {
    fetch(`/api/fsa/reconciliation?year=${cropYear}`)
      .then((r) => r.json())
      .then((d) => {
        setFarms(d.farms ?? [])
        // Auto-select first farm
        if (d.farms?.length > 0 && !selectedFarm) {
          setSelectedFarm(d.farms[0])
        }
      })
      .catch(() => setError('Failed to load farm list'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropYear])

  // Fetch reconciliation data for selected farm
  useEffect(() => {
    if (!selectedFarm) return
    setLoading(true)
    setError(null)
    setHighlightClu(null)

    // Fetch reconciliation spatial data + CLU records in parallel
    Promise.all([
      fetch(`/api/fsa/reconciliation?farm=${encodeURIComponent(selectedFarm)}&year=${cropYear}`).then((r) => r.json()),
      fetch(`/api/fsa/clu-records?year=${cropYear}`).then((r) => r.json()),
    ])
      .then(([reconData, cluData]) => {
        if (reconData.error) { setError(reconData.error); return }
        setRows(reconData.rows ?? [])
        setSummary(reconData.summary ?? null)
        setFarms((prev) => prev.length ? prev : reconData.farms ?? [])
        setCluRecords(cluData.records ?? [])
      })
      .catch(() => setError('Failed to load reconciliation data'))
      .finally(() => setLoading(false))
  }, [selectedFarm, cropYear, refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const cluGeoJSON  = cluFeatureCollection(rows, highlightClu ?? undefined)
  const zoneGeoJSON = zoneFeatureCollection(rows, highlightClu ?? undefined)

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-3 mb-0 border-b border-glomalin-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-glomalin-muted uppercase tracking-widest">
            Farm
          </label>
          <select
            value={selectedFarm ?? ''}
            onChange={(e) => setSelectedFarm(e.target.value || null)}
            className="bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
          >
            <option value="">Select farm...</option>
            {farms.map((f) => (
              <option key={f} value={f}>Farm {f}</option>
            ))}
          </select>
        </div>

        {loading && (
          <span className="text-xs font-mono text-glomalin-muted animate-pulse">Loading...</span>
        )}

        {summary && !loading && <SummaryBar s={summary} />}

        {error && (
          <span className="text-xs font-mono text-red-400 ml-2">{error}</span>
        )}

        {/* Export buttons — right-aligned */}
        {cluRecords.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {/* CSV download — plain anchor, triggers server-side route */}
            <a
              href={`/api/fsa/export-578?year=${cropYear}&confirmed_only=true`}
              download
              className="px-3 py-1.5 rounded border border-glomalin-border text-glomalin-muted text-xs font-mono hover:text-glomalin-text hover:border-glomalin-borderLight transition-colors"
            >
              Export CSV
            </a>
            {/* PDF download — client-side @react-pdf/renderer */}
            <Form578Button
              records={cluRecords}
              cropYear={cropYear}
              confirmedOnly={true}
            />
          </div>
        )}
      </div>

      {/* ── Three-panel layout ──────────────────────────────────────── */}
      {selectedFarm ? (
        <div className="flex flex-1 min-h-0 mt-3 gap-3">
          {/* Left: zone map */}
          <div className="flex flex-col rounded border border-glomalin-border overflow-hidden" style={{ width: '30%' }}>
            <ReconciliationMap
              geojson={zoneGeoJSON}
              panel="zone"
              highlightClu={highlightClu}
              onFeatureClick={setHighlightClu}
              className="h-full"
            />
          </div>

          {/* Center: reconciliation table */}
          <div className="flex flex-col rounded border border-glomalin-border overflow-hidden" style={{ width: '40%' }}>
            <div className="px-3 py-1.5 border-b border-glomalin-border bg-glomalin-surface flex-shrink-0">
              <span className="text-[10px] font-mono text-glomalin-muted uppercase tracking-widest">
                Reconciliation — {cropYear}
              </span>
            </div>
            <ReconciliationTable
              rows={rows}
              highlightClu={highlightClu}
              onRowClick={(clu) => setHighlightClu((prev) => prev === clu ? null : clu)}
              onConfirmed={refresh}
            />
          </div>

          {/* Right: CLU boundary map */}
          <div className="flex flex-col rounded border border-glomalin-border overflow-hidden" style={{ width: '30%' }}>
            <ReconciliationMap
              geojson={cluGeoJSON}
              panel="clu"
              highlightClu={highlightClu}
              onFeatureClick={setHighlightClu}
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs font-mono text-glomalin-muted">
          {farms.length === 0 && !loading
            ? `No CLU boundaries found for ${cropYear}. Run the shapefile import first.`
            : 'Select a farm above to begin reconciliation.'}
        </div>
      )}
    </div>
  )
}
