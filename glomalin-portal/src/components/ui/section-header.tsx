import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
      <div>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-glomalin-muted">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 font-mono text-xs text-glomalin-muted/70">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
