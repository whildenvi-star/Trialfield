'use client'

import { useMemo, useState } from 'react'
import { computeInsurancePolicy, type InsurancePolicy, type PricingEntry } from '@/lib/fsa/calc'

interface PayoutSimulatorProps {
  policy: InsurancePolicy
  pricing: PricingEntry[]
}

function formatDollars(value: number): string {
  if (value <= 0) return '$0'
  return '$' + Math.round(value).toLocaleString('en-US')
}

export function PayoutSimulator({ policy, pricing }: PayoutSimulatorProps) {
  // Find matching pricing entry for this policy's crop (case-insensitive)
  const matchingPricing = useMemo(() => {
    if (!policy.crop) return null
    const lc = policy.crop.toLowerCase().trim()
    return pricing.find((p) => p.crop.toLowerCase().trim() === lc) ?? null
  }, [policy.crop, pricing])

  // Default price: max(spring, fall) or 5.00 fallback
  const defaultPrice = useMemo(() => {
    if (!matchingPricing) return 5.0
    return Math.max(matchingPricing.spring_price, matchingPricing.fall_price) || 5.0
  }, [matchingPricing])

  // Slider initial values
  const initialSimYield = policy.actual > 0 ? policy.actual : policy.guarantee
  const [simYield, setSimYield] = useState(initialSimYield)
  const [simPrice, setSimPrice] = useState(defaultPrice)

  // Slider ranges
  const yieldMax = policy.guarantee > 0 ? Math.ceil(policy.guarantee * 1.5) : 200
  const priceMax = Math.ceil(defaultPrice * 2 * 20) / 20 // round to $0.05

  // Compute results via useMemo
  const result = useMemo(() => {
    if (!matchingPricing) return null

    // Override both spring and fall prices to simPrice for uniform market scenario
    const adjustedPricing: PricingEntry[] = pricing.map((p) => {
      const lc = p.crop.toLowerCase().trim()
      if (policy.crop && lc === policy.crop.toLowerCase().trim()) {
        return { ...p, spring_price: simPrice, fall_price: simPrice }
      }
      return p
    })

    return computeInsurancePolicy({ ...policy, actual: simYield }, adjustedPricing)
  }, [policy, pricing, matchingPricing, simYield, simPrice])

  // No pricing data case
  if (!matchingPricing) {
    return (
      <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-4 py-6">
        <p className="text-xs text-glomalin-muted italic font-mono">
          No pricing data available for {policy.crop ?? '(no crop)'}. Add pricing data to enable
          simulation.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-4 py-4">
      {/* Disclaimer — above all results */}
      <p className="text-xs text-glomalin-muted italic mb-4">
        Results are illustrative only. Verify all figures with your insurance agent.
      </p>

      {/* Yield slider */}
      <div className="mb-4">
        <p className="text-xs text-glomalin-muted font-mono mb-1">
          Simulated Yield: {simYield.toFixed(1)} bu/ac
        </p>
        <input
          type="range"
          min={0}
          max={yieldMax}
          step={1}
          value={simYield}
          onChange={(e) => setSimYield(Number(e.target.value))}
          className="w-full accent-glomalin-accent"
        />
        <div className="flex justify-between text-xs text-glomalin-muted font-mono mt-0.5">
          <span>0</span>
          <span>{yieldMax} bu/ac</span>
        </div>
      </div>

      {/* Price slider */}
      <div className="mb-5">
        <p className="text-xs text-glomalin-muted font-mono mb-1">
          Price: ${simPrice.toFixed(2)}/bu
        </p>
        <input
          type="range"
          min={0}
          max={priceMax}
          step={0.05}
          value={simPrice}
          onChange={(e) => setSimPrice(Number(e.target.value))}
          className="w-full accent-glomalin-accent"
        />
        <div className="flex justify-between text-xs text-glomalin-muted font-mono mt-0.5">
          <span>$0.00</span>
          <span>${priceMax.toFixed(2)}/bu</span>
        </div>
      </div>

      {/* Results grid */}
      {result && (
        <div className="grid grid-cols-3 gap-3">
          {/* Effective Guarantee */}
          <div className="bg-glomalin-bg border border-glomalin-border rounded px-4 py-3">
            <p className="text-xs text-glomalin-muted font-mono mb-1">Effective Guarantee</p>
            <p className="text-lg font-mono font-bold text-glomalin-text">
              {result.effectiveGuarantee.toFixed(1)}{' '}
              <span className="text-xs font-normal text-glomalin-muted">bu/ac</span>
            </p>
          </div>

          {/* Est. Indemnity */}
          <div
            className={`bg-glomalin-bg rounded px-4 py-3 border ${
              result.indemnity > 0 ? 'border-yellow-700' : 'border-glomalin-border'
            }`}
          >
            <p className="text-xs text-glomalin-muted font-mono mb-1">Est. Indemnity</p>
            <p
              className={`text-lg font-mono font-bold ${
                result.indemnity > 0 ? 'text-yellow-400' : 'text-glomalin-muted'
              }`}
            >
              {formatDollars(result.indemnity)}
            </p>
          </div>

          {/* Projected Revenue */}
          <div className="bg-glomalin-bg border border-glomalin-border rounded px-4 py-3">
            <p className="text-xs text-glomalin-muted font-mono mb-1">Projected Revenue</p>
            <p className="text-lg font-mono font-bold text-glomalin-text">
              {formatDollars(result.projectedRevenue)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
