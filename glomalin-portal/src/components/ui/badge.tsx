import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  // Confidence tiers
  | 'confident'
  | 'inferred'
  | 'manual'
  | 'unverified'

const variantClasses: Record<BadgeVariant, string> = {
  default:    'bg-glomalin-border/50 text-glomalin-text border-glomalin-border',
  accent:     'bg-glomalin-accent/15 text-glomalin-accent border-glomalin-accent/30',
  success:    'bg-glomalin-success/15 text-glomalin-success border-glomalin-success/30',
  warning:    'bg-glomalin-warning/15 text-glomalin-warning border-glomalin-warning/30',
  danger:     'bg-glomalin-danger/15 text-glomalin-danger border-glomalin-danger/30',
  info:       'bg-glomalin-info/15 text-glomalin-info border-glomalin-info/30',
  // Confidence tiers
  confident:  'bg-glomalin-tier-confident/15 text-glomalin-tier-confident border-glomalin-tier-confident/30',
  inferred:   'bg-glomalin-tier-inferred/15 text-glomalin-tier-inferred border-glomalin-tier-inferred/30',
  manual:     'bg-glomalin-tier-manual/15 text-glomalin-tier-manual border-glomalin-tier-manual/30',
  unverified: 'bg-glomalin-tier-unverified/15 text-glomalin-tier-unverified border-glomalin-tier-unverified/30',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

export function Badge({ variant = 'default', size = 'sm', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border font-mono font-medium leading-none',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

/** Convenience: renders the confidence tier label as a styled badge */
export function ConfidenceBadge({
  tier,
  className,
}: {
  tier: 'CONFIDENT' | 'INFERRED' | 'MANUAL' | 'UNVERIFIED'
  className?: string
}) {
  const map: Record<string, BadgeVariant> = {
    CONFIDENT: 'confident',
    INFERRED: 'inferred',
    MANUAL: 'manual',
    UNVERIFIED: 'unverified',
  }
  return (
    <Badge variant={map[tier]} className={className}>
      {tier}
    </Badge>
  )
}
