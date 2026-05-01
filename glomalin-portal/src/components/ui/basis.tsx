import { cn } from '@/lib/utils'

interface BasisProps {
  /** Basis value in dollars per bushel (e.g. -0.12 = -12¢ under). */
  value: number
  /** Show ¢/bu suffix. Default true. */
  showUnit?: boolean
  className?: string
}

/**
 * Sign-aware basis display.
 * Positive = green (over CBOT), negative = danger (under CBOT), zero = muted.
 * Always shows explicit sign. Renders in cents.
 */
export function Basis({ value, showUnit = true, className }: BasisProps) {
  const cents = Math.round(value * 100)
  const sign = cents > 0 ? '+' : ''

  const colorClass =
    cents > 0
      ? 'text-glomalin-success'
      : cents < 0
        ? 'text-glomalin-danger'
        : 'text-glomalin-muted'

  return (
    <span className={cn('font-mono tabular-nums', colorClass, className)}>
      {sign}{cents}
      {showUnit && <span className="text-glomalin-muted text-xs">¢</span>}
    </span>
  )
}
