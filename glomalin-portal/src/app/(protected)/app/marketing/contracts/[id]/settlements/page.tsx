import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { SettlementsClient } from '@/components/marketing/settlements-client'

export default async function ContractSettlementsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { accessToken } = ctx
  const { id } = await params

  const res = await fetchCertServiceWithAuth('/api/marketing/contracts/' + id + '/settlements', accessToken)

  if (!res.ok) {
    throw new Error('Contract not found')
  }

  const { contract, settlements, reconciliation } = await res.json()

  return (
    <SettlementsClient
      contractId={id}
      contract={contract}
      settlements={settlements}
      reconciliation={reconciliation}
    />
  )
}
