import { cn } from '@/lib/utils'

interface EmptyProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function Empty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="text-glomalin-muted text-3xl">{icon}</div>
      )}
      <p className="font-mono text-sm font-medium text-glomalin-text">{title}</p>
      {description && (
        <p className="font-mono text-xs text-glomalin-muted max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-4 py-1.5 rounded border border-glomalin-border text-xs font-mono text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
