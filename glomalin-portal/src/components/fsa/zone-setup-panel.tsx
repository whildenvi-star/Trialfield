'use client'

import { useState, useEffect, useCallback } from 'react'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistryField {
  id: string          // fld_NNN
  name: string
  reportingAcres: number
  organicAcres: number
  certStatus?: string
}

interface ZoneYearAttrs {
  id: string
  zone_id: string
  crop_year: number
  crop: string | null
  organic: boolean | null
  irrigated: boolean | null
  cover_crop: boolean | null
  intended_use: string | null
}

interface Zone {
  id: string
  registry_field_id: string
  name: string
  geojson: object | null
  organic_default: boolean
  irrigated_default: boolean
  notes: string | null
  year_attrs: ZoneYearAttrs | null
}

interface UnlinkedClu {
  id: string
  farm_number: string
  tract_number: string
  clu: string
  crop: string | null
  fsa_acres: number
  registry_field_id: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dot(active: boolean) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-glomalin-green' : 'bg-glomalin-muted'}`}
    />
  )
}

function badge(label: string, active: boolean) {
  if (!active) return null
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glomalin-green/20 text-glomalin-green border border-glomalin-green/30">
      {label}
    </span>
  )
}

// ── Zone row ──────────────────────────────────────────────────────────────────

