'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  'cnhind-fieldops':   'CNH FieldOps',
  'climate-fieldview': 'FieldView (API)',
  'geojson-upload':    'GeoJSON Upload',
  'fieldview-dat':     'FieldView DAT',
  'manual':            'Manual',
}

const OP_LABELS: Record<string, string> = {
  application: 'Application',
  planting:    'Planting',
  harvest:     'Harvest',
  tillage:     'Tillage',
}

interface FieldViewStatus {
  fieldview_configured: boolean
  connected:            boolean
  expires_at:           string | null
  connected_at:         string | null
}

export function CoverageImportPanel({ cropYear = CURRENT_CROP_YEAR }: CoverageImportPanelProps) {
  const [summary, setSummary]                   = useState<CoverageSummaryRow[]>([])
  const [fieldopsConfigured, setFieldopsConfigured] = useState(false)
  const [fvStatus, setFvStatus]                 = useState<FieldViewStatus | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [syncing, setSyncing]                   = useState(false)
  const [fvSyncing, setFvSyncing]               = useState(false)
  const [fvDisconnecting, setFvDisconnecting]   = useState(false)
  const [uploading, setUploading]               = useState(false)
  const [datUploading, setDatUploading]         = useState(false)
  const [result, setResult]                     = useState<ImportResult | null>(null)
  const [error, setError]                       = useState<string | null>(null)
  const fileInputRef                            = useRef<HTMLInputElement>(null)
  const datFileInputRef                         = useRef<HTMLInputElement>(null)

  const fetchSummary = useCallback(() => {
    setLoading(true)
    fetch(`/api/fsa/coverage-import?year=${cropYear}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary ?? [])
        setFieldopsConfigured(d.fieldops_configured ?? false)
      })
      .catch(() => setError('Failed to load coverage summary'))
      .finally(() => setLoading(false))
  }, [cropYear])

  function fetchFvStatus() {
    fetch('/api/fsa/fieldview/status')
      .then((r) => r.json())
      .then((d) => setFvStatus(d as FieldViewStatus))
      .catch(() => {/* non-blocking */})
  }

  useEffect(() => { fetchSummary(); fetchFvStatus() }, [fetchSummary])

  async function handleFieldViewSync() {
    setFvSyncing(true)
    setResult(null)
    setError(null)
    try {
      const res  = await fetch('/api/fsa/coverage-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'fieldview', crop_year: cropYear }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'FieldView sync failed')
      } else {
        setResult(data)
        fetchSummary()
      }
    } catch {
      setError('Network error during FieldView sync')
    } finally {
      setFvSyncing(false)
    }
  }

  async function handleFieldViewDisconnect() {
    setFvDisconnecting(true)
    try {
      await fetch('/api/fsa/fieldview/connect', { method: 'DELETE' })
      fetchFvStatus()
    } catch {/* ignore */} finally {
      setFvDisconnecting(false)
    }
  }

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

  const handleDatUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDatUploading(true)
    setResult(null)
    setError(null)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('crop_year', String(cropYear))

      const res  = await fetch('/api/fsa/fieldview/dat-import', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'DAT import failed')
      } else {
        setResult({ imported: data.imported, zone_matched: 0, unmatched: data.unmatched, warnings: data.warnings ?? [], errors: data.errors ?? [] })
        fetchSummary()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload ZIP')
    } finally {
      setDatUploading(false)
      if (datFileInputRef.current) datFileInputRef.current.value = ''
    }
  }, [cropYear, fetchSummary])

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

          {/* FieldView DAT export ZIP */}
          <label
            className={`px-3 py-1.5 rounded border border-glomalin-accent text-glomalin-accent text-xs font-mono cursor-pointer hover:bg-glomalin-accent/10 transition-colors ${datUploading ? 'opacity-50 pointer-events-none' : ''}`}
            title="Upload a FieldView manual export ZIP containing .dat files"
          >
            {datUploading ? 'Importing...' : 'Upload FieldView ZIP'}
            <input
              ref={datFileInputRef}
              type="file"
              accept=".zip"
              className="sr-only"
              onChange={handleDatUpload}
              disabled={datUploading}
            />
          </label>

          {/* GeoJSON file upload */}
          <label
            className={`px-3 py-1.5 rounded border border-glomalin-border text-glomalin-muted text-xs font-mono cursor-pointer hover:text-glomalin-text transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
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

      {/* Climate FieldView section */}
      {fvStatus && (
        <div className="rounded border border-glomalin-border bg-glomalin-surface px-3 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-glomalin-muted">
              Climate FieldView
            </span>
            {fvStatus.fieldview_configured && fvStatus.connected && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-mono text-glomalin-green">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-glomalin-green" />
                  Connected
                </span>
                <button
                  onClick={handleFieldViewSync}
                  disabled={fvSyncing}
                  className="px-3 py-1 rounded border border-glomalin-accent text-glomalin-accent text-xs font-mono hover:bg-glomalin-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {fvSyncing ? 'Syncing...' : `Sync ${cropYear}`}
                </button>
                <button
                  onClick={handleFieldViewDisconnect}
                  disabled={fvDisconnecting}
                  className="text-xs font-mono text-glomalin-muted hover:text-red-400 disabled:opacity-40 transition-colors"
                >
                  {fvDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            )}
            {fvStatus.fieldview_configured && !fvStatus.connected && (
              <a
                href="/api/fsa/fieldview/connect"
                className="px-3 py-1 rounded border border-glomalin-accent text-glomalin-accent text-xs font-mono hover:bg-glomalin-accent/10 transition-colors"
              >
                Connect FieldView
              </a>
            )}
          </div>
          {!fvStatus.fieldview_configured && (
            <p className="text-xs font-mono text-glomalin-muted">
              FieldView API credentials not set.{' '}
              Register at <span className="text-glomalin-accent">dev.fieldview.com</span> and set{' '}
              <code className="text-glomalin-accent">FIELDVIEW_CLIENT_ID</code>,{' '}
              <code className="text-glomalin-accent">FIELDVIEW_CLIENT_SECRET</code>, and{' '}
              <code className="text-glomalin-accent">FIELDVIEW_API_KEY</code>.
            </p>
          )}
          {fvStatus.fieldview_configured && fvStatus.connected && fvStatus.connected_at && (
            <p className="text-[10px] font-mono text-glomalin-muted">
              Connected {new Date(fvStatus.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {fvStatus.expires_at && (
                <> · token expires {new Date(fvStatus.expires_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
              )}
            </p>
          )}
          {fvStatus.fieldview_configured && !fvStatus.connected && (
            <p className="text-xs font-mono text-glomalin-muted">
              Connect your FieldView account to pull as-applied, planting, and harvest records automatically.
            </p>
          )}
        </div>
      )}

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
          Connect FieldView or CNH FieldOps above, or upload a GeoJSON export from any precision ag platform.
        </p>
      )}
    </div>
  )
}
