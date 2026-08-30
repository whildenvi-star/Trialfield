'use client'

import { useEffect, useState } from 'react'
import { buildSeasonRail, type RailItem } from '@/lib/field-history/season-rail'
import type { Enterprise } from './YearCard'

interface RainSummary {
  last7_in: number | null
  latestDate: string | null
}

function fmtShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/** Earliest confirmed planting-stage date for an enterprise (seed usage or planter pass). */
function plantDateFor(ent: Enterprise): string | null {
  const rail = buildSeasonRail({
    fieldOperations: ent.fieldOperations,
    materialUsages: ent.materialUsages ?? [],
    seedUsages: ent.seedUsages ?? [],
    fertilityEvents: ent.fertilityEvents,
    harvestEvents: ent.harvestEvents,
  })
  const planting = rail.confirmed.filter(i => i.stage === 'Planting' && i.date)
  return planting.length > 0 ? planting[0].date : null
}

/** Most recent confirmed activity across the given enterprises, newest first. */
function recentActivity(ents: Enterprise[], limit: number): RailItem[] {
  const items: RailItem[] = []
  for (const ent of ents) {
    const rail = buildSeasonRail({
      fieldOperations: ent.fieldOperations,
      materialUsages: ent.materialUsages ?? [],
      seedUsages: ent.seedUsages ?? [],
      fertilityEvents: ent.fertilityEvents,
      harvestEvents: ent.harvestEvents,
    })
    items.push(...rail.confirmed.filter(i => i.date))
  }
  items.sort((a, b) => (a.date! > b.date! ? -1 : a.date! < b.date! ? 1 : 0))
  return items.slice(0, limit)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-glomalin-muted">{label}</div>
      <div className="text-sm text-glomalin-text">{value}</div>
    </div>
  )
}

export function SituationBoard({
  enterprises,
  cropYear,
  registryId,
}: {
  enterprises: Enterprise[] // current-year enterprises only (multiple on split fields)
  cropYear: number
  registryId: string | null
}) {
  const [rain, setRain] = useState<RainSummary | null>(null)

  useEffect(() => {
    if (!registryId) return
    let cancelled = false
    fetch(`/api/weather/precip/summary/${registryId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: RainSummary | null) => {
        if (!cancelled && d) setRain(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [registryId])

  const ticker = recentActivity(enterprises, 3)

  return (
    <div className="mb-3 rounded border border-glomalin-border bg-glomalin-surface px-3 py-2.5">
      {/* One line per current-year crop (split fields get one each) */}
      {enterprises.map(ent => (
        <div key={ent.id} className="flex items-end gap-4 flex-wrap mb-2 last:mb-0">
          <Stat label={`${cropYear} crop`} value={`${ent.crop}${ent.label ? ` · ${ent.label}` : ''}`} />
          {ent.variety && <Stat label="variety" value={ent.variety} />}
          <Stat label="acres" value={ent.plantedAcres.toFixed(1)} />
          <Stat label="planted" value={fmtShort(plantDateFor(ent))} />
          {ent === enterprises[0] && rain?.last7_in != null && (
            <span
              title={`Rainfall last 7 days (through ${rain.latestDate ?? 'today'})`}
              className="ml-auto text-[11px] px-2 py-1 rounded-full border border-sky-800/50 bg-sky-950/40 text-sky-300 whitespace-nowrap"
            >
              🌧 {rain.last7_in.toFixed(2)}&Prime; / 7d
            </span>
          )}
        </div>
      ))}

      {/* Recent activity ticker */}
      {ticker.length > 0 && (
        <div className="mt-2 pt-2 border-t border-glomalin-border/60 space-y-0.5">
          {ticker.map(item => (
            <div key={item.id} className="flex items-baseline gap-2 text-[11px]">
              <span className="text-glomalin-muted w-12 shrink-0 tabular-nums">{fmtShort(item.date)}</span>
              <span className="text-glomalin-text/80 truncate">
                {item.text}
                {item.by && <span className="text-glomalin-muted"> — {item.by}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
