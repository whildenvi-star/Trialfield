import { cn } from '@/lib/utils'
import { formatUsd, formatUsdCents } from '@/lib/fmt'

interface MoneyProps {
  value: number
  /** Show cents (2 decimal places). Default false. */
  cents?: boolean
  /** Show explicit + sign for positive values. Default false. */
  showSign?: boolean
  /** How to render zero. 'muted' renders in muted color. Default 'muted'. */
  zero?: 'muted' | 'neutral'
  className?: string
}

/**
 * Sign-aware currency display.
 * Green for positive, red/coral for negative, muted for zero.
 */
export function Money({ value, cents = false, showSign = false, zero = 'muted', className }: MoneyProps) {
  const formatted = cents ? formatUsdCents(Math.abs(value)) : formatUsd(Math.abs(value))
  const sign = value > 0 ? (showSign ? '+' : '') : value < 0 ? '-' : ''

  const colorClass =
    value > 0
      ? 'text-glomalin-success'
      : value < 0
        ? 'text-glomalin-danger'
        : zero === 'muted'
          ? 'text-glomalin-muted'
          : 'text-glomalin-text'

  return (
    <span className={cn('font-mono tabular-nums', colorClass, className)}>
      {sign}{formatted}
    </span>
  )
}

interface MoneyPerAcreProps extends Omit<MoneyProps, 'cents'> {
  /** Render as $/ac inline label */
  perAcre?: boolean
}

/** Convenience: Money with optional /ac suffix */
export function MoneyPerAcre({ perAcre, className, ...props }: MoneyPerAcreProps) {
  return (
    <span className={cn('inline-flex items-baseline gap-0.5', className)}>
      <Money cents {...props} />
      {perAcre && (
        <span className="text-glomalin-muted text-xs">/ac</span>
      )}
    </span>
  )
}
