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
    if (res.status === 404) {
      throw new Error('Contract not found')
    }
    if (res.status === 403) {
      throw new Error('You do not have access to this contract')
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load settlements (${res.status})`)
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
