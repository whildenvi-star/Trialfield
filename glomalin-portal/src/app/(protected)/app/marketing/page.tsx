import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { computePosition } from '@/lib/marketing/position'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { PageHeader } from '@/components/ui/page-header'
import { SectionHeader } from '@/components/ui/section-header'
import { YearSelector } from '@/components/ui/year-selector'
import { PositionStrip } from '@/components/marketing/position-strip'
import { ContractTable } from '@/components/marketing/contract-table'
import { BasisExposurePanel } from '@/components/marketing/basis-exposure-panel'
import { ReconQueue } from '@/components/marketing/recon-queue'

interface GrainContractRow {
  id: string
  instrument: 'PRICED' | 'SPOT' | 'FOB' | 'PRICED_LATER' | 'BASIS_FIXED' | 'FUTURES_FIXED' | 'MIN_PRICE' | 'ACCUMULATOR'
  contractedBushels: number
  appliedBushels: number
  futuresPrice?: number | null
  basis?: number | null
  finalCashPrice?: number | null
  cropYear: number
  deliveryStart?: string | null
  deliveryEnd?: string | null
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

  const [contractsRes, deliveriesRes] = await Promise.allSettled([
    fetchCertServiceWithAuth(
      `/api/marketing/grain-contracts?year=${cropYear}`,
      accessToken
    ),
    fetchCertServiceWithAuth(
      `/api/marketing/grain-deliveries?year=${cropYear}&unmatched=true`,
      accessToken
    ),
  ])

  if (contractsRes.status === 'fulfilled' && contractsRes.value.ok) {
    const data = await contractsRes.value.json() as { contracts?: GrainContractRow[] }
    contracts = data.contracts ?? []
  } else {
    contractsError = true
  }

  if (deliveriesRes.status === 'fulfilled' && deliveriesRes.value.ok) {
    const data = await deliveriesRes.value.json() as { deliveries?: GrainDeliveryRow[] }
    deliveries = data.deliveries ?? []
  } else {
    deliveriesError = true
  }

  const positionData = isOwner ? computePosition(contracts) : null

  const unPricedContracts = isOwner
    ? contracts.filter(c =>
        (c.instrument === 'FUTURES_FIXED' && (c.futuresPrice == null)) ||
        (c.instrument === 'BASIS_FIXED' && (c.basis == null))
      )
    : []

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <PageHeader
        title="Marketing Command Center"
        subtitle={`${cropYear} crop year`}
        actions={<YearSelector currentYear={cropYear} />}
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

      {/* Position strip — owner only, server-side gate */}
      {isOwner && positionData && (
        <PositionStrip data={positionData} cropYear={cropYear} />
      )}

      {/* Contract table */}
      <div>
        <SectionHeader
          title="Contracts"
          actions={
            <a
              href="/app/marketing/contracts/new"
              className="px-3 py-1.5 rounded border border-glomalin-border text-xs font-mono text-glomalin-muted hover:border-glomalin-accent hover:text-glomalin-accent transition-colors"
            >
              New Contract
            </a>
          }
        />
        <ContractTable contracts={contracts} role={role} cropYear={cropYear} />
      </div>

      {/* Lower section: two-column for owner, single-column for office */}
      <div className={isOwner ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'grid grid-cols-1'}>
        {isOwner && <BasisExposurePanel contracts={unPricedContracts} />}
        <ReconQueue deliveries={deliveries} />
      </div>
    </div>
  )
}
