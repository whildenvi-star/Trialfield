'use client'

interface StatCardProps {
  label: string
  value: number | string
  sublabel?: string
  variant?: 'default' | 'warning' | 'critical' | 'ok'
  onClick?: () => void
}

const variantConfig = {
  default: {
    stripe:  'bg-glomalin-border-light',
    numeral: 'text-glomalin-text',
    ring:    '',
  },
  warning: {
    stripe:  'bg-amber-400',
    numeral: 'text-amber-300',
    ring:    'shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]',
  },
  critical: {
    stripe:  'bg-red-400',
    numeral: 'text-red-400',
    ring:    'shadow-[inset_0_0_0_1px_rgba(248,113,113,0.18)]',
  },
  ok: {
    stripe:  'bg-glomalin-success',
    numeral: 'text-glomalin-success',
    ring:    '',
  },
}

export function StatCard({ label, value, sublabel, variant = 'default', onClick }: StatCardProps) {
  const clickable = onClick != null
  const cfg = variantConfig[variant]

  return (
    <div
      onClick={onClick}
      className={[
        'relative bg-glomalin-surface border border-glomalin-border rounded-lg overflow-hidden transition-all',
        clickable ? 'cursor-pointer hover:border-glomalin-accent/40 group' : '',
        cfg.ring,
      ].join(' ')}
    >
      {/* Colored top accent stripe */}
      <div className={`h-[2px] w-full ${cfg.stripe}`} />

      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-glomalin-muted leading-none mb-3">
          {label}
        </p>
        <p className={`font-heading text-[2.75rem] font-bold leading-none tracking-tight ${cfg.numeral}`}>
          {value}
        </p>
        {sublabel && (
          <p className="text-[10px] font-mono text-glomalin-muted mt-2 leading-none">{sublabel}</p>
        )}
      </div>

      {clickable && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="font-mono text-xs text-glomalin-muted">→</span>
        </div>
      )}
    </div>
  )
}
