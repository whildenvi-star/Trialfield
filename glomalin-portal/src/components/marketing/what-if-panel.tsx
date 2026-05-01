'use client'

import { useState } from 'react'
import type { CommodityPosition } from '@/lib/marketing/types'

interface WhatIfPanelProps {
  positions: CommodityPosition[]
}

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`
  return `$${abs.toFixed(0)}`
}

function fmtBu(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('en-US')
}

const PRESET_SHIFTS = [-0.50, -0.25, -0.10, +0.10, +0.25, +0.50]

export function WhatIfPanel({ positions }: WhatIfPanelProps) {
  // Per-commodity CBOT shift in $/bu
  const [shifts, setShifts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const p of positions) init[p.commodity.id] = 0
    return init
  })

  const hedgeable = positions.filter((p) => p.commodity.is_hedgeable && p.cbot_price != null)

  if (hedgeable.length === 0) {
    return (
      <div className="rounded border border-glomalin-border bg-glomalin-surface px-6 py-8 text-center">
        <p className="font-mono text-sm text-glomalin-muted">
          No hedgeable commodities with CBOT prices to analyze.
        </p>
        <p className="font-mono text-xs text-glomalin-muted mt-1">
          Configure CBOT symbols and pricing modes in the Crop Types tab.
        </p>
      </div>
    )
  }

  function setShift(commodityId: string, value: number) {
    setShifts((prev) => ({ ...prev, [commodityId]: value }))
  }

  function addShift(commodityId: string, delta: number) {
    setShifts((prev) => ({
      ...prev,
      [commodityId]: Math.round(((prev[commodityId] ?? 0) + delta) * 1000) / 1000,
    }))
  }

  function resetAll() {
    setShifts((prev) => {
      const reset: Record<string, number> = {}
      for (const k of Object.keys(prev)) reset[k] = 0
      return reset
    })
  }

  // Aggregate scenario summary across all hedgeable commodities
  const totalCurrentExposure = hedgeable.reduce((s, p) => s + (p.unpriced_exposure_dollars ?? 0), 0)
  const totalScenarioExposure = hedgeable.reduce((p_sum, p) => {
    const shift = shifts[p.commodity.id] ?? 0
    const scenarioCbot = (p.cbot_price ?? 0) + shift
    // Use same logic as computeCommodityPositions: exposure = unpriced_bu × (cbot + basis)
    // For What-If we approximate — just apply the shift to the existing exposure calculation
    const scenarioExposure = p.unpriced_bu * Math.max(0, scenarioCbot)
    return p_sum + scenarioExposure
  }, 0)
  const totalExposureDelta = totalScenarioExposure - totalCurrentExposure

  const anyShift = hedgeable.some((p) => (shifts[p.commodity.id] ?? 0) !== 0)

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {anyShift && (
        <div className="rounded-lg border border-glomalin-border bg-glomalin-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-xs font-semibold text-glomalin-accent uppercase tracking-wide">
              Scenario Summary
            </p>
            <button
              onClick={resetAll}
              className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors"
            >
              Reset all
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-mono text-[10px] text-glomalin-muted uppercase tracking-wide">Current Exposure</p>
              <p className="font-mono text-lg font-semibold text-glomalin-text mt-0.5">
                {fmtUsd(totalCurrentExposure)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-glomalin-muted uppercase tracking-wide">Scenario Exposure</p>
              <p className="font-mono text-lg font-semibold text-glomalin-text mt-0.5">
                {fmtUsd(totalScenarioExposure)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-glomalin-muted uppercase tracking-wide">Exposure Change</p>
              <p className={`font-mono text-lg font-semibold mt-0.5 ${
                totalExposureDelta > 0 ? 'text-glomalin-warning' :
                totalExposureDelta < 0 ? 'text-glomalin-accent' :
                'text-glomalin-text'
              }`}>
                {totalExposureDelta >= 0 ? '+' : ''}{fmtUsd(totalExposureDelta)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Per-commodity cards */}
      <div className="space-y-4">
        {hedgeable.map((pos) => {
          const shift = shifts[pos.commodity.id] ?? 0
          const currentCbot = pos.cbot_price ?? 0
          const scenarioCbot = currentCbot + shift
          const scenarioExposure = pos.unpriced_bu * Math.max(0, scenarioCbot)
          const currentExposure = pos.unpriced_exposure_dollars ?? pos.unpriced_bu * currentCbot
          const exposureDelta = scenarioExposure - currentExposure

          // Break-even = the CBOT price at which unpriced exposure covers no cost at all
          // (We don't have cost data on the marketing page, so just show the WAP-based floor)
          const unpricedBuStr = fmtBu(pos.unpriced_bu)

          return (
            <div key={pos.commodity.id} className="rounded-lg border border-glomalin-border bg-glomalin-surface p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  {pos.commodity.cbot_symbol && (
                    <span className="font-mono text-[10px] text-glomalin-muted uppercase tracking-widest">
                      {pos.commodity.cbot_symbol}
                    </span>
                  )}
                  <h3 className="font-semibold text-glomalin-text text-base leading-tight mt-0.5">
                    {pos.commodity.name}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-glomalin-muted">Current CBOT</p>
                  <p className="font-mono text-lg font-semibold text-glomalin-text">{fmtPrice(currentCbot)}</p>
                </div>
              </div>

              {/* Shift control */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-mono text-xs text-glomalin-muted">CBOT Shift</p>
                  {shift !== 0 && (
                    <span className={`font-mono text-xs font-semibold ${shift > 0 ? 'text-glomalin-accent' : 'text-glomalin-warning'}`}>
                      {shift > 0 ? '+' : ''}{fmtPrice(shift)}/bu
                    </span>
                  )}
                </div>

                {/* Preset buttons */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_SHIFTS.map((delta) => (
                    <button
                      key={delta}
                      onClick={() => addShift(pos.commodity.id, delta)}
                      className={[
                        'font-mono text-[10px] rounded border px-2 py-1 transition-colors',
                        delta < 0
                          ? 'border-glomalin-warning/40 text-glomalin-warning hover:bg-glomalin-warning/10'
                          : 'border-glomalin-accent/40 text-glomalin-accent hover:bg-glomalin-accent/10',
                      ].join(' ')}
                    >
                      {delta > 0 ? '+' : ''}{(delta * 100).toFixed(0)}¢
                    </button>
                  ))}
                  {shift !== 0 && (
                    <button
                      onClick={() => setShift(pos.commodity.id, 0)}
                      className="font-mono text-[10px] rounded border border-glomalin-border text-glomalin-muted hover:text-glomalin-text px-2 py-1 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Manual input */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-glomalin-muted">Or enter:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={shift === 0 ? '' : shift}
                    onChange={(e) => setShift(pos.commodity.id, parseFloat(e.target.value) || 0)}
                    placeholder="e.g. +0.30"
                    className="w-28 bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-glomalin-accent"
                  />
                  <span className="font-mono text-xs text-glomalin-muted">$/bu</span>
                </div>
              </div>

              {/* Scenario results */}
              <div className="rounded border border-glomalin-border/60 bg-glomalin-bg p-3 grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <p className="font-mono text-[10px] text-glomalin-muted">Scenario CBOT</p>
                  <p className={`font-mono text-sm font-semibold mt-0.5 ${
                    shift > 0 ? 'text-glomalin-accent' : shift < 0 ? 'text-glomalin-warning' : 'text-glomalin-text'
                  }`}>
                    {fmtPrice(scenarioCbot)}/bu
                    {shift !== 0 && (
                      <span className="font-normal text-glomalin-muted text-xs ml-1">
                        ({shift > 0 ? '+' : ''}{fmtPrice(shift)})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-glomalin-muted">Unpriced Bu</p>
                  <p className="font-mono text-sm font-semibold text-glomalin-text mt-0.5">
                    {unpricedBuStr} bu
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-glomalin-muted">Scenario Exposure</p>
                  <p className="font-mono text-sm font-semibold text-glomalin-text mt-0.5">
                    {fmtUsd(scenarioExposure)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-glomalin-muted">Exposure Change</p>
                  <p className={`font-mono text-sm font-semibold mt-0.5 ${
                    exposureDelta > 0 ? 'text-glomalin-warning' :
                    exposureDelta < 0 ? 'text-glomalin-accent' :
                    'text-glomalin-muted'
                  }`}>
                    {exposureDelta >= 0 ? '+' : ''}{fmtUsd(exposureDelta)}
                  </p>
                </div>
                {pos.wap != null && (
                  <div className="col-span-2 border-t border-glomalin-border/40 pt-2 mt-1">
                    <p className="font-mono text-[10px] text-glomalin-muted">WAP vs Scenario CBOT</p>
                    <p className="font-mono text-sm mt-0.5">
                      <span className="text-glomalin-text font-semibold">{fmtPrice(pos.wap)}</span>
                      <span className="text-glomalin-muted mx-1">vs</span>
                      <span className={shift !== 0 ? (shift > 0 ? 'text-glomalin-accent' : 'text-glomalin-warning') : 'text-glomalin-text'}>
                        {fmtPrice(scenarioCbot)}
                      </span>
                      {(() => {
                        const delta = pos.wap - scenarioCbot
                        return (
                          <span className={`ml-2 font-mono text-xs ${delta >= 0 ? 'text-glomalin-accent' : 'text-glomalin-warning'}`}>
                            ({delta >= 0 ? '+' : ''}{fmtPrice(delta)})
                          </span>
                        )
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!anyShift && (
        <p className="font-mono text-xs text-glomalin-muted text-center pt-2">
          Use the preset buttons or enter a value to model CBOT price scenarios.
        </p>
      )}
    </div>
  )
}
