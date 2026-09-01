'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

type StatVariant = 'default' | 'success' | 'warning' | 'danger'

const valueColors: Record<StatVariant, string> = {
  default: 'text-glomalin-bright',
  success: 'text-glomalin-success',
  warning: 'text-glomalin-warning',
  danger:  'text-glomalin-danger',
}

interface StatCardProps {
  label: string
  value: number | string
  sublabel?: string
  delta?: number | string
  deltaLabel?: string
  trend?: 'up' | 'down' | 'flat'
  variant?: StatVariant
  onClick?: () => void
  /** Turns the whole tile into a shortcut. Takes precedence over onClick. */
  href?: string
  /** Affordance shown in the corner of a linked tile. Default: '→' */
  linkHint?: string
  className?: string
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up')   return <span className="text-glomalin-success">↑</span>
  if (trend === 'down') return <span className="text-glomalin-danger">↓</span>
  return <span className="text-glomalin-muted">→</span>
}

export function StatCard({
  label,
  value,
  sublabel,
  delta,
  deltaLabel,
  trend,
  variant = 'default',
  onClick,
  href,
  linkHint = '→',
  className,
}: StatCardProps) {
  const clickable = href != null || onClick != null
  const body = (
    <>
      <p className="text-xs text-glomalin-muted font-sans font-medium uppercase tracking-wider mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        {href && (
          <span className="font-mono text-glomalin-muted/70 group-hover:text-glomalin-accent transition-colors">
            {linkHint}
          </span>
        )}
      </p>
      <p className={cn('text-2xl font-mono font-bold leading-none', valueColors[variant])}>
        {value}
      </p>
      {(delta != null || sublabel) && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {trend && <TrendIcon trend={trend} />}
          {delta != null && (
            <span className="text-xs font-sans text-glomalin-muted">{delta}</span>
          )}
          {deltaLabel && (
            <span className="text-xs font-sans text-glomalin-muted/70">{deltaLabel}</span>
          )}
          {sublabel && !delta && (
            <span className="text-xs font-sans text-glomalin-muted">{sublabel}</span>
          )}
        </div>
      )}
    </>
  )

  const shell = cn(
    'group block bg-glomalin-surface border border-glomalin-border rounded-lg p-4',
    clickable && 'cursor-pointer hover:border-glomalin-accent transition-colors',
    className
  )

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    )
  }

  return (
    <div onClick={onClick} className={shell}>
      {body}
    </div>
  )
}