function ZoneRow({
  zone,
  cropYear,
  onUpdated,
}: {
  zone: Zone
  cropYear: number
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [crop, setCrop] = useState(zone.year_attrs?.crop ?? '')
  const [organic, setOrganic] = useState(zone.year_attrs?.organic ?? zone.organic_default)
  const [irrigated, setIrrigated] = useState(zone.year_attrs?.irrigated ?? zone.irrigated_default)
  const [coverCrop, setCoverCrop] = useState(zone.year_attrs?.cover_crop ?? false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/fsa/zones/${zone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          crop_year: cropYear,
          crop: crop || null,
          organic,
          irrigated,
          cover_crop: coverCrop,
        }),
      })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  async function deleteZone() {
    if (!confirm(`Delete zone "${zone.name}"? This cannot be undone.`)) return
    await fetch(`/api/fsa/zones/${zone.id}`, { method: 'DELETE' })
    onUpdated()
  }

  const ya = zone.year_attrs
  const hasGeom = zone.geojson != null

  if (editing) {
    return (
      <div className="ml-6 mt-1 p-3 rounded border border-glomalin-accent/40 bg-glomalin-highlight text-xs font-mono">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-glomalin-muted">Name</span>
            <input
              className="bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 text-glomalin-text focus:outline-none focus:border-glomalin-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-glomalin-muted">Crop ({cropYear})</span>
            <input
              className="bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 text-glomalin-text focus:outline-none focus:border-glomalin-accent"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              placeholder="e.g. Corn"
            />
          </label>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!organic} onChange={(e) => setOrganic(e.target.checked)} />
              <span>Organic</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!irrigated} onChange={(e) => setIrrigated(e.target.checked)} />
              <span>Irrigated</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!coverCrop} onChange={(e) => setCoverCrop(e.target.checked)} />
              <span>Cover Crop</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-1 border-t border-glomalin-border">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1 rounded bg-glomalin-accent text-black text-xs font-mono hover:bg-glomalin-accentLight disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1 rounded border border-glomalin-border text-glomalin-muted text-xs font-mono hover:text-glomalin-text"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-6 mt-1 flex items-center gap-3 py-1.5 px-2 rounded hover:bg-glomalin-highlight group text-xs font-mono">
      <span className="text-glomalin-muted">{dot(hasGeom)}</span>
      <span className="flex-1 text-glomalin-text truncate" title={zone.name}>{zone.name}</span>
      {ya?.crop && <span className="text-glomalin-muted">{ya.crop}</span>}
      {badge('ORG', !!(ya?.organic ?? zone.organic_default))}
      {badge('IRR', !!(ya?.irrigated ?? zone.irrigated_default))}
      {badge('CC', !!ya?.cover_crop)}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
        <button
          onClick={() => setEditing(true)}
          className="px-2 py-0.5 rounded border border-glomalin-border text-glomalin-muted hover:text-glomalin-text"
        >
          Edit
        </button>
        <button
          onClick={deleteZone}
          className="px-2 py-0.5 rounded border border-red-900/40 text-red-400/60 hover:text-red-400"
        >
          Del
        </button>
      </div>
    </div>
  )
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  cropYear,
  onRefresh,
}: {
  field: RegistryField
  cropYear: number
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)

  const loadZones = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/fsa/zones?registry_field_id=${encodeURIComponent(field.id)}&crop_year=${cropYear}`
      )
      if (res.ok) {
        const d = await res.json()
        setZones(d.zones ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [open, field.id, cropYear])

  useEffect(() => { loadZones() }, [loadZones])

  const isOrganic = field.certStatus === 'organic'

  return (
    <div className="border border-glomalin-border rounded mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-glomalin-highlight transition-colors"
      >
        <span className="text-glomalin-muted font-mono text-[10px] w-4">{open ? '▼' : '▶'}</span>
        <span className="flex-1 text-sm font-mono text-glomalin-text truncate">{field.name}</span>
        <span className="text-xs font-mono text-glomalin-muted">{field.reportingAcres.toFixed(1)} ac</span>
        {isOrganic && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glomalin-green/20 text-glomalin-green border border-glomalin-green/30">
            ORG
          </span>
        )}
        {zones.length > 0 && (
          <span className="text-[10px] font-mono text-glomalin-muted">{zones.length} zones</span>
        )}
      </button>

      {open && (
        <div className="pb-2 px-1">
          {loading && (
            <p className="text-xs font-mono text-glomalin-muted ml-8 py-1">Loading zones...</p>
          )}
          {!loading && zones.length === 0 && (
            <p className="text-xs font-mono text-glomalin-muted ml-8 py-1">No zones — seed from CLUs or add manually.</p>
          )}
          {zones.map((zone) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              cropYear={cropYear}
              onUpdated={() => { loadZones(); onRefresh() }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ZoneSetupPanelProps {
  cropYear?: number
}

export function ZoneSetupPanel({ cropYear = CURRENT_CROP_YEAR }: ZoneSetupPanelProps) {
  const [fields, setFields] = useState<RegistryField[]>([])
  const [unlinked, setUnlinked] = useState<UnlinkedClu[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<{ created: number; already_linked: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/api/registry/fields?active=true').then((r) => r.json()),
      fetch(`/api/fsa/clu-records?year=${cropYear}&unlinked=true`).then((r) => r.json()),
    ])
      .then(([fieldsData, cluData]) => {
        setFields(Array.isArray(fieldsData) ? fieldsData : [])
        setUnlinked(cluData.records ?? [])
      })
      .catch(() => setError('Failed to load data. Check that farm-registry is running.'))
      .finally(() => setLoading(false))
  }, [cropYear, refreshKey])

  async function seedFromClus() {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await fetch('/api/fsa/zones/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop_year: cropYear }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Seed failed')
      } else {
        setSeedResult(data)
        refresh()
      }
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="max-w-4xl font-mono text-glomalin-text">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-glomalin-border">
        <div>
          <h2 className="text-sm font-mono text-glomalin-text">Zone Setup — {cropYear}</h2>
          <p className="text-xs text-glomalin-muted mt-0.5">
            Farm-registry fields are the top-level grouping. Zones are persistent sub-field units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unlinked.length > 0 && (
            <span className="text-xs text-glomalin-warning font-mono">
              {unlinked.length} unlinked CLU{unlinked.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={seedFromClus}
            disabled={seeding || unlinked.length === 0}
            className="px-3 py-1.5 rounded bg-glomalin-accent text-black text-xs font-mono hover:bg-glomalin-accentLight disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {seeding ? 'Seeding...' : `Seed from CLUs (${unlinked.length})`}
          </button>
        </div>
      </div>

      {/* Seed result banner */}
      {seedResult && (
        <div className="mb-3 px-3 py-2 rounded border border-glomalin-green/40 bg-glomalin-green/10 text-xs font-mono text-glomalin-green">
          Created {seedResult.created} zone{seedResult.created !== 1 ? 's' : ''}.
          {seedResult.already_linked > 0 && ` ${seedResult.already_linked} CLUs already linked.`}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded border border-red-900/40 bg-red-950/20 text-xs font-mono text-red-400">
          {error}
        </div>
      )}

      {/* Field list */}
      {loading ? (
        <p className="text-xs font-mono text-glomalin-muted py-4">Loading fields...</p>
      ) : fields.length === 0 ? (
        <p className="text-xs font-mono text-glomalin-muted py-4">
          No fields found. Ensure farm-registry is running on port 3005.
        </p>
      ) : (
        <div>
          <p className="text-[10px] font-mono text-glomalin-muted mb-2">
            {fields.length} fields — click to expand zones
          </p>
          {fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              cropYear={cropYear}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Unlinked CLUs section */}
      {!loading && unlinked.length > 0 && (
        <div className="mt-6 pt-4 border-t border-glomalin-border">
          <h3 className="text-xs font-mono text-glomalin-warning mb-2">
            Unlinked CLUs ({unlinked.length}) — have registry_field_id but no zone
          </h3>
          <div className="space-y-0.5">
            {unlinked.map((clu) => (
              <div
                key={clu.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded text-xs font-mono text-glomalin-muted hover:bg-glomalin-highlight"
              >
                <span className="text-glomalin-text">Farm {clu.farm_number}</span>
                <span>Tract {clu.tract_number}</span>
                <span>CLU {clu.clu}</span>
                {clu.crop && <span className="text-glomalin-accent">{clu.crop}</span>}
                <span className="ml-auto">{clu.fsa_acres} ac</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
