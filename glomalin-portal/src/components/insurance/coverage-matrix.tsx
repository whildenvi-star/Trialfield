'use client'

import { useMemo } from 'react'
import { computeInsurancePolicy, type InsurancePolicy, type PricingEntry } from '@/lib/fsa/calc'

// RP-HPE excludes harvest price increase from guarantee; YP is yield-only.
// Both use spring_price for decision-support comparison.
// Results are illustrative — verify with your agent.
const COVERAGE_LEVELS = [50, 55, 60, 65, 70, 75, 80, 85] as const
const PLAN_TYPES = ['RP', 'RP-HPE', 'YP'] as const

type PlanType = (typeof PLAN_TYPES)[number]

interface CoverageMatrixProps {
  policy: InsurancePolicy
  pricing: PricingEntry[]
}

interface CellResult {
  indemnity: number
  dollarGuarantee: number
}

function computeCell(
  policy: InsurancePolicy,
  pricing: PricingEntry[],
  coverage: number,
  planType: PlanType
): CellResult {
  let adjustedPricing = pricing

  if (planType === 'RP-HPE' || planType === 'YP') {
    // RP-HPE: excludes harvest price increase (fall_price capped at spring_price)
    // YP: yield-only plan — uses spring_price only (no revenue component from fall price movement)
    // Both simplifications use spring_price for both spring and fall for decision-support comparison.
    adjustedPricing = pricing.map((p) => ({
      ...p,
      fall_price: p.spring_price,
    }))
  }

  const result = computeInsurancePolicy(
    { ...policy, coverage_level: coverage },
    adjustedPricing
  )

  return {
    indemnity: result.indemnity,
    dollarGuarantee: result.dollarGuarantee,
  }
}

function formatDollars(value: number): string {
  if (value <= 0) return '—'
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000).toLocaleString()}K`
  }
  return `$${Math.round(value).toLocaleString()}`
}

export function CoverageMatrix({ policy, pricing }: CoverageMatrixProps) {
  // Compute all 24 cells (8 coverage levels × 3 plan types)
  const cells = useMemo(() => {
    return COVERAGE_LEVELS.map((coverage) =>
      PLAN_TYPES.map((planType) => computeCell(policy, pricing, coverage, planType))
    )
  }, [policy, pricing])

  // Find max indemnity across all 24 cells for heat-map normalization
  const maxIndemnity = useMemo(() => {
    const max = cells.flat().reduce((m, c) => Math.max(m, c.indemnity), 0)
    return Math.max(max, 1) // floor at 1 to avoid div/0
  }, [cells])

  const hasPlanType = policy.plan_type && policy.plan_type.trim()

  return (
    <div className="rounded-lg border border-glomalin-border overflow-hidden">
      {!hasPlanType && (
        <div className="px-4 py-2 bg-glomalin-bg border-b border-glomalin-border">
          <p className="text-xs text-glomalin-muted italic">
            Select a plan type via Edit to highlight the active column
          </p>
        </div>
      )}

      {/* CSS grid: label column + 3 plan type columns */}
      <div className="grid grid-cols-4 gap-px bg-glomalin-border font-mono text-sm">
        {/* Header row */}
        <div className="bg-glomalin-surface px-3 py-2 text-xs text-glomalin-muted uppercase tracking-wide">
          Coverage
        </div>
        {PLAN_TYPES.map((pt) => {
          const isActive = policy.plan_type === pt
          return (
            <div
              key={pt}
              className={`bg-glomalin-surface px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
                isActive ? 'text-glomalin-accent border-b-2 border-glomalin-accent' : 'text-glomalin-accent'
              }`}
            >
              {pt}
            </div>
          )
        })}

        {/* Data rows */}
        {COVERAGE_LEVELS.map((coverage, rowIdx) => {
          const isCurrentLevel = coverage === policy.coverage_level
          const rowCells = cells[rowIdx]

          return (
            <>
              {/* Coverage label */}
              <div
                key={`label-${coverage}`}
                className={`bg-glomalin-surface px-3 py-2 text-glomalin-muted text-xs ${
                  isCurrentLevel ? 'border-l-2 border-glomalin-accent text-glomalin-accent font-semibold' : ''
                }`}
              >
                {coverage}%
              </div>

              {/* 3 plan type cells */}
              {PLAN_TYPES.map((pt, colIdx) => {
                const cell = rowCells[colIdx]
                const intensity = cell.indemnity > 0 ? cell.indemnity / maxIndemnity : 0
                const bgColor =
                  cell.indemnity > 0
                    ? `rgba(200, 134, 10, ${(0.1 + intensity * 0.5).toFixed(2)})`
                    : undefined

                return (
                  <div
                    key={`${coverage}-${pt}`}
                    className={`px-3 py-2 text-center text-xs ${
                      isCurrentLevel ? 'border-l-0' : ''
                    } ${cell.indemnity > 0 ? 'text-glomalin-text' : 'text-glomalin-muted'}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {formatDollars(cell.indemnity)}
                  </div>
                )
              })}
            </>
          )
        })}
      </div>

      <div className="px-3 py-2 bg-glomalin-bg border-t border-glomalin-border">
        <p className="text-xs text-glomalin-muted italic">
          Indemnity = shortfall bushels × price × planted acres. Figures are illustrative —
          verify with your agent.
        </p>
      </div>
    </div>
  )
}
