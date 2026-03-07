'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── Types ─────────────────────────────────────── */

interface Program {
  id: string
  name: string
  crop: string
  systemCode: string
  yieldPerAcre: number
  yieldUnit: string
  cropInsurancePerAcre: number
  inputs: { productName: string; quantity: number; season: string }[]
  machinery: { implementName: string; passes: number }[]
  seed: { variety: string; population: number } | null
}

interface DashboardEntry {
  enterprise: { id: string; name: string; category: string }
  cropRows: {
    crop: string
    acres: number
    avgYield: number
    profitPerAcre: number
    cop: number
    unit: string
  }[]
  totals: {
    acres: number
    rent: number
    fert: number
    seed: number
    machinery: number
    laborOverhead: number
    fuel: number
    drying: number
    interest: number
    insurance: number
    expTotal: number
    cropIncome: number
  }
}

interface CompSlot {
  programId: string
  label: string
  marketPrice: number
  expectedYield: number
  seedCost: number
  fertCost: number
  machineryCost: number
  rentCost: number
  insuranceCost: number
  laborOverhead: number
  otherCost: number
}

interface FarmOption {
  farmNumber: string
  name: string
  totalAcres: number
}

/* ─── Helpers ───────────────────────────────────── */

function fmt$(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtN(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function emptySlot(): CompSlot {
  return {
    programId: '',
    label: '',
    marketPrice: 0,
    expectedYield: 0,
    seedCost: 0,
    fertCost: 0,
    machineryCost: 0,
    rentCost: 0,
    insuranceCost: 0,
    laborOverhead: 0,
    otherCost: 0,
  }
}

function totalCost(s: CompSlot): number {
  return s.seedCost + s.fertCost + s.machineryCost + s.rentCost + s.insuranceCost + s.laborOverhead + s.otherCost
}

function revenue(s: CompSlot): number {
  return s.expectedYield * s.marketPrice
}

function profit(s: CompSlot): number {
  return revenue(s) - totalCost(s)
}

function breakEvenYield(s: CompSlot): number {
  return s.marketPrice > 0 ? totalCost(s) / s.marketPrice : 0
}

function breakEvenPrice(s: CompSlot): number {
  return s.expectedYield > 0 ? totalCost(s) / s.expectedYield : 0
}

/* ─── Component ─────────────────────────────────── */

export function CropComparison({ farms }: { farms: FarmOption[] }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [dashboard, setDashboard] = useState<DashboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFarm, setSelectedFarm] = useState('')
  const [slots, setSlots] = useState<CompSlot[]>([emptySlot()])

  useEffect(() => {
    fetch('/api/macro/programs')
      .then((r) => {
        if (!r.ok) throw new Error('Farm-budget offline')
        return r.json()
      })
      .then((data) => {
        setPrograms(data.programs ?? [])
        setDashboard(data.dashboard?.enterpriseSummaries ?? [])
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const updateSlot = useCallback((idx: number, patch: Partial<CompSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }, [])

  const selectProgram = useCallback(
    (idx: number, progId: string) => {
      const prog = programs.find((p) => p.id === progId)
      if (!prog) {
        updateSlot(idx, { programId: '', label: '' })
        return
      }

      // Find matching enterprise totals for per-acre cost breakdown
      let perAcre = {
        rent: 0,
        fert: 0,
        seed: 0,
        machinery: 0,
        laborOverhead: 0,
        insurance: 0,
        other: 0,
      }

      // Match by crop name in dashboard enterprise summaries
      for (const entry of dashboard) {
        const cropRow = entry.cropRows.find(
          (cr) => cr.crop.toLowerCase() === prog.crop.toLowerCase()
        )
        if (cropRow && entry.totals.acres > 0) {
          const t = entry.totals
          const ac = t.acres
          perAcre = {
            rent: t.rent / ac,
            fert: t.fert / ac,
            seed: t.seed / ac,
            machinery: t.machinery / ac,
            laborOverhead: t.laborOverhead / ac,
            insurance: t.insurance / ac,
            other: (t.fuel + t.drying + t.interest) / ac,
          }
          break
        }
      }

      // Find crop row for yield + price defaults
      let defaultYield = prog.yieldPerAcre || 0
      let defaultPrice = 0
      for (const entry of dashboard) {
        const cropRow = entry.cropRows.find(
          (cr) => cr.crop.toLowerCase() === prog.crop.toLowerCase()
        )
        if (cropRow) {
          if (cropRow.avgYield > 0) defaultYield = cropRow.avgYield
          // Derive market price from revenue: cropIncome / totalYield
          if (entry.totals.acres > 0) {
            const totalYieldEst = cropRow.avgYield * cropRow.acres
            if (totalYieldEst > 0) {
              // revenue per unit = (income share proportional to crop acres)
              const share = cropRow.acres / entry.totals.acres
              const cropIncome = entry.totals.cropIncome * share
              defaultPrice = cropIncome / totalYieldEst
            }
          }
          break
        }
      }

      updateSlot(idx, {
        programId: progId,
        label: prog.name,
        marketPrice: Math.round(defaultPrice * 100) / 100,
        expectedYield: Math.round(defaultYield * 10) / 10,
        seedCost: Math.round(perAcre.seed * 100) / 100,
        fertCost: Math.round(perAcre.fert * 100) / 100,
        machineryCost: Math.round(perAcre.machinery * 100) / 100,
        rentCost: Math.round(perAcre.rent * 100) / 100,
        insuranceCost: Math.round(perAcre.insurance * 100) / 100,
        laborOverhead: Math.round(perAcre.laborOverhead * 100) / 100,
        otherCost: Math.round(perAcre.other * 100) / 100,
      })
    },
    [programs, dashboard, updateSlot]
  )

  const addSlot = () => {
    if (slots.length < 4) setSlots((prev) => [...prev, emptySlot()])
  }

  const removeSlot = (idx: number) => {
    if (slots.length > 1) setSlots((prev) => prev.filter((_, i) => i !== idx))
  }

  if (loading) {
    return (
      <div className="rounded border border-glomalin-border bg-glomalin-surface px-6 py-8 text-center">
        <p className="text-glomalin-muted font-mono text-sm animate-pulse">Loading programs from Farm Budget...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded border border-glomalin-border bg-glomalin-surface px-6 py-8 text-center">
        <p className="text-glomalin-muted font-mono text-sm">Farm Budget unavailable — start the service on port 3001</p>
      </div>
    )
  }

  // Find best profit slot for highlighting
  const activeSlots = slots.filter((s) => s.programId)
  const bestIdx = activeSlots.length > 0
    ? slots.indexOf(
        activeSlots.reduce((best, s) => (profit(s) > profit(best) ? s : best), activeSlots[0])
      )
    : -1

  return (
    <div>
      {/* Farm selector */}
      <div className="mb-6">
        <label className="block text-xs text-glomalin-muted font-mono uppercase tracking-wider mb-2">
          Compare crops on farm
        </label>
        <select
          value={selectedFarm}
          onChange={(e) => setSelectedFarm(e.target.value)}
          className="bg-glomalin-surface border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-3 py-2 w-full max-w-xs focus:border-glomalin-accent focus:outline-none"
        >
          <option value="">Select a farm...</option>
          {farms.map((f) => (
            <option key={f.farmNumber} value={f.farmNumber}>
              {f.name} ({fmtN(f.totalAcres, 1)} ac)
            </option>
          ))}
        </select>
      </div>

      {/* Comparison columns */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}>
        {slots.map((slot, idx) => (
          <div key={idx} className={`rounded border bg-glomalin-surface p-4 ${
            idx === bestIdx && activeSlots.length > 1
              ? 'border-glomalin-green'
              : 'border-glomalin-border'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-glomalin-muted font-mono uppercase">Slot {idx + 1}</span>
              {slots.length > 1 && (
                <button
                  onClick={() => removeSlot(idx)}
                  className="text-xs text-glomalin-muted hover:text-red-400 font-mono transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Program picker */}
            <select
              value={slot.programId}
              onChange={(e) => selectProgram(idx, e.target.value)}
              className="w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 mb-4 focus:border-glomalin-accent focus:outline-none"
            >
              <option value="">Select program...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.crop})
                </option>
              ))}
            </select>

            {slot.programId && (
              <>
                {/* Revenue inputs */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs text-glomalin-accent font-mono uppercase tracking-wider">Revenue</h4>
                  <NumInput
                    label="Market Price ($/unit)"
                    value={slot.marketPrice}
                    onChange={(v) => updateSlot(idx, { marketPrice: v })}
                    step={0.01}
                  />
                  <NumInput
                    label="Expected Yield (units/ac)"
                    value={slot.expectedYield}
                    onChange={(v) => updateSlot(idx, { expectedYield: v })}
                    step={0.1}
                  />
                </div>

                {/* Cost inputs */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs text-glomalin-accent font-mono uppercase tracking-wider">Costs / Acre</h4>
                  <NumInput label="Seed" value={slot.seedCost} onChange={(v) => updateSlot(idx, { seedCost: v })} />
                  <NumInput label="Fertilizer" value={slot.fertCost} onChange={(v) => updateSlot(idx, { fertCost: v })} />
                  <NumInput label="Machinery" value={slot.machineryCost} onChange={(v) => updateSlot(idx, { machineryCost: v })} />
                  <NumInput label="Rent" value={slot.rentCost} onChange={(v) => updateSlot(idx, { rentCost: v })} />
                  <NumInput label="Insurance" value={slot.insuranceCost} onChange={(v) => updateSlot(idx, { insuranceCost: v })} />
                  <NumInput label="Labor & Overhead" value={slot.laborOverhead} onChange={(v) => updateSlot(idx, { laborOverhead: v })} />
                  <NumInput label="Other (fuel/drying/int)" value={slot.otherCost} onChange={(v) => updateSlot(idx, { otherCost: v })} />
                </div>

                {/* Results */}
                <div className="border-t border-glomalin-border pt-3 space-y-2">
                  <h4 className="text-xs text-glomalin-accent font-mono uppercase tracking-wider">Results / Acre</h4>
                  <ResultRow label="Total Cost" value={fmt$(totalCost(slot))} />
                  <ResultRow label="Revenue" value={fmt$(revenue(slot))} />
                  <ResultRow
                    label="Profit"
                    value={fmt$(profit(slot))}
                    color={profit(slot) >= 0 ? 'text-glomalin-green' : 'text-red-400'}
                    bold
                  />
                  <div className="border-t border-glomalin-border pt-2 mt-2">
                    <ResultRow label="Breakeven Yield" value={`${fmtN(breakEvenYield(slot), 1)} units/ac`} />
                    <ResultRow label="Breakeven Price" value={fmt$(breakEvenPrice(slot))} />
                    <ResultRow label="Cost of Production" value={slot.expectedYield > 0 ? fmt$(totalCost(slot) / slot.expectedYield) + '/unit' : '—'} />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add slot button */}
      {slots.length < 4 && (
        <button
          onClick={addSlot}
          className="mt-4 text-sm font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors border border-dashed border-glomalin-border rounded px-4 py-2 w-full"
        >
          + Add Comparison (up to 4)
        </button>
      )}

      {/* Sandbox notice */}
      <p className="mt-4 text-xs text-glomalin-muted font-mono">
        Sandbox mode — changes here do not affect your saved programs or budgets.
      </p>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────── */

function NumInput({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-glomalin-muted font-mono truncate">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        className="w-24 bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs text-right rounded px-2 py-1 focus:border-glomalin-accent focus:outline-none"
      />
    </div>
  )
}

function ResultRow({
  label,
  value,
  color,
  bold,
}: {
  label: string
  value: string
  color?: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-glomalin-muted font-mono">{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-semibold' : ''} ${color ?? 'text-glomalin-text'}`}>
        {value}
      </span>
    </div>
  )
}
