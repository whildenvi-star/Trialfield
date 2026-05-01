'use client'

import { useState, useEffect, useRef } from 'react'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface CoverageSummaryRow {
  source_adapter:     string
  operation_type:     string
  event_count:        number
  total_applied_ac:   number | null
  last_imported_at:   string | null
  matched_zone_count: number
  unmatched_count:    number
}

interface ImportResult {
  imported:     number
  zone_matched: number
  unmatched:    number
  warnings:     string[]
  errors:       string[]
}

interface CoverageImportPanelProps {
  cropYear?: number
}

const ADAPTER_LABELS: Record<string, string> = {
  'cnhind-fieldops': 'CNH FieldOps',
  'geojson-upload':  'GeoJSON Upload',
  'manual':          'Manual',
}

const OP_LABELS: Record<string, string> = {
  application: 'Application',
  planting:    'Planting',
  harvest:     'Harvest',
  tillage:     'Tillage',
}

export function CoverageImportPanel({ cropYear = CURRENT_CROP_YEAR }: CoverageImportPanelProps) {
  const [summary, setSummary]             = useState<CoverageSummaryRow[]>([])
  const [fieldopsConfigured, setFieldopsConfigured] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [syncing, setSyncing]             = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [result, setResult]               = useState<ImportResult | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const fileInputRef                      = useRef<HTMLInputElement>(null)

  function fetchSummary() {
    setLoading(true)
    fetch(`/api/fsa/coverage-import?year=${cropYear}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? [])
        setFieldopsConfigured(d.fieldops_configured ?? false)
      })
      .catch(() => setError('Failed to load coverage summary'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSummary() }, [cropYear]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFieldOpsSync() {
    setSyncing(true)
    setResult(null)
    setError(null)
    try {
      const res  = await fetch('/api/fsa/coverage-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'fieldops', crop_year: cropYear }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'FieldOps sync failed')
      } else {
        setResult(data)
        fetchSummary()
      }
    } catch {
      setError('Network error during FieldOps sync')
    } finally {
      setSyncing(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setResult(null)
    setError(null)

    try {
      const text     = await file.text()
      const geojson  = JSON.parse(text)

      const res  = await fetch('/api/fsa/coverage-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'geojson', crop_year: cropYear, data: geojson }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'GeoJSON import failed')
      } else {
        setResult(data)
        fetchSummary()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse GeoJSON file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalEvents = summary.reduce((s, r) => s + (Number(r.event_count) || 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-glomalin-muted uppercase tracking-widest">
            As-Applied Coverage — {cropYear}
          </span>
          {totalEvents > 0 && (
            <span className="ml-3 text-xs font-mono text-glomalin-green">
              {totalEvents} events imported
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* CNH FieldOps sync */}
          <button
            onClick={handleFieldOpsSync}
            disabled={syncing || !fieldopsConfigured}
            title={fieldopsConfigured ? 'Pull from CNH FieldOps API' : 'CNH FieldOps credentials not configured'}
            className="px-3 py-1.5 rounded border border-glomalin-border text-xs font-mono text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-borderLight disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? 'Syncing...' : 'Sync FieldOps'}
          </button>

          {/* GeoJSON file upload */}
          <label
            className={`px-3 py-1.5 rounded border border-glomalin-accent text-glomalin-accent text-xs font-mono cursor-pointer hover:bg-glomalin-accent/10 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? 'Uploading...' : 'Upload GeoJSON'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-xs font-mono text-glomalin-muted animate-pulse">Loading...</p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded border border-red-800/50 bg-red-950/20 px-3 py-2 text-xs font-mono text-red-400">
          {error}
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="rounded border border-glomalin-green/40 bg-green-950/20 px-3 py-2 text-xs font-mono">
          <span className="text-glomalin-green font-semibold">
            Imported {result.imported} events
          </span>
          <span className="text-glomalin-muted ml-2">
            · {result.zone_matched} zone-matched · {result.unmatched} unmatched
          </span>
          {result.warnings.length > 0 && (
            <div className="mt-1 text-amber-400">
              {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-1 text-red-400">
              {result.errors.map((e, i) => <p key={i}>✗ {e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* FieldOps not configured notice */}
      {!fieldopsConfigured && !loading && (
        <div className="rounded border border-glomalin-border bg-glomalin-surface px-3 py-2 text-xs font-mono text-glomalin-muted">
          CNH FieldOps live sync not configured. Set{' '}
          <code className="text-glomalin-accent">FIELDOPS_CLIENT_ID</code>,{' '}
          <code className="text-glomalin-accent">FIELDOPS_CLIENT_SECRET</code>, and{' '}
          <code className="text-glomalin-accent">FIELDOPS_SUBSCRIPTION_KEY</code> to enable.
          Use Upload GeoJSON to import as-applied data from any precision ag platform.
        </div>
      )}

      {/* Summary table */}
      {!loading && summary.length > 0 && (
        <div className="rounded border border-glomalin-border overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-glomalin-surface border-b border-glomalin-border">
                <th className="px-3 py-2 text-left text-glomalin-muted">Source</th>
                <th className="px-3 py-2 text-left text-glomalin-muted">Operation</th>
                <th className="px-3 py-2 text-right text-glomalin-muted">Events</th>
                <th className="px-3 py-2 text-right text-glomalin-muted">Applied Ac</th>
                <th className="px-3 py-2 text-right text-glomalin-muted">Zones Matched</th>
                <th className="px-3 py-2 text-right text-glomalin-muted">Last Import</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => (
                <tr key={i} className="border-b border-glomalin-border last:border-0 hover:bg-glomalin-surface/50">
                  <td className="px-3 py-2 text-glomalin-text">
                    {ADAPTER_LABELS[row.source_adapter] ?? row.source_adapter}
                  </td>
                  <td className="px-3 py-2 text-glomalin-muted">
                    {OP_LABELS[row.operation_type] ?? row.operation_type}
                  </td>
                  <td className="px-3 py-2 text-right text-glomalin-text">{row.event_count}</td>
                  <td className="px-3 py-2 text-right text-glomalin-text">
                    {row.total_applied_ac != null
                      ? Number(row.total_applied_ac).toFixed(1)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={Number(row.unmatched_count) > 0 ? 'text-amber-400' : 'text-glomalin-green'}>
                      {row.matched_zone_count} / {row.event_count}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-glomalin-muted">
                    {row.last_imported_at
                      ? new Date(row.last_imported_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && summary.length === 0 && (
        <p className="text-xs font-mono text-glomalin-muted">
          No coverage events imported for {cropYear} yet.
          Sync from CNH FieldOps or upload a GeoJSON export from FieldView, JD Operations Center, Trimble, or Ag Leader.
        </p>
      )}
    </div>
  )
}
