'use client'

interface StatCardProps {
  label: string
  value: number | string
  sublabel?: string
  variant?: 'default' | 'warning' | 'critical' | 'ok'
  onClick?: () => void
}

const variantColors: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'text-glomalin-text',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  ok: 'text-green-400',
}

export function StatCard({
  label,
  value,
  sublabel,
  variant = 'default',
  onClick,
}: StatCardProps) {
  const clickable = onClick != null
  return (
    <div
      onClick={onClick}
      className={[
        'bg-glomalin-surface border border-glomalin-border rounded-lg p-4',
        clickable
          ? 'cursor-pointer hover:border-glomalin-accent transition-colors'
          : '',
      ]
        .join(' ')
        .trim()}
    >
      <p className="text-xs text-glomalin-muted font-mono uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-mono font-bold mt-1 ${variantColors[variant]}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-glomalin-muted mt-1 font-mono">{sublabel}</p>
      )}
    </div>
  )
}
