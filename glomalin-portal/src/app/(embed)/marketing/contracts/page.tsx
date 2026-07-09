import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth, fetchBudgetService } from '@/app/api/mobile/_lib/proxy'
import { ContractListClient } from '@/components/marketing/contract-list'
import { CropPositionPanel } from '@/components/marketing/crop-position-panel'
import {
  groupContractsByCommodity,
  buildCropMarketingDataList,
} from '@/lib/marketing/position-by-crop'
import type { RawGrainVariant, BudgetFieldRow } from '@/lib/marketing/position-by-crop'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface BudgetDetailResponse {
  fields?: Array<{
    crop: string
    acres: number
    expPerAcre: number
    yieldPerAcre: number
  }>
}

interface CbotFetchResponse {
  price?: number | null
}

export default async function ContractsEmbedPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/login')

  const { role, accessToken } = ctx

  const [contractsRes, customersRes, variantsRes, budgetRes, cornRes, soyRes, wheatRes] =
    await Promise.allSettled([
      fetchCertServiceWithAuth('/api/marketing/contracts', accessToken),
      fetchCertServiceWithAuth('/api/marketing/customers?dropdown=true', accessToken),
      fetchCertServiceWithAuth('/api/marketing/grain-variants', accessToken),
      fetchBudgetService('/api/budget-field-details'),
      fetchBudgetService('/api/cbot-fetch?symbol=ZC'),
      fetchBudgetService('/api/cbot-fetch?symbol=ZS'),
      fetchBudgetService('/api/cbot-fetch?symbol=ZW'),
    ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawContracts: any[] =
    contractsRes.status === 'fulfilled' && contractsRes.value.ok
      ? ((await contractsRes.value.json()) as { cropYear: number; variant?: { id: string; name: string } | null }[])
          .filter((c) => c.cropYear === CURRENT_CROP_YEAR)
      : []

  const customers =
    customersRes.status === 'fulfilled' && customersRes.value.ok
      ? await customersRes.value.json()
      : []

  const variants: RawGrainVariant[] =
    variantsRes.status === 'fulfilled' && variantsRes.value.ok
      ? await variantsRes.value.json()
      : []

  let budgetFields: BudgetFieldRow[] = []
  if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
    const bData = (await budgetRes.value.json()) as BudgetDetailResponse
    budgetFields = (bData.fields ?? []).filter((f) => f.acres > 0 && f.yieldPerAcre > 0)
  }

  async function parseCbot(res: PromiseSettledResult<Response>): Promise<number | null> {
    if (res.status !== 'fulfilled' || !res.value.ok) return null
    const d = (await res.value.json()) as CbotFetchResponse
    return d.price ?? null
  }

  const cornPrice = await parseCbot(cornRes)
  const soyPrice = await parseCbot(soyRes)
  const wheatPrice = await parseCbot(wheatRes)

  const cbotPricesBySymbol: Record<string, number | null> = {
    C: cornPrice,
    S: soyPrice,
    W: wheatPrice,
  }

  const groups = groupContractsByCommodity(rawContracts, variants)
  const crops = buildCropMarketingDataList(groups, budgetFields, cbotPricesBySymbol)

  return (
    <div className="p-4 space-y-5">
      <CropPositionPanel crops={crops} role={role} />
      <ContractListClient
        contracts={rawContracts}
        customers={customers}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variants={variants as any}
        role={role}
      />
    </div>
  )
}
