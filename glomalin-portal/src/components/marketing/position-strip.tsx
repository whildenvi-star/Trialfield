import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { formatBu, formatUsdCents, formatPct } from '@/lib/fmt'
import type { PositionSummary } from '@/lib/marketing/position'

const EM_DASH = '—'

interface PositionStripProps {
  data: PositionSummary
  cropYear: number
}

export function PositionStrip({ data, cropYear }: PositionStripProps) {
  const pricedPct = data.contractedBu > 0 ? data.pricedBu / data.contractedBu : 0

  return (
    <KpiStrip cols={4}>
      <StatCard
        label="CONTRACTED"
        value={formatBu(data.contractedBu)}
        sublabel={`${cropYear} crop year`}
        variant="default"
      />
      <StatCard
        label="PRICED"
        value={formatBu(data.pricedBu)}
        sublabel={formatPct(pricedPct) + ' of contracted'}
        variant="default"
      />
      <StatCard
        label="OPEN / UNPRICED"
        value={formatBu(data.openBu)}
        sublabel="exposure"
        variant="warning"
      />
      <StatCard
        label="EST. AVG PRICE"
        value={data.avgPriceCents > 0 ? formatUsdCents(data.avgPriceCents / 100) : EM_DASH}
        sublabel="blended cash"
        variant="default"
      />
    </KpiStrip>
  )
}
