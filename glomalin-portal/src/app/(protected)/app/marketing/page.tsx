import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { PageHeader } from '@/components/ui/page-header'
import { YearSelector } from '@/components/ui/year-selector'
import { KpiStrip } from '@/components/ui/kpi-strip'
import { StatCard } from '@/components/ui/stat-card'
import { formatBu, formatUsd } from '@/lib/fmt'
import { PricedBreakdownCards } from '@/components/marketing/priced-breakdown-cards'
import { CropPoolCards } from '@/components/marketing/crop-pool-cards'
import { BasisExposurePanel } from '@/components/marketing/basis-exposure-panel'
import { ReconQueue } from '@/components/marketing/recon-queue'
import { EnterprisePositionTable } from '@/components/marketing/enterprise-position-table'
import { loadEnterpriseData } from '@/lib/marketing/load-enterprise-data'
import type { CommodityRollupRow, OfficeCommodityRollupRow } from '@/lib/marketing/enterprise-rollup'

interface GrainContractRow {
  id: string
  instrument: 'PRICED' | 'SPOT' | 'FOB' | 'PRICED_LATER' | 'BASIS_FIXED' | 'FUTURES_FIXED' | 'MIN_PRICE' | 'ACCUMULATOR'
  contractedBushels: number
  buyerTakesAll?: boolean
  appliedBushels: number
  futuresPrice?: number | null
  basis?: number | null
  finalCashPrice?: number | null
  cropYear: number
  deliveryStart?: string | null
  deliveryEnd?: string | null
  // No contract-number column exists on GrainContract — imports tag the buyer's
  // number into `notes` as "Buyer #NUMBER" and the pool-card drilldown reads it
  // back out of there.
  location?: string | null
  notes?: string | null
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'
}

interface GrainDeliveryRow {
  id: string
  deliveryDate: string
  netBushels: number
  unappliedBushels: number
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
}

