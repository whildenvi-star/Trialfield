import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Buttons and controls rendered to the right of the title */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold text-glomalin-bright leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 font-mono text-xs text-glomalin-muted">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-0.5">{actions}</div>
      )}
    </div>
  )
}
