import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { formatBu, formatUsd, formatPricePerBu, formatPct } from '@/lib/fmt'
import type { PositionSummary } from '@/lib/marketing/position'

export interface CopSummary {
  expPerAcre: number
  yieldPerAcre: number
  totalAcres: number
}

interface ContractsKpiStripProps {
  position: PositionSummary
  cop: CopSummary | null
  cbotPrices: { corn: number | null; soy: number | null }
  role: string
}

export function ContractsKpiStrip({ position, cop, cbotPrices, role }: ContractsKpiStripProps) {
  const isOwner = role === 'owner'
  const pricedPct = position.contractedBu > 0 ? position.pricedBu / position.contractedBu : 0
  const wapPerBu = position.avgPriceCents > 0 ? position.avgPriceCents / 100 : null

  const copPerBu = cop && cop.yieldPerAcre > 0 ? cop.expPerAcre / cop.yieldPerAcre : null
  const totalInputCost = cop ? cop.expPerAcre * cop.totalAcres : null
  const cbotRef = cbotPrices.corn ?? wapPerBu
  const unpricedExposure = position.openBu > 0 && cbotRef != null ? position.openBu * cbotRef : null

  const basisImplied =
    wapPerBu != null && cbotPrices.corn != null ? wapPerBu - cbotPrices.corn : null

  return (
    <div className="space-y-3">
      {/* Row 1: Position */}
      <KpiStrip cols={4}>
        <StatCard
          label="CONTRACTED"
          value={formatBu(position.contractedBu)}
          sublabel="this crop year"
        />
        <StatCard
          label="PRICED"
          value={formatBu(position.pricedBu)}
          sublabel={formatPct(pricedPct) + ' of contracted'}
        />
        <StatCard
          label="UNPRICED"
          value={formatBu(position.openBu)}
          sublabel="exposure"
          variant={position.openBu > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="WEIGHTED AVG PRICE"
          value={wapPerBu != null ? formatPricePerBu(wapPerBu) : '—'}
          sublabel="blended cash"
        />
      </KpiStrip>

      {/* Row 2: Economics — owner only */}
      {isOwner && (
        <KpiStrip cols={4}>
          <StatCard
            label="COST / ACRE"
            value={cop ? formatUsd(cop.expPerAcre) : '—'}
            sublabel="budgeted"
          />
          <StatCard
            label="COST / BU"
            value={copPerBu != null ? formatPricePerBu(copPerBu) : '—'}
            sublabel="at proj. yield"
          />
          <StatCard
            label="BREAK-EVEN"
            value={copPerBu != null ? formatPricePerBu(copPerBu) : '—'}
            sublabel="at proj. yield"
            variant={
              wapPerBu != null && copPerBu != null
                ? wapPerBu >= copPerBu
                  ? 'success'
                  : 'warning'
                : 'default'
            }
          />
          <StatCard
            label="UNPRICED EXPOSURE"
            value={unpricedExposure != null ? formatUsd(unpricedExposure) : '—'}
            sublabel={cbotPrices.corn != null ? 'at CBOT corn ref.' : 'at WAP ref.'}
            variant={unpricedExposure != null && unpricedExposure > 50000 ? 'warning' : 'default'}
          />
        </KpiStrip>
      )}

      {/* Row 3: Market reference */}
      <KpiStrip cols={4}>
        <StatCard
          label="CORN FUTURES"
          value={cbotPrices.corn != null ? formatPricePerBu(cbotPrices.corn) : '—'}
          sublabel="ZC nearby · CBOT"
        />
        <StatCard
          label="SOY FUTURES"
          value={cbotPrices.soy != null ? formatPricePerBu(cbotPrices.soy) : '—'}
          sublabel="ZS nearby · CBOT"
        />
        {isOwner && (
          <StatCard
            label="BASIS IMPLIED"
            value={
              basisImplied != null
                ? (basisImplied >= 0 ? '+' : '') + formatPricePerBu(basisImplied)
                : '—'
            }
            sublabel="WAP vs corn futures"
            variant={
              basisImplied != null
                ? basisImplied >= 0
                  ? 'success'
                  : 'warning'
                : 'default'
            }
          />
        )}
        {isOwner && totalInputCost != null && (
          <StatCard
            label="TOTAL BUDGETED COST"
            value={formatUsd(totalInputCost)}
            sublabel={`${cop ? Math.round(cop.totalAcres).toLocaleString() : '?'} acres`}
          />
        )}
      </KpiStrip>
    </div>
  )
}