// Farm-wide totals for the summary strip — FUTURES rows only. Organics &
// specialty (tracking tier) never blend into the numbers selling decisions
// are made against. Office rows have financial keys omitted — exposure
// comes back null there.
function farmSummary(rows: Array<CommodityRollupRow | OfficeCommodityRollupRow>, isOwner: boolean) {
  let projectedBu = 0
  let pricedBu = 0
  let soldBu = 0
  let exposure: number | null = isOwner ? 0 : null
  for (const row of rows) {
    if (row.tier !== 'futures') continue
    pricedBu += row.pricedBu
    soldBu += row.soldBu
    if (row.projectedBu != null) {
      projectedBu += row.projectedBu
      if (isOwner && exposure != null) {
        const cbot = (row as CommodityRollupRow).cbotPriceDollars
        if (cbot != null) {
          exposure += Math.max(0, row.projectedBu - row.pricedBu) * cbot
        }
      }
    }
  }
  return {
    projectedBu,
    pricedBu,
    soldBu,
    pctPriced: projectedBu > 0 ? pricedBu / projectedBu : null,
    exposure,
  }
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const cropYear = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')
  const { role, accessToken } = ctx
  const isOwner = role === 'owner'

  let contracts: GrainContractRow[] = []
  let deliveries: GrainDeliveryRow[] = []
  let contractsError = false
  let deliveriesError = false

  // Phase 13/14 routes return bare arrays and are named `contracts` / `deliveries`
  // (not grain-*). Contracts are not year-filtered server-side, so filter by cropYear
  // here. Deliveries use ?unreconciled=true and are intentionally NOT year-filtered —
  // an unmatched delivery must stay in the recon queue regardless of the year selector.
  const [contractsRes, deliveriesRes] = await Promise.allSettled([
    fetchCertServiceWithAuth(
      `/api/marketing/contracts`,
      accessToken
    ),
    fetchCertServiceWithAuth(
      `/api/marketing/deliveries?unreconciled=true`,
      accessToken
    ),
  ])

  if (contractsRes.status === 'fulfilled' && contractsRes.value.ok) {
    // Backend columns are deliveryStartDate/deliveryEndDate; BasisExposurePanel
    // reads deliveryStart/deliveryEnd — normalize here.
    const data = await contractsRes.value.json() as (GrainContractRow & {
      deliveryStartDate?: string | null
      deliveryEndDate?: string | null
    })[]
    contracts = (Array.isArray(data) ? data : [])
      .filter((c) => c.cropYear === cropYear)
      .map((c) => ({
        ...c,
        deliveryStart: c.deliveryStart ?? c.deliveryStartDate ?? null,
        deliveryEnd: c.deliveryEnd ?? c.deliveryEndDate ?? null,
      }))
  } else {
    contractsError = true
  }

  if (deliveriesRes.status === 'fulfilled' && deliveriesRes.value.ok) {
    const data = await deliveriesRes.value.json() as GrainDeliveryRow[]
    deliveries = Array.isArray(data) ? data : []
  } else {
    deliveriesError = true
  }

  // Enterprise rollup — pooled marketing position joined to crop plan, actuals,
  // and live CBOT. Degrades to volumes-only when budget/tickets are offline;
  // RBAC is payload-level inside the loader.
  const enterprise = await loadEnterpriseData(accessToken, role, cropYear)
  const summary = farmSummary(enterprise.rows, enterprise.isOwner)
  const activeContracts = contracts.filter((c) => c.status !== 'CANCELLED')

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <PageHeader
        title="Marketing Command Center"
        subtitle={`${cropYear} crop year`}
        actions={
          <div className="flex items-center gap-3">
            <a
              href="/app/marketing/contracts?new=1"
              className="px-3 py-1.5 rounded border border-glomalin-border text-xs font-mono text-glomalin-muted hover:border-glomalin-accent hover:text-glomalin-accent transition-colors"
            >
              New Contract
            </a>
            <YearSelector
              currentYear={cropYear}
              // Forward-looking: you market up to a year ahead ("this year and next"),
              // plus last year for reference. Default selector only looked backward.
              availableYears={[
                CURRENT_CROP_YEAR + 1,
                CURRENT_CROP_YEAR,
                CURRENT_CROP_YEAR - 1,
              ]}
            />
          </div>
        }
      />

      {/* Error banners — shown when organic-cert routes are not yet built or offline */}
      {contractsError && (
        <div className="px-4 py-3 bg-glomalin-warning/10 border border-glomalin-warning/30 text-glomalin-warning text-sm rounded">
          Unable to load contracts — refresh to retry.
        </div>
      )}
      {deliveriesError && (
        <div className="px-4 py-3 bg-glomalin-warning/10 border border-glomalin-warning/30 text-glomalin-warning text-sm rounded">
          Unable to load deliveries — refresh to retry.
        </div>
      )}

      {/* Priced position, broken out per crop — the farm-wide number stays the
          headline, but "62% priced" is useless without knowing WHICH crop is
          still open, so each commodity gets its glyph and its own bar. */}
      <PricedBreakdownCards
        rows={enterprise.rows}
        totalProjectedBu={summary.projectedBu}
        totalPricedBu={summary.pricedBu}
        totalSoldBu={summary.soldBu}
      />

      {/* Farm summary strip — mirrors the macro-rollup hedging dashboard strip */}
      <KpiStrip cols={2}>
        {enterprise.isOwner && summary.exposure != null ? (
          <StatCard
            label="UNPRICED EXPOSURE"
            value={formatUsd(summary.exposure)}
            sublabel="unpriced bu × today's CBOT"
            variant={summary.exposure > 500_000 ? 'warning' : 'default'}
          />
        ) : (
          <StatCard
            label="PROJECTED BUSHELS"
            value={formatBu(Math.round(summary.projectedBu))}
            sublabel="futures crops · from crop plan"
            variant="default"
          />
        )}
        <StatCard
          label="CONTRACTS"
          value={activeContracts.length}
          sublabel={`${cropYear} crop year · open the contract list`}
          variant="default"
          href="/app/marketing/contracts"
        />
      </KpiStrip>

      {/* Pool cards — one per commodity, the layout carried over from the
          macro-rollup Sales & Marketing tab it replaces */}
      <CropPoolCards
        rows={enterprise.rows}
        isOwner={enterprise.isOwner}
        contracts={contracts}
      />

      {/* Full detail table (variant rows, COP, what-if) — collapsed by default */}
      <EnterprisePositionTable
        rows={enterprise.rows}
        isOwner={enterprise.isOwner}
        cropYear={cropYear}
        notes={enterprise.notes}
        defaultOpen={false}
      />

      {/* Lower section: two-column for owner, single-column for office */}
      <div className={isOwner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'grid grid-cols-1'}>
        {isOwner && <BasisExposurePanel contracts={contracts} />}
        <ReconQueue deliveries={deliveries} />
      </div>
    </div>
  )
}
