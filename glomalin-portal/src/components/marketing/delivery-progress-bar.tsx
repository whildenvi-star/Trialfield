import { formatBu } from '@/lib/fmt'

interface DeliveryProgressBarProps {
  applied: number
  contracted: number
}

export function DeliveryProgressBar({ applied, contracted }: DeliveryProgressBarProps) {
  const pct = contracted > 0 ? Math.min(100, Math.round((applied / contracted) * 100)) : 0

  const fillColor =
    pct >= 100
      ? 'bg-glomalin-warning'
      : pct >= 80
        ? 'bg-glomalin-success'
        : 'bg-glomalin-info'

  return (
    <div>
      <div className="w-full h-1.5 rounded-full bg-glomalin-border/50">
        <div
          className={`h-full rounded-full ${fillColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-glomalin-muted mt-0.5 block">
        {formatBu(applied)} / {formatBu(contracted)}
      </span>
    </div>
  )
}
